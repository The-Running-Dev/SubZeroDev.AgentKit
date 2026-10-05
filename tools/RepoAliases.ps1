#Requires -Version 7.0
<#
.SYNOPSIS
    Shell-alias invocation for branch housekeeping with no model call (issue #183).

.DESCRIPTION
    Dot-source this from a PowerShell profile to get a function that runs this repository's
    mechanical housekeeping without starting a model session. This is deliberately a function a
    person types in a terminal they are watching, not a scheduled task: this repository's
    concurrency is sequential-by-policy and not by lock (design/00-brief.md § *Environment*), so
    an unattended run could switch branches under a session that is mid-edit. Running it by hand
    means the report lands in front of whoever ran it, immediately. It never stashes: uncommitted
    work is carried across the switch untouched.

    It never opens a model session. Where the underlying script reports a judgement
    case, these print it and stop; opening Claude Code, Codex, or Copilot to work it is left to
    the person reading the output (design/00-brief.md's non-goal keeps a human in adjudication,
    and this reading needs no per-vendor launch machinery, unlike having the script launch one
    itself).

.EXAMPLE
    # In $PROFILE:
    . "D:\Dropbox\Projects\SubZeroDev.AgentKit\tools\RepoAliases.ps1"

    # Then, from any of this kit's repositories:
    Invoke-AgentKitClean
#>

$script:RepoAliasesRoot = $PSScriptRoot

function Invoke-AgentKitClean {
    <#
    .SYNOPSIS
        Prunes merged branches: discover, auto-delete what needs no judgement, report.
    .DESCRIPTION
        Wraps tools/invoke-housekeeping.ts. Prints the report and returns the result object,
        whose .Escalate flags a case this script did not resolve - read it before deciding
        whether to open a session.
    #>
    param([string]$RepoRoot = (Get-Location).Path)
    & node (Join-Path $script:RepoAliasesRoot 'invoke-housekeeping.ts') --repo-root $RepoRoot | ConvertFrom-Json
}
