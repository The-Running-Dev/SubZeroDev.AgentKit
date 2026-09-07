#Requires -Version 7.0
<#
.SYNOPSIS
    The no-model invocation path for /next's orientation reads.

.DESCRIPTION
    next.md's "Orient" section runs six read-only commands before any decision is made:
    git status, the current branch, open and merged pull requests, and the two design gate
    scripts. None of that is a judgement call - next.md says so explicitly ("What this command
    adds is a check of what is outstanding, which orientation alone does not answer"). This
    script runs exactly those six reads and returns them as one object, so a person (or a
    model session opened afterward) can pick the row in AGENTS.md § *Session boundaries* /
    next.md's decision table without a model having spent anything gathering the inputs to it.

    This script decides nothing. It does not pick a row, and it does not open a session.
    Reading its output and choosing what runs next stays exactly the judgement call next.md
    already says it is.

.PARAMETER RepoRoot
    Repository to read. Defaults to the current directory.

.EXAMPLE
    ./tools/Get-NextOrientation.ps1
#>
[CmdletBinding()]
param(
    [string] $RepoRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    throw "RepoRoot '$RepoRoot' does not exist."
}
$repoRootResolved = (Resolve-Path -LiteralPath $RepoRoot).Path

function Invoke-Gh {
    param([string[]]$GhArgs, [string]$WorkingDir)
    Push-Location $WorkingDir
    try {
        $out = & gh @GhArgs 2>$null
        return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $out }
    }
    finally { Pop-Location }
}

function Get-RepoNameWithOwner {
    # Mirrors Invoke-DoneHousekeeping.ps1's helper of the same name (#255's other root
    # cause): a gate script that falls back to `gh`'s own cwd-based repo resolution needs
    # that resolution pinned to -RepoRoot, not left to whatever the process cwd is.
    param([string]$WorkingDir)
    $urlResult = & git -C $WorkingDir remote get-url origin 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $urlResult) { return $null }
    $url = ($urlResult | Select-Object -First 1).Trim()
    if ($url -match '[:/]([^/:]+/[^/]+?)(\.git)?$') { return $Matches[1] }
    return $null
}

function Invoke-GateScript {
    # Test-DesignDrift.ps1 and Test-DesignState.ps1 both `exit` with a code, so they are read
    # as external processes rather than dot-sourced - the same reason Measure-Session.Tests.ps1
    # and this repository's other tools scripts invoke each other with `&`, never `.`.
    #
    # Two things leaked to the ambient process cwd instead of $WorkingDir (#255): each
    # script's own internal `git`/`gh` calls that assume they're running from the repo they
    # should check (fixed by Push-Location, the same guard Invoke-Gh above already uses),
    # and Test-DesignState.ps1's `-Path` default plus Test-DesignDrift.ps1's `-Repository`
    # default, both of which resolve from cwd unless passed explicitly - fixed by passing
    # $WorkingDir and its resolved owner/repo through $ExtraArgs at each call site below.
    param([string]$Path, [string]$WorkingDir, [hashtable]$ExtraArgs = @{})
    if (-not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{ Ran = $false; ExitCode = $null; Output = $null }
    }
    Push-Location $WorkingDir
    try {
        # A hashtable splat, not an array one - array splatting binds positionally and
        # would hand the target script's own -Path a literal "-Path" string instead of
        # matching it by name.
        $output = & $Path @ExtraArgs *>&1 | Out-String
        return [pscustomobject]@{ Ran = $true; ExitCode = $LASTEXITCODE; Output = $output.TrimEnd() }
    }
    finally { Pop-Location }
}

$status = & git -C $repoRootResolved status --short --branch
$currentBranch = (& git -C $repoRootResolved branch --show-current).Trim()

$openPr = Invoke-Gh -GhArgs @('pr', 'list', '--state', 'open', '--json', 'number,title,headRefName') -WorkingDir $repoRootResolved
$mergedPr = Invoke-Gh -GhArgs @('pr', 'list', '--state', 'merged', '--limit', '5', '--json', 'number,title,mergedAt') -WorkingDir $repoRootResolved

$frozenPath = Join-Path $repoRootResolved 'design/FROZEN.md'
$frozen = Test-Path -LiteralPath $frozenPath
$frozenContent = if ($frozen) { Get-Content -LiteralPath $frozenPath -Raw } else { $null }

$repoNameWithOwner = Get-RepoNameWithOwner -WorkingDir $repoRootResolved
$driftExtraArgs = if ($repoNameWithOwner) { @{ Repository = $repoNameWithOwner } } else { @{} }

$drift = Invoke-GateScript -Path (Join-Path $repoRootResolved 'tools/Test-DesignDrift.ps1') -WorkingDir $repoRootResolved -ExtraArgs $driftExtraArgs
$state = Invoke-GateScript -Path (Join-Path $repoRootResolved 'tools/Test-DesignState.ps1') -WorkingDir $repoRootResolved -ExtraArgs @{ Path = $repoRootResolved }

[pscustomobject]@{
    RepoRoot      = $repoRootResolved
    Dirty         = [bool]($status | Where-Object { $_ -and $_ -notmatch '^##' })
    Status        = @($status)
    CurrentBranch = $currentBranch
    OpenPrs       = [pscustomobject]@{ Available = ($openPr.ExitCode -eq 0); Items = if ($openPr.ExitCode -eq 0 -and $openPr.Output) { $openPr.Output | ConvertFrom-Json } else { @() } }
    MergedPrs     = [pscustomobject]@{ Available = ($mergedPr.ExitCode -eq 0); Items = if ($mergedPr.ExitCode -eq 0 -and $mergedPr.Output) { $mergedPr.Output | ConvertFrom-Json } else { @() } }
    Frozen        = $frozen
    FrozenContent = $frozenContent
    DesignDrift   = $drift
    DesignState   = $state
}
