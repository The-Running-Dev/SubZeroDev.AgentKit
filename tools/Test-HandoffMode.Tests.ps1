#Requires -Version 7.0
#Requires -Modules Pester

<#
  Structural coverage for AGENTS.shared.md § Handoff mode.

  The external review this section integrates asked for the bypass to be "architectural and
  testable", and proposed a runtime `executionMode` flag to hang that on. AgentKit has no
  runtime - design/20-contract.md is explicit that a SKILL.md "is Markdown loaded into a model",
  and every gate in this repository is prose a model reads, not a branch a program takes. There
  is no process to hold a mode flag and no `if (executionMode === "standard")` to guard. So the
  honest mechanizable residue is this: the section's existence, its position ahead of the
  pipeline it suspends, and the completeness of the two lists it turns on.

  What this cannot test is whether a session actually honours the section. Nothing in a Markdown
  contract can be tested for that, and pretending otherwise by asserting against a mode flag
  would be a green gate over an unexercised mechanism - AGENTS.shared.md, *Verification*: a
  validator that has never failed is not known to constrain anything. These assertions fail if
  the section is deleted, moved below the rules it overrides, or quietly stripped of a list item,
  which are the three ways it degrades without anyone noticing.
#>

Describe 'AGENTS.shared.md § Handoff mode' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:AgentsPath = Join-Path $script:RepoRoot 'AGENTS.shared.md'
        $script:Lines = Get-Content -LiteralPath $script:AgentsPath
        $script:Raw = Get-Content -LiteralPath $script:AgentsPath -Raw

        # Index of the first line matching a heading, or -1. Position matters here: a section
        # that suspends the pipeline must be read before the pipeline states its claims, because
        # a session reads top to bottom and *Source of truth* is the first thing that binds.
        function script:HeadingIndex([string]$Heading) {
            for ($i = 0; $i -lt $script:Lines.Count; $i++) {
                if ($script:Lines[$i].Trim() -eq $Heading) { return $i }
            }
            return -1
        }

        $script:HandoffIndex = script:HeadingIndex '## Handoff mode'
        $script:SourceOfTruthIndex = script:HeadingIndex '## Source of truth'

        # The section body, for the content assertions below.
        $script:Section = if ($script:HandoffIndex -ge 0 -and $script:SourceOfTruthIndex -gt $script:HandoffIndex) {
            ($script:Lines[$script:HandoffIndex..($script:SourceOfTruthIndex - 1)]) -join "`n"
        } else { '' }
    }

    It 'exists as a top-level section' {
        $script:HandoffIndex | Should -BeGreaterOrEqual 0 -Because 'the escape hatch is a section of the contract, not a command that loses to it'
    }

    It 'is read before *Source of truth*, which it overrides' {
        $script:SourceOfTruthIndex | Should -BeGreaterThan $script:HandoffIndex -Because 'a suspension stated after the rule it suspends is read second'
    }

    It 'recognises the structured directive in both spellings' {
        $script:Section | Should -Match 'Execution:\s*direct'
        $script:Section | Should -Match 'Execution:\s*handoff'
    }

    It 'states that a structured directive wins over inference' {
        $script:Section | Should -Match 'structured directive always wins over inference'
    }

    It 'carries the precedence ladder, with the handoff above the default pipeline' {
        $handoffRow = $script:Section -split "`n" | Select-String -Pattern '^\d+\.\s+\*\*The explicit handoff\*\*'
        $pipelineRow = $script:Section -split "`n" | Select-String -Pattern "^\d+\.\s+AgentKit's default pipeline"

        $handoffRow | Should -Not -BeNullOrEmpty
        $pipelineRow | Should -Not -BeNullOrEmpty
        $handoffRow.LineNumber | Should -BeLessThan $pipelineRow.LineNumber -Because 'row 3 above row 5 is the whole point'
    }

    It 'names every pipeline command it suspends' {
        foreach ($command in @('/interview', '/brief', '/design', '/spec', '/plan', '/slice', '/align', '/track')) {
            $script:Section | Should -Match ([regex]::Escape($command)) -Because "$command is a pipeline stage the mode turns off"
        }
    }

    It 'names each surviving rule by the section that owns it' {
        foreach ($survivor in @('Verification', 'Git and delivery', 'House conventions', 'Third-party text')) {
            $script:Section | Should -Match ([regex]::Escape($survivor)) -Because "$survivor is the difference between finished work and claimed work"
        }
    }

    It 'keeps one-slice-at-a-time in force as scope discipline' {
        $script:Section | Should -Match 'One-slice-at-a-time is not suspended'
        $script:Section | Should -Match '### Scope discipline'
    }

    It 'forbids AI attribution even with the paperwork suspended' {
        $script:Section | Should -Match 'No AI attribution'
    }

    It 'states that a normally-required design is not a blocker' {
        $script:Section | Should -Match 'is not a blocker'
    }

    It 'lists the covert-reintroduction sentences as blockquotes' {
        $quotes = ($script:Section -split "`n") | Where-Object { $_ -match '^>\s+\S' }
        $quotes.Count | Should -BeGreaterOrEqual 11 -Because 'the named violation sentences are the enforceable part - a paraphrase of the rule is not'
    }

    It 'names the freeze and the public-interface rule among the violations, not only the generic ones' {
        $script:Section | Should -Match '>\s+The design is frozen, so I must stop\.'
        $script:Section | Should -Match '>\s+This touches a public interface'
    }

    It 'declares itself the single place the question is answered' {
        $script:Section | Should -Match 'single place that answers whether the pipeline applies'
    }

    It 'ends the mode with the work unit rather than persisting it' {
        $script:Section | Should -Match 'It is not a setting, it leaves no marker'
    }
}

Describe 'every gate the mode suspends consults it rather than re-deciding' {

    <#
      The external review asked for one authoritative policy all gates read, so that the mode
      cannot hold in one command and fail in the next. In a Markdown contract the enforceable
      form of that is a pointer: each gate section names § Handoff mode as the answer and states
      nothing of its own about when the pipeline applies. This is the regression guard - a gate
      added or rewritten without the pointer is a gate that will re-interpret the user's wording
      for itself, which is the scattered behaviour the pointer exists to prevent.
    #>

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:Lines = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'AGENTS.shared.md')

        # Section body keyed by its own heading, for the per-gate assertions below.
        $script:Sections = @{}
        $current = $null
        foreach ($line in $script:Lines) {
            if ($line -match '^## (.+)$') {
                $current = $Matches[1].Trim()
                $script:Sections[$current] = [System.Collections.Generic.List[string]]::new()
            } elseif ($null -ne $current) {
                $script:Sections[$current].Add($line)
            }
        }
    }

    It 'every suspendable gate carries the pointer to § Handoff mode' -ForEach @(
        @{ Gate = 'Source of truth' }
        @{ Gate = 'Model, effort, and review budget' }
        @{ Gate = 'Hard rules' }
        @{ Gate = 'The design freeze' }
        @{ Gate = 'Working with me' }
        @{ Gate = 'Tracking work' }
    ) {
        $script:Sections.ContainsKey($Gate) | Should -BeTrue -Because "$Gate should still be a top-level section"
        $body = $script:Sections[$Gate] -join "`n"
        $body | Should -Match 'is answered by \*Handoff mode\*, above, and nowhere else' -Because "$Gate must consult the one policy rather than re-deciding it"
    }
}

Describe 'standard mode is left intact' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:Raw = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'AGENTS.shared.md') -Raw
    }

    It 'the pipeline sections the mode suspends still exist for work that is not a handoff' {
        foreach ($heading in @('## Source of truth', '## Hard rules', '## The design freeze', '## Tracking work', '## Working with me')) {
            $script:Raw | Should -Match ([regex]::Escape($heading)) -Because 'the escape hatch removes nothing from the default path'
        }
    }

    It 'the freeze still gates its six authoring and reconciliation commands' {
        $script:Raw | Should -Match '`/align` and `/track` do not run'
        $script:Raw | Should -Match '`/interview`, `/design`, `/spec` and `/plan` refuse'
    }

    It 'the tier gate still binds work that is not a handoff' {
        $script:Raw | Should -Match 'Open substantive work with a banner, then gate on it'
    }
}

Describe 'skills/handoff/SKILL.md defers to the contract section' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:SkillPath = Join-Path $script:RepoRoot 'skills/handoff/SKILL.md'
    }

    It 'exists' {
        Test-Path -LiteralPath $script:SkillPath | Should -BeTrue
    }

    It 'cites AGENTS.shared.md § Handoff mode as the authority rather than restating it' {
        $content = Get-Content -LiteralPath $script:SkillPath -Raw
        $content | Should -Match '`AGENTS\.shared\.md` § \*Handoff mode\*'
    }

    It 'requires the Decisions line in its report' {
        $content = Get-Content -LiteralPath $script:SkillPath -Raw
        $content | Should -Match 'Decisions:' -Because 'a handoff makes material-ambiguity calls silently, so the report is where they surface'
    }
}
