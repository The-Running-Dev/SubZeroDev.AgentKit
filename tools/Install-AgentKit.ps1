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
$PSNativeCommandUseErrorActionPreference = $false
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'AgentKit requires Node >= 22.18 on PATH.' }
# Check here: an older Node fails on the TypeScript imports before the installer's own check can run.
$nodeVersion = [string](& node --version) -replace '^v|-.*$', ''
if (-not ($nodeVersion -as [version]) -or [version]$nodeVersion -lt [version]'22.18') { throw "AgentKit requires Node >= 22.18 on PATH; found $nodeVersion." }
$nodeArgs = @((Join-Path $PSScriptRoot 'install-agentkit.ts'))
$names = @{Version='version';Source='source';Prefix='prefix';PreviousCommit='previous-commit';RequestedVersion='requested-version'}
foreach ($key in $names.Keys) {
    if ($PSBoundParameters.ContainsKey($key) -and [string]$PSBoundParameters[$key] -ne '') { $nodeArgs += @(('--' + $names[$key]), [string]$PSBoundParameters[$key]) }
}
$flags = @{DryRun='dry-run';Uninstall='uninstall';Force='force';Verify='verify';RegisterOnly='register-only'}
foreach ($key in $flags.Keys) { if ($PSBoundParameters[$key]) { $nodeArgs += '--' + $flags[$key] } }
foreach ($hostName in $Hosts) { $nodeArgs += @('--hosts', $hostName) }
& node @nodeArgs
$code = $LASTEXITCODE
# A script calling this one with & never sees an exit code; the pwsh-era installer relies on
# its catch to print the recovery command, so fail it by throwing. -File still gets the code.
if ($code -ne 0 -and $MyInvocation.PSCommandPath) { throw "AgentKit installer exited $code." }
exit $code
