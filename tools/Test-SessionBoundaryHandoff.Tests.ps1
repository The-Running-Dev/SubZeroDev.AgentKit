#Requires -Version 7.0
#Requires -Modules Pester

<#
  Structural coverage for AGENTS.shared.md § Session boundaries' transfer-block requirement.

  The defect this closes: a boundary response named the next command and its tier but left the
  operator to hand-build the message that actually starts the next session, so the next thing
  typed back was routinely "write me the handoff". Like Test-HandoffMode.Tests.ps1, this is prose
  read by a model rather than a program taking a branch, so the honest mechanizable residue is the
  same shape: the section says the block is required, says what it must contain, says where it
  sits relative to the terminal banner, and says how it stays distinct from `/handoff` mode's
  `Execution: direct` / `Execution: handoff` lines. These assertions fail if that requirement is
  deleted, reworded into a suggestion, or the two meanings of "handoff" collapse back into one.
#>

Describe 'AGENTS.shared.md § Session boundaries — the transfer block' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:AgentsPath = Join-Path $script:RepoRoot 'AGENTS.shared.md'
        $script:Lines = Get-Content -LiteralPath $script:AgentsPath

        # Index of the first line matching a heading of the given prefix ('## ' or '### '), or -1.
        function script:HeadingIndex([string]$Heading) {
            for ($i = 0; $i -lt $script:Lines.Count; $i++) {
                if ($script:Lines[$i].Trim() -eq $Heading) { return $i }
            }
            return -1
        }

        $script:BoundariesIndex = script:HeadingIndex '### Session boundaries'
        $script:BudgetIndex = script:HeadingIndex '### Budget discipline'

        $script:Section = if ($script:BoundariesIndex -ge 0 -and $script:BudgetIndex -gt $script:BoundariesIndex) {
            ($script:Lines[$script:BoundariesIndex..($script:BudgetIndex - 1)]) -join "`n"
        } else { '' }
    }

    It 'exists as a subsection' {
        $script:BoundariesIndex | Should -BeGreaterOrEqual 0
    }

    It 'requires a fenced Markdown transfer block at a fresh-session boundary' {
        $script:Section | Should -Match '### The session-transfer handoff block'
        $script:Section | Should -Match '```markdown'
        $script:Section | Should -Match 'transfer block'
    }

    It 'states the boundary is incomplete without both the block and the terminal banner' {
        $script:Section | Should -Match 'incomplete until both that block and the terminal banner'
    }

    It 'names the acceptance test for a boundary response that omits the block' {
        $script:Section | Should -Match 'write me the handoff'
        $script:Section | Should -Match 'what do I paste into the next session'
    }

    It 'requires an Objective and a Start here, and only those two unconditionally' {
        $script:Section | Should -Match '## Objective'
        $script:Section | Should -Match '## Start here'
        $script:Section | Should -Match 'every section but `Objective` and `Start here` is omitted when it would be empty'
    }

    It 'requires pointing at authoritative artifacts rather than reproducing them' {
        $script:Section | Should -Match "Point at artifacts, don't restate them"
        $script:Section | Should -Match 'do not paste the artifact''s contents or the investigation'
    }

    It 'binds the block to the same verification standard as any other report' {
        $script:Section | Should -Match 'State only what this session verified'
        $script:Section | Should -Match 'unless this session confirmed it'
    }

    It 'keeps the transfer block distinct from `/handoff` and Handoff mode' {
        $script:Section | Should -Match 'to keep it apart from `/handoff` and \*Handoff mode\* above'
        $script:Section | Should -Match 'a different thing entirely'
    }

    It 'forbids Execution: direct or Execution: handoff in a routine transfer block' {
        $script:Section | Should -Match 'never `Execution: direct` or `Execution: handoff`'
    }

    It 'preserves Execution: direct when an unfinished direct-handoff unit crosses an unavoidable boundary' {
        $script:Section | Should -Match 'restates `Execution: direct`'
        $script:Section | Should -Match 'compaction'
    }

    It 'emits no transfer block for work that is genuinely finished' {
        $script:Section | Should -Match 'Next: Nothing — this is complete\.'
    }

    It 'keeps the transfer block ahead of the terminal banner, which stays last' {
        $script:Section | Should -Match 'transfer block above comes first; this banner follows it and stays the last thing'

        $blockIndex = ($script:Section -split "`n" | Select-String -Pattern '^# Session handoff$').LineNumber
        $bannerIndex = ($script:Section -split "`n" | Select-String -Pattern '^Session Boundary — Do Not Carry Into /track$').LineNumber

        $blockIndex | Should -Not -BeNullOrEmpty
        $bannerIndex | Should -Not -BeNullOrEmpty
        $blockIndex | Should -BeLessThan $bannerIndex -Because 'the payload is carried before the protocol marker that follows it'
    }

    It 'still carries the terminal banner example unchanged' {
        $script:Section | Should -Match 'Next: /track, Fresh Session, sonnet/medium'
    }
}

Describe 'skills/clean/SKILL.md hands off to /next, with a transfer block, never straight to /track' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:SkillPath = Join-Path $script:RepoRoot 'skills/clean/SKILL.md'
        $script:Content = Get-Content -LiteralPath $script:SkillPath -Raw
    }

    It 'exists' {
        Test-Path -LiteralPath $script:SkillPath | Should -BeTrue
    }

    It 'cites the shared transfer-block contract rather than restating its shape' {
        $script:Content | Should -Match '`AGENTS\.shared\.md` § \*The session-transfer handoff block\*'
    }

    It 'fills the block''s Start here with /next' {
        $script:Content | Should -Match "(?ms)## Start here\r?\n/next"
    }

    It 'still names /next, not /track, as the destination' {
        $script:Content | Should -Match 'Name `/next`, not `/track`\.'
        $script:Content | Should -Match 'Next: /next, Fresh Session, sonnet/medium'
    }

    It 'requires the block even on a run that deleted nothing' {
        $script:Content | Should -Match 'including a run that deleted\r?\n?\s*nothing'
        $script:Content | Should -Match 'write `Current state` as "none deleted" rather than omitting the block'
    }

    It 'forbids stating a deletion or stash the run did not make' {
        $script:Content | Should -Match 'Never state a deletion or a stash in the block that this run did not actually make'
    }
}
