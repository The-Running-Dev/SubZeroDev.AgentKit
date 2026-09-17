#Requires -Version 7.0
<#
.SYNOPSIS
    Checks that a target repository's working-tree changes fall within an allowed-prefix
    list, and reports the offending paths if not.

.DESCRIPTION
    Ported from `oz/repo_local.py::assert_write_surface` (research/oz-for-oss.md, F2/P7):
    a mechanically enforced write surface for an unattended, multi-repository pass. Oz runs
    `git diff --name-only base...branch` before push and aborts on anything outside an
    allowed-prefix list. This script reads `git status --porcelain` in the target instead of
    a commit range, and is run once per target immediately after that target's writes are
    applied, before /install-all reports that target as done.

    Since home install (`INSTALL.md` phase 4), `skills/`, `tools/` and `.claude/COMPANIONS.md`
    are kit-owned and never copied into a target - `/install-all`'s one-time migration only
    ever *deletes* a previously-copied file under one of those, matching a released kit
    version, and never adds or edits one. So they are not full write-surface entries: a
    deletion under one is allowed, an addition or modification is not. `-DeleteOnlyPrefixes`
    carries that narrower permission; `-AllowedPrefixes` keeps its old meaning of "add, edit,
    or delete freely" for the per-repo files `/install-all` still writes (the pointer section
    in `AGENTS.md`/`CLAUDE.md`, `design/`'s seed, issue templates, `.claude/kit.json`).

    This is the canonical, checkable list of what /install-all is allowed to write - keep it
    in step with INSTALL.md's phase 1 artifact table and .claude/kit.json/`syncedCommit`
    (AGENTS.shared.md, "A document states only what the tree cannot": the list lives here, once,
    and skills/install-all/SKILL.md points at this file rather than repeating it).
    `.claude/settings.json` is deliberately absent - INSTALL.md requires proposing its two
    hook keys and waiting on sign-off unconditionally, which /install-all's unattended pass
    always skips (install-all.md, phase 2's "named fork with no default" list), so a write
    there is never expected and the guard should catch it, not allow it.

.PARAMETER TargetRepo
    Repository whose working tree is checked. Defaults to the current directory.

.PARAMETER AllowedPrefixes
    Overrides the default add-or-delete allowed-prefix list. Exact strings match a single
    file; strings ending in `/` match themselves as a directory and everything under it.

.PARAMETER DeleteOnlyPrefixes
    Overrides the default delete-only prefix list - matched the same way as
    -AllowedPrefixes, but a change under one of these is only in-surface when it is a
    deletion. An add or a modification there is out of surface even though the path matches.

.PARAMETER Revert
    Reverts every offending path after reporting it - `git checkout --` for a tracked
    change, delete for an untracked file. Off by default (house convention: destructive
    operations gate on an explicit flag, not a prompt, but never run silently either).

.PARAMETER Quiet
    Suppresses the human-readable report only. The result object is always emitted.

.EXAMPLE
    ./tools/Test-WriteSurface.ps1 -TargetRepo D:\Projects\Some.Repo

.EXAMPLE
    ./tools/Test-WriteSurface.ps1 -TargetRepo D:\Projects\Some.Repo -Revert
    Reverts anything outside the allowed prefixes instead of just reporting it.
#>
[CmdletBinding()]
param(
    [string]   $TargetRepo = (Get-Location).Path,
    [string[]] $AllowedPrefixes,
    [string[]] $DeleteOnlyPrefixes,
    [switch]   $Revert,
    [switch]   $Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# git status exits non-zero when the path is not a git repository at all; on PowerShell
# 7.3+ that would otherwise become a terminating error under $ErrorActionPreference = 'Stop'
# before the exit code can be read as the (expected) NotEvaluated case below.
$PSNativeCommandUseErrorActionPreference = $false

function Get-DefaultAllowedPrefixes {
    @(
        'AGENTS.md'
        'CLAUDE.md'
        'agent.md'
        'design/'
        '.github/ISSUE_TEMPLATE/'
        'codex/PROFILES.md'
        '.claude/kit.json'
    )
}

<#
    skills/, tools/ and .claude/COMPANIONS.md are kit-owned and never copied into a target
    (INSTALL.md phase 4) - /install-all's one-time migration only deletes a previously-copied
    file under one of these, never adds or edits one, so they carry delete-only permission
    rather than sitting in Get-DefaultAllowedPrefixes.
#>
function Get-DefaultDeleteOnlyPrefixes {
    @(
        'skills/'
        'tools/'
        '.claude/COMPANIONS.md'
    )
}

function Test-PathInSurface {
    param([Parameter(Mandatory)][string] $Path, [Parameter(Mandatory)][string[]] $AllowedPrefixes)

    $normalized = $Path -replace '\\', '/'
    foreach ($prefix in $AllowedPrefixes) {
        if ($prefix.EndsWith('/')) {
            if ($normalized -eq $prefix.TrimEnd('/') -or $normalized.StartsWith($prefix)) { return $true }
        } elseif ($normalized -eq $prefix) {
            return $true
        }
    }
    $false
}

<#
    A deletion shows as 'D ' (staged) or ' D' (unstaged) in --porcelain=v1's two-character
    status; a rename/copy line was already reduced to its destination path in
    Get-ChangedPaths, which is never itself a deletion.
#>
function Test-PathIsAllowedChange {
    param(
        [Parameter(Mandatory)][string] $Path,
        [Parameter(Mandatory)][string] $Status,
        [Parameter(Mandatory)][string[]] $AllowedPrefixes,
        [Parameter(Mandatory)][string[]] $DeleteOnlyPrefixes
    )

    if (Test-PathInSurface -Path $Path -AllowedPrefixes $AllowedPrefixes) { return $true }
    if (Test-PathInSurface -Path $Path -AllowedPrefixes $DeleteOnlyPrefixes) {
        return $Status.Contains('D')
    }
    $false
}

<#
    Returns $null (not evaluated) rather than an empty list when git status itself fails -
    "no changes" and "could not ask" are different results, and folding the second into the
    first would report a repo that could not be checked as clean.
#>
function Get-ChangedPaths {
    param([Parameter(Mandatory)][string] $TargetRepo)

    # -uall: an untracked directory otherwise collapses to one summary line ("?? src/"),
    # which would report a whole new directory as one offending path instead of naming the
    # file actually written, and would mask an allowed file sitting next to a disallowed one.
    $raw = & git -C $TargetRepo status --porcelain=v1 -uall 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }

    $items = [System.Collections.Generic.List[object]]::new()
    foreach ($line in @($raw)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $status = $line.Substring(0, 2)
        $rest   = $line.Substring(3)
        # A rename/copy line is "XY orig -> new"; only the new path is a live write.
        $path = if ($rest -match '^(?<from>.+) -> (?<to>.+)$') { $Matches['to'] } else { $rest }
        $items.Add([pscustomobject]@{ Status = $status; Path = $path.Trim('"') })
    }
    # The unary comma forces this out as one array object even when $items is empty - without
    # it PowerShell unravels an empty array to zero pipeline outputs, and the caller's `$x =`
    # collapses that to $null, indistinguishable from the "git status failed" case above.
    ,@($items)
}

function Invoke-WriteSurfaceCheck {
    param(
        [Parameter(Mandatory)][string] $TargetRepo,
        [string[]] $AllowedPrefixes = (Get-DefaultAllowedPrefixes),
        [string[]] $DeleteOnlyPrefixes = (Get-DefaultDeleteOnlyPrefixes)
    )

    $changed = Get-ChangedPaths -TargetRepo $TargetRepo
    if ($null -eq $changed) {
        return [pscustomobject]@{
            State          = 'NotEvaluated'
            OffendingPaths = @()
            ChangedPaths   = @()
            Detail         = "'$TargetRepo' is not a git repository, or `git status` could not run there."
        }
    }

    $offending = @($changed | Where-Object {
            -not (Test-PathIsAllowedChange -Path $_.Path -Status $_.Status -AllowedPrefixes $AllowedPrefixes -DeleteOnlyPrefixes $DeleteOnlyPrefixes)
        })
    $state = if ($offending.Count -gt 0) { 'OutOfSurface' } else { 'InSurface' }

    [pscustomobject]@{
        State          = $state
        OffendingPaths = @($offending)
        ChangedPaths   = @($changed)
        Detail         = ''
    }
}

<#
    Tracked changes revert with `git checkout --`; an untracked ('??') path has nothing in
    the index to check out and is deleted instead. Returns the paths actually reverted.
#>
function Invoke-WriteSurfaceRevert {
    param([Parameter(Mandatory)][string] $TargetRepo, [Parameter(Mandatory)][object[]] $OffendingItems)

    $reverted = [System.Collections.Generic.List[string]]::new()
    foreach ($item in $OffendingItems) {
        if ($item.Status -eq '??') {
            $full = Join-Path $TargetRepo $item.Path
            if (Test-Path -LiteralPath $full) { Remove-Item -LiteralPath $full -Force -Recurse }
        } else {
            & git -C $TargetRepo checkout -- $item.Path 2>$null | Out-Null
        }
        $reverted.Add($item.Path)
    }
    ,@($reverted)
}

function Get-WriteSurfaceExitCode {
    param([string] $State)
    switch ($State) {
        'InSurface'    { 0 }
        'OutOfSurface' { 1 }
        'NotEvaluated' { 2 }
        default        { throw "Unknown write-surface state: $State" }
    }
}

function Write-WriteSurfaceReport {
    param([Parameter(Mandatory)][object] $Result, [switch] $Reverted)

    switch ($Result.State) {
        'InSurface' {
            Write-Host "Write surface OK - $($Result.ChangedPaths.Count) changed path(s), all within the allowed prefixes."
        }
        'OutOfSurface' {
            Write-Host "Write surface VIOLATED - $($Result.OffendingPaths.Count) path(s) outside the allowed prefixes:"
            foreach ($item in $Result.OffendingPaths) { Write-Host "  [$($item.Status)] $($item.Path)" }
            if ($Reverted) { Write-Host 'Reverted.' }
        }
        'NotEvaluated' {
            Write-Host "Could not evaluate: $($Result.Detail)"
        }
    }
}

# Guards the exit-calling wrapper so this script's tests can dot-source it instead - see
# Test-DesignDrift.ps1/Wait-PullRequestCheck.ps1 for the same structure and why.
if ($MyInvocation.InvocationName -ne '.') {
    $prefixes = if ($AllowedPrefixes) { $AllowedPrefixes } else { Get-DefaultAllowedPrefixes }
    $deleteOnlyPrefixes = if ($DeleteOnlyPrefixes) { $DeleteOnlyPrefixes } else { Get-DefaultDeleteOnlyPrefixes }
    $result = Invoke-WriteSurfaceCheck -TargetRepo $TargetRepo -AllowedPrefixes $prefixes -DeleteOnlyPrefixes $deleteOnlyPrefixes

    if ($Revert -and $result.State -eq 'OutOfSurface') {
        Invoke-WriteSurfaceRevert -TargetRepo $TargetRepo -OffendingItems $result.OffendingPaths | Out-Null
        if (-not $Quiet) { Write-WriteSurfaceReport -Result $result -Reverted }
    } elseif (-not $Quiet) {
        Write-WriteSurfaceReport -Result $result
    }

    $result
    exit (Get-WriteSurfaceExitCode -State $result.State)
}
