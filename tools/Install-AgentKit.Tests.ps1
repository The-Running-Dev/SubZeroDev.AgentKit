#Requires -Version 7.0
#Requires -Modules Pester

<#
  Install-AgentKit.ps1 resolves every path (install root, manifest, skills folders,
  personal rules files) from the automatic $HOME variable, which PowerShell treats as
  read-only within a running session (it is seeded once from $env:HOME / $env:USERPROFILE
  at process start). There is no way to redirect $HOME for an in-process invocation, so
  every test here runs the script in a genuinely separate pwsh child process, launched
  with $env:HOME and $env:USERPROFILE pointed at a fresh $TestDrive sandbox for that one
  call - the same isolation technique used to hand-verify this script before this suite
  existed. Slower than an in-process call, but it is the only isolation this script's own
  design allows, and the point of these tests is exercising the real filesystem effects
  (junctions, manifest, hooks, pointer blocks) end to end.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'Install-AgentKit.ps1'

    function New-Sandbox {
        param([Parameter(Mandatory)][string] $Path)
        New-Item -ItemType Directory -Path (Join-Path $Path '.claude/skills') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $Path '.codex') -Force | Out-Null
        $Path
    }

    function New-KitRepo {
        <#
          A local git repo standing in for the kit's own origin, with a couple of skills
          so Install-HostSkillLinks has something real to link.
        #>
        param([Parameter(Mandatory)][string] $Path)
        New-Item -ItemType Directory -Path (Join-Path $Path 'skills/alpha') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $Path 'skills/beta') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $Path 'skills/alpha/SKILL.md') -Value "alpha`n" -NoNewline
        Set-Content -LiteralPath (Join-Path $Path 'skills/beta/SKILL.md') -Value "beta`n" -NoNewline
        Set-Content -LiteralPath (Join-Path $Path 'AGENTS.md') -Value "shared rules`n" -NoNewline
        & git -C $Path -c core.autocrlf=false init --quiet -b main | Out-Null
        & git -C $Path -c user.email='test@example.com' -c user.name='Test' add -A | Out-Null
        & git -C $Path -c user.email='test@example.com' -c user.name='Test' commit --quiet -m 'initial' | Out-Null
        $Path
    }

    function Invoke-Install {
        <#
          Runs Install-AgentKit.ps1 in a fresh child pwsh process with $HOME/$env:USERPROFILE
          redirected at $HomeDir for that call only, then restores the current process's env
          vars in every case (success or throw) so one test's sandbox never leaks into another.
        #>
        param(
            [Parameter(Mandatory)][string] $HomeDir,
            [string[]] $ScriptArgs = @()
        )
        $priorHome = $env:HOME
        $priorProfile = $env:USERPROFILE
        try {
            $env:HOME = $HomeDir
            $env:USERPROFILE = $HomeDir
            $output = & pwsh -NoProfile -File $script:ScriptPath @ScriptArgs 2>&1
            [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
        } finally {
            $env:HOME = $priorHome
            $env:USERPROFILE = $priorProfile
        }
    }

    function Get-Manifest {
        param([Parameter(Mandatory)][string] $HomeDir)
        $path = Join-Path $HomeDir '.agent-kit-state/installed.json'
        if (-not (Test-Path -LiteralPath $path)) { return $null }
        Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    }
}

Describe 'Install-AgentKit' {

    Context 'fresh install' {

        It 'clones the kit, links every skill for claude, and skips codex per the documented exception' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'fresh-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'fresh-kit')

            $result = Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main')

            $result.ExitCode | Should -Be 0
            (Join-Path $homeDir '.agent-kit/.git') | Should -Exist
            (Join-Path $homeDir '.claude/skills/alpha') | Should -Exist
            (Join-Path $homeDir '.claude/skills/beta') | Should -Exist
            (Join-Path $homeDir '.codex/skills') | Should -Not -Exist

            $manifest = Get-Manifest -HomeDir $homeDir
            $manifest.version | Should -Be 'main'
            $manifest.hosts.claude | Should -Contain 'alpha'
            $manifest.hosts.claude | Should -Contain 'beta'
        }

        It 'writes a declared AgentKit pointer block into the claude and codex rules files' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'fresh-pointer-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'fresh-pointer-kit')

            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main') | Out-Null

            $claudeRules = Get-Content -LiteralPath (Join-Path $homeDir '.claude/CLAUDE.md') -Raw
            $claudeRules | Should -Match 'agentkit-pointer:start'
            $codexRules = Get-Content -LiteralPath (Join-Path $homeDir '.codex/AGENTS.md') -Raw
            $codexRules | Should -Match 'agentkit-pointer:start'
        }

        It 'refreshes claude session-cost hooks as non-null arrays' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'fresh-hooks-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'fresh-hooks-kit')

            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main') | Out-Null

            $settings = Get-Content -LiteralPath (Join-Path $homeDir '.claude/settings.json') -Raw | ConvertFrom-Json
            $settings.hooks.SessionEnd | Should -Not -BeNullOrEmpty
            $settings.hooks.UserPromptSubmit | Should -Not -BeNullOrEmpty
        }

        It '-DryRun writes nothing to disk' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'dryrun-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'dryrun-kit')

            $result = Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main', '-DryRun')

            $result.ExitCode | Should -Be 0
            $result.Output | Should -Match 'DRY RUN'
            (Join-Path $homeDir '.agent-kit') | Should -Not -Exist
            (Join-Path $homeDir '.agent-kit-state/installed.json') | Should -Not -Exist
            (Join-Path $homeDir '.claude/skills/alpha') | Should -Not -Exist
        }
    }

    Context 'no-op re-run' {

        It 'changes nothing except installedAt when run twice with identical arguments' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'noop-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'noop-kit')

            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main') | Out-Null
            $manifestBefore = Get-Content -LiteralPath (Join-Path $homeDir '.agent-kit-state/installed.json') -Raw
            $alphaLinkBefore = (Get-Item -LiteralPath (Join-Path $homeDir '.claude/skills/alpha')).Target

            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main') | Out-Null
            $manifestAfter = Get-Content -LiteralPath (Join-Path $homeDir '.agent-kit-state/installed.json') -Raw
            $alphaLinkAfter = (Get-Item -LiteralPath (Join-Path $homeDir '.claude/skills/alpha')).Target

            $before = $manifestBefore | ConvertFrom-Json
            $after = $manifestAfter | ConvertFrom-Json
            $before.version | Should -Be $after.version
            $before.hosts | ConvertTo-Json | Should -Be ($after.hosts | ConvertTo-Json)
            $alphaLinkBefore | Should -Be $alphaLinkAfter
        }
    }

    Context 'version change' {

        It 'checks out the newly requested version and updates the manifest' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'verchange-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'verchange-kit')
            & git -C $kit -c core.autocrlf=false branch other-branch | Out-Null
            Set-Content -LiteralPath (Join-Path $kit 'skills/alpha/SKILL.md') -Value "alpha v2`n" -NoNewline
            & git -C $kit -c user.email='test@example.com' -c user.name='Test' commit --quiet -am 'alpha v2 on main' | Out-Null

            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main') | Out-Null
            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'other-branch') | Out-Null

            $manifest = Get-Manifest -HomeDir $homeDir
            $manifest.version | Should -Be 'other-branch'
            $installedRepo = Join-Path $homeDir '.agent-kit'
            (& git -C $installedRepo rev-parse --abbrev-ref HEAD).Trim() | Should -Be 'other-branch'
            Get-Content -LiteralPath (Join-Path $installedRepo 'skills/alpha/SKILL.md') -Raw | Should -Be "alpha`n"
        }
    }

    Context 'rollback' {

        It 're-requesting a prior version checks the checkout back out to it' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'rollback-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'rollback-kit')
            & git -C $kit -c core.autocrlf=false branch newer | Out-Null

            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main') | Out-Null
            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'newer') | Out-Null
            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main') | Out-Null

            $manifest = Get-Manifest -HomeDir $homeDir
            $manifest.version | Should -Be 'main'
            $installedRepo = Join-Path $homeDir '.agent-kit'
            (& git -C $installedRepo rev-parse --abbrev-ref HEAD).Trim() | Should -Be 'main'
        }
    }

    Context 'adopting an existing clone' {

        It 'uses the checkout already at the install root instead of re-cloning' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'adopt-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'adopt-kit')
            & git -c core.autocrlf=false clone --quiet $kit (Join-Path $homeDir '.agent-kit') 2>&1 | Out-Null

            $result = Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main')

            $result.ExitCode | Should -Be 0
            $result.Output | Should -Not -Match 'Clone .* into'
            (Join-Path $homeDir '.claude/skills/alpha') | Should -Exist
        }
    }

    Context 'skipping a foreign, non-junction folder' {

        It 'leaves a same-named folder it did not create alone, with a warning, and links the rest' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'foreign-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'foreign-kit')
            $foreignDir = Join-Path $homeDir '.claude/skills/alpha'
            New-Item -ItemType Directory -Path $foreignDir -Force | Out-Null
            Set-Content -LiteralPath (Join-Path $foreignDir 'SKILL.md') -Value "mine, not the kit's`n" -NoNewline

            $result = Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main')

            $result.ExitCode | Should -Be 0
            $result.Output | Should -Match "'alpha' already exists"
            Get-Content -LiteralPath (Join-Path $foreignDir 'SKILL.md') -Raw | Should -Be "mine, not the kit's`n"
            (Join-Path $homeDir '.claude/skills/beta') | Should -Exist
            $manifest = Get-Manifest -HomeDir $homeDir
            $manifest.hosts.claude | Should -Not -Contain 'alpha'
            $manifest.hosts.claude | Should -Contain 'beta'
        }
    }

    Context 'uninstall' {

        It 'removes exactly the links, hooks and pointer blocks it created, and leaves the checkout without -Force' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'uninstall-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'uninstall-kit')
            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main') | Out-Null

            $result = Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Uninstall')

            $result.ExitCode | Should -Be 0
            (Join-Path $homeDir '.claude/skills/alpha') | Should -Not -Exist
            (Join-Path $homeDir '.claude/skills/beta') | Should -Not -Exist
            (Join-Path $homeDir '.agent-kit-state/installed.json') | Should -Not -Exist
            (Join-Path $homeDir '.agent-kit/.git') | Should -Exist

            $claudeRules = Get-Content -LiteralPath (Join-Path $homeDir '.claude/CLAUDE.md') -Raw
            $claudeRules | Should -Not -Match 'agentkit-pointer:start'

            $settings = Get-Content -LiteralPath (Join-Path $homeDir '.claude/settings.json') -Raw | ConvertFrom-Json
            @($settings.hooks.SessionEnd).Count | Should -Be 0
            @($settings.hooks.UserPromptSubmit).Count | Should -Be 0
        }

        It '-Uninstall -Force also deletes the checkout' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'uninstall-force-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'uninstall-force-kit')
            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main') | Out-Null

            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Uninstall', '-Force') | Out-Null

            (Join-Path $homeDir '.agent-kit') | Should -Not -Exist
        }

        It 'does not remove a foreign folder that was left unlinked at install time' {
            $homeDir = New-Sandbox -Path (Join-Path $TestDrive 'uninstall-foreign-home')
            $kit = New-KitRepo -Path (Join-Path $TestDrive 'uninstall-foreign-kit')
            $foreignDir = Join-Path $homeDir '.claude/skills/alpha'
            New-Item -ItemType Directory -Path $foreignDir -Force | Out-Null
            Set-Content -LiteralPath (Join-Path $foreignDir 'SKILL.md') -Value "mine, not the kit's`n" -NoNewline
            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Source', $kit, '-Version', 'main') | Out-Null

            Invoke-Install -HomeDir $homeDir -ScriptArgs @('-Uninstall') | Out-Null

            Get-Content -LiteralPath (Join-Path $foreignDir 'SKILL.md') -Raw | Should -Be "mine, not the kit's`n"
        }
    }
}
