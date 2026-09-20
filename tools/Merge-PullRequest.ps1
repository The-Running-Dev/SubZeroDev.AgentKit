#Requires -Version 7.0
<#
.SYNOPSIS
    Merges a pull request only when every merge precondition is independently confirmed green
    against a named head SHA, and refuses - never asks - when any one of them is not.

.DESCRIPTION
    `AGENTS.shared.md` § *Git and delivery* delegates merge-when-green. This script is the whole
    of that delegation: the decision to merge is computed here, from observable state, rather
    than judged by a model reading a checks page. That placement is the point - a merge gate
    made of prose is re-interpreted on every invocation, and the one interpretation nobody
    notices is the permissive one.

    Preconditions, all required, evaluated in this order:

      1. The pull request is OPEN, is not a draft, and its head is exactly -HeadSha.
      2. Every check on that head reached a terminal PASSING state - delegated in full to
         Wait-PullRequestCheck.ps1, which owns bucket classification and the head-moved
         invariant (I2). Its NotEvaluated states are carried through verbatim.
      3. Zero unresolved review threads. `isResolved:false` is a merge blocker under
         `required_review_thread_resolution` regardless of what the checks say, and is treated
         as one here unconditionally - a thread nobody answered is the reviewer's objection
         still standing, whether or not the branch protection happens to enforce it.
      4. The head is re-read and still matches, and the merge call itself carries
         `--match-head-commit`, so GitHub rejects the merge server-side if the head moved in
         the window this script cannot close on its own.

    FAILS CLOSED, ALWAYS. Every unknown is a refusal: an unreadable API, an unrecognised check
    bucket, a timeout, and - deliberately - a repository with NO checks configured at all.
    "Merge after CI passes" where there is no CI is not a pass, and the absence of a signal must
    never read as a green one.

    Never prompts (House conventions: scripts run without interactive confirmation). Never
    passes `--admin`, never force-pushes, never re-runs a check, never resolves a thread, and
    never merges anything but the exact commit named by -HeadSha.

.PARAMETER PullRequest
    The pull request number.

.PARAMETER HeadSha
    The commit this call is allowed to merge. Mandatory, with no default, for the same reason
    Wait-PullRequestCheck.ps1's is: defaulting it to the current head would let a push that
    landed after the gates ran be merged as though it had passed them.

.PARAMETER Repository
    owner/repo. Defaults to the current git remote, via gh's own resolution.

.PARAMETER Method
    squash (default), merge, or rebase.

.PARAMETER TimeoutSeconds
    How long to wait for non-terminal checks before refusing. Default 900.

.PARAMETER PollSeconds
    Delay between check polls. Default 20.

.PARAMETER DeleteBranch
    Also delete the remote branch on a successful merge.

.PARAMETER DryRun
    Evaluate every precondition and report the decision without merging. The MergeResult is
    identical except that State is 'WouldMerge' where a real run would have merged.

.EXAMPLE
    ./tools/Merge-PullRequest.ps1 -PullRequest 42 -HeadSha $sha

.EXAMPLE
    ./tools/Merge-PullRequest.ps1 -PullRequest 42 -HeadSha $sha -DryRun
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [int]    $PullRequest,
    [Parameter(Mandatory)] [string] $HeadSha,
    [string] $Repository,
    [ValidateSet('squash', 'merge', 'rebase')]
    [string] $Method         = 'squash',
    [int]    $TimeoutSeconds = 900,
    [int]    $PollSeconds    = 20,
    [switch] $DeleteBranch,
    [switch] $DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-MergeResult {
    param(
        [string]   $State,
        [string]   $HeadSha,
        [string]   $Refusal,
        [object[]] $Passed = @(),
        [object[]] $Failed = @(),
        [object[]] $NotRun = @(),
        [object[]] $UnresolvedThreads = @(),
        [string]   $Detail
    )
    [pscustomobject]@{
        State             = $State
        HeadSha           = $HeadSha
        Refusal           = $Refusal
        Passed            = @($Passed)
        Failed            = @($Failed)
        NotRun            = @($NotRun)
        UnresolvedThreads = @($UnresolvedThreads)
        Detail            = $Detail
    }
}

function Get-MergeExitCode {
    <# Pure State->exit-code map, contracted in contract/merge-pullrequest. Kept separate so
       the mapping can be verified without a real process exit. Only 'Merged' and the dry-run
       'WouldMerge' are 0: every other state, including every could-not-tell, is non-zero. #>
    param([string]$State)
    switch ($State) {
        'Merged'       { 0 }
        'WouldMerge'   { 0 }
        'Refused'      { 1 }
        'NotEvaluated' { 2 }
        default        { throw "Unknown MergeResult state: $State" }
    }
}

function Invoke-Gh {
    <# Every gh failure is data on the return object, never thrown - the same reason
       Wait-PullRequestCheck.ps1 does it this way: an exception drops the partial findings,
       which are the part worth reporting on a refusal. #>
    param([string[]]$Arguments)
    try {
        $global:LASTEXITCODE = 0
        $output = & gh @Arguments 2>&1
        [pscustomobject]@{ Text = ($output | Out-String); ExitCode = $LASTEXITCODE; CommandFound = $true }
    }
    catch [System.Management.Automation.CommandNotFoundException] {
        [pscustomobject]@{ Text = $_.Exception.Message; ExitCode = -1; CommandFound = $false }
    }
}

function Get-PullRequestState {
    <# .State/.IsDraft/.HeadSha set, or .Failure = 'GhUnavailable' | 'PullRequestMissing' #>
    param([int]$PullRequest, [string]$Repository)

    $ghArgs = @('pr', 'view', $PullRequest, '--json', 'state,isDraft,headRefOid')
    if ($Repository) { $ghArgs += @('-R', $Repository) }
    $result = Invoke-Gh -Arguments $ghArgs

    if (-not $result.CommandFound) { return [pscustomobject]@{ Failure = 'GhUnavailable' } }
    # gh's own documented convention: exit code 4 means the command requires authentication.
    if ($result.ExitCode -eq 4)    { return [pscustomobject]@{ Failure = 'GhUnavailable' } }
    if ($result.ExitCode -ne 0)    { return [pscustomobject]@{ Failure = 'PullRequestMissing' } }

    try {
        $parsed = $result.Text | ConvertFrom-Json
        [pscustomobject]@{
            State    = $parsed.state
            IsDraft  = [bool]$parsed.isDraft
            HeadSha  = $parsed.headRefOid
            Failure  = $null
        }
    }
    catch {
        [pscustomobject]@{ Failure = 'GhUnavailable' }
    }
}

function Get-UnresolvedReviewThread {
    <# .Threads set (possibly empty), or .Failure = 'GhUnavailable' | 'PullRequestMissing'.

       --paginate walks reviewThreads' own pageInfo to exhaustion, so a PR with more than 100
       threads is not silently truncated into a false zero - which on this path would be a
       merge over a standing objection. Only id/isResolved/path/line are requested: this
       script counts blockers, it never classifies or answers them (that is /resolve's, and
       skills/resolve/SKILL.md owns the query that reads comment bodies). #>
    param([int]$PullRequest, [string]$Repository)

    $query = @'
query($endCursor: String, $owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first:100, after:$endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id isResolved isOutdated path line }
      }
    }
  }
}
'@

    if ($Repository) {
        $owner, $repo = $Repository -split '/', 2
    }
    else {
        $lookup = Invoke-Gh -Arguments @('repo', 'view', '--json', 'owner,name')
        if (-not $lookup.CommandFound -or $lookup.ExitCode -eq 4) { return [pscustomobject]@{ Failure = 'GhUnavailable' } }
        if ($lookup.ExitCode -ne 0) { return [pscustomobject]@{ Failure = 'PullRequestMissing' } }
        try {
            $parsed = $lookup.Text | ConvertFrom-Json
            $owner  = $parsed.owner.login
            $repo   = $parsed.name
        }
        catch { return [pscustomobject]@{ Failure = 'GhUnavailable' } }
    }

    # --slurp is required, not optional: without it, --paginate concatenates each page's raw
    # JSON object with no separator (`{...}{...}`), which ConvertFrom-Json cannot parse as one
    # document and throws "Additional text encountered..." on any PR with more than one page of
    # threads - silently misreported below as GhUnavailable. --slurp wraps every page (even a
    # single one) in one outer JSON array, which is what the parsing below assumes.
    $result = Invoke-Gh -Arguments @(
        'api', 'graphql', '--paginate', '--slurp',
        '-f', "query=$query",
        '-f', "owner=$owner",
        '-f', "repo=$repo",
        '-F', "number=$PullRequest"
    )

    if (-not $result.CommandFound) { return [pscustomobject]@{ Failure = 'GhUnavailable' } }
    if ($result.ExitCode -eq 4)    { return [pscustomobject]@{ Failure = 'GhUnavailable' } }
    if ($result.ExitCode -ne 0)    { return [pscustomobject]@{ Failure = 'PullRequestMissing' } }

    try {
        # --slurp guarantees the whole text is one JSON array, one element per page, even
        # when there was only one page - so this always parses as a single document.
        $pages = @($result.Text | ConvertFrom-Json)
        $unresolved = [System.Collections.Generic.List[object]]::new()
        foreach ($page in $pages) {
            foreach ($node in @($page.data.repository.pullRequest.reviewThreads.nodes)) {
                if (-not $node) { continue }
                if (-not $node.isResolved) {
                    $unresolved.Add([pscustomobject]@{
                        Id         = $node.id
                        Path       = $node.path
                        Line       = $node.line
                        IsOutdated = [bool]$node.isOutdated
                    })
                }
            }
        }
        [pscustomobject]@{ Threads = @($unresolved); Failure = $null }
    }
    catch {
        [pscustomobject]@{ Failure = 'GhUnavailable' }
    }
}

function Invoke-Merge {
    param(
        [Parameter(Mandatory)] [int]    $PullRequest,
        [Parameter(Mandatory)] [string] $HeadSha,
        [string] $Repository,
        [string] $Method         = 'squash',
        [int]    $TimeoutSeconds = 900,
        [int]    $PollSeconds    = 20,
        [switch] $DeleteBranch,
        [switch] $DryRun,
        [scriptblock] $WaitForChecks
    )

    # --- 1. The pull request itself -------------------------------------------------------
    $pr = Get-PullRequestState -PullRequest $PullRequest -Repository $Repository
    if ($pr.Failure) {
        return New-MergeResult -State 'NotEvaluated' -HeadSha $HeadSha -Refusal $pr.Failure
    }
    if ($pr.State -ne 'OPEN') {
        return New-MergeResult -State 'Refused' -HeadSha $HeadSha -Refusal 'NotOpen' `
            -Detail "Pull request state is $($pr.State)."
    }
    if ($pr.IsDraft) {
        return New-MergeResult -State 'Refused' -HeadSha $HeadSha -Refusal 'IsDraft'
    }
    if ($pr.HeadSha -ne $HeadSha) {
        return New-MergeResult -State 'Refused' -HeadSha $HeadSha -Refusal 'HeadMoved' `
            -Detail "Pull request head is $($pr.HeadSha)."
    }

    # --- 2. The checks --------------------------------------------------------------------
    # Delegated whole to Wait-PullRequestCheck.ps1 rather than reimplemented: bucket
    # classification and the head-moved invariant have exactly one home, and this is not it.
    $wait = & $WaitForChecks

    if ($wait.State -eq 'Failed') {
        return New-MergeResult -State 'Refused' -HeadSha $HeadSha -Refusal 'ChecksFailed' `
            -Passed $wait.Passed -Failed $wait.Failed -NotRun $wait.NotRun
    }
    if ($wait.State -ne 'Passed') {
        # NoChecksConfigured arrives here, and is refused with everything else: a repository
        # with no CI produces no green signal, and silence must not be read as one.
        return New-MergeResult -State 'NotEvaluated' -HeadSha $HeadSha -Refusal $wait.Failure `
            -Passed $wait.Passed -Failed $wait.Failed -NotRun $wait.NotRun
    }

    # --- 3. The review threads ------------------------------------------------------------
    $threads = Get-UnresolvedReviewThread -PullRequest $PullRequest -Repository $Repository
    if ($threads.Failure) {
        return New-MergeResult -State 'NotEvaluated' -HeadSha $HeadSha -Refusal $threads.Failure `
            -Passed $wait.Passed
    }
    if ($threads.Threads.Count -gt 0) {
        return New-MergeResult -State 'Refused' -HeadSha $HeadSha -Refusal 'UnresolvedThreads' `
            -Passed $wait.Passed -UnresolvedThreads $threads.Threads `
            -Detail "$($threads.Threads.Count) unresolved review thread(s)."
    }

    # --- 4. Re-read the head, then merge against it ---------------------------------------
    $prAfter = Get-PullRequestState -PullRequest $PullRequest -Repository $Repository
    if ($prAfter.Failure) {
        return New-MergeResult -State 'NotEvaluated' -HeadSha $HeadSha -Refusal $prAfter.Failure -Passed $wait.Passed
    }
    if ($prAfter.HeadSha -ne $HeadSha) {
        return New-MergeResult -State 'Refused' -HeadSha $HeadSha -Refusal 'HeadMoved' `
            -Passed $wait.Passed -Detail "Pull request head is $($prAfter.HeadSha)."
    }

    if ($DryRun) {
        return New-MergeResult -State 'WouldMerge' -HeadSha $HeadSha -Passed $wait.Passed
    }

    # --match-head-commit is what closes the window between the read above and this call:
    # GitHub itself rejects the merge if the head is no longer this SHA. Never --admin -
    # bypassing branch protection is the one thing a delegated merge must not be able to do.
    $mergeArgs = @('pr', 'merge', $PullRequest, "--$Method", '--match-head-commit', $HeadSha)
    if ($Repository)   { $mergeArgs += @('-R', $Repository) }
    if ($DeleteBranch) { $mergeArgs += '--delete-branch' }

    $merge = Invoke-Gh -Arguments $mergeArgs
    if (-not $merge.CommandFound) {
        return New-MergeResult -State 'NotEvaluated' -HeadSha $HeadSha -Refusal 'GhUnavailable' -Passed $wait.Passed
    }
    if ($merge.ExitCode -ne 0) {
        return New-MergeResult -State 'Refused' -HeadSha $HeadSha -Refusal 'MergeRejected' `
            -Passed $wait.Passed -Detail ($merge.Text.Trim())
    }

    New-MergeResult -State 'Merged' -HeadSha $HeadSha -Passed $wait.Passed
}

# Guards the exit-calling wrapper so this script's tests can dot-source it instead - that
# defines every function above in the caller's scope, lets Mock intercept `gh`, and skips
# straight past this block rather than exiting the test runner's own process.
if ($MyInvocation.InvocationName -ne '.') {
    $waitScript = Join-Path $PSScriptRoot 'Wait-PullRequestCheck.ps1'
    $waitCall   = {
        & $waitScript -PullRequest $PullRequest -HeadSha $HeadSha -Repository $Repository `
            -TimeoutSeconds $TimeoutSeconds -PollSeconds $PollSeconds
    }

    $result = Invoke-Merge -PullRequest $PullRequest -HeadSha $HeadSha -Repository $Repository `
        -Method $Method -TimeoutSeconds $TimeoutSeconds -PollSeconds $PollSeconds `
        -DeleteBranch:$DeleteBranch -DryRun:$DryRun -WaitForChecks $waitCall
    $result
    exit (Get-MergeExitCode -State $result.State)
}
