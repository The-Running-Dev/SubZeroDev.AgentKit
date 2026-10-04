#Requires -Version 7.0
<#
.SYNOPSIS
    Decides what /next does now: resume a slice already in flight, start the next one, or stop
    because the plan is finished or blocked.

.DESCRIPTION
    /next is meant to be safe to run again after any interruption. Reconstructing where it got
    to from prose is how a run picks the wrong slice, so this script works it out from facts
    every time, and keeps no state of its own:

      - The plan is read from origin/<default branch> after a fetch, never from the working
        copy. A slice's Status: done only counts once its pull request has merged, so a branch
        carrying an unmerged "done", or a local default branch a failed pull left behind,
        cannot decide what is finished. A fetch that fails stops the run with git's own error.
      - Work already in flight wins over new work. For each slice that is not done, an open
        pull request whose head is slice/S<n>... is resumed; failing that, a local or
        origin slice/S<n>... branch with commits the default branch does not have (work
        that was interrupted before its pull request was opened).
      - Otherwise the first slice in document order whose Status is not done and whose
        Depends on: slices are all done is started. Slices named below a "## Landed" heading
        are history and count as done.

    It also reports whether the working tree is dirty, so the caller builds in a separate
    worktree rather than carrying someone else's uncommitted work into the slice branch.

    Read-only apart from the fetch: it never switches branches, writes, stages or stashes.
    Never prompts. Exit codes: 0 for Resume, Start and Finished; 1 for Blocked.

.PARAMETER RepoRoot
    Repository to inspect. Defaults to the current directory.

.PARAMETER DefaultBranch
    Override the default branch instead of resolving it from origin's HEAD.

.PARAMETER Slice
    A slice id (S12 or 12) to take instead of the first eligible one: /next's $1.

.PARAMETER PullRequestsJson
    The open pull requests as `gh pr list --json number,headRefName,url` would print them,
    instead of calling gh. For tests and for hosts without gh.

.PARAMETER Quiet
    Suppresses the human-readable line only. The result object is always emitted.

.EXAMPLE
    pwsh ./tools/Get-NextSlice.ps1
#>
[CmdletBinding()]
param(
    [string] $RepoRoot,
    [string] $DefaultBranch,
    [string] $Slice,
    [string] $PullRequestsJson,
    [switch] $Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:LandedHeading = '(?m)^## Landed\b'

function Invoke-Git {
    param([string] $Root, [string[]] $GitArgs)
    $output = & git -C $Root @GitArgs 2>&1
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = (@($output) -join "`n").Trim() }
}

# The ## S<n> slices above any ## Landed heading, in document order, and the ids named below it.
function Get-SlicePlan {
    param([string] $Text)
    $m = [regex]::Match($Text, $script:LandedHeading)
    $live = if ($m.Success) { $Text.Substring(0, $m.Index) } else { $Text }
    $landed = $Text.Substring($live.Length)
    $headings = @([regex]::Matches($live, '(?m)^## S(\d+)\b'))
    $slices = foreach ($h in $headings) {
        $rest = $live.Substring($h.Index + $h.Length)
        $next = [regex]::Match($rest, '(?m)^#{1,2} ')
        $body = if ($next.Success) { $rest.Substring(0, $next.Index) } else { $rest }
        $status = [regex]::Match($body, '(?m)^Status:[ \t]*(\S+)')
        $dep = [regex]::Match($body, '(?m)^Depends on:(.*)$')
        [pscustomobject]@{
            Id        = [int]$h.Groups[1].Value
            Done      = $status.Success -and $status.Groups[1].Value -eq 'done'
            DependsOn = @(if ($dep.Success) { [regex]::Matches($dep.Groups[1].Value, '\bS?(\d+)\b') | ForEach-Object { [int]$_.Groups[1].Value } })
        }
    }
    [pscustomobject]@{
        Slices = @($slices)
        Landed = @([regex]::Matches($landed, '\bS(\d+)\b') | ForEach-Object { [int]$_.Groups[1].Value })
    }
}

function Get-OpenPullRequest {
    param([string] $Root, [string] $Json)
    if (-not $Json) {
        Push-Location -LiteralPath $Root
        try { $Json = (& gh pr list --state open --limit 200 --json number,headRefName,url 2>&1) -join "`n" }
        finally { Pop-Location }
        if ($LASTEXITCODE) { throw "gh pr list failed: $Json" }
    }
    @($Json | ConvertFrom-Json)
}

function Get-NextSlice {
    param(
        [Parameter(Mandatory)] [string] $RepoRoot,
        [string] $DefaultBranch,
        [string] $Slice,
        [string] $PullRequestsJson
    )
    $root = (Resolve-Path -LiteralPath $RepoRoot).Path
    $result = [ordered]@{
        State = $null; Slice = $null; Branch = $null; PullRequest = $null; PullRequestUrl = $null
        Base = $null; DefaultBranch = $null; Dirty = $false; Reason = $null; Detail = $null
    }
    function Complete([string] $State, [string] $Reason, [string] $Detail) {
        $result.State = $State; $result.Reason = $Reason; $result.Detail = $Detail
        [pscustomobject]$result
    }

    $result.Dirty = [bool](Invoke-Git $root @('status','--porcelain')).Output

    if (-not $DefaultBranch) {
        $head = Invoke-Git $root @('symbolic-ref','--short','refs/remotes/origin/HEAD')
        if ($head.ExitCode -eq 0 -and $head.Output -match '^origin/(.+)$') { $DefaultBranch = $Matches[1] }
        else {
            $show = Invoke-Git $root @('remote','show','origin')
            if ($show.Output -match '(?m)HEAD branch:\s*(\S+)' -and $Matches[1] -ne '(unknown)') { $DefaultBranch = $Matches[1] }
            else { return Complete 'Blocked' 'NoDefaultBranch' "Could not resolve origin's default branch: $($show.Output) Pass -DefaultBranch." }
        }
    }
    $base = "origin/$DefaultBranch"
    $result.DefaultBranch = $DefaultBranch; $result.Base = $base

    $fetch = Invoke-Git $root @('fetch','--prune','origin')
    if ($fetch.ExitCode) { return Complete 'Blocked' 'FetchFailed' "git fetch origin failed, so $base may be stale: $($fetch.Output)" }

    $show = Invoke-Git $root @('show',"${base}:design/30-slices.md")
    if ($show.ExitCode) { return Complete 'Blocked' 'NoPlan' "No design/30-slices.md on ${base}: $($show.Output)" }
    $plan = Get-SlicePlan $show.Output

    $done = @($plan.Landed) + @($plan.Slices | Where-Object Done | ForEach-Object Id)
    $pending = @($plan.Slices | Where-Object { -not $_.Done })

    $wanted = $null
    if ($Slice) {
        if ($Slice -notmatch '^[Ss]?(\d+)$') { return Complete 'Blocked' 'UnknownSlice' "'$Slice' is not a slice id." }
        $id = [int]$Matches[1]
        $wanted = @($plan.Slices | Where-Object Id -eq $id) | Select-Object -First 1
        if (-not $wanted) { return Complete 'Blocked' 'UnknownSlice' "S$id is not a slice heading on $base." }
        $result.Slice = "S$id"
        if ($wanted.Done) { return Complete 'Blocked' 'AlreadyDone' "S$id is already done on $base." }
        $pending = @($wanted)
    }
    if (-not $pending.Count) { return Complete 'Finished' $null "Every slice on $base is done." }

    try { $prs = Get-OpenPullRequest -Root $root -Json $PullRequestsJson }
    catch { return Complete 'Blocked' 'PullRequestsUnavailable' "$_" }
    # A branch only counts as work in flight when it has commits the default branch lacks.
    $refs = @((Invoke-Git $root @('for-each-ref','--format=%(refname)','refs/heads/slice/','refs/remotes/origin/slice/')).Output -split "`n" | Where-Object { $_ })
    $unmerged = @($refs | Where-Object { (Invoke-Git $root @('merge-base','--is-ancestor',$_,$base)).ExitCode -eq 1 } |
        ForEach-Object { $_ -replace '^refs/(heads|remotes/origin)/', '' } | Sort-Object -Unique)

    foreach ($s in $pending) {
        $pattern = "^slice/S$($s.Id)(?![0-9])"
        $pr = @($prs | Where-Object { $_.headRefName -match $pattern }) | Select-Object -First 1
        if ($pr) {
            $result.Slice = "S$($s.Id)"; $result.Branch = $pr.headRefName
            $result.PullRequest = [int]$pr.number; $result.PullRequestUrl = $pr.url
            return Complete 'Resume' 'OpenPullRequest' "S$($s.Id) has open pull request #$($pr.number) on $($pr.headRefName)."
        }
        $branches = @($unmerged | Where-Object { $_ -match $pattern })
        if ($branches.Count -gt 1) {
            $result.Slice = "S$($s.Id)"
            return Complete 'Blocked' 'AmbiguousBranch' "S$($s.Id) has unmerged work on more than one branch: $($branches -join ', ')."
        }
        if ($branches.Count -eq 1) {
            $result.Slice = "S$($s.Id)"; $result.Branch = $branches[0]
            return Complete 'Resume' 'UnmergedBranch' "S$($s.Id) has unmerged work on $($branches[0]) and no open pull request."
        }
    }

    $waiting = @()
    foreach ($s in $pending) {
        $missing = @($s.DependsOn | Where-Object { $done -notcontains $_ })
        if (-not $missing.Count) {
            $result.Slice = "S$($s.Id)"
            return Complete 'Start' $null "Start S$($s.Id) from $base."
        }
        $waiting += "S$($s.Id) waits on $(($missing | ForEach-Object { "S$_" }) -join ', ')"
    }
    Complete 'Blocked' 'NoEligibleSlice' "Slices remain but none can start: $($waiting -join '; ')."
}

if ($MyInvocation.InvocationName -ne '.') {
    if (-not $RepoRoot) { $RepoRoot = (Get-Location).Path }
    $result = Get-NextSlice -RepoRoot $RepoRoot -DefaultBranch $DefaultBranch -Slice $Slice -PullRequestsJson $PullRequestsJson
    if (-not $Quiet) {
        $what = @($result.Slice, $result.Branch, $(if ($result.PullRequest) { "#$($result.PullRequest)" })) | Where-Object { $_ }
        Write-Host "Next slice: $($result.State)$(if ($what) { " $($what -join ' ')" }) - $($result.Detail)$(if ($result.Dirty) { ' Working tree is dirty: build in a separate worktree.' })"
    }
    $result
    exit $(if ($result.State -eq 'Blocked') { 1 } else { 0 })
}
