#Requires -Version 7.0
#Requires -Modules Pester

<#
  Test-GatesCache.ps1 returns its result object and never exits the process, so it is invoked
  with `&` against a throwaway repository in $TestDrive rather than dot-sourced.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'Test-GatesCache.ps1'

    function New-CacheRepo {
        $root = Join-Path $TestDrive ([guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path (Join-Path $root '.github/workflows') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $root '.github/workflows/ci.yml') -Value 'on: push' -Encoding utf8
        $root
    }

    # Rewrites the cache's gate list by hand, keeping its hash, the way a corrupted or
    # hand-edited file would arrive.
    function Set-CachedGate {
        param([Parameter(Mandatory)][string] $Root, [AllowNull()] $Gates)
        $path = Join-Path $Root '.claude/gates.json'
        $cache = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        $cache.gates = $Gates
        ($cache | ConvertTo-Json -Depth 10) | Set-Content -LiteralPath $path -NoNewline
    }
}

Describe 'Test-GatesCache' {

    It 'is Missing before any cache is written' {
        $root = New-CacheRepo
        (& $script:ScriptPath -RepoRoot $root).Status | Should -Be 'Missing'
    }

    It 'is Fresh with the cached gates when the manifest is unchanged' {
        $root = New-CacheRepo
        & $script:ScriptPath -RepoRoot $root -Write -GatesJson '[{"name":"Pester","command":"Invoke-Pester -Path tools"}]' | Out-Null

        $r = & $script:ScriptPath -RepoRoot $root

        $r.Status | Should -Be 'Fresh'
        @($r.Gates).Count | Should -Be 1
        $r.Gates[0].name | Should -Be 'Pester'
    }

    It 'is Stale once a workflow changes' {
        $root = New-CacheRepo
        & $script:ScriptPath -RepoRoot $root -Write -GatesJson '[{"name":"Pester","command":"Invoke-Pester -Path tools"}]' | Out-Null
        Set-Content -LiteralPath (Join-Path $root '.github/workflows/ci.yml') -Value 'on: pull_request' -Encoding utf8

        (& $script:ScriptPath -RepoRoot $root).Status | Should -Be 'Stale'
    }

    It 'is Stale, not Fresh, when the cached gate list is null under a matching hash' {
        # @($null) is a one-element array, so a bare wrap would hand back a Fresh result whose
        # only gate is null.
        $root = New-CacheRepo
        & $script:ScriptPath -RepoRoot $root -Write -GatesJson '[{"name":"Pester","command":"Invoke-Pester -Path tools"}]' | Out-Null
        Set-CachedGate -Root $root -Gates $null

        $r = & $script:ScriptPath -RepoRoot $root

        $r.Status | Should -Be 'Stale'
        @($r.Gates).Count | Should -Be 0
    }

    It 'is Stale when the cached gate list is empty under a matching hash' {
        $root = New-CacheRepo
        & $script:ScriptPath -RepoRoot $root -Write -GatesJson '[{"name":"Pester","command":"Invoke-Pester -Path tools"}]' | Out-Null
        Set-CachedGate -Root $root -Gates @()

        (& $script:ScriptPath -RepoRoot $root).Status | Should -Be 'Stale'
    }

    It 'rejects a write whose gates are not a nonempty array of usable objects' {
        $invalidJson = @(
            '"not-a-gate"',
            '{"name":"Pester","command":"Invoke-Pester"}',
            '[]',
            '[{"name":" ","command":"Invoke-Pester"}]',
            '[{"name":"Pester","command":null}]',
            '[{"name":1,"command":"Invoke-Pester"}]',
            '[{"name":"Pester"}]',
            '[{"name":"Pester","command":"Invoke-Pester"},null]'
        )
        foreach ($json in $invalidJson) {
            $root = New-CacheRepo
            { & $script:ScriptPath -RepoRoot $root -Write -GatesJson $json } | Should -Throw
            Test-Path -LiteralPath (Join-Path $root '.claude/gates.json') | Should -BeFalse
        }
    }

    It 'marks a matching cache Stale when any gate is malformed' {
        $invalidGateJson = @(
            '"not-a-gate"',
            '{"name":"Pester","command":"Invoke-Pester"}',
            '[{"name":"Pester","command":"Invoke-Pester"},null]',
            '[{"name":"Pester","command":" "}]',
            '[{"name":"Pester","command":42}]',
            '[{"command":"Invoke-Pester"}]'
        )
        foreach ($json in $invalidGateJson) {
            $root = New-CacheRepo
            & $script:ScriptPath -RepoRoot $root -Write -GatesJson '[{"name":"Pester","command":"Invoke-Pester"}]' | Out-Null
            Set-CachedGate -Root $root -Gates (ConvertFrom-Json -InputObject $json -NoEnumerate)

            $r = & $script:ScriptPath -RepoRoot $root
            $r.Status | Should -Be 'Stale'
            @($r.Gates).Count | Should -Be 0
        }
    }

    It 'marks a cache with invalid JSON Stale' {
        $root = New-CacheRepo
        & $script:ScriptPath -RepoRoot $root -Write -GatesJson '[{"name":"Pester","command":"Invoke-Pester"}]' | Out-Null
        Set-Content -LiteralPath (Join-Path $root '.claude/gates.json') -Value '{invalid json' -NoNewline

        (& $script:ScriptPath -RepoRoot $root).Status | Should -Be 'Stale'
    }
}
