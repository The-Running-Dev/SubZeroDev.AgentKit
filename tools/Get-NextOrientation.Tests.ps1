#Requires -Version 7.0
#Requires -Modules Pester

<#
  Get-NextOrientation.ps1 has no exit-calling wrapper - it runs to completion and returns its
  report object on the pipeline - so these tests invoke it end-to-end via `&`, the same
  reasoning Invoke-DoneHousekeeping.Tests.ps1 gives for its own script.

  The two gate scripts it shells out to (Test-DesignDrift.ps1, Test-DesignState.ps1) are
  replaced with fixture stubs dropped into -RepoRoot's own tools/ directory - Invoke-GateScript
  resolves them by a path built from -RepoRoot, so a stub there is picked up exactly like the
  real script would be, with none of the real design/state/ fixture cost. Each stub reports
  its own process cwd and the path/repository argument it actually received, which is what
  exposes issue #255's cwd leak: today, invoked while the process is sitting in a different
  repository than -RepoRoot, Test-DesignState.ps1 defaults -Path to that ambient cwd and
  Test-DesignDrift.ps1's internal `git merge-base` runs against the ambient cwd's git state.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'Get-NextOrientation.ps1'

    function New-GitRepo {
        param([Parameter(Mandatory)][string] $Path, [Parameter(Mandatory)][string] $OriginUrl)
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        & git init --quiet -b main $Path | Out-Null
        & git -C $Path -c user.email='test@example.com' -c user.name='Test' commit --allow-empty --quiet -m 'initial' | Out-Null
        & git -C $Path remote add origin $OriginUrl | Out-Null
        $Path
    }

    function New-FakeGh {
        # gh pr list is invoked twice by Get-NextOrientation.ps1 itself (open, merged) via
        # Invoke-Gh, which already Push-Locations to -RepoRoot - not what #255 is about.
        # This stub only needs to answer both calls with something ConvertFrom-Json can parse.
        param([Parameter(Mandatory)][string] $BinDir)
        New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $BinDir 'gh.ps1') -Value "Write-Output '[]'`nexit 0" -Encoding utf8NoBOM
        $BinDir
    }

    function New-FixtureGateScripts {
        # Drops fixture Test-DesignDrift.ps1 / Test-DesignState.ps1 into $RepoPath/tools/,
        # each reporting Get-Location (proves cwd scoping) and the -Path/-Repository value it
        # was actually called with (proves explicit argument scoping) as a result object -
        # Invoke-GateScript calls every gate with -Quiet and reads its pipeline output, so
        # each stub accepts (and ignores) -Quiet the same as the real gate scripts do.
        param([Parameter(Mandatory)][string] $RepoPath)
        $toolsDir = Join-Path $RepoPath 'tools'
        New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null

        $driftStub = @'
param([string] $SlicesPath, [string] $Repository, [switch] $Quiet)
[pscustomobject]@{ Pwd = (Get-Location).Path; Repository = $Repository }
exit 0
'@
        Set-Content -LiteralPath (Join-Path $toolsDir 'Test-DesignDrift.ps1') -Value $driftStub -Encoding utf8NoBOM

        $stateStub = @'
param([string] $Path = (Get-Location).Path, [switch] $Quiet)
[pscustomobject]@{ Pwd = (Get-Location).Path; Path = $Path }
exit 0
'@
        Set-Content -LiteralPath (Join-Path $toolsDir 'Test-DesignState.ps1') -Value $stateStub -Encoding utf8NoBOM
    }

    function New-WordingGateScripts {
        # Fixture gates whose result shape matches the real scripts' (State/Findings for
        # drift; CouldNotEvaluate/Findings/Reported for state), each exiting with the code the
        # State they report would actually produce - so Get-GateSummary's real translation
        # logic, not just its default fallback, is what these tests exercise.
        param(
            [Parameter(Mandatory)][string] $RepoPath,
            [Parameter(Mandatory)][ValidateSet('Clean', 'Drifted', 'NotEvaluated')][string] $DriftState,
            [Parameter(Mandatory)][ValidateSet('Clean', 'Blocking', 'NonBlocking', 'CouldNotEvaluate')][string] $StateResult
        )
        $toolsDir = Join-Path $RepoPath 'tools'
        New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null

        $driftExit = if ($DriftState -eq 'Drifted') { 1 } elseif ($DriftState -eq 'NotEvaluated') { 2 } else { 0 }
        $driftFindings = if ($DriftState -eq 'Drifted') { "@('finding one', 'finding two')" } else { '@()' }
        $driftStub = @"
param([string] `$Repository, [switch] `$Quiet)
[pscustomobject]@{ State = '$DriftState'; Findings = $driftFindings }
exit $driftExit
"@
        Set-Content -LiteralPath (Join-Path $toolsDir 'Test-DesignDrift.ps1') -Value $driftStub -Encoding utf8NoBOM

        $stateExit = if ($StateResult -eq 'Blocking') { 1 } elseif ($StateResult -eq 'CouldNotEvaluate') { 2 } else { 0 }
        $stateFindings = if ($StateResult -eq 'Blocking') { "@('blocking one')" } else { '@()' }
        $stateReported = if ($StateResult -eq 'NonBlocking') { "@('reported one', 'reported two', 'reported three')" } else { '@()' }
        $stateCouldNot = if ($StateResult -eq 'CouldNotEvaluate') { "@('could-not-evaluate one')" } else { '@()' }
        $stateStub = @"
param([string] `$Path, [switch] `$Quiet)
[pscustomobject]@{ CouldNotEvaluate = $stateCouldNot; Findings = $stateFindings; Reported = $stateReported }
exit $stateExit
"@
        Set-Content -LiteralPath (Join-Path $toolsDir 'Test-DesignState.ps1') -Value $stateStub -Encoding utf8NoBOM

        # Get-NextOrientation.ps1 reports Dirty from `git status`, and these fixture files are
        # dropped straight into the repo's own tools/ dir - commit them so a "clean tree" test
        # is actually testing a clean tree, not an artifact of how the fixture was installed.
        & git -C $RepoPath add 'tools/Test-DesignDrift.ps1' 'tools/Test-DesignState.ps1' | Out-Null
        & git -C $RepoPath -c user.email='test@example.com' -c user.name='Test' commit --quiet -m 'wording fixture gates' | Out-Null
    }

    function Assert-NoBareIdentifiers {
        # Existing properties are unchanged alongside the new wording - Dirty/Available/
        # ExitCode etc. still carry their raw values (asserted per-test below); this only
        # checks that no *Summary* string leaks one instead of translating it.
        param([Parameter(Mandatory)] $Result)
        $summaries = @(
            $Result.Summary, $Result.OpenPrs.Summary, $Result.MergedPrs.Summary,
            $Result.DesignDrift.Summary, $Result.DesignState.Summary
        ) -join "`n"
        $summaries | Should -Not -Match '\bTrue\b'
        $summaries | Should -Not -Match '\bFalse\b'
        $summaries | Should -Not -Match 'exit code'
    }
}

Describe 'Get-NextOrientation' {

    Context 'invoked while the process cwd is a different repository than -RepoRoot' {

        BeforeEach {
            $script:SavedPath = $env:PATH
            $script:SavedLocation = Get-Location
            $script:Bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$script:Bin$([IO.Path]::PathSeparator)$env:PATH"
        }

        AfterEach {
            $env:PATH = $script:SavedPath
            Set-Location $script:SavedLocation
        }

        It 'scopes both gate scripts to -RepoRoot, not the ambient cwd' {
            $ambientRepo = New-GitRepo -Path (Join-Path $TestDrive 'repo-ambient') -OriginUrl 'https://github.com/ownerA/repoA.git'
            $targetRepo = New-GitRepo -Path (Join-Path $TestDrive 'repo-target') -OriginUrl 'https://github.com/ownerB/repoB.git'
            New-FixtureGateScripts -RepoPath $targetRepo

            Set-Location $ambientRepo
            $result = & $script:ScriptPath -RepoRoot $targetRepo

            $resolvedTarget = (Resolve-Path -LiteralPath $targetRepo).Path
            $resolvedAmbient = (Resolve-Path -LiteralPath $ambientRepo).Path

            $result.DesignState.Ran | Should -Be $true
            $result.DesignState.Result.Pwd | Should -Be $resolvedTarget
            $result.DesignState.Result.Path | Should -Be $resolvedTarget
            $result.DesignState.Result.Pwd | Should -Not -Be $resolvedAmbient

            $result.DesignDrift.Ran | Should -Be $true
            $result.DesignDrift.Result.Pwd | Should -Be $resolvedTarget
            $result.DesignDrift.Result.Repository | Should -Be 'ownerB/repoB'
            $result.DesignDrift.Result.Pwd | Should -Not -Be $resolvedAmbient
            $result.DesignDrift.Result.Repository | Should -Not -Be 'ownerA/repoA'
        }
    }

    Context 'Summary wording (AGENTS.shared.md, Output discipline: meaning before identifier)' {

        BeforeEach {
            $script:SavedPath = $env:PATH
        }

        AfterEach {
            $env:PATH = $script:SavedPath
        }

        It 'states a clean working tree and gh availability in words, gates at exit 0' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-clean') -OriginUrl 'https://github.com/ownerC/repoC.git'
            New-WordingGateScripts -RepoPath $repo -DriftState 'Clean' -StateResult 'Clean'
            $bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"

            $result = & $script:ScriptPath -RepoRoot $repo

            $result.Dirty | Should -Be $false
            $result.Summary | Should -Match 'working tree clean'
            $result.OpenPrs.Available | Should -Be $true
            $result.OpenPrs.Summary | Should -Be 'Open PRs: 0'
            $result.MergedPrs.Summary | Should -Be 'Recently merged PRs: 0'
            $result.DesignDrift.ExitCode | Should -Be 0
            $result.DesignDrift.Summary | Should -Be 'Design drift: none'
            $result.DesignState.ExitCode | Should -Be 0
            $result.DesignState.Summary | Should -Be 'Design state: clean'
            Assert-NoBareIdentifiers -Result $result
        }

        It 'states a dirty working tree in words, and blocking/drifted gates at exit 1' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-dirty') -OriginUrl 'https://github.com/ownerD/repoD.git'
            New-WordingGateScripts -RepoPath $repo -DriftState 'Drifted' -StateResult 'Blocking'
            $bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"
            Set-Content -LiteralPath (Join-Path $repo 'untracked.txt') -Value 'dirty'

            $result = & $script:ScriptPath -RepoRoot $repo

            $result.Dirty | Should -Be $true
            $result.Summary | Should -Match 'working tree dirty'
            $result.DesignDrift.ExitCode | Should -Be 1
            $result.DesignDrift.Summary | Should -Be 'Design drift: 2 findings'
            $result.DesignState.ExitCode | Should -Be 1
            $result.DesignState.Summary | Should -Be 'Design state: 1 blocking findings'
            Assert-NoBareIdentifiers -Result $result
        }

        It 'states non-blocking findings and a could-not-evaluate gate at exit 2 in words' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-notevaluated') -OriginUrl 'https://github.com/ownerE/repoE.git'
            New-WordingGateScripts -RepoPath $repo -DriftState 'NotEvaluated' -StateResult 'NonBlocking'
            $bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"

            $result = & $script:ScriptPath -RepoRoot $repo

            $result.DesignDrift.ExitCode | Should -Be 2
            $result.DesignDrift.Summary | Should -Be 'Design drift: could not evaluate'
            $result.DesignState.ExitCode | Should -Be 0
            $result.DesignState.Summary | Should -Be 'Design state: 3 non-blocking findings'
            Assert-NoBareIdentifiers -Result $result
        }

        It 'states a could-not-evaluate design-state gate at exit 2 in words' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-couldnotevaluate') -OriginUrl 'https://github.com/ownerF/repoF.git'
            New-WordingGateScripts -RepoPath $repo -DriftState 'Clean' -StateResult 'CouldNotEvaluate'
            $bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"

            $result = & $script:ScriptPath -RepoRoot $repo

            $result.DesignState.ExitCode | Should -Be 2
            $result.DesignState.Summary | Should -Be 'Design state: could not evaluate'
            Assert-NoBareIdentifiers -Result $result
        }

        It 'states unavailable gh in words instead of Available:False' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-nogh') -OriginUrl 'https://github.com/ownerG/repoG.git'
            New-WordingGateScripts -RepoPath $repo -DriftState 'Clean' -StateResult 'Clean'
            # A `gh` that resolves but exits non-zero (not authenticated, rate-limited, etc.) -
            # Invoke-Gh reads $LASTEXITCODE, and Get-NextOrientation.ps1 has no handling for
            # `gh` being entirely absent from PATH (a native-command-not-found is terminating
            # under this script's own Set-StrictMode/$ErrorActionPreference), so this is the
            # "unavailable" case the script actually distinguishes.
            $bin = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-Item -ItemType Directory -Path $bin -Force | Out-Null
            Set-Content -LiteralPath (Join-Path $bin 'gh.ps1') -Value "exit 1" -Encoding utf8NoBOM
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"

            $result = & $script:ScriptPath -RepoRoot $repo

            $result.OpenPrs.Available | Should -Be $false
            $result.OpenPrs.Summary | Should -Be 'GitHub CLI unavailable: pull requests not checked'
            $result.MergedPrs.Available | Should -Be $false
            $result.MergedPrs.Summary | Should -Be 'GitHub CLI unavailable: merged pull requests not checked'
            Assert-NoBareIdentifiers -Result $result
        }
    }
}
