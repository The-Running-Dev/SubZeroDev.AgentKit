#Requires -Version 7.0
#Requires -Modules Pester

<#
  Invoke-CodexCommand.ps1 maps each command name to a Codex profile per AGENTS.md's
  *Command routing* table. The regression this guards (issue #116): /done was renamed to
  /clean (issue #127) but the map kept the old 'done' key, so /clean fell through to the
  "no profile mapping" error - exactly the manual profile selection the script exists to
  remove. Runs against this repository's own .claude/commands/ rather than a fixture,
  since the defect is staleness against the real command set.
#>

BeforeAll {
    $script:ScriptPath = Join-Path $PSScriptRoot 'Invoke-CodexCommand.ps1'
    $script:RepoRoot = Split-Path $PSScriptRoot -Parent
    $script:CommandNames = Get-ChildItem (Join-Path $script:RepoRoot '.claude/commands/*.md') |
        ForEach-Object { $_.BaseName }
}

Describe 'Invoke-CodexCommand command map' {
    It 'has a mapping for every command file in .claude/commands/' {
        foreach ($name in $script:CommandNames) {
            { & $script:ScriptPath -Command $name -WhatIf } | Should -Not -Throw -Because "/$name has no profile mapping"
        }
    }

    It 'resolves /clean rather than the retired /done name' {
        $result = & $script:ScriptPath -Command 'clean' -WhatIf
        $result | Should -Match 'gpt-5.3-codex-spark'
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
        $result = & $script:ScriptPath -Command 'slice' -WhatIf
        $result | Should -Match 'AGENTKIT_TIER=Implementation'
    }

    It 'stamps the resolved effort, not the profile default, when -Effort overrides it' {
        $result = & $script:ScriptPath -Command 'slice' -Effort high -WhatIf
        $result | Should -Match 'AGENTKIT_EFFORT=high'
        $result | Should -Match 'AGENTKIT_TIER=Implementation'
    }

    It 'stamps a tier for every command file in .claude/commands/' {
        foreach ($name in $script:CommandNames) {
            $result = & $script:ScriptPath -Command $name -WhatIf
            $result | Should -Match 'AGENTKIT_TIER=(Deep reasoning|Implementation)' -Because "/$name stamps no tier"
        }
    }
}

Describe 'Invoke-CodexCommand resolved effort and sandbox match AGENTS.md (issue #252)' {
    <#
      Before this fix, every deep-reasoning command shared one 'architect' profile that was
      sandboxed read-only - correct for /redteam and /brief-check, which write nothing, but
      wrong for /design, /contract, /slices, and /reconcile, whose normal work is writing to
      design/. The same profile also defaulted to 'xhigh' effort where AGENTS.md's tier table
      requires 'high'. Separately, /kit-help and /clean resolved 'low' effort against an
      implementation-tier requirement of 'medium'. These assert against AGENTS.md's tables
      directly (not against $commandProfiles/$profileConfig) so a future edit to either table
      without the other still fails here.
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
        foreach ($name in 'brief-check', 'design', 'contract', 'slices', 'redteam', 'reconcile') {
            (Get-Resolved $name).Effort | Should -Be 'high' -Because "/$name is deep-reasoning tier, which defaults to 'high' per AGENTS.md - xhigh is for one escalated question, not a profile default"
        }
    }

    It 'gives implementation-tier housekeeping commands medium effort, not low' {
        foreach ($name in 'kit-help', 'clean') {
            (Get-Resolved $name).Effort | Should -Be 'medium' -Because "/$name is implementation tier per AGENTS.md's Command routing table"
        }
    }

    It 'keeps /redteam and /brief-check read-only' {
        foreach ($name in 'redteam', 'brief-check') {
            (Get-Resolved $name).Sandbox | Should -Be 'read-only' -Because "/$name writes nothing and should never be able to touch the tree"
        }
    }

    It 'gives design-document-writing deep-reasoning commands a writable sandbox' {
        foreach ($name in 'design', 'contract', 'slices', 'reconcile') {
            (Get-Resolved $name).Sandbox | Should -Be 'workspace-write' -Because "/$name writes to design/ as its normal work"
        }
    }
}

Describe 'Invoke-CodexCommand /unfreeze two-process chain (issue #253)' {
    <#
      unfreeze.md requires its reconcile phase at deep-reasoning tier and its track phase at
      implementation tier "in this same session," but a single Codex profile can't switch
      mid-session. Before this fix, /unfreeze mapped to one profile ('builder') for the whole
      run, so its reconcile phase could never actually reach deep-reasoning tier. The fix
      chains two separate `codex` invocations instead of picking one profile.
    #>

    BeforeAll {
        $script:UnfreezeWhatIf = & $script:ScriptPath -Command 'unfreeze' -WhatIf
    }

    It 'emits two codex invocations, not one' {
        ($script:UnfreezeWhatIf | Measure-Object).Count | Should -Be 2
    }

    It 'runs the first (reconcile) process at deep-reasoning tier with a writable sandbox' {
        $script:UnfreezeWhatIf[0] | Should -Match 'AGENTKIT_TIER=Deep reasoning'
        $script:UnfreezeWhatIf[0] | Should -Match '-s workspace-write'
    }

    It 'runs the second (track) process at implementation tier' {
        $script:UnfreezeWhatIf[1] | Should -Match 'AGENTKIT_TIER=Implementation'
    }

    It 'still resolves /unfreeze without a $commandProfiles entry throwing "no profile mapping"' {
        { & $script:ScriptPath -Command 'unfreeze' -WhatIf } | Should -Not -Throw
    }
}
