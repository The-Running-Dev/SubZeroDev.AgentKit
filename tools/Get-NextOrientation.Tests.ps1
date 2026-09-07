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
        # was actually called with (proves explicit argument scoping) as plain text lines.
        param([Parameter(Mandatory)][string] $RepoPath)
        $toolsDir = Join-Path $RepoPath 'tools'
        New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null

        $driftStub = @'
param([string] $SlicesPath, [string] $Repository)
Write-Output "PWD=$((Get-Location).Path)"
Write-Output "Repository=$Repository"
exit 0
'@
        Set-Content -LiteralPath (Join-Path $toolsDir 'Test-DesignDrift.ps1') -Value $driftStub -Encoding utf8NoBOM

        $stateStub = @'
param([string] $Path = (Get-Location).Path)
Write-Output "PWD=$((Get-Location).Path)"
Write-Output "Path=$Path"
exit 0
'@
        Set-Content -LiteralPath (Join-Path $toolsDir 'Test-DesignState.ps1') -Value $stateStub -Encoding utf8NoBOM
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
            $result.DesignState.Output | Should -Match ([regex]::Escape("PWD=$resolvedTarget"))
            $result.DesignState.Output | Should -Match ([regex]::Escape("Path=$resolvedTarget"))
            $result.DesignState.Output | Should -Not -Match ([regex]::Escape($resolvedAmbient))

            $result.DesignDrift.Ran | Should -Be $true
            $result.DesignDrift.Output | Should -Match ([regex]::Escape("PWD=$resolvedTarget"))
            $result.DesignDrift.Output | Should -Match 'Repository=ownerB/repoB'
            $result.DesignDrift.Output | Should -Not -Match ([regex]::Escape($resolvedAmbient))
            $result.DesignDrift.Output | Should -Not -Match 'ownerA/repoA'
        }
    }
}
