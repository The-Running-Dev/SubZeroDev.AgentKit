#Requires -Version 7.0
#Requires -Modules Pester

<#
  Merge-PullRequest.ps1 exits the process on every path (0 Merged/WouldMerge, 1 Refused,
  2 NotEvaluated), which would kill the Pester runner if invoked in-process via `&`. So the
  script is structured with the exit-calling wrapper guarded by
  `$MyInvocation.InvocationName -ne '.'`, and these tests dot-source it instead - that skips
  the wrapper, defines its functions in this scope, and lets `Mock gh` intercept the script's
  own calls to the real command.

  The checks phase is injected as -WaitForChecks rather than reached through the real
  Wait-PullRequestCheck.ps1: that script has its own suite, and what is under test here is
  how each of its outcomes is TREATED, which is this script's own contract. Every test that
  is not about the checks passes a stub returning a Passed WaitResult.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'Merge-PullRequest.ps1'
    $script:PreDotSourceErrorActionPreference = $ErrorActionPreference
    # Dummy values only to satisfy the Mandatory top-level params; the guard this dot-source
    # relies on skips using them for anything.
    . $script:ScriptPath -PullRequest 1 -HeadSha 'unused'

    function New-StubWait {
        param(
            [string]   $State   = 'Passed',
            [string]   $Failure,
            [object[]] $Passed  = @(),
            [object[]] $Failed  = @(),
            [object[]] $NotRun  = @()
        )
        $r = [pscustomobject]@{
            State   = $State
            Failure = $Failure
            Passed  = @($Passed)
            Failed  = @($Failed)
            NotRun  = @($NotRun)
        }
        { $r }.GetNewClosure()
    }

    # The happy-path gh mock: open non-draft PR at abc123, no review threads, merge succeeds.
    function Set-GreenGh {
        Mock gh {
            if ($args[0] -eq 'pr' -and $args[1] -eq 'view') {
                '{"state":"OPEN","isDraft":false,"headRefOid":"abc123"}'
            }
            elseif ($args[0] -eq 'repo' -and $args[1] -eq 'view') {
                '{"owner":{"login":"o"},"name":"r"}'
            }
            elseif ($args[0] -eq 'api') {
                '{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":false},"nodes":[]}}}}}'
            }
            elseif ($args[0] -eq 'pr' -and $args[1] -eq 'merge') { '' }
        } -ModuleName $null
    }
}

AfterAll {
    $ErrorActionPreference = $script:PreDotSourceErrorActionPreference
    Set-StrictMode -Off
}

Describe 'Merge-PullRequest' {

    Context 'the exit-code map' {
        It 'maps only Merged and WouldMerge to 0, and every could-not-tell to 2' {
            Get-MergeExitCode -State 'Merged'       | Should -Be 0
            Get-MergeExitCode -State 'WouldMerge'   | Should -Be 0
            Get-MergeExitCode -State 'Refused'      | Should -Be 1
            Get-MergeExitCode -State 'NotEvaluated' | Should -Be 2
        }

        It 'throws on an unknown state rather than defaulting to a success code' {
            { Get-MergeExitCode -State 'Whatever' } | Should -Throw
        }
    }

    Context 'the pull request itself' {
        It 'merges when the PR is open, the head matches, checks pass and no thread is unresolved' {
            Set-GreenGh
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait)

            $r.State   | Should -Be 'Merged'
            $r.Refusal | Should -BeNullOrEmpty
            Get-MergeExitCode -State $r.State | Should -Be 0
        }

        It 'refuses a pull request that is not open' {
            Mock gh { '{"state":"MERGED","isDraft":false,"headRefOid":"abc123"}' }
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait)

            $r.State   | Should -Be 'Refused'
            $r.Refusal | Should -Be 'NotOpen'
        }

        It 'refuses a draft' {
            Mock gh { '{"state":"OPEN","isDraft":true,"headRefOid":"abc123"}' }
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait)

            $r.State   | Should -Be 'Refused'
            $r.Refusal | Should -Be 'IsDraft'
        }

        It 'refuses when the head has already moved off -HeadSha, before running any check' {
            Mock gh { '{"state":"OPEN","isDraft":false,"headRefOid":"deadbee"}' }
            $checked = $false
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks {
                $script:checked = $true
                [pscustomobject]@{ State = 'Passed'; Failure = $null; Passed = @(); Failed = @(); NotRun = @() }
            }

            $r.State   | Should -Be 'Refused'
            $r.Refusal | Should -Be 'HeadMoved'
            $r.Detail  | Should -Match 'deadbee'
        }

        It 'reports GhUnavailable as NotEvaluated, never as a refusal that looks decided' {
            Mock gh { $global:LASTEXITCODE = 4; '' }
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait)

            $r.State   | Should -Be 'NotEvaluated'
            $r.Refusal | Should -Be 'GhUnavailable'
            Get-MergeExitCode -State $r.State | Should -Be 2
        }
    }

    Context 'the checks' {
        It 'refuses on a failing check and carries the failing names through' {
            Set-GreenGh
            $wait = New-StubWait -State 'Failed' `
                -Passed @([pscustomobject]@{ Name = 'lint' }) `
                -Failed @([pscustomobject]@{ Name = 'build' })
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks $wait

            $r.State       | Should -Be 'Refused'
            $r.Refusal     | Should -Be 'ChecksFailed'
            $r.Failed.Name | Should -Contain 'build'
        }

        It 'refuses a repository with no checks configured - absence of CI is not a pass' {
            Set-GreenGh
            $wait = New-StubWait -State 'NotEvaluated' -Failure 'NoChecksConfigured'
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks $wait

            $r.State   | Should -Be 'NotEvaluated'
            $r.Refusal | Should -Be 'NoChecksConfigured'
            Get-MergeExitCode -State $r.State | Should -Not -Be 0
        }

        It 'carries a checks timeout through verbatim rather than merging on a pending run' {
            Set-GreenGh
            $wait = New-StubWait -State 'NotEvaluated' -Failure 'TimedOut' `
                -NotRun @([pscustomobject]@{ Name = 'slow' })
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks $wait

            $r.State       | Should -Be 'NotEvaluated'
            $r.Refusal     | Should -Be 'TimedOut'
            $r.NotRun.Name | Should -Contain 'slow'
        }

        It 'never calls gh pr merge on any non-passing check outcome' {
            Set-GreenGh
            $wait = New-StubWait -State 'Failed' -Failed @([pscustomobject]@{ Name = 'build' })
            Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks $wait | Out-Null

            Should -Not -Invoke gh -ParameterFilter { $args[1] -eq 'merge' }
        }
    }

    Context 'the review threads' {
        It 'refuses while any thread is unresolved, naming how many' {
            Mock gh {
                if ($args[0] -eq 'pr' -and $args[1] -eq 'view') {
                    '{"state":"OPEN","isDraft":false,"headRefOid":"abc123"}'
                }
                elseif ($args[0] -eq 'repo') { '{"owner":{"login":"o"},"name":"r"}' }
                elseif ($args[0] -eq 'api') {
                    '{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":false},"nodes":[{"id":"t1","isResolved":false,"isOutdated":false,"path":"a.ps1","line":3}]}}}}}'
                }
            }
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait)

            $r.State                  | Should -Be 'Refused'
            $r.Refusal                | Should -Be 'UnresolvedThreads'
            $r.UnresolvedThreads.Count | Should -Be 1
            $r.UnresolvedThreads[0].Path | Should -Be 'a.ps1'
        }

        It 'ignores resolved threads' {
            Mock gh {
                if ($args[0] -eq 'pr' -and $args[1] -eq 'view') {
                    '{"state":"OPEN","isDraft":false,"headRefOid":"abc123"}'
                }
                elseif ($args[0] -eq 'repo') { '{"owner":{"login":"o"},"name":"r"}' }
                elseif ($args[0] -eq 'api') {
                    '{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":false},"nodes":[{"id":"t1","isResolved":true,"isOutdated":false,"path":"a.ps1","line":3}]}}}}}'
                }
                elseif ($args[1] -eq 'merge') { '' }
            }
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait)

            $r.State | Should -Be 'Merged'
        }

        It 'requests --slurp on the paginated graphql call, not just a bare --paginate' {
            # Without --slurp, `gh api --paginate` concatenates each page's raw JSON object
            # with no separator ("{...}{...}"), which ConvertFrom-Json cannot parse as one
            # document on any PR with more than one page of threads - it throws, and that
            # throw is caught below and silently misreported as GhUnavailable instead of
            # the real unresolved-thread data. --slurp wraps every page in one outer array,
            # which is what the parsing in Get-UnresolvedReviewThread assumes.
            Set-GreenGh
            Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait) | Out-Null

            Should -Invoke gh -ParameterFilter {
                $args[0] -eq 'api' -and ($args -contains '--paginate') -and ($args -contains '--slurp')
            }
        }

        It 'counts unresolved threads across every --paginate page, not just the first' {
            Mock gh {
                if ($args[0] -eq 'pr' -and $args[1] -eq 'view') {
                    '{"state":"OPEN","isDraft":false,"headRefOid":"abc123"}'
                }
                elseif ($args[0] -eq 'repo') { '{"owner":{"login":"o"},"name":"r"}' }
                elseif ($args[0] -eq 'api') {
                    # --slurp's actual shape: one outer JSON array, one element per page. The
                    # blocker is on page 2.
                    '[{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":true},"nodes":[{"id":"t1","isResolved":true,"isOutdated":false,"path":"a.ps1","line":1}]}}}}},{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":false},"nodes":[{"id":"t2","isResolved":false,"isOutdated":false,"path":"b.ps1","line":2}]}}}}}]'
                }
            }
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait)

            $r.State                     | Should -Be 'Refused'
            $r.Refusal                   | Should -Be 'UnresolvedThreads'
            $r.UnresolvedThreads[0].Path | Should -Be 'b.ps1'
        }

        It 'reports GhUnavailable rather than a wrong thread count, if a multi-page response ever arrives unslurped' {
            # Reproduces the handoff defect directly: real --paginate output without --slurp is
            # two JSON objects concatenated with no separator, which ConvertFrom-Json rejects.
            # This must fail closed (GhUnavailable / NotEvaluated), never silently read as zero
            # unresolved threads.
            Mock gh {
                if ($args[0] -eq 'pr' -and $args[1] -eq 'view') {
                    '{"state":"OPEN","isDraft":false,"headRefOid":"abc123"}'
                }
                elseif ($args[0] -eq 'repo') { '{"owner":{"login":"o"},"name":"r"}' }
                elseif ($args[0] -eq 'api') {
                    '{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":true},"nodes":[]}}}}}{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":false},"nodes":[{"id":"t2","isResolved":false,"isOutdated":false,"path":"b.ps1","line":2}]}}}}}'
                }
            }
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait)

            $r.State   | Should -Be 'NotEvaluated'
            $r.Refusal | Should -Be 'GhUnavailable'
        }
    }

    Context 'the merge call' {
        It 'always passes --match-head-commit with the named SHA' {
            Set-GreenGh
            Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait) | Out-Null

            Should -Invoke gh -ParameterFilter {
                $args[1] -eq 'merge' -and
                ($args -contains '--match-head-commit') -and
                ($args -contains 'abc123')
            }
        }

        It 'never passes --admin' {
            Set-GreenGh
            Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait) | Out-Null

            Should -Not -Invoke gh -ParameterFilter { $args -contains '--admin' }
        }

        It 'uses the requested merge method' {
            Set-GreenGh
            Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -Method 'rebase' -WaitForChecks (New-StubWait) | Out-Null

            Should -Invoke gh -ParameterFilter { $args[1] -eq 'merge' -and ($args -contains '--rebase') }
        }

        It 'reports a server-side rejection as Refused, carrying gh output as the detail' {
            Mock gh {
                if ($args[0] -eq 'pr' -and $args[1] -eq 'view') {
                    '{"state":"OPEN","isDraft":false,"headRefOid":"abc123"}'
                }
                elseif ($args[0] -eq 'repo') { '{"owner":{"login":"o"},"name":"r"}' }
                elseif ($args[0] -eq 'api') {
                    '{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":false},"nodes":[]}}}}}'
                }
                elseif ($args[1] -eq 'merge') { $global:LASTEXITCODE = 1; 'Protected branch update failed' }
            }
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait)

            $r.State   | Should -Be 'Refused'
            $r.Refusal | Should -Be 'MergeRejected'
            $r.Detail  | Should -Match 'Protected branch'
        }

        It 'evaluates every gate but calls no merge under -DryRun' {
            Set-GreenGh
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -DryRun -WaitForChecks (New-StubWait)

            $r.State | Should -Be 'WouldMerge'
            Should -Not -Invoke gh -ParameterFilter { $args[1] -eq 'merge' }
        }

        It 'refuses when the head moves between the thread read and the merge' {
            $script:viewCount = 0
            Mock gh {
                if ($args[0] -eq 'pr' -and $args[1] -eq 'view') {
                    $script:viewCount++
                    if ($script:viewCount -eq 1) { '{"state":"OPEN","isDraft":false,"headRefOid":"abc123"}' }
                    else { '{"state":"OPEN","isDraft":false,"headRefOid":"newsha"}' }
                }
                elseif ($args[0] -eq 'repo') { '{"owner":{"login":"o"},"name":"r"}' }
                elseif ($args[0] -eq 'api') {
                    '{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":false},"nodes":[]}}}}}'
                }
            }
            $r = Invoke-Merge -PullRequest 9 -HeadSha 'abc123' -WaitForChecks (New-StubWait)

            $r.State   | Should -Be 'Refused'
            $r.Refusal | Should -Be 'HeadMoved'
            Should -Not -Invoke gh -ParameterFilter { $args[1] -eq 'merge' }
        }
    }
}
