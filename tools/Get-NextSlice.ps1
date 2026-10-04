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
        pull request from this repository into the default branch whose head is slice/S<n>...
        is resumed (two such pull requests are Blocked, never a guess); failing that, a local or
        origin slice/S<n>... branch with commits the default branch does not have, or a local
        one with no commits yet (work interrupted before its first commit or its pull request).
      - Otherwise the first slice in document order whose Status is not done and whose
        Depends on: slices are all done is started. Slices named below a "## Landed" heading
        are history and count as done.

    It also lists the files with uncommitted changes (DirtyFiles) and splits them in two.
    GuardedFiles are someone else's: they were already uncommitted when the slice started and
    ride across the branch switch, so the caller never stages them, and a slice that must
    change one is a blocker. OwnFiles are the slice's own edits from a run that was interrupted
    before committing them, so a resumed run carries on with them. On Start the script records
    the dirty files of that moment in the worktree's git directory (agentkit/next-guard.json,
    never in the tree); on Resume that record is what tells the two apart. Without a record
    for the slice, every dirty file is guarded: unknown ownership fails safe.

    Apart from the fetch and that record it never writes: it never switches branches, stages
    or stashes.
    Never prompts. Exit codes: 0 for Resume, Start and Finished; 1 for Blocked.

.PARAMETER RepoRoot
    Repository to inspect. Defaults to the current directory.

.PARAMETER DefaultBranch
    Override the default branch instead of resolving it from origin's HEAD.

.PARAMETER Slice
    A slice id (S12 or 12) to take instead of the first eligible one: /next's $1.

.PARAMETER PullRequestsJson
    The open pull requests as
    `gh pr list --json number,headRefName,baseRefName,isCrossRepository,url` would print them,
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
        try { $Json = (& gh pr list --state open --limit 200 --json number,headRefName,baseRefName,isCrossRepository,url 2>&1) -join "`n" }
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
        Base = $null; DefaultBranch = $null; DirtyFiles = @(); GuardedFiles = @(); OwnFiles = @()
        Reason = $null; Detail = $null
    }
    $guardPath = (Invoke-Git $root @('rev-parse','--git-path','agentkit/next-guard.json')).Output
    if (-not [IO.Path]::IsPathRooted($guardPath)) { $guardPath = Join-Path $root $guardPath }
    function Complete([string] $State, [string] $Reason, [string] $Detail) {
        $result.State = $State; $result.Reason = $Reason; $result.Detail = $Detail
        $result.GuardedFiles = $result.DirtyFiles
        if ($State -eq 'Start') {
            # Dirty before the slice's first edit, so someone else's for the whole slice.
            New-Item -ItemType Directory -Path (Split-Path $guardPath) -Force | Out-Null
            [ordered]@{ Slice = $result.Slice; Files = @($result.DirtyFiles) } | ConvertTo-Json |
                Set-Content -LiteralPath $guardPath -Encoding utf8NoBOM
        }
        elseif ($State -eq 'Resume' -and (Test-Path -LiteralPath $guardPath)) {
            $guard = Get-Content -LiteralPath $guardPath -Raw | ConvertFrom-Json
            if ($guard.Slice -eq $result.Slice) {
                $result.GuardedFiles = @($result.DirtyFiles | Where-Object { @($guard.Files) -contains $_ })
                $result.OwnFiles = @($result.DirtyFiles | Where-Object { @($guard.Files) -notcontains $_ })
            }
        }
        [pscustomobject]$result
    }

    # Not through Invoke-Git: its trim would eat the status column of the first line.
    $status = @(& git -C $root -c core.quotepath=false status --porcelain --untracked-files=all 2>$null)
    $result.DirtyFiles = @($status | Where-Object { $_.Length -gt 3 } | ForEach-Object { ($_.Substring(3) -split ' -> ')[-1].Trim('"') })

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
    # Only this repository's pull requests into the default branch: a fork's branch name says
    # nothing about this slice.
    $prs = @($prs | Where-Object {
        $_.PSObject.Properties['isCrossRepository'] -and -not $_.isCrossRepository -and
        $_.PSObject.Properties['baseRefName'] -and $_.baseRefName -eq $DefaultBranch })
    # A branch is work in flight when it has commits the default branch lacks, or, for a local
    # branch, when it has none yet: a run interrupted before its first commit.
    $refs = @((Invoke-Git $root @('for-each-ref','--format=%(refname)','refs/heads/slice/','refs/remotes/origin/slice/')).Output -split "`n" | Where-Object { $_ })
    $inFlight = @($refs | ForEach-Object {
            $ahead = (Invoke-Git $root @('merge-base','--is-ancestor',$_,$base)).ExitCode -eq 1
            if ($ahead -or $_ -like 'refs/heads/*') {
                [pscustomobject]@{ Name = $_ -replace '^refs/(heads|remotes/origin)/', ''; Ahead = $ahead }
            }
        } | Group-Object Name | ForEach-Object {
            [pscustomobject]@{ Name = $_.Name; Empty = -not @($_.Group | Where-Object Ahead).Count }
        })

    foreach ($s in $pending) {
        $pattern = "^slice/S$($s.Id)(?![0-9])"
        $matching = @($prs | Where-Object { $_.headRefName -match $pattern })
        if ($matching.Count -gt 1) {
            $result.Slice = "S$($s.Id)"
            return Complete 'Blocked' 'AmbiguousPullRequest' "S$($s.Id) has more than one open pull request: $(($matching | ForEach-Object { "#$($_.number) $($_.headRefName)" }) -join ', ')."
        }
        if ($matching.Count -eq 1) {
            $pr = $matching[0]
            $result.Slice = "S$($s.Id)"; $result.Branch = $pr.headRefName
            $result.PullRequest = [int]$pr.number; $result.PullRequestUrl = $pr.url
            return Complete 'Resume' 'OpenPullRequest' "S$($s.Id) has open pull request #$($pr.number) on $($pr.headRefName)."
        }
        $branches = @($inFlight | Where-Object { $_.Name -match $pattern })
        if ($branches.Count -gt 1) {
            $result.Slice = "S$($s.Id)"
            return Complete 'Blocked' 'AmbiguousBranch' "S$($s.Id) has work in flight on more than one branch: $(($branches | ForEach-Object Name) -join ', ')."
        }
        if ($branches.Count -eq 1) {
            $b = $branches[0]
            $result.Slice = "S$($s.Id)"; $result.Branch = $b.Name
            if ($b.Empty) { return Complete 'Resume' 'EmptyBranch' "S$($s.Id) has branch $($b.Name) with no commits yet and no open pull request." }
            return Complete 'Resume' 'UnmergedBranch' "S$($s.Id) has unmerged work on $($b.Name) and no open pull request."
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
        Write-Host "Next slice: $($result.State)$(if ($what) { " $($what -join ' ')" }) - $($result.Detail)$(if ($result.GuardedFiles.Count) { " Uncommitted, never stage: $($result.GuardedFiles -join ', ')." })$(if ($result.OwnFiles.Count) { " Uncommitted slice work to carry on: $($result.OwnFiles -join ', ')." })"
    }
    $result
    exit $(if ($result.State -eq 'Blocked') { 1 } else { 0 })
}
