#Requires -Version 7.0
<#
.SYNOPSIS
    Installs, updates, rolls back, or removes the machine-wide AgentKit checkout at
    ~/.agent-kit and links its skills into every detected AI tool's personal skills folder.

.DESCRIPTION
    Per reports/2026-09-14-home-install-plan.md, phase 2: one script replaces per-repo
    copies of the kit with a single git checkout at $env:AGENTKIT_HOME (default
    $HOME/.agent-kit), version-pinned by tag, branch or sha, linked into each tool's
    personal skills folder with a Windows directory junction so nothing goes stale
    between updates.

    Codex is the documented exception (phase 0 findings): tools/Invoke-CodexCommand.ps1
    reads skills/<name>/SKILL.md from the install root directly and does not rely on
    Codex's own skill discovery, so no junctions are created under ~/.codex/skills for
    AgentKit skills. Codex still needs $env:AGENTKIT_HOME set (or the default
    $HOME/.agent-kit to exist) for that launcher to find the install; this script does
    not set process-wide environment variables, since a child PowerShell process cannot
    persist one into the user's shell profile without side effects this script has no
    business taking silently.

    Every link this script creates is recorded in a manifest outside the checkout
    ($HOME/.agent-kit-state/installed.json), and -Uninstall (or a version change) only
    ever removes links this script itself created. A same-named folder it did not create
    is left alone with a warning, the way gstack protects a user's own skills.

.PARAMETER Version
    Tag, branch or commit to check out. Defaults to the highest tag reachable from the
    remote (by creation date), falling back to the default branch head if the remote has
    no tags.

.PARAMETER Source
    Git URL or local path to clone/fetch from. Defaults to the origin already recorded
    in the manifest from a prior install; required on a first install with no existing
    checkout to read a recorded source from. A local path is how unreleased work is
    tested (INSTALL.md's phase 2 "testing unreleased work" case).

.PARAMETER Hosts
    Which tools to link skills into: claude, codex, copilot. Defaults to auto-detecting
    which of ~/.claude, ~/.codex, ~/.copilot exist. Codex is accepted for symmetry but
    never receives skill junctions - see DESCRIPTION.

.PARAMETER Prefix
    Optional prefix for every linked skill's folder name, e.g. -Prefix ak- installs
    /ak-slice instead of /slice. Guards against a future name clash; unset by default
    since the phase 0 clash check found none on this machine.

.PARAMETER DryRun
    Print what would change - clone/fetch, checkout, links, hook edits, pointer blocks -
    without writing anything.

.PARAMETER Uninstall
    Remove every link, hook entry and pointer block this script's manifest says it
    created, then clear the manifest. The checkout at the install root is left in place
    unless -Force is also given, since deleting a git repository is the more destructive
    of the two and warrants the explicit flag on its own.

.PARAMETER Force
    Required for anything destructive: adopting an existing ~/.agent-kit clone that has
    uncommitted changes (they are discarded via checkout -f / clean -fd), and deleting
    the checkout itself during -Uninstall.

.EXAMPLE
    ./tools/Install-AgentKit.ps1 -Source https://github.com/you/SubZeroDev.AgentKit.git
    First install: clone, pick the latest tag, link skills into every detected tool.

.EXAMPLE
    ./tools/Install-AgentKit.ps1 -Version v2026.09.20
    Update an existing install to a specific tag.

.EXAMPLE
    ./tools/Install-AgentKit.ps1 -Source D:\Dropbox\Projects\SubZeroDev.AgentKit -Version my-branch
    Point the install at a local working branch to test unreleased kit changes.

.EXAMPLE
    ./tools/Install-AgentKit.ps1 -Uninstall
    Remove every link, hook and pointer block this script created. Leaves the checkout.
#>
[CmdletBinding()]
param(
    [string] $Version,
    [string] $Source,
    [ValidateSet('claude', 'codex', 'copilot')]
    [string[]] $Hosts,
    [string] $Prefix = '',
    [switch] $DryRun,
    [switch] $Uninstall,
    [switch] $Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- Paths -------------------------------------------------------------------------

function Get-InstallRoot {
    if ($env:AGENTKIT_HOME) { return $env:AGENTKIT_HOME }
    return (Join-Path $HOME '.agent-kit')
}

function Get-StateDir {
    # Deliberately not inside the checkout: a `git clean` or a version rollback must never
    # touch the manifest that says what this machine's tools currently link to.
    return (Join-Path $HOME '.agent-kit-state')
}

function Get-ManifestPath {
    return (Join-Path (Get-StateDir) 'installed.json')
}

$script:InstallRoot = Get-InstallRoot
$script:ManifestPath = Get-ManifestPath

# --- Manifest ------------------------------------------------------------------------

function New-EmptyManifest {
    [ordered]@{
        version       = $null
        source        = $null
        installedAt   = $null
        hosts         = [ordered]@{}
        hooksManaged  = $false
        pointers      = [ordered]@{}
    }
}

function Read-Manifest {
    if (-not (Test-Path -LiteralPath $script:ManifestPath)) {
        return New-EmptyManifest
    }
    $raw = Get-Content -LiteralPath $script:ManifestPath -Raw | ConvertFrom-Json
    # Normalise to hashtables so callers can add/remove keys freely regardless of what
    # ConvertFrom-Json produced (PSCustomObject for an empty {} vs ordered dict otherwise).
    $manifest = New-EmptyManifest
    foreach ($prop in @('version', 'source', 'installedAt', 'hooksManaged')) {
        if ($raw.PSObject.Properties.Name -contains $prop) {
            $manifest.$prop = $raw.$prop
        }
    }
    foreach ($section in @('hosts', 'pointers')) {
        $target = [ordered]@{}
        if ($raw.PSObject.Properties.Name -contains $section -and $raw.$section) {
            foreach ($p in $raw.$section.PSObject.Properties) {
                $target[$p.Name] = $p.Value
            }
        }
        $manifest.$section = $target
    }
    return $manifest
}

function Write-Manifest {
    param([Parameter(Mandatory)] $Manifest)
    if ($script:DryRunActive) { return }
    $stateDir = Get-StateDir
    if (-not (Test-Path -LiteralPath $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    }
    $json = ConvertTo-Json -InputObject $Manifest -Depth 10
    Set-Content -LiteralPath $script:ManifestPath -Value $json -NoNewline
}

$script:DryRunActive = [bool]$DryRun

function Write-Plan {
    param([string] $Message)
    if ($script:DryRunActive) {
        Write-Host "[DryRun] $Message"
    } else {
        Write-Host $Message
    }
}

# --- Git plumbing ----------------------------------------------------------------------

function Invoke-Git {
    param([string[]] $GitArgs, [string] $WorkingDir)
    $result = & git -C $WorkingDir @GitArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed in '$WorkingDir': $result"
    }
    return $result
}

function Test-CleanWorkingTree {
    param([string] $RepoPath)
    $status = & git -C $RepoPath status --porcelain 2>&1
    return [string]::IsNullOrWhiteSpace(($status -join "`n"))
}

function Resolve-LatestTag {
    param([string] $RepoPath)
    $tags = & git -C $RepoPath tag --sort=-creatordate 2>&1
    if ($LASTEXITCODE -ne 0 -or -not $tags) { return $null }
    return @($tags)[0]
}

function Get-DefaultBranchHead {
    param([string] $RepoPath)
    $head = & git -C $RepoPath symbolic-ref refs/remotes/origin/HEAD 2>&1
    if ($LASTEXITCODE -eq 0 -and $head) {
        return ($head -replace '^refs/remotes/origin/', '')
    }
    return 'main'
}

function Sync-KitCheckout {
    param([string] $InstallRoot, [string] $Source, [string] $RequestedVersion)

    $exists = Test-Path -LiteralPath (Join-Path $InstallRoot '.git')

    if (-not $exists) {
        if (-not $Source) {
            throw "No checkout at '$InstallRoot' and no -Source given. Pass -Source <git url or local path> for the first install."
        }
        Write-Plan "Clone '$Source' into '$InstallRoot'."
        if (-not $script:DryRunActive) {
            New-Item -ItemType Directory -Path (Split-Path -Parent $InstallRoot) -Force | Out-Null
            $null = Invoke-Git -GitArgs @('clone', $Source, $InstallRoot) -WorkingDir (Split-Path -Parent $InstallRoot)
        }
    } else {
        $currentOrigin = (& git -C $InstallRoot remote get-url origin 2>&1)
        if ($Source -and $LASTEXITCODE -eq 0 -and $currentOrigin -and ($currentOrigin -ne $Source)) {
            Write-Warning "Existing checkout at '$InstallRoot' has origin '$currentOrigin', not the requested -Source '$Source'. Using the existing origin; pass -Force to re-point it."
            if ($Force) {
                Write-Plan "Re-point origin to '$Source'."
                if (-not $script:DryRunActive) { $null = Invoke-Git -GitArgs @('remote', 'set-url', 'origin', $Source) -WorkingDir $InstallRoot }
            }
        }
        if (-not (Test-CleanWorkingTree -RepoPath $InstallRoot)) {
            if (-not $Force) {
                throw "'$InstallRoot' has uncommitted changes. Commit, stash, or re-run with -Force to discard them."
            }
            Write-Plan "Discard uncommitted changes in '$InstallRoot' (-Force)."
            if (-not $script:DryRunActive) {
                $null = Invoke-Git -GitArgs @('checkout', '-f') -WorkingDir $InstallRoot
                $null = Invoke-Git -GitArgs @('clean', '-fd') -WorkingDir $InstallRoot
            }
        }
        Write-Plan "Fetch '$InstallRoot' (tags and branches)."
        if (-not $script:DryRunActive) {
            $null = Invoke-Git -GitArgs @('fetch', '--all', '--tags', '--prune') -WorkingDir $InstallRoot
        }
    }

    $version = $RequestedVersion
    if (-not $version) {
        # A DryRun on a fresh clone can't resolve tags without the clone existing yet;
        # report the fallback rule instead of a concrete answer in that one case.
        if ($script:DryRunActive -and -not $exists) {
            Write-Plan "Version not given: would resolve to the highest tag, else the default branch."
            return $null
        }
        $version = Resolve-LatestTag -RepoPath $InstallRoot
        if (-not $version) {
            $version = Get-DefaultBranchHead -RepoPath $InstallRoot
        }
    }

    Write-Plan "Check out '$version' in '$InstallRoot'."
    if (-not $script:DryRunActive) {
        $null = Invoke-Git -GitArgs @('checkout', $version) -WorkingDir $InstallRoot
        # A branch checkout should track the remote's tip, not whatever the local ref last had.
        & git -C $InstallRoot show-ref --verify --quiet "refs/remotes/origin/$version"
        $isBranch = ($LASTEXITCODE -eq 0)
        $global:LASTEXITCODE = 0
        if ($isBranch) {
            $null = Invoke-Git -GitArgs @('reset', '--hard', "origin/$version") -WorkingDir $InstallRoot
        }
    }

    return $version
}

# --- Host detection and skills -----------------------------------------------------------

function Get-HostSkillsDir {
    param([string] $HostName)
    switch ($HostName) {
        'claude' { return (Join-Path $HOME '.claude/skills') }
        'codex' { return (Join-Path $HOME '.codex/skills') }
        'copilot' { return (Join-Path $HOME '.copilot/skills') }
    }
}

function Get-HostRulesFile {
    param([string] $HostName)
    switch ($HostName) {
        'claude' { return (Join-Path $HOME '.claude/CLAUDE.md') }
        'codex' { return (Join-Path $HOME '.codex/AGENTS.md') }
        'copilot' { return (Join-Path $HOME '.copilot/copilot-instructions.md') }
    }
}

function Get-DetectedHosts {
    $found = [System.Collections.Generic.List[string]]::new()
    if (Test-Path -LiteralPath (Join-Path $HOME '.claude')) { $found.Add('claude') }
    if (Test-Path -LiteralPath (Join-Path $HOME '.codex')) { $found.Add('codex') }
    if ((Test-Path -LiteralPath (Join-Path $HOME '.copilot')) -or (Test-Path -LiteralPath (Join-Path $HOME '.agents'))) { $found.Add('copilot') }
    return $found
}

function Get-KitSkillNames {
    param([string] $InstallRoot)
    $skillsDir = Join-Path $InstallRoot 'skills'
    if (-not (Test-Path -LiteralPath $skillsDir)) { return @() }
    return @(Get-ChildItem -LiteralPath $skillsDir -Directory | Select-Object -ExpandProperty Name | Sort-Object)
}

function New-Junction {
    param([string] $LinkPath, [string] $TargetPath)
    if (Test-Path -LiteralPath $LinkPath) {
        $item = Get-Item -LiteralPath $LinkPath -Force
        if ($item.LinkType -eq 'Junction') {
            Remove-Item -LiteralPath $LinkPath -Force
        } else {
            throw "'$LinkPath' exists and is not a junction this script manages. Refusing to overwrite it."
        }
    }
    New-Item -ItemType Junction -Path $LinkPath -Target $TargetPath | Out-Null
}

function Install-HostSkillLinks {
    param([string] $HostName, [string] $InstallRoot, [string] $Prefix, $Manifest)

    if ($HostName -eq 'codex') {
        Write-Plan "codex: no skill junctions (Invoke-CodexCommand.ps1 reads skills/<name>/SKILL.md from the install root directly - see phase 0 findings)."
        return @()
    }

    $skillsDir = Get-HostSkillsDir -HostName $HostName
    $skillNames = @(Get-KitSkillNames -InstallRoot $InstallRoot)
    $linked = [System.Collections.Generic.List[string]]::new()

    Write-Plan "$($HostName): link $($skillNames.Count) skill(s) into '$skillsDir'."
    if (-not $script:DryRunActive) {
        if (-not (Test-Path -LiteralPath $skillsDir)) {
            New-Item -ItemType Directory -Path $skillsDir -Force | Out-Null
        }
    }

    foreach ($name in $skillNames) {
        $linkName = "$Prefix$name"
        $linkPath = Join-Path $skillsDir $linkName
        $targetPath = Join-Path $InstallRoot "skills/$name"

        $alreadyOwned = $Manifest.hosts.Contains($HostName) -and ($Manifest.hosts[$HostName] -contains $linkName)
        if ((Test-Path -LiteralPath $linkPath) -and -not $alreadyOwned) {
            $existing = Get-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue
            if (-not $existing -or $existing.LinkType -ne 'Junction') {
                Write-Warning "$($HostName): '$linkName' already exists at '$linkPath' and was not created by this script - skipped."
                continue
            }
        }

        Write-Plan "  $linkName -> $targetPath"
        if (-not $script:DryRunActive) {
            New-Junction -LinkPath $linkPath -TargetPath $targetPath
        }
        $linked.Add($linkName)
    }

    return $linked
}

function Remove-HostSkillLinks {
    param([string] $HostName, [string[]] $LinkNames)
    if (-not $LinkNames -or $LinkNames.Count -eq 0) { return }
    $skillsDir = Get-HostSkillsDir -HostName $HostName
    foreach ($linkName in $LinkNames) {
        $linkPath = Join-Path $skillsDir $linkName
        if (-not (Test-Path -LiteralPath $linkPath)) { continue }
        $item = Get-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue
        if ($item -and $item.LinkType -eq 'Junction') {
            Write-Plan "$($HostName): remove link '$linkPath'."
            if (-not $script:DryRunActive) { Remove-Item -LiteralPath $linkPath -Force }
        } else {
            Write-Warning "$($HostName): '$linkPath' is no longer a junction this script owns - left in place."
        }
    }
}

# --- Claude session-cost hooks ----------------------------------------------------------

function Get-ManagedHookEntry {
    param([string] $InstallRoot, [string] $Mode)
    [pscustomobject]@{
        hooks = @(
            [pscustomobject]@{
                type    = 'command'
                command = 'pwsh'
                args    = @('-NoProfile', '-File', (Join-Path $InstallRoot 'tools/Measure-Session.ps1').Replace('\', '/'), $Mode)
                timeout = if ($Mode -eq '-Hook') { 30 } else { 10 }
            }
        )
    }
}

function Update-ClaudeHooks {
    param([string] $InstallRoot, [switch] $Remove)

    $settingsPath = Join-Path $HOME '.claude/settings.json'
    $settingsDir = Split-Path -Parent $settingsPath
    $settings = @{}
    if (Test-Path -LiteralPath $settingsPath) {
        $raw = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json -AsHashtable
        if ($raw) { $settings = $raw }
    }
    if (-not $settings.ContainsKey('hooks')) { $settings['hooks'] = @{} }

    # A managed hook is identified by calling Measure-Session.ps1 wherever it lives -
    # this script's own entry, not by position - so re-running never duplicates it and
    # never touches an unrelated hook the user configured for the same event.
    function Remove-ManagedFrom {
        param($EventEntries)
        if (-not $EventEntries) { return @() }
        return @($EventEntries | Where-Object {
                $args = @($_.hooks | ForEach-Object { $_.args })
                -not ($args | Where-Object { $_ -like '*Measure-Session.ps1*' })
            })
    }

    foreach ($eventName in @('SessionEnd', 'UserPromptSubmit')) {
        $mode = if ($eventName -eq 'SessionEnd') { '-Hook' } else { '-Watch' }
        $current = if ($settings['hooks'].ContainsKey($eventName)) { @($settings['hooks'][$eventName]) } else { @() }
        $kept = @(Remove-ManagedFrom -EventEntries $current)
        if ($Remove) {
            $settings['hooks'][$eventName] = $kept
        } else {
            $settings['hooks'][$eventName] = $kept + @((Get-ManagedHookEntry -InstallRoot $InstallRoot -Mode $mode))
        }
    }

    Write-Plan "claude: $(if ($Remove) { 'remove' } else { 'refresh' }) session-cost hooks in '$settingsPath', pointed at '$InstallRoot'."
    if (-not $script:DryRunActive) {
        if (-not (Test-Path -LiteralPath $settingsDir)) { New-Item -ItemType Directory -Path $settingsDir -Force | Out-Null }
        if (Test-Path -LiteralPath $settingsPath) {
            Copy-Item -LiteralPath $settingsPath -Destination "$settingsPath.bak" -Force
        }
        $settingsJson = ConvertTo-Json -InputObject $settings -Depth 10
        Set-Content -LiteralPath $settingsPath -Value $settingsJson -NoNewline
    }
}

# --- Pointer blocks in personal rules files ----------------------------------------------

$script:PointerBlockId = 'agentkit-pointer'

function Get-PointerBlock {
    param([string] $InstallRoot)
    $startMarker = "<!-- $($script:PointerBlockId):start -->"
    $endMarker = "<!-- $($script:PointerBlockId):end -->"
    $sharedRules = (Join-Path $InstallRoot 'AGENTS.md').Replace('\', '/')
    return @"
$startMarker
AgentKit shared rules, installed at '$InstallRoot'. Regenerated by tools/Install-AgentKit.ps1 -
edit outside this block, never inside it.

@$sharedRules
$endMarker
"@
}

function Update-PointerBlock {
    param([string] $RulesFile, [string] $InstallRoot, [switch] $Remove)

    $startMarker = "<!-- $($script:PointerBlockId):start -->"
    $endMarker = "<!-- $($script:PointerBlockId):end -->"
    $existing = if (Test-Path -LiteralPath $RulesFile) { Get-Content -LiteralPath $RulesFile -Raw } else { '' }

    $pattern = [regex]::Escape($startMarker) + '.*?' + [regex]::Escape($endMarker)
    $withoutBlock = if ($existing) { [regex]::Replace($existing, $pattern, '', 'Singleline') } else { '' }
    $withoutBlock = $withoutBlock.TrimEnd()

    if ($Remove) {
        Write-Plan "Remove AgentKit pointer block from '$RulesFile'."
        if (-not $script:DryRunActive -and (Test-Path -LiteralPath $RulesFile)) {
            Set-Content -LiteralPath $RulesFile -Value $withoutBlock -NoNewline
        }
        return
    }

    $block = Get-PointerBlock -InstallRoot $InstallRoot
    $updated = if ($withoutBlock) { "$withoutBlock`n`n$block`n" } else { "$block`n" }

    Write-Plan "$(if (Test-Path -LiteralPath $RulesFile) { 'Refresh' } else { 'Write' }) AgentKit pointer block in '$RulesFile'."
    if (-not $script:DryRunActive) {
        $dir = Split-Path -Parent $RulesFile
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Set-Content -LiteralPath $RulesFile -Value $updated -NoNewline
    }
}

# --- Main ------------------------------------------------------------------------------

$manifest = Read-Manifest

if ($Uninstall) {
    Write-Host "Uninstalling AgentKit links, hooks and pointer blocks (checkout at '$script:InstallRoot' is kept unless -Force)."

    foreach ($hostName in $manifest.hosts.Keys) {
        Remove-HostSkillLinks -HostName $hostName -LinkNames @($manifest.hosts[$hostName])
    }
    if ($manifest.hooksManaged) {
        Update-ClaudeHooks -InstallRoot $script:InstallRoot -Remove
    }
    foreach ($hostName in $manifest.pointers.Keys) {
        Update-PointerBlock -RulesFile (Get-HostRulesFile -HostName $hostName) -InstallRoot $script:InstallRoot -Remove
    }

    Write-Plan "Clear manifest '$script:ManifestPath'."
    if (-not $script:DryRunActive) {
        if (Test-Path -LiteralPath $script:ManifestPath) { Remove-Item -LiteralPath $script:ManifestPath -Force }
    }

    if ($Force) {
        Write-Plan "Delete checkout '$script:InstallRoot' (-Force)."
        if (-not $script:DryRunActive -and (Test-Path -LiteralPath $script:InstallRoot)) {
            Remove-Item -LiteralPath $script:InstallRoot -Recurse -Force
        }
    } else {
        Write-Host "Checkout left at '$script:InstallRoot'. Re-run with -Uninstall -Force to delete it too."
    }

    return
}

$effectiveSource = if ($Source) { $Source } elseif ($manifest.source) { $manifest.source } else { $null }
$resolvedVersion = Sync-KitCheckout -InstallRoot $script:InstallRoot -Source $effectiveSource -RequestedVersion $Version

$effectiveHosts = @(if ($Hosts -and $Hosts.Count -gt 0) { $Hosts } else { Get-DetectedHosts })
if ($effectiveHosts.Count -eq 0) {
    Write-Warning "No AI tool folders detected under $HOME (~/.claude, ~/.codex, ~/.copilot / ~/.agents). Nothing to link. Pass -Hosts explicitly if one is installed elsewhere."
}

$newHostLinks = [ordered]@{}
foreach ($hostName in $effectiveHosts) {
    # Drop links this run no longer produces (a version change removed a skill, or -Prefix
    # changed) before creating this run's set, so a stale junction never survives an update.
    $previousLinks = if ($manifest.hosts.Contains($hostName)) { @($manifest.hosts[$hostName]) } else { @() }
    $freshLinks = @(Install-HostSkillLinks -HostName $hostName -InstallRoot $script:InstallRoot -Prefix $Prefix -Manifest $manifest)
    $toRemove = @($previousLinks | Where-Object { $_ -notin $freshLinks })
    Remove-HostSkillLinks -HostName $hostName -LinkNames $toRemove
    if ($freshLinks.Count -gt 0) { $newHostLinks[$hostName] = $freshLinks }
}

if ('claude' -in $effectiveHosts) {
    Update-ClaudeHooks -InstallRoot $script:InstallRoot
}

$newPointers = [ordered]@{}
foreach ($hostName in $effectiveHosts) {
    $rulesFile = Get-HostRulesFile -HostName $hostName
    Update-PointerBlock -RulesFile $rulesFile -InstallRoot $script:InstallRoot
    $newPointers[$hostName] = $rulesFile
}

$manifest.version = if ($resolvedVersion) { $resolvedVersion } else { $manifest.version }
$manifest.source = $effectiveSource
$manifest.installedAt = (Get-Date).ToString('o')
$manifest.hosts = $newHostLinks
$manifest.hooksManaged = ('claude' -in $effectiveHosts)
$manifest.pointers = $newPointers
Write-Manifest -Manifest $manifest

if ($script:DryRunActive) {
    Write-Host "`nDRY RUN - nothing above was written."
} else {
    Write-Host "`nInstalled AgentKit '$($manifest.version)' at '$script:InstallRoot' for: $($effectiveHosts -join ', ')."
}
