#Requires -Version 7.0
#Requires -Modules Pester

<#
  Invoke-Housekeeping.ps1 is the no-model wrapper issue #183 asks for: it must auto-delete an
  ordinary merged branch without anyone deciding anything, and it must hand off - Escalate:true,
  nothing deleted for that branch - the moment Invoke-DoneHousekeeping.ps1 itself reports a
  judgement case. Both are exercised end-to-end against real git repos under $TestDrive, the
  same "not worth mocking" reasoning Invoke-DoneHousekeeping.Tests.ps1 gives for its own script.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'Invoke-Housekeeping.ps1'

    function New-GitRepo {
        param([Parameter(Mandatory)][string] $Path)
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        & git init --quiet -b main $Path | Out-Null
        & git -C $Path -c user.email='test@example.com' -c user.name='Test' commit --allow-empty --quiet -m 'initial' | Out-Null
        $Path
    }

    function New-MergedBranch {
        # A real merge commit, so it shows up in `--merged` and Invoke-Housekeeping should
        # delete it without anyone being asked - the ordinary, no-judgement case.
        param([Parameter(Mandatory)][string] $RepoPath, [Parameter(Mandatory)][string] $Branch)
        & git -C $RepoPath checkout --quiet -b $Branch | Out-Null
        & git -C $RepoPath -c user.email='test@example.com' -c user.name='Test' commit --allow-empty --quiet -m 'feature work' | Out-Null
        & git -C $RepoPath checkout --quiet main | Out-Null
        & git -C $RepoPath -c user.email='test@example.com' -c user.name='Test' merge --no-ff --quiet $Branch -m "merge $Branch" | Out-Null
    }

    function New-UnmergedBranch {
        param([Parameter(Mandatory)][string] $RepoPath, [Parameter(Mandatory)][string] $Branch)
        & git -C $RepoPath checkout --quiet -b $Branch | Out-Null
        & git -C $RepoPath -c user.email='test@example.com' -c user.name='Test' commit --allow-empty --quiet -m 'squashed work' | Out-Null
        & git -C $RepoPath checkout --quiet main | Out-Null
        (& git -C $RepoPath rev-parse $Branch).Trim()
    }

    function New-MergedWorktreeBranch {
        # A merged branch that is also checked out in a second worktree, so the safe delete
        # Invoke-DoneHousekeeping.ps1 attempts on it is refused - the Refused judgement case,
        # distinct from TipAheadOfMergedPr. Same fixture shape as
        # Invoke-DoneHousekeeping.Tests.ps1's own New-MergedWorktreeBranch.
        param([Parameter(Mandatory)][string] $RepoPath, [Parameter(Mandatory)][string] $WorktreePath)
        & git -C $RepoPath checkout --quiet -b feature/foo | Out-Null
        & git -C $RepoPath -c user.email='test@example.com' -c user.name='Test' commit --allow-empty --quiet -m 'feature work' | Out-Null
        & git -C $RepoPath checkout --quiet main | Out-Null
        & git -C $RepoPath -c user.email='test@example.com' -c user.name='Test' merge --no-ff --quiet feature/foo -m 'merge feature/foo' | Out-Null
        & git -C $RepoPath worktree add --quiet $WorktreePath feature/foo *>$null
    }

    function New-FakeGh {
        # Same stub Invoke-DoneHousekeeping.Tests.ps1 uses: Invoke-Housekeeping.ps1 shells out
        # to Invoke-DoneHousekeeping.ps1, which shells out to `gh` directly - no seam to Mock,
        # so a stub named `gh` goes first on PATH instead.
        param([Parameter(Mandatory)][string] $BinDir)
        New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
        $stub = @'
param()
$argv = $args
$headIdx = [array]::IndexOf($argv, '--head')
$branch = if ($headIdx -ge 0) { $argv[$headIdx + 1] } else { $null }
if ($branch -and $branch -eq $env:FAKE_GH_BRANCH) {
    $oid = $env:FAKE_GH_HEAD_OID
    Write-Output "[{""number"":1,""url"":""https://example.invalid/pr/1"",""mergeCommit"":{""oid"":""abc123""},""headRefOid"":""$oid""}]"
} else {
    Write-Output '[]'
}
exit 0
'@
        Set-Content -LiteralPath (Join-Path $BinDir 'gh.ps1') -Value $stub -Encoding utf8NoBOM
        $BinDir
    }

    function New-PostCheckoutDirtyHook {
        # Fires on every `git checkout`, including a no-op checkout of the branch already
        # checked out - so the discovery pass's own checkout dirties the tree in time for
        # the apply pass's dirty-tree check to see it, without mocking anything.
        param([Parameter(Mandatory)][string] $RepoPath)
        $hookPath = Join-Path $RepoPath '.git/hooks/post-checkout'
        Set-Content -LiteralPath $hookPath -Value "#!/bin/sh`ntouch dirty-marker.txt`n" -Encoding utf8NoBOM -NoNewline
        # git on Linux refuses to run a hook that isn't executable; Windows has no such bit,
        # so this was invisible until the hook ran on the powershell-linux job (#372).
        if (-not $IsWindows) {
            & chmod +x $hookPath
        }
    }
}

Describe 'Invoke-Housekeeping' {

    Context 'the ordinary case - a merged branch, no judgement needed' {

        It 'deletes it and reports Escalate:false, with no model call in the path' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-ordinary')
            New-MergedBranch -RepoPath $repo -Branch 'feature/ordinary'

            $result = & $script:ScriptPath -RepoRoot $repo -DefaultBranch main -SkipPull

            $result.Escalate | Should -Be $false
            $result.Applied.Deleted | Should -Contain 'feature/ordinary'
            (& git -C $repo branch --list 'feature/ordinary') | Should -BeNullOrEmpty
        }

        It 'reports the pulled state as a sentence, not a bare boolean (AGENTS.shared.md, Output discipline)' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-wording')
            New-MergedBranch -RepoPath $repo -Branch 'feature/wording'

            & $script:ScriptPath -RepoRoot $repo -DefaultBranch main -SkipPull -InformationVariable lines | Out-Null

            $joined = (@($lines | ForEach-Object ToString)) -join "`n"
            $joined | Should -Not -Match '\bTrue\b'
            $joined | Should -Not -Match '\bFalse\b'
            $joined | Should -Not -Match 'exit code'
            $joined | Should -Match '\(not pulled\)'
        }
    }

    Context 'a real judgement case - commits a merged PR does not account for' {

        BeforeEach {
            $script:SavedPath = $env:PATH
            $script:Bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$script:Bin$([IO.Path]::PathSeparator)$env:PATH"
            $env:FAKE_GH_BRANCH = 'fix/ahead'
        }

        AfterEach {
            $env:PATH = $script:SavedPath
            Remove-Item Env:FAKE_GH_BRANCH -ErrorAction SilentlyContinue
            Remove-Item Env:FAKE_GH_HEAD_OID -ErrorAction SilentlyContinue
        }

        It 'hands off - Escalate:true, TipAheadOfMergedPr named, branch left alone - instead of guessing' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-judgement')
            $mergedHead = New-UnmergedBranch -RepoPath $repo -Branch 'fix/ahead'
            $env:FAKE_GH_HEAD_OID = $mergedHead
            # One more commit after the PR merged - the case Invoke-DoneHousekeeping.ps1
            # refuses to force-delete because no merged PR accounts for it.
            & git -C $repo checkout --quiet 'fix/ahead' | Out-Null
            & git -C $repo -c user.email='test@example.com' -c user.name='Test' commit --allow-empty --quiet -m 'after the merge' | Out-Null
            & git -C $repo checkout --quiet main | Out-Null

            $result = & $script:ScriptPath -RepoRoot $repo -DefaultBranch main -SkipPull -WarningVariable warnings -WarningAction SilentlyContinue

            $result.Escalate | Should -Be $true
            $named = $result.Discover.TipAheadOfMergedPr | Where-Object Branch -eq 'fix/ahead'
            $named | Should -Not -BeNullOrEmpty
            $named.Reason | Should -Match 'no merged PR accounts for'
            (& git -C $repo rev-parse --verify 'fix/ahead' 2>$null) | Should -Not -BeNullOrEmpty

            # Rendering-only assertions (this PR's scope): the human meaning leads, the bare
            # structured identifier does not, and it still appears as an auditability suffix.
            $joined = (@($warnings | ForEach-Object ToString)) -join "`n"
            $joined | Should -Match 'Kept fix/ahead: it has commits that no merged pull request accounts for'
            $joined | Should -Not -Match '^TipAheadOfMergedPr'
            $joined | Should -Match '\(TipAheadOfMergedPr\)'
        }
    }

    Context 'a refused safe delete - Git blocks the branch' {

        It 'renders the human meaning first, keeps the structured Refused entry, and leaves the branch alone' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-refused')
            $wt = Join-Path $TestDrive 'wt-refused'
            New-MergedWorktreeBranch -RepoPath $repo -WorktreePath $wt

            $result = & $script:ScriptPath -RepoRoot $repo -DefaultBranch main -SkipPull -WarningVariable warnings -WarningAction SilentlyContinue

            $result.Escalate | Should -Be $true
            $refusal = $result.Applied.Refused | Where-Object Branch -eq 'feature/foo'
            $refusal | Should -Not -BeNullOrEmpty
            (& git -C $repo rev-parse --verify 'feature/foo' 2>$null) | Should -Not -BeNullOrEmpty

            $joined = (@($warnings | ForEach-Object ToString)) -join "`n"
            $joined | Should -Match 'Kept feature/foo: Git refused the safe delete'
            $joined | Should -Not -Match '^Refused'
            $joined | Should -Match '\(Refused\)'
        }
    }

    Context 'the apply pass itself stops - a judgement case discovery never saw' {
        # Invoke-DoneHousekeeping.ps1 runs twice: once to discover candidates, again to
        # delete them. The second run can hit its own Stopped condition (dirty tree,
        # unmerged current branch, a failed checkout) independently of anything discovery
        # found. A post-checkout hook that dirties the tree reproduces this without mocking
        # anything - discovery's own checkout (of the branch it is already on) fires the
        # hook, so by the time the apply pass starts, its dirty-tree check trips first,
        # before it ever gets to -DeleteBranches.

        It 'escalates on Applied.Stopped instead of reporting Escalate:false' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-apply-stop')
            New-MergedBranch -RepoPath $repo -Branch 'feature/apply-stop'
            New-PostCheckoutDirtyHook -RepoPath $repo

            $result = & $script:ScriptPath -RepoRoot $repo -DefaultBranch main -SkipPull -WarningVariable warnings -WarningAction SilentlyContinue

            $result.Applied.Stopped | Should -Be $true
            $result.Applied.Reason | Should -Be 'DirtyTree'
            $result.Escalate | Should -Be $true
            # Discovery itself completed cleanly and never saw a judgement case of its own.
            $result.Discover.Stopped | Should -Be $false
            (& git -C $repo branch --list 'feature/apply-stop') | Should -Not -BeNullOrEmpty

            $joined = (@($warnings | ForEach-Object ToString)) -join "`n"
            $joined | Should -Match 'Stopped during apply: DirtyTree'
        }

        It 'still reports discovery''s own pull/prune results in the summary, not the apply pass''s' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-apply-stop-summary')
            New-MergedBranch -RepoPath $repo -Branch 'feature/apply-stop-summary'
            New-PostCheckoutDirtyHook -RepoPath $repo

            & $script:ScriptPath -RepoRoot $repo -DefaultBranch main -SkipPull -InformationVariable lines | Out-Null

            $joined = (@($lines | ForEach-Object ToString)) -join "`n"
            # A Stopped:DirtyTree result from the apply pass carries DefaultBranch:$null and
            # PrunedCount:0 (Invoke-DoneHousekeeping.ps1:131-146) - the summary must not
            # source these lines from $applied, or discovery's real values are lost.
            $joined | Should -Match 'Default branch: main \(not pulled\)'
            $joined | Should -Not -Match 'Default branch:  \('
        }
    }
}
