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

    It 'keeps a decision only the user can make in the conversation, not inside the block' {
        $script:Section | Should -Match 'asked in this conversation, never inside the block'
        $script:Section | Should -Match 'belongs in `Result:`/`Next:`'
    }

    It 'carries an answered decision forward as settled input rather than re-offering it' {
        $script:Section | Should -Match 'settled input'
        $script:Section | Should -Match 'never re-offers the options it'
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

Describe 'skills/next/SKILL.md fills the transfer block from the boundary row it matched' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:SkillPath = Join-Path $script:RepoRoot 'skills/next/SKILL.md'
        $script:Content = Get-Content -LiteralPath $script:SkillPath -Raw
    }

    It 'cites the shared transfer-block contract rather than restating its shape' {
        $script:Content | Should -Match '(?s)transfer block `AGENTS\.shared\.md`\s+\u00a7 \*The session-transfer handoff block\*'
    }

    It 'requires the block at every boundary row, ahead of that row''s banner' {
        $script:Content | Should -Match 'Every \*\*boundary\*\* row above ends the session here'
        $script:Content | Should -Match '(?s)the block, then\s+the banner, and nothing after it'
    }

    It 'names the exact command and spells out a slice id' {
        $script:Content | Should -Match '(?s)`/slice S<n>` with the id\s+spelled out'
    }

    It 'carries /redteam''s different-vendor constraint into the block' {
        $script:Content | Should -Match 'different vendor from the design author'
    }

    It 'keeps the orientation reasoning out of the block' {
        $script:Content | Should -Match 'Do not carry the orientation reasoning across'
    }
}

Describe 'skills/design/SKILL.md hands off to /redteam with the vendor constraint in the block' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:SkillPath = Join-Path $script:RepoRoot 'skills/design/SKILL.md'
        $script:Content = Get-Content -LiteralPath $script:SkillPath -Raw
    }

    It 'has a hand-off section citing the shared transfer-block contract' {
        $script:Content | Should -Match '(?m)^## Hand off$'
        $script:Content | Should -Match '(?s)`AGENTS\.shared\.md` \u00a7 \*The session-transfer handoff block\*'
    }

    It 'still requires a fresh session on a different vendor' {
        $script:Content | Should -Match 'fresh session \*\*and a different vendor\*\*'
        $script:Content | Should -Match 'different-vendor requirement goes in `Constraints`'
    }

    It 'points at the committed design rather than pasting or summarising it' {
        $script:Content | Should -Match '(?s)Do not paste the design into the\s+block'
        $script:Content | Should -Match 'do not summarise the arguments behind it'
    }
}

Describe 'skills/plan/SKILL.md hands off with the exact slice id' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:SkillPath = Join-Path $script:RepoRoot 'skills/plan/SKILL.md'
        $script:Content = Get-Content -LiteralPath $script:SkillPath -Raw
    }

    It 'has a hand-off section citing the shared transfer-block contract' {
        $script:Content | Should -Match '(?m)^## Hand off$'
        $script:Content | Should -Match '(?s)`AGENTS\.shared\.md` \u00a7 \*The\s+session-transfer handoff block\*'
    }

    It 'requires the exact slice id, never a description of which slice to pick' {
        $script:Content | Should -Match '\*\*exact slice id\*\*'
        $script:Content | Should -Match '`/slice S3`, never "the first outstanding slice"'
    }

    It 'keeps one slice per session' {
        $script:Content | Should -Match '\*\*one slice per session\*\*'
    }

    It 'names the constraining documents instead of copying the criteria' {
        $script:Content | Should -Match 'do not copy them into the block'
    }
}

Describe 'skills/interview/SKILL.md hands off to /brief with the block' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:SkillPath = Join-Path $script:RepoRoot 'skills/interview/SKILL.md'
        $script:Content = Get-Content -LiteralPath $script:SkillPath -Raw
    }

    It 'cites the shared transfer-block contract' {
        $script:Content | Should -Match 'transfer block `AGENTS\.shared\.md` \u00a7 \*The session-transfer handoff block\*'
    }

    It 'names /brief as the starting action and the brief as the authoritative input' {
        $script:Content | Should -Match '`Start here` is `/brief`'
        $script:Content | Should -Match 'Authoritative inputs` is'
    }

    It 'requires empty fields to be reported as findings, and nothing else to cross' {
        $script:Content | Should -Match 'names the fields left empty'
        $script:Content | Should -Match 'Nothing else from the interview'
    }
}
