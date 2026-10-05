# Compatibility bridge for pwsh-era upgrades. New installs use node setup.ts.
[CmdletBinding()]
param(
    [string] $Version,
    [string] $Source,
    [string[]] $Hosts,
    [string] $Prefix = '',
    [switch] $DryRun,
    [switch] $Uninstall,
    [switch] $Force,
    [switch] $Verify,
    [switch] $RegisterOnly,
    [string] $PreviousCommit,
    [string] $RequestedVersion
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'AgentKit requires Node >= 22.18 on PATH.' }
$nodeArgs = @((Join-Path $PSScriptRoot 'setup.ts'))
$names = @{Version='version';Source='source';Prefix='prefix';PreviousCommit='previous-commit';RequestedVersion='requested-version'}
foreach ($key in $names.Keys) {
    if ($PSBoundParameters.ContainsKey($key) -and [string]$PSBoundParameters[$key] -ne '') { $nodeArgs += @(('--' + $names[$key]), [string]$PSBoundParameters[$key]) }
}
$flags = @{DryRun='dry-run';Uninstall='uninstall';Force='force';Verify='verify';RegisterOnly='register-only'}
foreach ($key in $flags.Keys) { if ($PSBoundParameters[$key]) { $nodeArgs += '--' + $flags[$key] } }
foreach ($hostName in $Hosts) { $nodeArgs += @('--hosts', $hostName) }
& node @nodeArgs
exit $LASTEXITCODE
