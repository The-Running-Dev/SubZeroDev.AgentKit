#Requires -Version 7.0
#Requires -Modules Pester

<#
  Get-NextOrientation.ps1 has no exit-calling wrapper - it runs to completion and returns its
  report object on the pipeline - so these tests invoke it end-to-end via `&`, the same
  reasoning Invoke-DoneHousekeeping.Tests.ps1 gives for its own script.

  The two gate scripts it shells out to (Test-DesignDrift.ps1, Test-DesignState.ps1) are
  replaced with fixture stubs dropped into a separate -KitRoot fixture directory's own tools/ -
  Invoke-GateScript resolves them by a path built from -KitRoot (the canonical-runtime
  resolution the script itself uses), so a stub there is picked up exactly like the real script
  would be, with none of the real design/state/ fixture cost, and without a target-repo fixture
  needing a tools/ directory of its own it would never have when installed. Each stub reports
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
        # Drops fixture Test-DesignDrift.ps1 / Test-DesignState.ps1 into $KitPath/tools/ - a kit
        # fixture directory distinct from the target repo, matching the real -KitRoot resolution
        # Invoke-GateScript now uses - each reporting Get-Location (proves cwd scoping) and the
        # -Path/-Repository value it was actually called with (proves explicit argument scoping)
        # as a result object. Invoke-GateScript calls every gate with -Quiet and reads its
        # pipeline output, so each stub accepts (and ignores) -Quiet the same as the real gate
        # scripts do.
        param([Parameter(Mandatory)][string] $KitPath)
        $toolsDir = Join-Path $KitPath 'tools'
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
            [Parameter(Mandatory)][string] $KitPath,
            [Parameter(Mandatory)][ValidateSet('Clean', 'Drifted', 'NotEvaluated')][string] $DriftState,
            [Parameter(Mandatory)][ValidateSet('Clean', 'Blocking', 'NonBlocking', 'CouldNotEvaluate')][string] $StateResult
        )
        $toolsDir = Join-Path $KitPath 'tools'
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
            $kitRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-FixtureGateScripts -KitPath $kitRoot

            Set-Location $ambientRepo
            $result = & $script:ScriptPath -RepoRoot $targetRepo -KitRoot $kitRoot

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
            $kitRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-WordingGateScripts -KitPath $kitRoot -DriftState 'Clean' -StateResult 'Clean'
            $bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"

            $result = & $script:ScriptPath -RepoRoot $repo -KitRoot $kitRoot

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
            $kitRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-WordingGateScripts -KitPath $kitRoot -DriftState 'Drifted' -StateResult 'Blocking'
            $bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"
            Set-Content -LiteralPath (Join-Path $repo 'untracked.txt') -Value 'dirty'

            $result = & $script:ScriptPath -RepoRoot $repo -KitRoot $kitRoot

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
            $kitRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-WordingGateScripts -KitPath $kitRoot -DriftState 'NotEvaluated' -StateResult 'NonBlocking'
            $bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"

            $result = & $script:ScriptPath -RepoRoot $repo -KitRoot $kitRoot

            $result.DesignDrift.ExitCode | Should -Be 2
            $result.DesignDrift.Summary | Should -Be 'Design drift: could not evaluate'
            $result.DesignState.ExitCode | Should -Be 0
            $result.DesignState.Summary | Should -Be 'Design state: 3 non-blocking findings'
            Assert-NoBareIdentifiers -Result $result
        }

        It 'states a could-not-evaluate design-state gate at exit 2 in words' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-couldnotevaluate') -OriginUrl 'https://github.com/ownerF/repoF.git'
            $kitRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-WordingGateScripts -KitPath $kitRoot -DriftState 'Clean' -StateResult 'CouldNotEvaluate'
            $bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"

            $result = & $script:ScriptPath -RepoRoot $repo -KitRoot $kitRoot

            $result.DesignState.ExitCode | Should -Be 2
            $result.DesignState.Summary | Should -Be 'Design state: could not evaluate'
            Assert-NoBareIdentifiers -Result $result
        }

        It 'states unavailable gh in words instead of Available:False' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-nogh') -OriginUrl 'https://github.com/ownerG/repoG.git'
            $kitRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-WordingGateScripts -KitPath $kitRoot -DriftState 'Clean' -StateResult 'Clean'
            # A `gh` that resolves but exits non-zero (not authenticated, rate-limited, etc.) -
            # Invoke-Gh reads $LASTEXITCODE for this case. `gh` entirely absent from PATH is
            # the other route to the same "unavailable" shape, covered separately below.
            $bin = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-Item -ItemType Directory -Path $bin -Force | Out-Null
            Set-Content -LiteralPath (Join-Path $bin 'gh.ps1') -Value "exit 1" -Encoding utf8NoBOM
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"

            $result = & $script:ScriptPath -RepoRoot $repo -KitRoot $kitRoot

            $result.OpenPrs.Available | Should -Be $false
            $result.OpenPrs.Summary | Should -Be 'GitHub CLI unavailable: pull requests not checked'
            $result.MergedPrs.Available | Should -Be $false
            $result.MergedPrs.Summary | Should -Be 'GitHub CLI unavailable: merged pull requests not checked'
            Assert-NoBareIdentifiers -Result $result
        }
    }

    Context 'gh entirely missing from PATH' {

        BeforeEach {
            $script:SavedPath = $env:PATH
        }

        AfterEach {
            $env:PATH = $script:SavedPath
        }

        It 'reports GitHub unavailable instead of throwing, when gh is not on PATH at all' {
            # Reproduces the handoff defect: a bare `& gh @GhArgs` command-not-found is a
            # terminating error under this script's own Set-StrictMode/$ErrorActionPreference,
            # so unlike "gh present but exiting non-zero" (already covered above), this used to
            # abort the whole script rather than degrade to the unavailable shape.
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-nogh-at-all') -OriginUrl 'https://github.com/ownerJ/repoJ.git'
            $kitRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-WordingGateScripts -KitPath $kitRoot -DriftState 'Clean' -StateResult 'Clean'
            $gitCommand = Get-Command git -ErrorAction Stop
            $env:PATH = ($env:PATH -split [IO.Path]::PathSeparator |
                Where-Object { -not (Test-Path -LiteralPath (Join-Path $_ 'gh.exe')) -and -not (Test-Path -LiteralPath (Join-Path $_ 'gh')) }) -join [IO.Path]::PathSeparator

            # Where gh and git are installed in the same directory (Linux runner images put
            # both in /usr/bin), filtering out gh's directory above also removes git - which
            # this test needs to stay resolvable so the failure under test is "gh missing",
            # not "git missing" (#372).
            if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
                $gitShimDir = Join-Path $TestDrive 'git-shim'
                New-Item -ItemType Directory -Path $gitShimDir -Force | Out-Null
                if ($IsWindows) {
                    $shimPath = Join-Path $gitShimDir 'git.cmd'
                    Set-Content -LiteralPath $shimPath -Value "@echo off`r`n`"$($gitCommand.Source)`" %*"
                } else {
                    $shimPath = Join-Path $gitShimDir 'git'
                    Set-Content -LiteralPath $shimPath -Value "#!/bin/sh`nexec `"$($gitCommand.Source)`" `"`$@`""
                    & chmod +x $shimPath
                }
                $env:PATH = "$gitShimDir$([IO.Path]::PathSeparator)$env:PATH"
            }

            $result = & $script:ScriptPath -RepoRoot $repo -KitRoot $kitRoot

            $result.OpenPrs.Available | Should -Be $false
            $result.OpenPrs.Summary | Should -Be 'GitHub CLI unavailable: pull requests not checked'
            $result.MergedPrs.Available | Should -Be $false
            $result.MergedPrs.Summary | Should -Be 'GitHub CLI unavailable: merged pull requests not checked'
        }
    }

    Context 'detached HEAD' {

        BeforeEach {
            $script:SavedPath = $env:PATH
        }

        AfterEach {
            $env:PATH = $script:SavedPath
        }

        It 'names the checked-out commit instead of throwing, when HEAD is detached' {
            # Reproduces the handoff defect: `git branch --show-current` prints nothing at all
            # in detached HEAD (not an empty line), so the captured result is $null and
            # $null.Trim() threw before this fix.
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-detached') -OriginUrl 'https://github.com/ownerK/repoK.git'
            $sha = (& git -C $repo rev-parse HEAD).Trim()
            & git -C $repo checkout --quiet $sha
            $kitRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-WordingGateScripts -KitPath $kitRoot -DriftState 'Clean' -StateResult 'Clean'
            $bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"

            $result = & $script:ScriptPath -RepoRoot $repo -KitRoot $kitRoot

            $shortSha = (& git -C $repo rev-parse --short HEAD).Trim()
            $result.CurrentBranch | Should -Be "detached HEAD at $shortSha"
            $result.Summary | Should -Match ([regex]::Escape("detached HEAD at $shortSha"))
        }
    }

    Context 'kit runtime resolution (AGENTS.shared.md, Home-install convention)' {

        BeforeEach {
            $script:SavedPath = $env:PATH
        }

        AfterEach {
            $env:PATH = $script:SavedPath
        }

        It 'runs both gates against an installed target with no local tools/ directory, given a valid -KitRoot' {
            # Reproduces the handoff defect: an installed target repository carries design/
            # and AGENTS.md but none of the kit's own tools/ tree, so the gate scripts must
            # not be looked up under -RepoRoot.
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-installed-target') -OriginUrl 'https://github.com/ownerH/repoH.git'
            Test-Path -LiteralPath (Join-Path $repo 'tools') | Should -BeFalse

            $kitRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
            New-FixtureGateScripts -KitPath $kitRoot
            $bin = New-FakeGh -BinDir (Join-Path $TestDrive ([guid]::NewGuid().ToString('n')))
            $env:PATH = "$bin$([IO.Path]::PathSeparator)$env:PATH"

            $result = & $script:ScriptPath -RepoRoot $repo -KitRoot $kitRoot

            $resolvedTarget = (Resolve-Path -LiteralPath $repo).Path
            $result.DesignDrift.Ran | Should -Be $true
            $result.DesignDrift.Result.Pwd | Should -Be $resolvedTarget
            $result.DesignState.Ran | Should -Be $true
            $result.DesignState.Result.Pwd | Should -Be $resolvedTarget
        }

        It 'fails explicitly rather than reporting canonical scripts as merely absent, when -KitRoot does not resolve' {
            $repo = New-GitRepo -Path (Join-Path $TestDrive 'repo-missing-kit') -OriginUrl 'https://github.com/ownerI/repoI.git'
            $missingKitRoot = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))

            { & $script:ScriptPath -RepoRoot $repo -KitRoot $missingKitRoot -ErrorAction Stop } |
                Should -Throw
        }
    }
}
