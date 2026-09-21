#Requires -Version 7.0
<#
.SYNOPSIS
    Reads a canonical skill with absolute kit dependency bindings.
.DESCRIPTION
    Global host adapters and the Codex launcher share this deterministic reader.
    It never writes a core copy. Project files, including migration's old kit copies
    and SKILL-local.md, stay project-relative. Only executable kit calls and citations
    are anchored; migration's deletion candidates must never point into the runtime.

    The first read of a host session also checks whether the installed runtime is behind
    what it tracks, and if so puts a notice ahead of the body: what changed, and the
    setup.ps1 command to run once the user agrees. The check never moves the checkout,
    is silent when there is nothing to offer, and never blocks the command being read.
    Tracked: the newest stable vYYYY.MM.DD[.N] tag for a latest-stable install, or
    origin/<branch> for a branch install. An explicit tag or SHA is a pin, never offered one.
.PARAMETER SetAutoUpdate
    On or Off: persist the update check setting to ~/.agent-kit-state/config.json and exit.
    Absent means On. AGENTKIT_AUTO_UPDATE=0|off|false|no disables it for one environment.
#>
[CmdletBinding(DefaultParameterSetName = 'Read')]
param(
    [Parameter(Mandatory, ParameterSetName = 'Read')][ValidatePattern('^[a-z][a-z0-9-]*$')][string] $Command,
    [Parameter(Mandatory, ParameterSetName = 'AutoUpdate')][ValidateSet('On','Off')][string] $SetAutoUpdate
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Split-Path -Parent $PSScriptRoot).Replace('\','/')
$stateDir = Join-Path $HOME '.agent-kit-state'

function Read-StateJson([string] $Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return @{} }
    try { return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -AsHashtable) ?? @{} } catch { return @{} }
}
function Save-StateJson([string] $Path, $Value) {
    $null = New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force
    [IO.File]::WriteAllText($Path, (ConvertTo-Json -InputObject $Value -Depth 5), [Text.UTF8Encoding]::new($false))
}

if ($PSCmdlet.ParameterSetName -eq 'AutoUpdate') {
    $configPath = Join-Path $stateDir 'config.json'
    $config = Read-StateJson $configPath
    $config['autoUpdate'] = $SetAutoUpdate -eq 'On'
    Save-StateJson $configPath $config
    "AgentKit auto-update: $SetAutoUpdate ($configPath)"
    return
}

function Get-HostSessionKey {
    foreach ($name in @('CLAUDE_CODE_SESSION_ID','CODEX_THREAD_ID','CODEX_SESSION_ID')) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($value) { return "${name}:$value" }
    }
    # No host-provided id: the nearest non-shell ancestor is the host, keyed by id and start time.
    $shells = @('pwsh','powershell','cmd','bash','sh','zsh','dash','fish','conhost','wsl')
    $process = Get-Process -Id $PID
    for ($i = 0; $i -lt 8; $i++) {
        $parent = $process.Parent
        if (-not $parent) { break }
        $process = $parent
        if ($process.ProcessName -notin $shells) {
            $start = try { $process.StartTime.ToUniversalTime().Ticks } catch { 0 }
            return "pid:$($process.Id):$start"
        }
    }
    return "pid:$($process.Id)"
}

function Invoke-GitTimed([string[]] $GitArgs, [int] $TimeoutMs = 20000) {
    $psi = [Diagnostics.ProcessStartInfo]::new('git')
    foreach ($a in @('-C', $root) + $GitArgs) { $psi.ArgumentList.Add($a) }
    $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.UseShellExecute = $false
    $psi.Environment['GIT_TERMINAL_PROMPT'] = '0'
    $proc = [Diagnostics.Process]::Start($psi)
    $out = $proc.StandardOutput.ReadToEndAsync(); $err = $proc.StandardError.ReadToEndAsync()
    if (-not $proc.WaitForExit($TimeoutMs)) { try { $proc.Kill($true) } catch { }; throw "git $($GitArgs -join ' ') timed out" }
    if ($proc.ExitCode -ne 0) { throw "git $($GitArgs -join ' ') failed: $($err.Result)" }
    return @($out.Result -split "`r?`n" | Where-Object { $_ })
}

function Get-UpdateNotice {
    if ($env:AGENTKIT_AUTO_UPDATE -match '^(0|off|false|no)$') { return '' }
    $config = Read-StateJson (Join-Path $stateDir 'config.json')
    if ($config.ContainsKey('autoUpdate') -and -not [bool]$config['autoUpdate']) { return '' }
    $manifest = Read-StateJson (Join-Path $stateDir 'installed.json')
    # Only the recorded install checks itself: a kit development checkout or a test fixture
    # reading skills from elsewhere is not the runtime the user upgrades.
    if (-not $manifest.ContainsKey('installRoot')) { return '' }
    $full = [IO.Path]::GetFullPath($root).TrimEnd('\','/')
    if ([IO.Path]::GetFullPath([string]$manifest.installRoot).TrimEnd('\','/') -ne $full) { return '' }

    $sessionsPath = Join-Path $stateDir 'update-check.json'
    $sessionKey = Get-HostSessionKey
    $seen = Read-StateJson $sessionsPath
    $sessions = [Collections.Generic.List[string]]::new()
    if ($seen.ContainsKey('sessions')) { foreach ($s in @($seen['sessions'])) { $sessions.Add([string]$s) } }
    if ($sessions.Contains($sessionKey)) { return '' }
    # Recorded before the network call: a failed or slow check is not retried on every command.
    $sessions.Add($sessionKey)
    while ($sessions.Count -gt 50) { $sessions.RemoveAt(0) }
    try { Save-StateJson $sessionsPath ([ordered]@{ sessions = @($sessions) }) } catch { }

    $installed = [string](Invoke-GitTimed @('rev-parse','HEAD'))
    $version = if ($manifest.ContainsKey('version')) { [string]$manifest.version } else { '' }
    $requested = if ($manifest.ContainsKey('requestedVersion')) { [string]$manifest.requestedVersion } else { '' }
    $target = $null; $targetName = $null; $upgradeArgs = ''
    if ($requested -eq 'latest stable') {
        $tags = Invoke-GitTimed @('ls-remote','--tags','--refs','origin') | ForEach-Object { ([string]$_ -split '\s+', 2)[1] -replace '^refs/tags/', '' }
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
        if ($best.Count) {
            $targetName = $best[0].Name
            $null = Invoke-GitTimed @('fetch','--quiet','origin',"+refs/tags/${targetName}:refs/tags/$targetName") 60000
            $target = [string](Invoke-GitTimed @('rev-parse','--verify',"refs/tags/$targetName^{commit}"))
        }
    } elseif ($version -and -not $version.StartsWith('-') -and $version -notmatch '^[0-9a-f]{7,40}$' -and $version -cnotmatch '^v\d{4}[.]\d{2}[.]\d{2}') {
        # Installed from a branch: follow that branch, and upgrade with the same -Version.
        $null = Invoke-GitTimed @('fetch','--quiet','origin',"+refs/heads/${version}:refs/remotes/origin/$version") 60000
        $targetName = "origin/$version"
        $target = [string](Invoke-GitTimed @('rev-parse','--verify',"refs/remotes/origin/$version^{commit}"))
        $upgradeArgs = " -Version '$($version.Replace("'","''"))'"
    }
    if (-not $target -or $target -eq $installed) { return '' }
    # Behind only: a runtime ahead of or diverged from its target is not offered a "downgrade".
    & git -C $root merge-base --is-ancestor $installed $target 2>$null
    if ($LASTEXITCODE -ne 0) { return '' }

    $changes = @(Invoke-GitTimed @('log','--no-merges','--format=%h %s',"$installed..$target"))
    $shown = @($changes | Select-Object -First 25)
    $more = $changes.Count - $shown.Count
    $quoted = $root.Replace("'","''")
    $lines = @(
        '=== AgentKit update available ==='
        "Installed: $(if ($version) { "$version ($($installed.Substring(0,7)))" } else { $installed.Substring(0,7) })"
        "Available: $targetName ($($target.Substring(0,7)))"
        "What changed ($($changes.Count) commit$(if ($changes.Count -ne 1) {'s'})):"
        ($shown | ForEach-Object { "  - $_" })
        $(if ($more -gt 0) { "  ... and $more more" })
        ''
        'Agent: before doing anything else, show the user the list above and ask whether to upgrade'
        'AgentKit now (one question, recommend yes). If yes, run exactly:'
        "  & '$quoted/setup.ps1'$upgradeArgs"
        'then re-read this command through the same reader and follow the refreshed body. If no, or if'
        'the upgrade fails, report that in one line and continue with the command body below unchanged.'
        "This check runs once per session. Disable it with: & '$quoted/tools/Get-AgentKitSkill.ps1' -SetAutoUpdate Off"
        '=== end AgentKit update notice ==='
    )
    return (($lines | Where-Object { $null -ne $_ }) -join "`n") + "`n`n"
}

$path = Join-Path $root "skills/$Command/SKILL.md"
if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Unknown AgentKit command '$Command': '$path' is missing." }
$text = [IO.File]::ReadAllText($path)
$text = $text.Replace('../../.claude/COMPANIONS.md', "$root/.claude/COMPANIONS.md")
# Executable examples must remain valid when the runtime root contains spaces or quotes.
$quotedRoot = $root.Replace("'", "''")
$text = [regex]::Replace($text, 'pwsh (?:-File )?(?:\./)?tools/([\w-]+[.]ps1)', [Text.RegularExpressions.MatchEvaluator]{ param($m) "pwsh -File '$quotedRoot/tools/$($m.Groups[1].Value)'" })
$text = [regex]::Replace($text, '(?m)^(\s*)(?:\./)?tools/([\w-]+[.]ps1)', [Text.RegularExpressions.MatchEvaluator]{ param($m) "$($m.Groups[1].Value)& '$quotedRoot/tools/$($m.Groups[2].Value)'" })
# Bare references in migration enumerate TARGET copies to classify/delete. Leave those
# identifiers untouched; its executable calls above still use the canonical runtime.
if ($Command -ne 'install-all') {
    foreach ($relative in @('AGENTS.shared.md','.claude/COMPANIONS.md','INSTALL.md','tools/','templates/')) {
        $pattern = '(?<![\w/\\.])(?:\./)?' + [regex]::Escape($relative)
        $replacement = "$root/$relative"
        $text = [regex]::Replace($text, $pattern, [Text.RegularExpressions.MatchEvaluator]{ param($m) $replacement })
    }
}
$text = [regex]::Replace($text, '(?<![\w/\\.])skills/([a-z0-9-]+)/SKILL[.]md', [Text.RegularExpressions.MatchEvaluator]{ param($m) "$root/$($m.Value)" })
$notice = try { Get-UpdateNotice } catch { Write-Verbose "AgentKit update check skipped: $_"; '' }
$notice + @"
AgentKit canonical runtime: $root
Shared rules: $root/AGENTS.shared.md
Companion mechanism: $root/.claude/COMPANIONS.md
Kit script root: $root/tools/
Kit template root: $root/templates/
Project companions and project files remain relative to the calling project. In
/install-all, old-copy classification and deletion paths are TARGET project paths,
never canonical runtime paths. Keep the project working directory when running tools.
Quote absolute paths when executing PowerShell commands.

$text
"@
