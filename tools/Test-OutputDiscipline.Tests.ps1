#Requires -Version 7.0
#Requires -Modules Pester

<#
  Structural coverage for AGENTS.shared.md § Output discipline's operator-facing completion
  shape. A report that leads with mechanism instead of outcome is not a bug a runtime test can
  catch - there is no process to hold a report string and assert against it, the same reason
  Test-HandoffMode.Tests.ps1 gives for testing prose by section rather than behaviour. What is
  mechanizable is the same residue: the contract states the shape, states it is mandatory, and
  the representative skills that produce completion reports point at it instead of re-deriving
  their own ordering.
#>

Describe 'AGENTS.shared.md § Output discipline' {

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
        $script:AgentsPath = Join-Path $script:RepoRoot 'AGENTS.shared.md'
        $script:Lines = Get-Content -LiteralPath $script:AgentsPath

        function script:HeadingIndex([string]$Heading) {
            for ($i = 0; $i -lt $script:Lines.Count; $i++) {
                if ($script:Lines[$i].Trim() -eq $Heading) { return $i }
            }
            return -1
        }

        $script:OutputIndex = script:HeadingIndex '## Output discipline'
        $script:WorkingWithMeIndex = script:HeadingIndex '## Working with me'

        $script:Section = if ($script:OutputIndex -ge 0 -and $script:WorkingWithMeIndex -gt $script:OutputIndex) {
            ($script:Lines[$script:OutputIndex..($script:WorkingWithMeIndex - 1)]) -join "`n"
        } else { '' }
    }

    It 'exists as a top-level section' {
        $script:OutputIndex | Should -BeGreaterOrEqual 0
    }

    It 'makes Result: and Next: the default completion fields' {
        $script:Section | Should -Match 'Result:\s*<one plain-English sentence stating the outcome and consequence>'
        $script:Section | Should -Match 'Next:\s*<one exact action, decision, command, or "Nothing'
        $script:Section | Should -Match 'Verified:\s*<only the evidence needed to trust Result>'
    }

    It 'states Result: and Next: are mandatory' {
        $script:Section | Should -Match '`Result:` and `Next:` are mandatory'
    }

    It 'requires the exact no-action phrasing when nothing remains' {
        $script:Section | Should -Match 'Next: Nothing — this is complete\.' -Because 'this exact phrase is already established at *Session boundaries* and must not drift into a paraphrase here'
    }

    It 'carries the decision-stop shape, recommended option first' {
        $script:Section | Should -Match 'decision stop'
        $script:Section | Should -Match 'recommended option first'
    }

    It 'states the acceptance test verbatim' {
        $script:Section | Should -Match ([regex]::Escape('if the likely next user message is "what does that mean?" or "what do I do now?", the report failed. Rewrite it before sending.'))
    }

    It 'requires leading with outcome and consequence, not mechanism' {
        $script:Section | Should -Match 'leads with the outcome and its consequence, never with mechanism'
    }

    It 'forbids inferring the consequence from the evidence' {
        $script:Section | Should -Match 'Do not make the reader infer the consequence from the evidence'
    }

    It 'forbids narration of process or chronology' {
        $script:Section | Should -Match 'No narration of process or chronology'
    }

    It 'bounds routine paragraphs and pushes multiple facts into bullets' {
        $script:Section | Should -Match 'no paragraph runs longer than two sentences'
        $script:Section | Should -Match 'three or more independent facts become bullets'
    }

    It 'still defers to rules requiring full diagnostics, skipped-gate reasons, and verbatim text' {
        $script:Section | Should -Match 'Existing rules requiring full failure diagnostics, skipped-gate reasons, criterion ids, verbatim marker text, or a terminal session-boundary banner still win'
    }

    It 'keeps the gloss-vocabulary rule intact' {
        $script:Section | Should -Match 'Gloss this repository''s own vocabulary the first time a session uses it'
    }

    It 'keeps the brevity-never-removes-evidence rule intact' {
        $script:Section | Should -Match 'Brevity never removes evidence'
    }

    It 'keeps the subagent-justification rule intact' {
        $script:Section | Should -Match 'A subagent is justified only by independence or by containment'
    }
}

Describe 'representative skill reports point at Output discipline rather than re-deriving it' {

    <#
      Each of these produces a chat-level completion report. None may restate the contract's
      shape - a second copy is a promise it will diverge - and none may retain report-ordering
      language that contradicts the outcome-first rule (skills/next/SKILL.md used to instruct
      "what you read, what you concluded, what you did or why you stopped", in that order).
    #>

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
    }

    It 'cites AGENTS.shared.md § Output discipline' -ForEach @(
        @{ Skill = 'skills/next/SKILL.md' }
        @{ Skill = 'skills/clean/SKILL.md' }
        @{ Skill = 'skills/check/SKILL.md' }
        @{ Skill = 'skills/pr/SKILL.md' }
        @{ Skill = 'skills/resolve/SKILL.md' }
    ) {
        $content = Get-Content -LiteralPath (Join-Path $script:RepoRoot $Skill) -Raw
        $content | Should -Match '`AGENTS\.shared\.md`.{0,4}\*Output discipline\*' -Because "$Skill's completion report is governed by the one canonical shape, not its own"
    }

    It 'skills/next/SKILL.md no longer orders its report evidence-first' {
        $content = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'skills/next/SKILL.md') -Raw
        $content | Should -Not -Match 'what you read.{0,20}what you concluded.{0,20}what you did'
    }

    It 'every representative skill names Result: and Next: in its own report section' -ForEach @(
        @{ Skill = 'skills/next/SKILL.md' }
        @{ Skill = 'skills/clean/SKILL.md' }
        @{ Skill = 'skills/check/SKILL.md' }
        @{ Skill = 'skills/pr/SKILL.md' }
        @{ Skill = 'skills/resolve/SKILL.md' }
    ) {
        $content = Get-Content -LiteralPath (Join-Path $script:RepoRoot $Skill) -Raw
        $content | Should -Match '`Result:`'
        $content | Should -Match '`Next:`'
    }

    It 'skills/resolve/SKILL.md frames an unresolved thread as a decision stop' {
        <#
          The decision-stop path. /resolve's own list is evidence - threads found, the
          classification table, what was pushed - and an Ambiguous thread is the one thing in
          it a person has to answer. Leading with the list buries that.
        #>
        $content = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'skills/resolve/SKILL.md') -Raw
        $content | Should -Match 'decision stop'
        $content | Should -Match 'recommended option first'
    }
}

Describe 'the operator frame does not displace the structured evidence it sits above' {

    <#
      Required fact 6 of the handoff: structured results and verification artifacts are
      unchanged. The lead-in is framing, so each mechanism the representative skills depend on
      must still be stated where it was - a Result:/Next: line that replaced one of these
      rather than sitting above it is the failure this catches.
    #>

    BeforeAll {
        $script:RepoRoot = Split-Path $PSScriptRoot -Parent
    }

    It '/check still writes and validates the structured artifact before any prose' {
        $content = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'skills/check/SKILL.md') -Raw
        $content | Should -Match '\.claude/verify-report\.json'
        $content | Should -Match 'tools/Test-VerifyReport\.ps1'
        $content | Should -Match 'Write the result as a structured artifact first'
        $content | Should -Match 'Read the artifact back from disk before writing a word of prose'
    }

    It '/check still renders all three exhaustive lists' -ForEach @(
        @{ Heading = 'Ran and passed' }
        @{ Heading = 'Ran and failed' }
        @{ Heading = 'Did not run' }
    ) {
        $content = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'skills/check/SKILL.md') -Raw
        $content | Should -Match ([regex]::Escape($Heading))
    }

    It '/pr still copies only the evidence payload into the PR body, not the chat envelope' {
        $content = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'skills/pr/SKILL.md') -Raw
        $content | Should -Match 'Verified'
        $content | Should -Match 'verbatim'
    }

    It '/clean still reports its structured fields by name' -ForEach @(
        @{ Field = 'PrunedCount' }
        @{ Field = 'Stashed' }
        @{ Field = 'TipAheadOfMergedPr' }
    ) {
        $content = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'skills/clean/SKILL.md') -Raw
        $content | Should -Match ([regex]::Escape($Field))
    }
}
