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
    model session opened afterward) can pick the row in AGENTS.shared.md § *Session boundaries* /
    next.md's decision table without a model having spent anything gathering the inputs to it.

    This script decides nothing. It does not pick a row, and it does not open a session.
    Reading its output and choosing what runs next stays exactly the judgement call next.md
    already says it is.

.PARAMETER RepoRoot
    Repository to read. Defaults to the current directory.

.PARAMETER KitRoot
    The AgentKit checkout to read the canonical gate scripts (tools/Test-DesignDrift.ps1,
    tools/Test-DesignState.ps1) from. Defaults to the Home-install convention
    (AGENTS.shared.md, *House conventions*): a self-hosted checkout containing this script,
    then $env:AGENTKIT_HOME, then $HOME/.agent-kit. An installed target repository carries no
    canonical tools/ directory of its own, so those scripts are resolved against the kit
    rather than -RepoRoot; every other read (design/, the git status, the branch, gh) still
    targets -RepoRoot.

.EXAMPLE
    ./tools/Get-NextOrientation.ps1
#>
[CmdletBinding()]
param(
    [string] $RepoRoot = (Get-Location).Path,
    [string] $KitRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    throw "RepoRoot '$RepoRoot' does not exist."
}
$repoRootResolved = (Resolve-Path -LiteralPath $RepoRoot).Path

function Resolve-AgentKitRoot {
    <#
        Home-install convention (AGENTS.shared.md, *House conventions*): self-hosted checkout
        first (a live kit working tree, so kit development reads its own uncommitted edits),
        then $env:AGENTKIT_HOME, then $HOME/.agent-kit. Same shape as Test-Companion.ps1's
        function of the same name, New-DesignDocs.ps1's Resolve-KitRoot, and
        Invoke-CodexCommand.ps1's Get-AgentKitInstallRoot.
    #>
    param([string] $Explicit)

    if ($Explicit) {
        return (Resolve-Path -LiteralPath $Explicit).Path
    }

    $selfHosted = Split-Path -Parent $PSScriptRoot
    if (Test-Path -LiteralPath (Join-Path $selfHosted '.git')) {
        return $selfHosted
    }

    if ($env:AGENTKIT_HOME -and (Test-Path -LiteralPath $env:AGENTKIT_HOME)) {
        return $env:AGENTKIT_HOME
    }

    $synced = Join-Path $HOME '.agent-kit'
    if (Test-Path -LiteralPath $synced) {
        return $synced
    }

    throw "Could not find a kit checkout under '$selfHosted', `$env:AGENTKIT_HOME, or '$synced'. Pass -KitRoot explicitly."
}

$kitRootResolved = Resolve-AgentKitRoot -Explicit $KitRoot

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
    #
    # -Quiet suppresses the target's own Write-Host report and leaves its result object as
    # the only thing on the pipeline, so $resultObj is that object itself - never the merged,
    # stringified dump `*>&1 | Out-String` used to produce here (AGENTS.shared.md, *Output discipline*).
    param([string]$Path, [string]$WorkingDir, [hashtable]$ExtraArgs = @{})
    if (-not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{ Ran = $false; ExitCode = $null; Result = $null }
    }
    Push-Location $WorkingDir
    try {
        # A hashtable splat, not an array one - array splatting binds positionally and
        # would hand the target script's own -Path a literal "-Path" string instead of
        # matching it by name.
        $resultObj = & $Path @ExtraArgs -Quiet
        return [pscustomobject]@{ Ran = $true; ExitCode = $LASTEXITCODE; Result = $resultObj }
    }
    finally { Pop-Location }
}

function Get-ResultProperty {
    # Set-StrictMode throws on a missing property, and a fixture stub in a test is under no
    # obligation to carry the real gate scripts' full result shape - so Summary text falls
    # back to $null for a property that isn't there instead of throwing.
    #
    # Write-Output -NoEnumerate, not a bare `return`: a plain `return $Result.$Name` sends an
    # array value through the pipeline, which unwraps it - a one-element array collapses to a
    # bare scalar at the caller (losing .Count under strict mode) and an empty array collapses
    # to $null entirely. -NoEnumerate hands the property back exactly as it is.
    param($Result, [string]$Name)
    if ($null -eq $Result) { return $null }
    if ($Result.PSObject.Properties.Match($Name).Count -eq 0) { return $null }
    Write-Output -NoEnumerate $Result.$Name
}

function Get-GateSummary {
    # The plain-language sentence each gate result carries next to it, so a reader (or
    # Get-AgentKitNext) never has to translate ExitCode or Result into words themselves.
    param([Parameter(Mandatory)][string]$Label, [Parameter(Mandatory)]$Gate)
    if (-not $Gate.Ran) { return "$Label`: script not present" }
    switch ($Label) {
        'Design drift' {
            switch (Get-ResultProperty -Result $Gate.Result -Name 'State') {
                'Clean'        { return 'Design drift: none' }
                'Drifted'      { return "Design drift: $((Get-ResultProperty -Result $Gate.Result -Name 'Findings').Count) findings" }
                'NotEvaluated' { return 'Design drift: could not evaluate' }
                default        { return "Design drift: exit $($Gate.ExitCode)" }
            }
        }
        'Design state' {
            $couldNotEvaluate = Get-ResultProperty -Result $Gate.Result -Name 'CouldNotEvaluate'
            $findings = Get-ResultProperty -Result $Gate.Result -Name 'Findings'
            $reported = Get-ResultProperty -Result $Gate.Result -Name 'Reported'
            if ($couldNotEvaluate -and $couldNotEvaluate.Count -gt 0) { return 'Design state: could not evaluate' }
            if ($findings -and $findings.Count -gt 0) { return "Design state: $($findings.Count) blocking findings" }
            if ($reported -and $reported.Count -gt 0) { return "Design state: $($reported.Count) non-blocking findings" }
            return 'Design state: clean'
        }
    }
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

$drift = Invoke-GateScript -Path (Join-Path $kitRootResolved 'tools/Test-DesignDrift.ps1') -WorkingDir $repoRootResolved -ExtraArgs $driftExtraArgs
$state = Invoke-GateScript -Path (Join-Path $kitRootResolved 'tools/Test-DesignState.ps1') -WorkingDir $repoRootResolved -ExtraArgs @{ Path = $repoRootResolved }
$drift | Add-Member -NotePropertyName Summary -NotePropertyValue (Get-GateSummary -Label 'Design drift' -Gate $drift)
$state | Add-Member -NotePropertyName Summary -NotePropertyValue (Get-GateSummary -Label 'Design state' -Gate $state)

$dirty = [bool]($status | Where-Object { $_ -and $_ -notmatch '^##' })
$openPrAvailable = ($openPr.ExitCode -eq 0)
$mergedPrAvailable = ($mergedPr.ExitCode -eq 0)
# @(...) around the whole if/else forces array-coercion: `'[]' | ConvertFrom-Json` returns $null
# (not an empty array), and a single-object JSON array unwraps to a bare PSCustomObject - either
# throws on .Count under strict mode without this. @(...) inside just one branch isn't enough -
# assigning an if/else's own result collapses an empty-array branch back to $null.
$openPrItems = @(if ($openPrAvailable -and $openPr.Output) { $openPr.Output | ConvertFrom-Json })
$mergedPrItems = @(if ($mergedPrAvailable -and $mergedPr.Output) { $mergedPr.Output | ConvertFrom-Json })

$summary = "Branch $currentBranch, working tree $(if ($dirty) { 'dirty' } else { 'clean' })$(if ($frozen) { ', design/ frozen' })"

[pscustomobject]@{
    RepoRoot      = $repoRootResolved
    Dirty         = $dirty
    Status        = @($status)
    CurrentBranch = $currentBranch
    Summary       = $summary
    OpenPrs       = [pscustomobject]@{
        Available = $openPrAvailable
        Items     = $openPrItems
        Summary   = if ($openPrAvailable) { "Open PRs: $($openPrItems.Count)" } else { 'GitHub CLI unavailable: pull requests not checked' }
    }
    MergedPrs     = [pscustomobject]@{
        Available = $mergedPrAvailable
        Items     = $mergedPrItems
        Summary   = if ($mergedPrAvailable) { "Recently merged PRs: $($mergedPrItems.Count)" } else { 'GitHub CLI unavailable: merged pull requests not checked' }
    }
    Frozen        = $frozen
    FrozenContent = $frozenContent
    DesignDrift   = $drift
    DesignState   = $state
}
