#Requires -Version 7.0
<#
.SYNOPSIS
    Installs, updates, rolls back, or uninstalls one machine-wide AgentKit runtime.
.DESCRIPTION
    Use the root setup.ps1 front door (README.md). This script owns Git state and
    managed host registrations. It never copies kit cores or tools into a project.
    Claude and Copilot receive native adapters; Codex receives native and routed
    adapters. All adapters resolve dependencies from the one canonical checkout.
.PARAMETER Version
    Tag, branch, or SHA. Omitted: newest valid vYYYY.MM.DD[.N] release, ordered by
    date and numeric revision, never tag creation time. No implicit main fallback.
.PARAMETER Source
    Git origin. Defaults to the recorded source, otherwise the public AgentKit repo.
    Local origins support isolated testing. Changing origin requires -Force.
.PARAMETER Hosts
    claude, codex, copilot; omitted: detect personal folders or installed executables.
    Codex honors CODEX_HOME. Existing unselected managed hosts remain registered.
.PARAMETER Prefix
    Prefix each registered name; e.g. ak- gives ak-slice and ak-slice-routed.
.PARAMETER DryRun
    Show operations without fetch, checkout, registration, or state writes. A fresh
    dry run cannot resolve remote tags; an existing dry run uses cached references.
.PARAMETER Uninstall
    Remove only unchanged managed registrations, exact hooks, and pointer blocks.
    Keep the canonical checkout unless -Force is also supplied.
.PARAMETER Force
    Explicitly permits discarding dirty checkout files or repointing origin, and
    deleting the validated canonical checkout on uninstall. Never overwrites skills.
.EXAMPLE
    ./setup.ps1 -Hosts codex
    Install latest stable for Codex, both native and explicitly routed skills.
.EXAMPLE
    ./setup.ps1 -Version main -Hosts claude
    Explicitly install unreleased main for Claude.
.EXAMPLE
    ./setup.ps1 -Version v2026.09.20
    Select a specific release; selecting an older supported release is rollback.
.EXAMPLE
    ./setup.ps1 -Uninstall
    Remove managed registrations; keep checkout and customized files.
#>
[CmdletBinding()]
param(
    [string] $Version,
    [string] $Source,
    [ValidateSet('claude', 'codex', 'copilot')][string[]] $Hosts,
    [ValidatePattern('^[a-z0-9-]*$')][string] $Prefix = '',
    [switch] $DryRun,
    [switch] $Uninstall,
    [switch] $Force,
    # Private second stage: re-enter the installer FROM the selected commit.
    [switch] $RegisterOnly,
    [string] $PreviousCommit,
    [string] $RequestedVersion
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'AgentKit requires Git on PATH.' }
$publicSource = 'https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git'
$installRoot = [IO.Path]::GetFullPath($(if ($env:AGENTKIT_HOME) { $env:AGENTKIT_HOME } else { Join-Path $HOME '.agent-kit' }))
$stateDir = Join-Path $HOME '.agent-kit-state'
$manifestPath = Join-Path $stateDir 'installed.json'
$codexRoot = if ($env:CODEX_HOME) { [IO.Path]::GetFullPath($env:CODEX_HOME) } else { Join-Path $HOME '.codex' }
$collisions = [Collections.Generic.List[string]]::new()
$registrations = [Collections.Generic.List[object]]::new()
$pointerStart = '<!-- agentkit-pointer:start -->'
$pointerEnd = '<!-- agentkit-pointer:end -->'

function Invoke-Git {
    param([string[]] $GitArgs, [string] $WorkingDir = $installRoot)
    $output = & git -C $WorkingDir @GitArgs 2>&1
    if ($LASTEXITCODE -ne 0) { throw "git $($GitArgs -join ' ') failed (exit $LASTEXITCODE): $output" }
    return $output
}
function Write-Plan([string] $Message) { Write-Host "$(if ($DryRun) { '[DryRun] ' })$Message" }
function Save-Text([string] $Path, [string] $Text) {
    if ($DryRun) { return }
    if ((Test-Path -LiteralPath $Path -PathType Leaf) -and [IO.File]::ReadAllText($Path) -ceq $Text) { return }
    $null = New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force
    [IO.File]::WriteAllText($Path, $Text, [Text.UTF8Encoding]::new($false))
}
function Get-Hash([string] $Text) {
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($Text)))
}
function Add-Collision([string] $Path) {
    if (-not $collisions.Contains($Path)) { $collisions.Add($Path) }
    Write-Warning "Foreign or modified entry '$Path' already exists - skipped and left unchanged."
}
function Normalize-Origin([string] $Value) {
    if ($Value -match '^(https://github[.]com/|git@github[.]com:)(.+?)([.]git)?/?$') {
        return ('github:' + $Matches[2].TrimEnd('/').ToLowerInvariant())
    }
    if (Test-Path -LiteralPath $Value) { return [IO.Path]::GetFullPath($Value).TrimEnd('/','\') }
    return $Value.TrimEnd('/')
}
function Assert-Root {
    if ($installRoot -eq [IO.Path]::GetPathRoot($installRoot) -or $installRoot -eq [IO.Path]::GetFullPath($HOME) -or $installRoot -eq $codexRoot) {
        throw "Unsafe install root '$installRoot'. Choose a dedicated AgentKit directory."
    }
    if (Test-Path -LiteralPath $installRoot) {
        $hasGit = Test-Path -LiteralPath (Join-Path $installRoot '.git') -PathType Container
        if (-not $hasGit) {
            # An existing-but-empty directory is not occupied: git clone accepts it.
            $isEmpty = -not (Get-ChildItem -LiteralPath $installRoot -Force -ErrorAction SilentlyContinue | Select-Object -First 1)
            if (-not $isEmpty) {
                throw "Install root '$installRoot' is occupied and is not an AgentKit checkout."
            }
            return
        }
        if (-not (Test-Path -LiteralPath (Join-Path $installRoot 'tools/Install-AgentKit.ps1')) -or
            -not (Test-Path -LiteralPath (Join-Path $installRoot 'AGENTS.shared.md'))) {
            throw "Checkout '$installRoot' is not an AgentKit runtime."
        }
    }
}
function Get-HostRoot([string] $Name) {
    switch ($Name) {
        claude { Join-Path $HOME '.claude' }
        codex { $codexRoot }
        copilot { Join-Path $HOME '.copilot' }
    }
}
function Get-RulesPath([string] $Name) {
    $leaf = switch ($Name) { claude { 'CLAUDE.md' } codex { 'AGENTS.md' } copilot { 'copilot-instructions.md' } }
    Join-Path (Get-HostRoot $Name) $leaf
}
function Get-DetectedHosts {
    foreach ($name in @('claude','codex','copilot')) {
        if ((Test-Path -LiteralPath (Get-HostRoot $name)) -or (Get-Command $name -ErrorAction SilentlyContinue) -or
            ($name -eq 'copilot' -and (Test-Path -LiteralPath (Join-Path $HOME '.agents')))) { $name }
    }
}
function Resolve-StableTag {
    $tags = if ($DryRun) { @(Invoke-Git @('tag','--list')) } else { @(Invoke-Git @('ls-remote','--tags','--refs','origin') | ForEach-Object { ([string]$_ -split '\s+', 2)[1] -replace '^refs/tags/', '' }) }
    $valid = foreach ($tag in $tags) {
        if ($tag -cmatch '^v(\d{4})[.](\d{2})[.](\d{2})(?:[.](\d+))?$') {
            $date = [datetime]::MinValue
            if ([datetime]::TryParseExact("$($Matches[1])-$($Matches[2])-$($Matches[3])", 'yyyy-MM-dd',
                [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$date)) {
                [pscustomobject]@{ Name = $tag; Date = $date; Revision = $(if ($Matches[4]) { [long]$Matches[4] } else { 0 }) }
            }
        }
    }
    $best = @($valid | Sort-Object @{Expression='Date';Descending=$true}, @{Expression='Revision';Descending=$true}, Name | Select-Object -First 1)
    if (-not $best.Count) { throw 'No valid stable release tag exists. Use -Version main only to opt into unreleased work.' }
    return $best[0].Name
}

$manifest = if (Test-Path -LiteralPath $manifestPath) { Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
if ($manifest.ContainsKey('installRoot') -and $manifest.installRoot -ne $installRoot) { throw "Manifest belongs to '$($manifest.installRoot)', not '$installRoot'. Use that AGENTKIT_HOME first." }
$effectiveSource = if ($Source) { $Source } elseif ($manifest.ContainsKey('source') -and $manifest.source) { $manifest.source } else { $publicSource }
Assert-Root
$exists = Test-Path -LiteralPath (Join-Path $installRoot '.git')
if ($exists) {
    $origin = [string](Invoke-Git @('remote','get-url','origin'))
    if ((Normalize-Origin $origin) -ne (Normalize-Origin $effectiveSource)) {
        if (-not $Force -or $Uninstall) { throw "Wrong origin '$origin'; expected '$effectiveSource'. Explicit -Source and -Force are required to re-point a checkout." }
        Write-Plan "Re-point origin '$origin' to '$effectiveSource'."
        if (-not $DryRun) { $null = Invoke-Git @('remote','set-url','origin',$effectiveSource) }
    }
}

# A manifest entry alone never licenses overwriting changed files or a retargeted link.
function Test-Owned($Entry) {
    if ($Entry.root -ne $installRoot) { return $false }
    $item = Get-Item -LiteralPath $Entry.path -Force -ErrorAction SilentlyContinue
    if (-not $item) { return $false }
    if ($Entry.kind -eq 'link') {
        return ($item.LinkType -in @('Junction','SymbolicLink') -and
            [IO.Path]::GetFullPath([string]$item.Target) -eq [IO.Path]::GetFullPath($Entry.target))
    }
    if ($item.LinkType -or -not $item.PSIsContainer) { return $false }
    $files = @(Get-ChildItem -LiteralPath $Entry.path -Force)
    if ($files.Count -ne $Entry.files.Count) { return $false }
    foreach ($file in $files) {
        if ($file.PSIsContainer -or $file.LinkType -or -not $Entry.files.Contains($file.Name)) { return $false }
        if ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne $Entry.files[$file.Name]) { return $false }
    }
    return $true
}
function Remove-Registration($Entry) {
    if (-not (Get-Item -LiteralPath $Entry.path -Force -ErrorAction SilentlyContinue)) { return }
    if (-not (Test-Owned $Entry)) { Add-Collision $Entry.path; return }
    Write-Plan "Remove managed registration '$($Entry.path)'."
    if (-not $DryRun) {
        if ($Entry.kind -eq 'link') { [IO.Directory]::Delete($Entry.path) }
        else {
            foreach ($file in $Entry.files.Keys) { Remove-Item -LiteralPath (Join-Path $Entry.path $file) -Force }
            [IO.Directory]::Delete($Entry.path)
        }
    }
}
$oldRegistrations = @()
if ($manifest.ContainsKey('registrations')) { $oldRegistrations = @($manifest.registrations) }
elseif ($manifest.ContainsKey('hosts')) {
    # v1 migration: only manifest-listed links anchored to this exact runtime count.
    foreach ($name in $manifest.hosts.Keys) {
        foreach ($link in @($manifest.hosts[$name])) {
            $path = Join-Path (Get-HostRoot $name) "skills/$link"
            $item = Get-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
            if ($item -and $item.LinkType -in @('Junction','SymbolicLink')) {
                $target = [string]$item.Target
                $parent = Split-Path -Parent $target
                if ($parent -eq (Join-Path $installRoot 'skills')) {
                    $oldRegistrations += @{ host=$name; name=$link; path=$path; root=$installRoot; kind='link'; target=$target }
                }
            }
        }
    }
}

function Get-Pointer {
    $shared = (Join-Path $installRoot 'AGENTS.shared.md').Replace('\','/')
    return "$pointerStart`nAgentKit shared rules: read [$shared]($shared) before using AgentKit.`n@$shared`n$pointerEnd"
}
function Update-Pointer([string] $Path, [switch] $Remove) {
    $text = if (Test-Path -LiteralPath $Path) { [IO.File]::ReadAllText($Path) } else { '' }
    $pattern = [regex]::Escape($pointerStart) + '.*?' + [regex]::Escape($pointerEnd)
    $matches = [regex]::Matches($text, $pattern, 'Singleline')
    $prior = $null
    if ($manifest.ContainsKey('pointerBlocks') -and $manifest.pointerBlocks.Contains($Path)) { $prior = $manifest.pointerBlocks[$Path] }
    if ($matches.Count -gt 1 -or ($text.Contains($pointerStart) -ne $text.Contains($pointerEnd))) { Add-Collision $Path; return }
    if ($matches.Count -eq 1) {
        $block = $matches[0].Value
        # Legacy pointers must match the original generated body, not merely name
        # this root: a recognizable but customized block still belongs to the user.
        $legacyTarget = (Join-Path $installRoot 'AGENTS.md').Replace('\','/')
        $legacyBody = "$pointerStart`nAgentKit shared rules, installed at '$installRoot'. Regenerated by tools/Install-AgentKit.ps1 -`nedit outside this block, never inside it.`n`n@$legacyTarget`n$pointerEnd"
        $legacy = $manifest.ContainsKey('pointers') -and ($manifest.pointers.Values -contains $Path) -and
            $block.Replace("`r`n", "`n") -ceq $legacyBody
        if ($block -cne $prior -and -not $legacy) { Add-Collision $Path; return }
        if ($Remove) {
            Save-Text $Path ($text.Remove($matches[0].Index, $matches[0].Length))
            return
        }
        $updated = $text.Remove($matches[0].Index, $matches[0].Length).Insert($matches[0].Index, (Get-Pointer))
    } else {
        if ($Remove) { return }
        $updated = $text + $(if ($text -and -not $text.EndsWith("`n")) { "`n" }) + (Get-Pointer) + "`n"
    }
    Save-Text $Path $updated
    $script:pointerBlocks[$Path] = Get-Pointer
}
function Update-Hooks([switch] $Remove) {
    $path = Join-Path $HOME '.claude/settings.json'
    $settings = if (Test-Path -LiteralPath $path) { Get-Content -LiteralPath $path -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
    if (-not $settings.ContainsKey('hooks')) { $settings.hooks = @{} }
    foreach ($event in @('SessionEnd','UserPromptSubmit')) {
        $mode = if ($event -eq 'SessionEnd') { '-Hook' } else { '-Watch' }
        $entry = [ordered]@{ hooks = @([ordered]@{ type='command'; command='pwsh'; args=@('-NoProfile','-File',(Join-Path $installRoot 'tools/Measure-Session.ps1').Replace('\','/'),$mode); timeout=$(if ($mode -eq '-Hook') {30} else {10}) }) }
        $serialized = ConvertTo-Json -InputObject $entry -Depth 10 -Compress
        $kept = @($settings.hooks[$event] | Where-Object { $_ -and (ConvertTo-Json -InputObject $_ -Depth 10 -Compress) -cne $serialized })
        $settings.hooks[$event] = if ($Remove) { @($kept) } else { @($kept) + @($entry) }
    }
    $json = ConvertTo-Json -InputObject $settings -Depth 20
    if ((Test-Path -LiteralPath $path) -and [IO.File]::ReadAllText($path) -cne $json -and -not $DryRun) {
        # Never overwrite an earlier backup.
        $backup = "$path.agentkit-$(Get-Hash ([IO.File]::ReadAllText($path))).bak"
        if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $path -Destination $backup }
    }
    Save-Text $path $json
}
$pointerBlocks = [ordered]@{}
if ($manifest.ContainsKey('pointerBlocks')) { foreach ($key in $manifest.pointerBlocks.Keys) { $pointerBlocks[$key] = $manifest.pointerBlocks[$key] } }

if ($Uninstall) {
    foreach ($entry in $oldRegistrations) { Remove-Registration $entry }
    if ($manifest.ContainsKey('hooksManaged') -and $manifest.hooksManaged) { Update-Hooks -Remove }
    $paths = @($pointerBlocks.Keys)
    if ($manifest.ContainsKey('pointers')) { $paths += @($manifest.pointers.Values) }
    foreach ($path in @($paths | Select-Object -Unique)) { Update-Pointer $path -Remove }
    if (-not $DryRun -and (Test-Path -LiteralPath $manifestPath)) { Remove-Item -LiteralPath $manifestPath }
    if ($Force -and $exists) {
        Write-Plan "Delete validated canonical checkout '$installRoot' (-Force)."
        if (-not $DryRun) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
    }
    Write-Host "Uninstall complete. Root: $installRoot; preserved collisions: $($collisions -join ', ')"
    return
}

if (-not $RegisterOnly) {
    $previous = if ($exists) { [string](Invoke-Git @('rev-parse','HEAD')) } else { '' }
    if ($exists) {
        $dirty = Invoke-Git @('status','--porcelain')
        if ($dirty) {
            if (-not $Force) { throw "'$installRoot' has uncommitted changes. Commit, stash, or explicitly use -Force to discard them." }
            Write-Plan "Discard uncommitted changes at '$installRoot' (-Force)."
            if (-not $DryRun) { $null = Invoke-Git @('reset','--hard','HEAD'); $null = Invoke-Git @('clean','-fd') }
        }
        Write-Plan "Fetch tags and branches at '$installRoot'."
        if (-not $DryRun) { $null = Invoke-Git @('fetch','origin','--tags','--prune','+refs/heads/*:refs/remotes/origin/*') }
    } else {
        Write-Plan "Clone '$effectiveSource' into '$installRoot'."
        if (-not $DryRun) {
            $parent = Split-Path -Parent $installRoot
            $null = New-Item -ItemType Directory -Path $parent -Force
            $null = Invoke-Git @('clone','--origin','origin',$effectiveSource,$installRoot) $parent
        }
    }
    if ($DryRun -and -not $exists) {
        Write-Host "DRY RUN: requested $(if ($Version) {$Version} else {'latest stable release'}); tags unresolved until clone. No files written."
        return
    }
    $resolved = if ($Version) { $Version } else { Resolve-StableTag }
    if ($resolved.StartsWith('-')) { throw 'Version must be a tag, branch, or SHA, not a Git option.' }
    & git -C $installRoot show-ref --verify --quiet "refs/tags/$resolved"
    $isTag = $LASTEXITCODE -eq 0
    & git -C $installRoot show-ref --verify --quiet "refs/remotes/origin/$resolved"
    $isBranch = -not $isTag -and $LASTEXITCODE -eq 0
    $ref = if ($isTag) { "refs/tags/$resolved" } elseif ($isBranch) { "refs/remotes/origin/$resolved" } else { $resolved }
    $sha = [string](Invoke-Git @('rev-parse','--verify',"$ref^{commit}"))
    # Refuse a release predating the front door rather than claim it installs new behavior.
    $frontDoor = & git -C $installRoot cat-file -e "${sha}:setup.ps1" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Version '$resolved' ($sha) predates the global front door. Publish a release containing this change after merge, or explicitly use -Version main for unreleased work." }
    if ($isBranch) {
        & git -C $installRoot show-ref --verify --quiet "refs/heads/$resolved"
        if ($LASTEXITCODE -eq 0) {
            & git -C $installRoot merge-base --is-ancestor "refs/heads/$resolved" $sha
            if ($LASTEXITCODE -ne 0) { throw "Local branch '$resolved' has unpublished or divergent commits; not resetting it. Previous commit: $previous." }
        }
    }
    Write-Plan "Requested: $(if ($Version) {$Version} else {'latest stable'}); resolved: $resolved ($sha)."
    if ($DryRun) { Write-Host 'DRY RUN: checkout and refresh selected managed registrations, hooks and shared pointers; no files written.'; return }
    if ($isBranch) {
        $null = Invoke-Git @('checkout',$resolved)
        $null = Invoke-Git @('merge','--ff-only',$sha)
    } else { $null = Invoke-Git @('checkout','--detach',$sha) }
    $argsForSelected = @{ Version=$resolved; Source=$effectiveSource; Prefix=$Prefix; RegisterOnly=$true; PreviousCommit=$previous; RequestedVersion=$(if ($Version) {$Version} else {'latest stable'}) }
    if ($Hosts) { $argsForSelected.Hosts=$Hosts }
    # Invoke freshly loaded definitions, even when this script was read before checkout moved.
    try { & (Join-Path $installRoot 'tools/Install-AgentKit.ps1') @argsForSelected }
    catch { throw "Setup failed after selecting $sha. Previous commit: $previous. No automatic reset. Recovery: pwsh -File '$installRoot/setup.ps1' -Version '$previous'. Error: $_" }
    return
}

# Verify canonical dependencies before writing host state. A download of SKILL.md alone
# cannot satisfy this boundary.
foreach ($relative in @('AGENTS.shared.md','.claude/COMPANIONS.md','templates','tools/Invoke-CodexCommand.ps1','tools/Start-AgentKitCodex.ps1','tools/Get-AgentKitSkill.ps1')) {
    if (-not (Test-Path -LiteralPath (Join-Path $installRoot $relative))) { throw "Incomplete runtime: missing '$relative'." }
}
$skills = @(Get-ChildItem -LiteralPath (Join-Path $installRoot 'skills') -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md') } | Sort-Object Name)
$effectiveHosts = @(if ($Hosts) { $Hosts | Select-Object -Unique } else { Get-DetectedHosts })
if (-not $effectiveHosts.Count) { Write-Warning 'No supported host detected. Pass -Hosts claude, codex, or copilot explicitly.' }
foreach ($entry in $oldRegistrations) { if ($entry.host -notin $effectiveHosts) { $registrations.Add($entry) } }

function New-Adapter([string] $Name, [string] $RegistrationName, [string] $HostName, [bool] $Routed) {
    $root = $installRoot.Replace('\','/')
    $escaped = $installRoot.Replace("'", "''")
    $mode = if ($Routed) { 'routed, separate terminal' } elseif ($HostName -eq 'codex') { 'native, current session' } else { 'native' }
    $header = "---`nname: $RegistrationName`ndescription: 'AgentKit /$Name ($mode). Use only when the user requests this command.'`n---`n"
    if ($HostName -eq 'claude') { $header = $header.Replace("`n---`n", "`ndisable-model-invocation: true`n---`n") }
    $dependencies = "Runtime: [$root]($root). Read [$root/AGENTS.shared.md]($root/AGENTS.shared.md) and [$root/.claude/COMPANIONS.md]($root/.claude/COMPANIONS.md). Kit scripts and templates resolve under this runtime; project files and companions stay relative to the current project.`n"
    if ($Routed) {
        return $header + $dependencies + @"

This is an explicit routed invocation. Do not execute the command in this session.
Write the user's command arguments verbatim as a UTF-8 JSON array of strings to a
unique temporary file outside the project. Do not interpolate arguments into shell code.
Invoke the following in PowerShell, substituting only the temporary file's literal path:

``````powershell
& '$escaped/tools/Start-AgentKitCodex.ps1' -Command '$Name' -ArgumentsFile '<temporary JSON path>' -NewWindow
``````

This opens a visible Windows terminal. The user interacts with that terminal for
approvals and session completion. Report that it launched; do not claim the command
completed. Never substitute headless codex exec or auto-answer child approvals.
"@
    }
    $native = if ($HostName -eq 'codex') { 'Execution mode: native Codex. Keep the current session model and effort under the explicit native-mode exception in the shared rules linked above; do not claim routed tier verification. For enforced command routing use the corresponding -routed skill.' } else { 'Execute the core using this host and its normal model policy.' }
    return $header + $dependencies + @"

$native

Load the complete canonical command through this reader, then execute the returned
body with the user's arguments. The reader resolves kit dependencies to absolute
paths without moving project companions or project files:

``````powershell
& '$escaped/tools/Get-AgentKitSkill.ps1' -Command '$Name'
``````

The source is [$root/skills/$Name/SKILL.md]($root/skills/$Name/SKILL.md).
Treat the user's command arguments as data for the core's placeholders (including
spaces, quotes and multiline text). Do not invoke this global adapter recursively.
"@
}

foreach ($hostName in $effectiveHosts) {
    $desired = [Collections.Generic.List[string]]::new()
    foreach ($skill in $skills) {
        foreach ($routed in @(if ($hostName -eq 'codex') { $false; $true } else { $false })) {
            $name = "$Prefix$($skill.Name)$(if ($routed) {'-routed'})"
            $path = Join-Path (Get-HostRoot $hostName) "skills/$name"
            $desired.Add($path)
            $old = @($oldRegistrations | Where-Object { $_.path -eq $path } | Select-Object -First 1)
            $item = Get-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
            if ($item -and (-not $old.Count -or -not (Test-Owned $old[0]))) { Add-Collision $path; if ($old.Count) {$registrations.Add($old[0])}; continue }
            if ($item -and $old[0].kind -eq 'link') { Remove-Registration $old[0] }
            $text = New-Adapter $skill.Name $name $hostName $routed
            $marker = "AgentKit registration`nRoot: $installRoot`nHost: $hostName`nName: $name`n"
            Write-Plan "Register $hostName/$name -> $installRoot"
            Save-Text (Join-Path $path 'SKILL.md') $text
            Save-Text (Join-Path $path '.agentkit-owner') $marker
            $registrations.Add([ordered]@{host=$hostName;name=$name;path=$path;root=$installRoot;kind='files';files=[ordered]@{'SKILL.md'=(Get-Hash $text);'.agentkit-owner'=(Get-Hash $marker)}})
        }
    }
    foreach ($stale in @($oldRegistrations | Where-Object { $_.host -eq $hostName -and $_.path -notin $desired })) { Remove-Registration $stale }
    Update-Pointer (Get-RulesPath $hostName)
}
if ('claude' -in $effectiveHosts) { Update-Hooks }
$sha = [string](Invoke-Git @('rev-parse','HEAD'))
$nextManifest = [ordered]@{
    schemaVersion=2; installRoot=$installRoot; source=$effectiveSource; requestedVersion=$RequestedVersion;
    version=$Version; commit=$sha; previousCommit=$(if ($manifest.ContainsKey('commit') -and $manifest.commit -eq $sha) {$manifest.previousCommit} else {$PreviousCommit}); registrations=@($registrations);
    hooksManaged=('claude' -in $effectiveHosts -or ($manifest.ContainsKey('hooksManaged') -and [bool]$manifest.hooksManaged)); pointerBlocks=$pointerBlocks
}
Save-Text $manifestPath (ConvertTo-Json -InputObject $nextManifest -Depth 20)
# A successful report is grounded in actual registration bytes and runtime dependencies.
foreach ($entry in $registrations) {
    if ($entry.path -notin $collisions -and -not (Test-Owned $entry)) { throw "Registration verification failed: $($entry.path)" }
}
Write-Host "AgentKit source: $effectiveSource"
Write-Host "Requested: $RequestedVersion; resolved: $Version ($sha); root: $installRoot"
Write-Host "Hosts: $($effectiveHosts -join ', '); registrations: $((@($registrations | ForEach-Object { "$($_.host)/$($_.name)" })) -join ', ')"
Write-Host "Skipped collisions: $($collisions -join ', ')"
Write-Host 'Verified: canonical runtime dependencies and owned registration bytes. Restart hosts for discovery; host execution is not claimed by setup.'
