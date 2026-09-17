#Requires -Version 7.0
#Requires -Modules Pester

<#
  Regression coverage for New-DesignDocs.ps1's Resolve-KitRoot only - the home-install root
  resolution it shares in shape with Invoke-CodexCommand.ps1 (AGENTS.shared.md §
  House conventions → Home-install convention). The rest of the script (seeding design/ from
  templates/design/) has no test coverage yet; that is a pre-existing gap this file does not
  attempt to close.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'New-DesignDocs.ps1'
}

Describe 'New-DesignDocs Resolve-KitRoot' {

    Context 'Resolve-KitRoot honors $env:AGENTKIT_HOME per AGENTS.md''s home-install convention' {

        BeforeAll {
            $script:PriorAgentKitHome = $env:AGENTKIT_HOME
            $script:PreDotSourceErrorActionPreference = $ErrorActionPreference

            # $script:ScriptPath lives inside this real checkout, which has templates/design/
            # right alongside it, so dot-sourcing it directly always resolves self-hosted and
            # never exercises the $env:AGENTKIT_HOME branch. Copy it to a TestDrive location
            # with no templates/design/ anywhere above it, so Resolve-KitRoot's self-hosted
            # check genuinely misses there.
            $fixtureDir = Join-Path $TestDrive 'no-templates-fixture/tools'
            New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
            $script:FixtureScript = Join-Path $fixtureDir 'New-DesignDocs.ps1'
            Copy-Item -LiteralPath $script:ScriptPath -Destination $script:FixtureScript

            # Dot-source with a -KitRoot that does not exist, so Resolve-KitRoot throws on
            # Resolve-Path immediately - after every function in the script is already defined
            # - leaving Resolve-KitRoot itself callable directly, against the fixture's own
            # $PSScriptRoot, for the tests below.
            try {
                . $script:FixtureScript -TargetRepo $TestDrive -KitRoot (Join-Path $TestDrive 'does-not-exist-explicit') -ErrorAction Stop
            } catch {
                # expected - Resolve-KitRoot's throw, functions are already defined by now
            }
        }

        AfterEach {
            $env:AGENTKIT_HOME = $script:PriorAgentKitHome
        }

        AfterAll {
            $ErrorActionPreference = $script:PreDotSourceErrorActionPreference
            Set-StrictMode -Off
        }

        It 'resolves the install root from $env:AGENTKIT_HOME when no self-hosted checkout is available' {
            $agentKitHome = Join-Path $TestDrive 'agentkit-home-valid'
            New-Item -ItemType Directory -Path (Join-Path $agentKitHome 'templates/design') -Force | Out-Null
            $env:AGENTKIT_HOME = $agentKitHome

            Resolve-KitRoot -Explicit '' | Should -Be (Resolve-Path -LiteralPath $agentKitHome).Path
        }

        It 'ignores $env:AGENTKIT_HOME when it has no templates/design/, and falls through to $HOME/.agent-kit or the not-found throw' {
            $env:AGENTKIT_HOME = Join-Path $TestDrive 'agentkit-home-without-templates'
            New-Item -ItemType Directory -Path $env:AGENTKIT_HOME -Force | Out-Null
            $fallbackRoot = Join-Path $HOME '.agent-kit'
            if (Test-Path -LiteralPath (Join-Path $fallbackRoot 'templates/design')) {
                Set-ItResult -Skipped -Because 'this machine already has a real home install at $HOME/.agent-kit'
                return
            }

            { Resolve-KitRoot -Explicit '' } | Should -Throw "*$fallbackRoot*"
        }
    }
}
