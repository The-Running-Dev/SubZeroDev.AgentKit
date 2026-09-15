#Requires -Version 7.0
#Requires -Modules Pester

<#
  Exercises the script against a small fixture repo rather than this
  repository's own AGENTS.md / design docs, so a future edit to either does
  not silently change what these tests assert. The fixture reproduces just
  the shapes the script depends on: a command file citing two AGENTS.md
  sections, an AGENTS.md with those two sections plus a third it must not
  pull in, a slices doc with two slice blocks, and a contract file.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'New-ReducedPrompt.ps1'

    function New-Fixture {
        param([string]$Root)

        New-Item -ItemType Directory -Path (Join-Path $Root 'skills/slice') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $Root 'design') -Force | Out-Null

        Set-Content -LiteralPath (Join-Path $Root 'skills/slice/SKILL.md') -Encoding utf8NoBOM -Value @'
---
description: fixture
---
Cites (`AGENTS.shared.md`, *Safe start*) once and (AGENTS.md, *Hard rules*) again later.
'@

        Set-Content -LiteralPath (Join-Path $Root 'AGENTS.shared.md') -Encoding utf8NoBOM -Value @'
# Agent contract

## Safe start
Read before touching anything.
'@

        Set-Content -LiteralPath (Join-Path $Root 'AGENTS.md') -Encoding utf8NoBOM -Value @'
# Agent contract — this repository

## Hard rules
One slice at a time.

## Unrelated section
This must never appear in a reduced prompt - nothing cites it.
'@

        Set-Content -LiteralPath (Join-Path $Root 'design/20-contract.md') -Encoding utf8NoBOM -Value @'
# Contract
Verbatim carry-through content.
'@

        Set-Content -LiteralPath (Join-Path $Root 'design/30-slices.md') -Encoding utf8NoBOM -Value @'
# Slices

## Outstanding

## S1 — First slice
Delivers: the first thing.
Acceptance:
  - S1.1 does a thing

---

## S2 — Second slice
Delivers: the second thing.
Acceptance:
  - S2.1 does another thing

---

## Landed
retired bodies live elsewhere
'@
    }
}

Describe 'New-ReducedPrompt' {
    BeforeEach {
        $script:Root = Join-Path $TestDrive ([guid]::NewGuid())
        New-Item -ItemType Directory -Path $script:Root -Force | Out-Null
        New-Fixture -Root $script:Root
    }

    It 'includes only the AGENTS.md sections the command file cites, in citation order' {
        $result = & $script:ScriptPath -SliceId S1 -RepoRoot $script:Root

        $result | Should -Match '## Safe start'
        $result | Should -Match '## Hard rules'
        $result | Should -Not -Match 'Unrelated section'

        # Citation order is Safe start, then Hard rules - assert the section
        # headings appear in that order, not just that both are present.
        $safeIndex = $result.IndexOf('## Safe start')
        $hardIndex = $result.IndexOf('## Hard rules')
        $safeIndex | Should -BeGreaterThan -1
        $hardIndex | Should -BeGreaterThan $safeIndex
    }

    It 'carries the contract verbatim' {
        $result = & $script:ScriptPath -SliceId S1 -RepoRoot $script:Root

        $result | Should -Match ([regex]::Escape('Verbatim carry-through content.'))
    }

    It 'drops agent.md entirely - the word never appears as a source, only as a stated exclusion' {
        $agentMdPath = Join-Path $script:Root 'agent.md'
        Set-Content -LiteralPath $agentMdPath -Encoding utf8NoBOM -Value 'Lessons that must not leak into the reduced prompt.'

        $result = & $script:ScriptPath -SliceId S1 -RepoRoot $script:Root

        $result | Should -Not -Match 'Lessons that must not leak'
    }

    It 'extracts only the requested slice block, not a neighbour' {
        $result = & $script:ScriptPath -SliceId S1 -RepoRoot $script:Root

        $result | Should -Match '## S1 — First slice'
        $result | Should -Match 'S1\.1 does a thing'
        $result | Should -Not -Match '## S2 — Second slice'
        $result | Should -Not -Match 'S2\.1 does another thing'
    }

    It 'selects the other slice when asked for it' {
        $result = & $script:ScriptPath -SliceId S2 -RepoRoot $script:Root

        $result | Should -Match '## S2 — Second slice'
        $result | Should -Not -Match '## S1 — First slice'
    }

    It 'throws naming the slice when no such heading exists' {
        { & $script:ScriptPath -SliceId S9 -RepoRoot $script:Root -ErrorAction Stop } |
            Should -Throw '*S9*'
    }

    It 'throws naming the missing section when a cited section is in neither AGENTS.shared.md nor AGENTS.md' {
        Set-Content -LiteralPath (Join-Path $script:Root 'AGENTS.md') -Encoding utf8NoBOM -Value @'
# Agent contract — this repository

## Unrelated section
Nothing cited lives here.
'@
        { & $script:ScriptPath -SliceId S1 -RepoRoot $script:Root -ErrorAction Stop } |
            Should -Throw '*Hard rules*'
    }

    It 'finds a section that is only in AGENTS.shared.md and one that is only in AGENTS.md' {
        $result = & $script:ScriptPath -SliceId S1 -RepoRoot $script:Root

        $result | Should -Match ([regex]::Escape('Read before touching anything.'))
        $result | Should -Match ([regex]::Escape('One slice at a time.'))
    }

    It 'reads AGENTS.shared.md from the kit install when the repository has no copy of its own' {
        Remove-Item -LiteralPath (Join-Path $script:Root 'AGENTS.shared.md')

        $result = & $script:ScriptPath -SliceId S1 -RepoRoot $script:Root

        # The kit checkout this script runs from is the self-hosted install, and its Safe start
        # carries the git status command the fixture's does not.
        $result | Should -Match ([regex]::Escape('git status --short --branch'))
        $result | Should -Not -Match ([regex]::Escape('Read before touching anything.'))
    }

    It 'writes to -OutFile instead of the success stream when given one' {
        $outFile = Join-Path $script:Root 'reduced.md'

        $result = & $script:ScriptPath -SliceId S1 -RepoRoot $script:Root -OutFile $outFile

        $result | Should -BeNullOrEmpty
        Test-Path -LiteralPath $outFile | Should -BeTrue
        (Get-Content -LiteralPath $outFile -Raw) | Should -Match '## S1 — First slice'
    }

    It 'writes nothing to the repository - a pure read' {
        & $script:ScriptPath -SliceId S1 -RepoRoot $script:Root | Out-Null

        Get-Content -LiteralPath (Join-Path $script:Root 'AGENTS.md') -Raw |
            Should -Match 'Unrelated section'
        Get-Content -LiteralPath (Join-Path $script:Root 'design/20-contract.md') -Raw |
            Should -Match 'Verbatim carry-through content.'
    }
}

Describe 'New-ReducedPrompt against this repository''s own slice.md and AGENTS.md' {
    <#
      Deliberately the opposite of the fixture tests above. A slice's completion
      report is governed by AGENTS.shared.md's *Output discipline*, and the reduced prompt
      only carries a section when slice.md cites it. Nothing special-cases that
      section in the script, so the only thing keeping it in a reduced prompt is
      the citation - which is exactly what an edit to either real file could drop.
    #>
    BeforeEach {
        $script:Root = Join-Path $TestDrive ([guid]::NewGuid())
        New-Item -ItemType Directory -Path $script:Root -Force | Out-Null
        New-Fixture -Root $script:Root
        $repoRoot = Split-Path $PSScriptRoot -Parent
        Copy-Item -LiteralPath (Join-Path $repoRoot 'AGENTS.shared.md') -Destination (Join-Path $script:Root 'AGENTS.shared.md') -Force
        Copy-Item -LiteralPath (Join-Path $repoRoot 'AGENTS.md') -Destination (Join-Path $script:Root 'AGENTS.md') -Force
        Copy-Item -LiteralPath (Join-Path $repoRoot 'skills/slice/SKILL.md') -Destination (Join-Path $script:Root 'skills/slice/SKILL.md') -Force
    }

    It 'carries the Output discipline section, bounded at the next heading' {
        $result = & $script:ScriptPath -SliceId S1 -RepoRoot $script:Root

        $result | Should -Match '(?m)^## Output discipline$'
        $result | Should -Not -Match '(?m)^## Working with me$'
    }
}
