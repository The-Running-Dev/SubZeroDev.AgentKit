#Requires -Version 7.0
#Requires -Modules Pester

<#
  Test-Design.ps1 exits the process on every path (0/1/2). Dot-sourcing defines its functions
  here and skips the exit-calling wrapper; Invoke-DesignCheck runs against a fixture repository
  built in TestDrive, with its own fixture kit root so the real kit's tools and skills never
  satisfy a reference by accident. The exit codes and the read-only promise are checked by
  running the script as a child process, the way CI and /next run it.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'Test-Design.ps1'
    $script:PreDotSourceErrorActionPreference = $ErrorActionPreference
    . $script:ScriptPath

    $script:BaseFiles = [ordered]@{
        'AGENTS.md' = "# Rules`n`nUse ``/compact`` when the context is long.`n"
        'design/00-brief.md' = "# Brief`n"
        'design/20-contract.md' = @'
# Contract

## Commands (`skills/<name>/SKILL.md`)

| Command | Does | Writes |
|---|---|---|
| `next` | Builds the plan | code |

## Scripts (`tools/`)

| Script | Parameters | Result |
|---|---|---|
| `Do-Thing.ps1` | `-Name`, `[-Quiet]` | a thing |
| `Other.ps1` | see the script | another |
'@
        'design/30-slices.md' = @'
# Slices

## S2 — Two
Status: todo
Depends on: S1

## Landed

| Slice | Name |
|---|---|
| **S1** | One |
'@
        'skills/next/SKILL.md' = "Run ``tools/Do-Thing.ps1``, then ``/next`` again, or ``/agentkit:next``.`n"
        'tools/Do-Thing.ps1' = "param([string]`$Name, [switch]`$Quiet)`n"
        'tools/Do-Thing.Tests.ps1' = "# not a script the contract lists`n"
        'tools/Other.ps1' = "param(`$Anything)`n"
    }

    function New-Fixture {
        param([hashtable]$Override = @{}, [string[]]$Remove = @())
        $root = Join-Path $TestDrive ([guid]::NewGuid().ToString('n'))
        $files = [ordered]@{}
        foreach ($k in $script:BaseFiles.Keys) { $files[$k] = $script:BaseFiles[$k] }
        foreach ($k in $Override.Keys) { $files[$k] = $Override[$k] }
        foreach ($k in $Remove) { $files.Remove($k) }
        foreach ($k in $files.Keys) {
            $path = Join-Path $root $k
            New-Item -ItemType Directory -Force -Path (Split-Path $path -Parent) | Out-Null
            Set-Content -LiteralPath $path -Value $files[$k] -NoNewline
        }
        $root
    }

    function Invoke-Fixture {
        param([string]$Root, [string]$KitRoot)
        if (-not $KitRoot) {
            $KitRoot = Join-Path $TestDrive 'empty-kit'
            New-Item -ItemType Directory -Force $KitRoot | Out-Null
        }
        Invoke-DesignCheck -RepoRoot $Root -KitRoot $KitRoot
    }

    function Get-Checks { param($Result) @($Result.Findings | ForEach-Object Check) }
}

AfterAll {
    $ErrorActionPreference = $script:PreDotSourceErrorActionPreference
    Set-StrictMode -Off
}

Describe 'Test-Design' {

    It 'passes a fixture whose every stated fact is true' {
        $r = Invoke-Fixture (New-Fixture)
        $r.Findings | Should -BeNullOrEmpty
        $r.State | Should -Be 'Passed'
    }

    Context 'S33.1 tool references' {
        It 'reports a cited tools/ path that does not exist, with file and line' {
            $root = New-Fixture -Override @{ 'skills/next/SKILL.md' = "First line, ``/next``.`nThen run ``tools/Gone.ps1``.`n" }
            $f = @((Invoke-Fixture $root).Findings | Where-Object Check -eq 'MissingTool')
            $f.Count | Should -Be 1
            $f[0].File | Should -Be 'skills/next/SKILL.md'
            $f[0].Line | Should -Be 2
            $f[0].Message | Should -Match 'tools/Gone\.ps1'
        }

        It 'accepts a tool that exists only in the kit root' {
            $kit = Join-Path $TestDrive 'kit-with-tool'
            New-Item -ItemType Directory -Force (Join-Path $kit 'tools') | Out-Null
            Set-Content (Join-Path $kit 'tools/Kit-Only.ps1') 'param()'
            $root = New-Fixture -Override @{ 'AGENTS.md' = "Run ``tools/Kit-Only.ps1``.`n" }
            Get-Checks (Invoke-Fixture $root $kit) | Should -Not -Contain 'MissingTool'
        }

        It 'ignores a stale tool named only in the Landed index' {
            $slices = $script:BaseFiles['design/30-slices.md'] + "`n- **S1** — ``tools/Retired.ps1```n"
            $root = New-Fixture -Override @{ 'design/30-slices.md' = $slices }
            Get-Checks (Invoke-Fixture $root) | Should -Not -Contain 'MissingTool'
        }
    }

    Context 'S33.2 command references' {
        It 'reports a command with no skill behind it' {
            $root = New-Fixture -Override @{ 'AGENTS.md' = "Then run ``/track``.`n" }
            $f = @((Invoke-Fixture $root).Findings | Where-Object Check -eq 'UnknownCommand')
            $f.Count | Should -Be 1
            $f[0].Message | Should -Match '/track'
        }

        It 'reports a namespaced command with no skill behind it' {
            $root = New-Fixture -Override @{ 'AGENTS.md' = "Then run ``/agentkit:slice``.`n" }
            Get-Checks (Invoke-Fixture $root) | Should -Contain 'UnknownCommand'
        }

        It 'accepts host commands and skills, bare or namespaced' {
            $root = New-Fixture -Override @{ 'AGENTS.md' = "``/compact``, ``/code-review:code-review --comment``, ``/next``, ``/agentkit:next``, ``/agentkit:<name>``.`n" }
            Get-Checks (Invoke-Fixture $root) | Should -Not -Contain 'UnknownCommand'
        }
    }

    Context 'S33.3 the Scripts table' {
        It 'reports a listed script that does not exist' {
            $root = New-Fixture -Remove @('tools/Other.ps1')
            $f = @((Invoke-Fixture $root).Findings | Where-Object Check -eq 'MissingScript')
            $f.Count | Should -Be 1
            $f[0].Message | Should -Match 'Other\.ps1'
            $f[0].File | Should -Be 'design/20-contract.md'
        }

        It 'reports a listed parameter the script does not declare' {
            $root = New-Fixture -Override @{ 'tools/Do-Thing.ps1' = "param([string]`$Name)`n" }
            $f = @((Invoke-Fixture $root).Findings | Where-Object Check -eq 'UnknownParameter')
            $f.Count | Should -Be 1
            $f[0].Message | Should -Match '-Quiet'
        }

        It 'reports a declared parameter its row does not list' {
            $root = New-Fixture -Override @{ 'tools/Do-Thing.ps1' = "param([string]`$Name, [switch]`$Quiet, [int]`$Retries)`n" }
            $f = @((Invoke-Fixture $root).Findings | Where-Object Check -eq 'UnlistedParameter')
            $f.Count | Should -Be 1
            $f[0].Message | Should -Match '-Retries'
        }

        It 'exempts a "see the script" row from both parameter checks' {
            $root = New-Fixture -Override @{ 'tools/Other.ps1' = "param(`$One, `$Two, `$Three)`n" }
            Get-Checks (Invoke-Fixture $root) | Should -BeNullOrEmpty
        }

        It 'reports a tools script no row lists, and ignores test files' {
            $root = New-Fixture -Override @{ 'tools/New-Thing.ps1' = "param()`n"; 'tools/New-Thing.Tests.ps1' = "`n" }
            $f = @((Invoke-Fixture $root).Findings | Where-Object Check -eq 'UnlistedScript')
            $f.Count | Should -Be 1
            $f[0].Message | Should -Match 'New-Thing\.ps1'
        }

        It 'skips the table checks where the contract has no kit-shaped Scripts table' {
            $root = New-Fixture -Override @{ 'design/20-contract.md' = "# Contract`n`n## Scripts`n`n| Script | Parameters |`n|---|---|`n| ``Gone.ps1`` | ``-X`` |`n" }
            Get-Checks (Invoke-Fixture $root) | Should -BeNullOrEmpty
        }
    }

    Context 'S33.4 the Commands table' {
        It 'reports a skill with no row' {
            $root = New-Fixture -Override @{ 'skills/fix/SKILL.md' = "Fix it.`n" }
            $f = @((Invoke-Fixture $root).Findings | Where-Object Check -eq 'UnlistedCommand')
            $f.Count | Should -Be 1
            $f[0].Message | Should -Match '\bfix\b'
        }

        It 'reports a row with no skill' {
            $contract = $script:BaseFiles['design/20-contract.md'].Replace('| `next` | Builds the plan | code |', "| ``next`` | Builds the plan | code |`n| ``align`` | Reconciles | design |")
            $root = New-Fixture -Override @{ 'design/20-contract.md' = $contract }
            $f = @((Invoke-Fixture $root).Findings | Where-Object Check -eq 'MissingCommand')
            $f.Count | Should -Be 1
            $f[0].Message | Should -Match '\balign\b'
        }
    }

    Context 'S33.5 the slices document' {
        It 'reports a slice heading with no Status line' {
            $root = New-Fixture -Override @{ 'design/30-slices.md' = "# Slices`n`n## S2 — Two`nDepends on: none`n" }
            $f = @((Invoke-Fixture $root).Findings | Where-Object Check -eq 'MissingStatus')
            $f.Count | Should -Be 1
            $f[0].Line | Should -Be 3
        }

        It 'reports a slice id used twice' {
            $root = New-Fixture -Override @{ 'design/30-slices.md' = "# Slices`n`n## S2 — Two`nStatus: done`n`n## S2 — Again`nStatus: todo`n" }
            Get-Checks (Invoke-Fixture $root) | Should -Contain 'DuplicateSlice'
        }

        It 'reports a dependency on a slice that exists nowhere' {
            $root = New-Fixture -Override @{ 'design/30-slices.md' = "# Slices`n`n## S2 — Two`nStatus: todo`nDepends on: S9`n" }
            $f = @((Invoke-Fixture $root).Findings | Where-Object Check -eq 'UnknownDependency')
            $f.Count | Should -Be 1
            $f[0].Message | Should -Match 'S9'
        }

        It 'accepts a dependency on a Landed slice, and ignores headings below Landed' {
            $slices = $script:BaseFiles['design/30-slices.md'] + "`n## S1 — Old body`nNo status here.`n"
            $root = New-Fixture -Override @{ 'design/30-slices.md' = $slices }
            Get-Checks (Invoke-Fixture $root) | Should -BeNullOrEmpty
        }
    }

    Context 'S33.6 exit codes and read-only' {
        BeforeAll {
            function Invoke-Child {
                param([string]$Root)
                $out = & pwsh -NoProfile -File $script:ScriptPath -RepoRoot $Root -Quiet 2>&1
                [pscustomobject]@{ Code = $LASTEXITCODE; Output = ($out -join "`n") }
            }
        }

        It 'exits 0 with no findings and leaves git status unchanged' {
            $root = New-Fixture -Override @{ 'skills/next/SKILL.md' = "Run ``/next``.`n" }
            git -C $root init -q
            git -C $root -c core.autocrlf=false add -A
            git -C $root -c user.name=t -c user.email=t@example.com commit -q -m fixture
            Set-Content (Join-Path $root 'scratch.txt') 'uncommitted'
            $before = git -C $root status --porcelain
            (Invoke-Child $root).Code | Should -Be 0
            git -C $root status --porcelain | Should -Be $before
        }

        It 'exits 1 with findings' {
            (Invoke-Child (New-Fixture -Override @{ 'AGENTS.md' = "``/track```n" })).Code | Should -Be 1
        }

        It 'exits 2 when there is no design/ to check' {
            $root = Join-Path $TestDrive 'no-design'
            New-Item -ItemType Directory -Force $root | Out-Null
            (Invoke-Child $root).Code | Should -Be 2
        }
    }
}
