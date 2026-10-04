#Requires -Version 7.0
#Requires -Modules Pester

<#
  Invoke-CodexCommand.ps1 maps each command name to a Codex profile per AGENTS.shared.md's
  *Models* table. The regression this guards (issue #116): a renamed command kept its old
  map key, so the new name fell through to the "no profile mapping" error - exactly the
  manual profile selection the script exists to remove. Runs against this repository's own
  skills/ rather than a fixture, since the defect is staleness against the real command set.
#>

<#
  W3 correspondence parsers. These read AGENTS.shared.md's *Models* command table and
  codex/PROFILES.md's 0.134+ profile blocks as data, so the tests below (and their fixture
  counterparts) catch drift between what those documents say and what
  Invoke-CodexCommand.ps1 actually does - instead of the hand-kept-in-sync comments that
  used to be the only thing saying they matched (see the correction below issue #252's
  Describe block, and the launcher's own header comment).

  Kept as plain functions (not a machine-readable routing source) per the work plan's "Not
  doing": the point is to test the correspondence, not to move policy out of the tables
  people read.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'Invoke-CodexCommand.ps1'
    $script:RepoRoot = Split-Path $PSScriptRoot -Parent
    $script:CommandNames = Get-ChildItem -LiteralPath (Join-Path $script:RepoRoot 'skills') -Filter 'SKILL.md' -File -Recurse -Depth 1 |
        ForEach-Object { $_.Directory.Name }

    # This repo checkout is the install root the launcher should read skills/ from for every
    # test below, exactly as it is on a dev machine that has not run a separate home install
    # (this file's own header comment: "runs against this repository's own skills/").
    $script:PriorAgentKitHome = $env:AGENTKIT_HOME
    $env:AGENTKIT_HOME = $script:RepoRoot

function Get-AgentsCanonicalTierMap {
    <#
      Parses AGENTS.md's primary tier table (*Models*): rows of
      the form "| **<Tier>** | <work> | <effort> | `<claude alias>` | `<codex alias>` |".
      Returns alias -> tier name, first row wins a duplicate alias (so `opus` resolves to
      'Deep reasoning', not 'Exceptional fork' - Command routing never routes a command to
      the latter, it is an escalation only).
    #>
    param([Parameter(Mandatory)][string] $Text)

    $map = [ordered]@{}
    foreach ($line in ($Text -split "`r?`n")) {
        if ($line -match '^\|\s*\*\*(?<tier>[^*]+)\*\*\s*\|[^|]*\|[^|]*\|\s*`(?<claude>[a-zA-Z0-9]+)`\s*\|\s*`(?<codex>[a-zA-Z0-9]+)`\s*\|\s*$') {
            $alias = $Matches['claude']
            if (-not $map.Contains($alias)) { $map[$alias] = $Matches['tier'].Trim() }
        }
    }
    return $map
}

function Get-CommandRoutingRows {
    <#
      Parses any markdown table row whose first cell contains one or more `` `/name` ``
      tokens and is not a *Session boundaries*-style "`/a` -> `/b`" transition row - which
      in practice leaves only AGENTS.shared.md's *Models* command table, since *Session
      boundaries* is the only other table writing a slash-prefixed command name in
      backticks, and its first cell always names a transition rather than a single
      command's row. Returns one object per row: Commands (the slash names, without the
      slash) and Alias (the first of `sonnet`/`opus` found anywhere in the row's remaining
      cells - the Tier column normally, the Notes column for /redteam's "if it must be
      Claude" case).

      Not anchored to the "### Command routing" heading, so a locally edited AGENTS.md that
      has renamed or moved the heading still gets read correctly; a target repo where the
      table itself is gone or reshaped past recognition simply yields no rows, and callers
      skip rather than fail (AGENTS.md ships to every installed repo per INSTALL.md, but a
      repo may have edited its copy).
    #>
    param([Parameter(Mandatory)][string] $Text)

    $rows = @()
    foreach ($line in ($Text -split "`r?`n")) {
        if ($line -notmatch '^\s*\|') { continue }
        if ($line -match '^\s*\|\s*-+\s*\|') { continue }
        $cells = $line.Trim().Trim('|') -split '\|'
        if ($cells.Count -lt 2) { continue }
        if ($cells[0] -match "`u{2192}") { continue } # "->" transition row, e.g. Session boundaries
        $commandNames = @([regex]::Matches($cells[0], '`/([a-z0-9-]+)`') | ForEach-Object { $_.Groups[1].Value })
        if ($commandNames.Count -eq 0) { continue }
        $rest = ($cells[1..($cells.Count - 1)]) -join ' '
        $aliasMatch = [regex]::Match($rest, '`(sonnet|opus)`')
        $rows += [pscustomobject]@{
            Commands = $commandNames
            Alias    = if ($aliasMatch.Success) { $aliasMatch.Groups[1].Value } else { $null }
        }
    }
    return $rows
}

function Get-RoutingCoverageGaps {
    <#
      Every skills/*/SKILL.md file should appear in exactly one routing row. Returns
      the ones that don't (zero rows, or more than one) - $NamedSkips excuses any command
      that does not fit the one-row-one-command shape.
    #>
    param($Rows, $CommandNames, $NamedSkips = @())

    $gaps = @()
    foreach ($name in $CommandNames) {
        if ($name -in $NamedSkips) { continue }
        $count = @($Rows | Where-Object { $_.Commands -contains $name }).Count
        if ($count -ne 1) { $gaps += [pscustomobject]@{ Command = $name; RowCount = $count } }
    }
    return $gaps
}

function Get-RoutingTierMismatches {
    <#
      For every routed command that has a command file, runs the real launcher -WhatIf and
      compares its AGENTKIT_TIER stamp against the tier the row's alias resolves to via
      $TierMap. A row whose alias the map doesn't recognise is itself a mismatch ("stale or
      unrecognised alias") rather than silently skipped - AGENTS.md's own *Vendor model
      aliases* rule is "a mismatch gates the same way, in either direction."
    #>
    param($Rows, $TierMap, $ScriptPath, $CommandNames, $NamedSkips = @())

    $mismatches = @()
    foreach ($row in $Rows) {
        foreach ($name in $row.Commands) {
            if ($name -in $NamedSkips) { continue }
            if ($name -notin $CommandNames) { continue } # no command file - named skip
            if (-not $row.Alias -or -not $TierMap.Contains($row.Alias)) {
                $mismatches += [pscustomobject]@{ Command = $name; Reason = "unrecognised or missing alias '$($row.Alias)'" }
                continue
            }
            $expected = $TierMap[$row.Alias]
            $result = & $ScriptPath -Command $name -WhatIf
            if ($result -notmatch "AGENTKIT_TIER=$([regex]::Escape($expected))") {
                $mismatches += [pscustomobject]@{ Command = $name; Reason = "routing row says $expected ($($row.Alias)), launcher stamped something else" }
            }
        }
    }
    return $mismatches
}

function Get-ProfileTomlBlocks {
    <#
      Parses codex/PROFILES.md's "Codex 0.134.0 and later" section: each profile is a
      `~/.codex/<name>.config.toml` heading followed by a fenced toml block. Returns
      name -> { model; model_reasoning_effort; approval_policy; sandbox_mode }.
    #>
    param([Parameter(Mandatory)][string] $Text)

    $blocks = [ordered]@{}
    $matches = [regex]::Matches($Text, '(?ms)`~/\.codex/(?<name>[a-z]+)\.config\.toml`.*?```toml\s*(?<body>.*?)```')
    foreach ($m in $matches) {
        $body = $m.Groups['body'].Value
        $fields = @{}
        foreach ($field in 'model', 'model_reasoning_effort', 'approval_policy', 'sandbox_mode') {
            if ($body -match "(?m)^$field\s*=\s*`"([^`"]+)`"") { $fields[$field] = $Matches[1] }
        }
        $blocks[$m.Groups['name'].Value] = $fields
    }
    return $blocks
}

function Get-LauncherProfileConfig {
    <#
      Parses Invoke-CodexCommand.ps1's own $profileConfig hashtable out of its source text,
      reading the source text -
      reading the launcher's actual literal values rather than re-declaring them, so a hand
      edit to one place and not the other is exactly what these tests are meant to catch.
    #>
    param([Parameter(Mandatory)][string] $ScriptText)

    $result = [ordered]@{}
    $blockMatch = [regex]::Match($ScriptText, '(?s)\$profileConfig = \[ordered\]@\{(?<body>.*?)\r?\n\}')
    if (-not $blockMatch.Success) { return $result }
    $rowMatches = [regex]::Matches($blockMatch.Groups['body'].Value,
        "'(?<name>[a-z]+)'\s*=\s*@\{\s*Model\s*=\s*'(?<model>[^']+)';\s*Effort\s*=\s*'(?<effort>[^']+)';\s*Approval\s*=\s*'(?<approval>[^']+)';\s*Sandbox\s*=\s*'(?<sandbox>[^']+)'\s*\}")
    foreach ($m in $rowMatches) {
        $result[$m.Groups['name'].Value] = @{
            model                  = $m.Groups['model'].Value
            model_reasoning_effort = $m.Groups['effort'].Value
            approval_policy        = $m.Groups['approval'].Value
            sandbox_mode           = $m.Groups['sandbox'].Value
        }
    }
    return $result
}

}

AfterAll {
    $env:AGENTKIT_HOME = $script:PriorAgentKitHome
}

Describe 'Invoke-CodexCommand command map' {
    It 'has a mapping for every command file in skills/' {
        foreach ($name in $script:CommandNames) {
            { & $script:ScriptPath -Command $name -WhatIf } | Should -Not -Throw -Because "/$name has no profile mapping"
        }
    }

    It 'throws for a command name with no mapping' {
        { & $script:ScriptPath -Command 'not-a-real-command' -WhatIf } | Should -Throw
    }
}

Describe 'Invoke-CodexCommand tier stamping' {
    <#
      The gate in AGENTS.md resolves a Codex session's tier from configuration, but the
      `architect` profile is sandboxed read-only to the workspace and `~/.codex/` is outside
      it, so the session cannot read the file the rule names and the gate stops on every
      /redteam run. These guard the stamp that crosses that boundary.
    #>

    It 'stamps AGENTKIT_TIER as Deep reasoning for an architect-profile command' {
        $result = & $script:ScriptPath -Command 'redteam' -WhatIf
        $result | Should -Match 'AGENTKIT_TIER=Deep reasoning'
    }

    It 'stamps AGENTKIT_TIER as Implementation for a builder-profile command' {
        $result = & $script:ScriptPath -Command 'next' -WhatIf
        $result | Should -Match 'AGENTKIT_TIER=Implementation'
    }

    It 'stamps the resolved effort, not the profile default, when -Effort overrides it' {
        $result = & $script:ScriptPath -Command 'next' -Effort high -WhatIf
        $result | Should -Match 'AGENTKIT_EFFORT=high'
        $result | Should -Match 'AGENTKIT_TIER=Implementation'
    }

    It 'stamps a tier for every command file in skills/' {
        foreach ($name in $script:CommandNames) {
            $result = & $script:ScriptPath -Command $name -WhatIf
            $result | Should -Match 'AGENTKIT_TIER=(Deep reasoning|Implementation)' -Because "/$name stamps no tier"
        }
    }
}

Describe 'Invoke-CodexCommand resolved effort and sandbox match AGENTS.md (issue #252)' {
    <#
      Before this fix, every deep-reasoning command shared one 'architect' profile that was
      sandboxed read-only - correct for /redteam and /brief, which write nothing, but
      wrong for /design, /spec, /plan, and /align, whose normal work is writing to
      design/. The same profile also defaulted to 'xhigh' effort where AGENTS.md's tier table
      requires 'high'. Separately, two housekeeping commands resolved 'low' effort against an
      implementation-tier requirement of 'medium'. These hardcode the expected effort and
      sandbox per command name, kept in sync with AGENTS.md's tables by hand - they do not
      parse AGENTS.md itself, so an edit to the *Models* command table without a matching edit here
      would not fail. The 'W3' Describe blocks below are the ones that parse AGENTS.md's
      tables directly and so catch that drift automatically.
    #>

    BeforeAll {
        function Get-Resolved($name) {
            $result = & $script:ScriptPath -Command $name -WhatIf
            [pscustomobject]@{
                Effort  = if ($result -match 'model_reasoning_effort=(\S+)') { $Matches[1] } else { $null }
                Sandbox = if ($result -match '-s (\S+)') { $Matches[1] } else { $null }
            }
        }
    }

    It 'never defaults a deep-reasoning command to xhigh effort' {
        foreach ($name in 'brief', 'interview', 'design', 'plan', 'redteam', 'align') {
            (Get-Resolved $name).Effort | Should -Be 'high' -Because "/$name is deep-reasoning tier, which defaults to 'high' per AGENTS.md - xhigh is for one escalated question, not a profile default"
        }
    }

    It 'gives implementation-tier commands medium effort, not low' {
        foreach ($name in 'next', 'fix', 'sync') {
            (Get-Resolved $name).Effort | Should -Be 'medium' -Because "/$name is implementation tier per AGENTS.shared.md's Models command table"
        }
    }

    It 'keeps /redteam and /brief read-only' {
        foreach ($name in 'redteam', 'brief') {
            (Get-Resolved $name).Sandbox | Should -Be 'read-only' -Because "/$name writes nothing and should never be able to touch the tree"
        }
    }

    It 'gives design-document-writing deep-reasoning commands a writable sandbox' {
        foreach ($name in 'interview', 'design', 'plan', 'align') {
            (Get-Resolved $name).Sandbox | Should -Be 'workspace-write' -Because "/$name writes to design/ as its normal work"
        }
    }
}

Describe 'Invoke-CodexCommand install root resolution (Get-AgentKitInstallRoot, home install)' {
    <#
      Resolution order per AGENTS.shared.md's Home-install convention: (1) self-hosted - this
      script's own containing checkout, when it has a .git folder, so kit development reads
      live uncommitted edits rather than a possibly-stale synced copy; (2) $env:AGENTKIT_HOME,
      when set and present; (3) $HOME/.agent-kit, the location /sync maintains. Exercised
      through -WhatIf on /next with -SkillArguments (which makes the prompt read the skill
      file), since the function itself is not exported.

      $script:ScriptPath always resolves self-hosted (this repo has a real .git), so branches
      2 and 3 are exercised against a copy under TestDrive that has no .git sibling - the
      fixture New-NonSelfHostedFixture below.
    #>

    BeforeAll {
        $script:PriorAgentKitHome = $env:AGENTKIT_HOME

        function New-NonSelfHostedFixture {
            <# Copies just enough of this repo (the launcher + skills/next/SKILL.md)
               into a fresh TestDrive directory with no .git, so Get-AgentKitInstallRoot's
               self-hosted check fails there and falls through to $env:AGENTKIT_HOME /
               $HOME/.agent-kit - the branches $script:ScriptPath can never exercise, since
               it always resolves self-hosted from inside this real checkout. #>
            param([Parameter(Mandatory)][string] $Name)

            $fixtureRoot = Join-Path $TestDrive $Name
            New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'tools') -Force | Out-Null
            New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'skills/next') -Force | Out-Null
            Copy-Item -LiteralPath $script:ScriptPath -Destination (Join-Path $fixtureRoot 'tools/Invoke-CodexCommand.ps1')
            Copy-Item -LiteralPath (Join-Path $script:RepoRoot 'tools/Get-AgentKitSkill.ps1') -Destination (Join-Path $fixtureRoot 'tools/Get-AgentKitSkill.ps1')
            Copy-Item -LiteralPath (Join-Path $script:RepoRoot 'skills/next/SKILL.md') -Destination (Join-Path $fixtureRoot 'skills/next/SKILL.md')
            return (Join-Path $fixtureRoot 'tools/Invoke-CodexCommand.ps1')
        }
    }

    AfterEach {
        $env:AGENTKIT_HOME = $script:PriorAgentKitHome
    }

    It 'resolves the install root from the self-hosted checkout even when $env:AGENTKIT_HOME points elsewhere' {
        $env:AGENTKIT_HOME = Join-Path $TestDrive 'does-not-exist'
        { & $script:ScriptPath -Command 'next' -SkillArguments @('x') -WhatIf } | Should -Not -Throw
    }

    It 'falls back to $env:AGENTKIT_HOME when no self-hosted checkout is available' {
        $fixtureScript = New-NonSelfHostedFixture -Name 'agentkit-home-fixture'
        $env:AGENTKIT_HOME = $script:RepoRoot
        { & $fixtureScript -Command 'next' -SkillArguments @('x') -WhatIf } | Should -Not -Throw
    }

    It 'falls back to $HOME/.agent-kit when self-hosted is unavailable and $env:AGENTKIT_HOME is unset' {
        $fixtureScript = New-NonSelfHostedFixture -Name 'home-agent-kit-fixture'
        Remove-Item Env:AGENTKIT_HOME -ErrorAction SilentlyContinue
        $fallbackRoot = Join-Path $HOME '.agent-kit'
        if (Test-Path -LiteralPath (Join-Path $fallbackRoot 'skills/next/SKILL.md')) {
            Set-ItResult -Skipped -Because 'this machine already has a real home install at $HOME/.agent-kit'
            return
        }
        { & $fixtureScript -Command 'next' -SkillArguments @('x') -WhatIf } | Should -Throw "*$fallbackRoot*"
    }

    It 'throws naming every location checked when self-hosted, $env:AGENTKIT_HOME, and $HOME/.agent-kit all miss' {
        $fixtureScript = New-NonSelfHostedFixture -Name 'no-root-fixture'
        $env:AGENTKIT_HOME = Join-Path $TestDrive 'does-not-exist'
        $fallbackRoot = Join-Path $HOME '.agent-kit'
        if (Test-Path -LiteralPath $fallbackRoot) {
            Set-ItResult -Skipped -Because 'this machine already has a checkout at $HOME/.agent-kit, so this branch cannot be reached'
            return
        }
        # The source names the env var literally (`$env:AGENTKIT_HOME) rather than
        # interpolating its value - see Invoke-CodexCommand.ps1's Get-AgentKitInstallRoot,
        # since this branch fires whether the var is unset or set to a bad path.
        $fixtureRoot = Split-Path -Parent (Split-Path -Parent $fixtureScript)
        { & $fixtureScript -Command 'next' -SkillArguments @('x') -WhatIf } | Should -Throw "*$fixtureRoot*`$env:AGENTKIT_HOME*$fallbackRoot*"
    }
}

Describe 'Invoke-CodexCommand command routing matches AGENTS.shared.md Command routing (W3, issue #299)' {
    <#
      Regression coverage for the gap the #252 Describe block above disclosed once corrected:
      nothing previously parsed AGENTS.md's own *Models* command table and compared it
      against $commandProfiles/$profileTiers, so the two could drift silently (exactly the
      renamed-command staleness issue #116 already found once, in the other direction).

      Skipped, not failed, when a target repo's locally edited AGENTS.md no longer contains
      anything Get-CommandRoutingRows recognises as the table - AGENTS.md ships to every
      installed repo (INSTALL.md) but a repo is free to edit its own copy.
    #>

    BeforeAll {
        $script:AgentsMdPath = Join-Path $script:RepoRoot 'AGENTS.shared.md'
        $script:AgentsMdText = Get-Content -Raw -LiteralPath $script:AgentsMdPath
        $script:CanonicalTierMap = Get-AgentsCanonicalTierMap -Text $script:AgentsMdText
        $script:RoutingRows = Get-CommandRoutingRows -Text $script:AgentsMdText
        $script:NamedSkips = @()
    }

    It 'finds rows in AGENTS.md''s Models command table' {
        $script:RoutingRows.Count | Should -BeGreaterThan 0 -Because 'a locally edited AGENTS.md that no longer has a recognisable Command routing table would silently skip every check below - this fails loudly instead'
    }

    It 'finds Claude aliases for Deep reasoning and Implementation in AGENTS.md''s primary tier table' {
        $script:CanonicalTierMap['opus'] | Should -Be 'Deep reasoning'
        $script:CanonicalTierMap['sonnet'] | Should -Be 'Implementation'
    }

    It 'every skills/*/SKILL.md file appears in exactly one Command routing row' {
        if ($script:RoutingRows.Count -eq 0) {
            Set-ItResult -Skipped -Because 'no recognisable Command routing table - see the locally-edited-AGENTS.md note above'
            return
        }
        $gaps = Get-RoutingCoverageGaps -Rows $script:RoutingRows -CommandNames $script:CommandNames -NamedSkips $script:NamedSkips
        $gaps | Should -BeNullOrEmpty -Because ("the following command files have no row, or more than one: " + (($gaps | ForEach-Object { "/$($_.Command) ($($_.RowCount) rows)" }) -join ', '))
    }

    It 'stamps AGENTKIT_TIER matching its Command routing row, for every routed command with a command file' {
        if ($script:RoutingRows.Count -eq 0) {
            Set-ItResult -Skipped -Because 'no recognisable Command routing table - see the locally-edited-AGENTS.md note above'
            return
        }
        $mismatches = Get-RoutingTierMismatches -Rows $script:RoutingRows -TierMap $script:CanonicalTierMap -ScriptPath $script:ScriptPath -CommandNames $script:CommandNames -NamedSkips $script:NamedSkips
        $mismatches | Should -BeNullOrEmpty -Because ("the following commands' launcher tier disagrees with their Command routing row: " + (($mismatches | ForEach-Object { "/$($_.Command): $($_.Reason)" }) -join '; '))
    }
}

Describe 'Command routing correspondence parser rejects bad data (W3 fixtures)' {
    <#
      Unit coverage for the parser/comparison functions above, independent of whatever
      AGENTS.md currently says. Uses real command names (/next, /redteam) so the tier
      mismatch case exercises the actual launcher, not a stand-in.
    #>

    BeforeAll {
        $script:GoodFixture = @'
| Command | Tier | Notes |
|---|---|---|
| `/next` | `sonnet`, `medium` | — |
| `/redteam` | strongest model, different vendor | If it must be Claude, a fresh `opus`, `high` session |
'@
        $script:TierMap = [ordered]@{ opus = 'Deep reasoning'; sonnet = 'Implementation' }
    }

    It 'parses command names and the tier alias, including one found only in the Notes column' {
        $rows = Get-CommandRoutingRows -Text $script:GoodFixture
        ($rows | Where-Object { $_.Commands -contains 'next' }).Alias | Should -Be 'sonnet'
        ($rows | Where-Object { $_.Commands -contains 'redteam' }).Alias | Should -Be 'opus'
    }

    It 'passes correspondence checks for a fixture that agrees with the real launcher' {
        $mismatches = Get-RoutingTierMismatches -Rows (Get-CommandRoutingRows -Text $script:GoodFixture) -TierMap $script:TierMap -ScriptPath $script:ScriptPath -CommandNames @('next', 'redteam')
        $mismatches | Should -BeNullOrEmpty
    }

    It 'rejects a wrong tier: fixture claims /next is opus/high, but the launcher stamps it Implementation' {
        $badFixture = $script:GoodFixture -replace '`/next` \| `sonnet`, `medium`', '`/next` | `opus`, `high`'
        $mismatches = Get-RoutingTierMismatches -Rows (Get-CommandRoutingRows -Text $badFixture) -TierMap $script:TierMap -ScriptPath $script:ScriptPath -CommandNames @('next', 'redteam')
        $mismatches.Command | Should -Contain 'next'
    }

    It 'rejects a wrong/unrecognised model alias' {
        $badFixture = $script:GoodFixture -replace '`sonnet`, `medium`', '`gpt4`, `medium`'
        $mismatches = Get-RoutingTierMismatches -Rows (Get-CommandRoutingRows -Text $badFixture) -TierMap $script:TierMap -ScriptPath $script:ScriptPath -CommandNames @('next', 'redteam')
        ($mismatches | Where-Object { $_.Command -eq 'next' }).Reason | Should -Match 'unrecognised or missing alias'
    }

    It 'rejects a command with no routing row' {
        $gaps = Get-RoutingCoverageGaps -Rows (Get-CommandRoutingRows -Text $script:GoodFixture) -CommandNames @('next', 'redteam', 'fix')
        $gaps.Command | Should -Contain 'fix'
        $gaps.Command | Should -Not -Contain 'next'
    }
}

Describe 'Invoke-CodexCommand profiles match codex/PROFILES.md (W3, issue #299)' {
    <#
      Regression coverage for the launcher header's own admission (before this fix): "Keep
      $profileConfig below in sync with codex/PROFILES.md by hand; nothing enforces that
      automatically." This is the enforcement - see the corrected header comment.
    #>

    BeforeAll {
        $script:ProfilesMdPath = Join-Path $script:RepoRoot 'codex/PROFILES.md'
        $script:ProfilesMdText = Get-Content -Raw -LiteralPath $script:ProfilesMdPath
        $script:DocProfiles = Get-ProfileTomlBlocks -Text $script:ProfilesMdText
        $script:LauncherProfiles = Get-LauncherProfileConfig -ScriptText (Get-Content -Raw -LiteralPath $script:ScriptPath)
    }

    It 'finds all four 0.134+ profile blocks in codex/PROFILES.md' {
        ($script:DocProfiles.Keys | Sort-Object) | Should -Be @('architect', 'author', 'builder', 'quick')
    }

    It 'matches model, effort, approval, and sandbox for every profile' {
        foreach ($name in 'architect', 'author', 'builder', 'quick') {
            $doc = $script:DocProfiles[$name]
            $launcher = $script:LauncherProfiles[$name]
            $launcher | Should -Not -BeNullOrEmpty -Because "`$profileConfig has no '$name' entry"
            $launcher.model | Should -Be $doc.model -Because "$name's model"
            $launcher.model_reasoning_effort | Should -Be $doc.model_reasoning_effort -Because "$name's effort"
            $launcher.approval_policy | Should -Be $doc.approval_policy -Because "$name's approval policy"
            $launcher.sandbox_mode | Should -Be $doc.sandbox_mode -Because "$name's sandbox mode"
        }
    }
}

Describe 'Codex profile parser rejects bad data (W3 fixtures)' {
    It 'reads exactly what a fixture says, wrong values included, rather than silently correcting them' {
        $badDocText = @'
**`~/.codex/builder.config.toml`**
```toml
model = "gpt-5.6-sol"
model_reasoning_effort = "medium"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```
'@
        $doc = Get-ProfileTomlBlocks -Text $badDocText
        $doc['builder'].model | Should -Be 'gpt-5.6-sol'
        $doc['builder'].model | Should -Not -Be 'gpt-5.6-terra' -Because 'a real correspondence check against this fixture would now fail, which is the point: builder is really gpt-5.6-terra'
    }
}

Describe 'Invoke-CodexCommand canonical skill prompts' {
    It 'inlines the selected canonical SKILL.md and preserves user arguments as one JSON array' {
        $arguments = @('contains spaces', 'quote " and apostrophe ''', "line one`nline two", '-not-a-launcher-switch')
        $expectedJson = ConvertTo-Json -InputObject $arguments -Compress
        $result = & $script:ScriptPath -Command 'next' -WhatIf -SkillArguments $arguments
        $skill = & (Join-Path $script:RepoRoot 'tools/Get-AgentKitSkill.ps1') -Command next

        $result | Should -Match ([regex]::Escape($skill))
        $result | Should -Match 'Do not invoke\s+another AgentKit wrapper, skill-dispatch command, or global adapter'
        $result | Should -Match ([regex]::Escape($expectedJson))
    }

    It 'uses the canonical prompt only for explicit SkillArguments' {
        $launcher = Get-Content -Raw -LiteralPath $script:ScriptPath
        $launcher | Should -Match '\$useSkillArguments = \$PSBoundParameters\.ContainsKey\(''SkillArguments''\)'
        $launcher | Should -Match '& \$reader -Command \$Name'
        $launcher | Should -Match '\$codexInvocationArgs \+= \$CodexArgs'
    }

    It 'preserves legacy CodexArgs passthrough without a canonical skill prompt' {
        $result = & $script:ScriptPath -Command next -WhatIf '--legacy-flag' 'legacy prompt'
        $result | Should -Match '--legacy-flag legacy prompt'
        $result | Should -Not -Match 'canonical skills/next/SKILL.md'
    }
}
