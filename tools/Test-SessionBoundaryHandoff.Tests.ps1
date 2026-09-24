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

    It 'gives the context-exhaustion path a worked example with the marker outside the fence' {
        $script:Section | Should -Match 'a `/handoff` session that compacts mid-build'

        $lines = $script:Section -split "`n"
        $anchorIndex = ($lines | Select-String -Pattern 'a `/handoff` session that compacts mid-build').LineNumber | Select-Object -First 1
        $fenceOpenIndex = ($lines | Select-String -Pattern '^```markdown$').LineNumber |
            Where-Object { $_ -gt $anchorIndex } | Select-Object -First 1
        $fenceCloseIndex = ($lines | Select-String -Pattern '^```$').LineNumber |
            Where-Object { $_ -gt $fenceOpenIndex } | Select-Object -First 1
        $markerIndex = ($lines | Select-String -Pattern 'Context Exhaustion, Stay in Direct-Handoff Mode').LineNumber |
            Select-Object -First 1

        $fenceOpenIndex | Should -Not -BeNullOrEmpty
        $fenceCloseIndex | Should -Not -BeNullOrEmpty
        $markerIndex | Should -Not -BeNullOrEmpty
        $markerIndex | Should -BeGreaterThan $fenceCloseIndex -Because 'the end-of-session marker sits after the block closes, not inside it'
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

    It 'carries the tier /next is fixed at, in Start here' {
        $script:Content | Should -Match '(?ms)## Start here\r?\n/next.*sonnet.*medium'
    }

    It 'names an Authoritative inputs section for the housekeeping script''s own output' {
        $script:Content | Should -Match '(?m)^## Authoritative inputs$'
        $script:Content | Should -Match 'Invoke-DoneHousekeeping\.ps1` output'
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

Describe 'exhausted slices still route ready non-slice issues' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:NextPath = Join-Path $script:RepoRoot 'skills/next/SKILL.md'
        $script:SlicePath = Join-Path $script:RepoRoot 'skills/slice/SKILL.md'
        $script:NextContent = Get-Content -LiteralPath $script:NextPath -Raw
        $script:SliceContent = Get-Content -LiteralPath $script:SlicePath -Raw
    }

    It 'defines ready as the marker for non-slice work that needs no owner decision' {
        $script:NextContent | Should -Match '(?s)`ready`.*pickable now, with no owner decision needed'
    }

    It 'maps every supported non-slice route marker to its owning command' {
        $script:NextContent | Should -Match '(?s)`bug`.*`/fix <issue>`'
        $script:NextContent | Should -Match '(?s)`documentation`.*`/docs`'
        $script:NextContent | Should -Match '(?s)`spec`.*`/spec`'
        $script:NextContent | Should -Match '(?s)`align`.*`/align`'
        $script:NextContent | Should -Match '(?s)`check`.*`/check`'
    }

    It 'only sends issues that map to an outstanding slice to /slice' {
        $script:NextContent | Should -Match 'open slice issue.*`design/30-slices\.md`.*`S<n> —`'
        $script:NextContent | Should -Not -Match 'An issue exists with unticked `Done when` boxes and no branch in flight'
    }

    It 'selects deterministic ready non-slice work when Outstanding is empty' {
        $script:NextContent | Should -Match '(?s)Outstanding.*empty.*`ready`.*route marker.*lowest issue number'
    }

    It 'lists owner-only blockers without automatically selecting them' {
        $script:NextContent | Should -Match '`needs-decision`'
        $script:NextContent | Should -Match '`blocked-external`'
        $script:NextContent | Should -Match 'awaiting owner'
        $script:NextContent | Should -Match 'never auto-pick'
    }

    It 'makes /slice report the same ready routes and owner-only blockers when every slice is done' {
        $script:SliceContent | Should -Match 'skills/next/SKILL\.md` § \*Open non-slice work\*'
        $script:SliceContent | Should -Match 'name every pickable open `ready` issue and its owning'
        $script:SliceContent | Should -Match '`needs-decision`.*`blocked-external`.*awaiting owner'
        $script:SliceContent | Should -Not -Match 'Every slice is done\. Say so; do not go looking for adjacent work\.'
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

    It 'names /redteam and its tier in Start here' {
        $script:Content | Should -Match 'Start here.*is `/redteam`, strongest model, different vendor'
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

    It 'carries the tier the next command is fixed at' {
        $script:Content | Should -Match 'also carries the tier `AGENTS\.shared\.md` §\s*\*Command routing\* fixes for that command'
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

    It 'carries the tier /brief is fixed at' {
        $script:Content | Should -Match '`Start here` is `/brief`, `opus`/`high`'
    }
}
