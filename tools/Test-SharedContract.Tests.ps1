#Requires -Version 7.0
#Requires -Modules Pester

<#
  Guards the workflow redesign: /next builds the whole plan in one session, design/ is a
  write-once spec, and the drift and tracker machinery is gone. The regression this catches
  is the old shape creeping back - a command file ending a session at a boundary, or pointing
  at a tool or command that no longer exists.
#>

BeforeAll {
    $script:RepoRoot = Split-Path $PSScriptRoot -Parent
    $script:Shared = Get-Content -Raw -LiteralPath (Join-Path $script:RepoRoot 'AGENTS.shared.md')
    $script:Skills = Get-ChildItem -LiteralPath (Join-Path $script:RepoRoot 'skills') -Filter 'SKILL.md' -File -Recurse -Depth 1
    $script:Next = Get-Content -Raw -LiteralPath (Join-Path $script:RepoRoot 'skills/next/SKILL.md')

    $script:Removed = @(
        'Test-DesignState', 'Test-DesignDrift', 'Test-Companion', 'Test-WriteSurface', 'Test-CIWorkflow',
        'Update-WorkMirror', 'Update-DesignProjection', 'Update-SlicesDocument', 'Read-DesignState',
        'Get-NextOrientation', 'Get-AgentKitNext'
    )
    $script:RemovedCommands = @('track', 'clean', 'hold', 'resume', 'tune', 'handoff', 'spec', 'docs', 'slice', 'check', 'resolve', 'pr', 'help', 'autoupdate')
}

Describe 'AGENTS.shared.md' {
    It 'lets a build continue in the same session' {
        $script:Shared | Should -Match 'continues in the same session'
    }

    It 'has no session-boundary rule' {
        $script:Shared | Should -Not -Match '(?i)session boundar'
        $script:Shared | Should -Not -Match '(?i)fresh session'
    }

    It 'keeps the no-attribution rule' {
        $script:Shared | Should -Match 'No AI attribution, anywhere'
    }

    It 'keeps merging delegated to Merge-PullRequest.ps1 alone' {
        $script:Shared | Should -Match 'Merging is delegated to `tools/Merge-PullRequest\.ps1` and nothing else'
    }

    It 'has no design freeze' {
        $script:Shared | Should -Not -Match 'FROZEN\.md'
    }
}

Describe 'skills/next' {
    It 'builds slice after slice in this same session' {
        $script:Next | Should -Match 'in this same session'
    }

    It 'merges only through Merge-PullRequest.ps1' {
        $script:Next | Should -Match 'tools/Merge-PullRequest\.ps1'
    }
}

Describe 'command files' {
    It 'never end a run with a session-boundary banner' {
        foreach ($file in $script:Skills) {
            (Get-Content -Raw -LiteralPath $file.FullName) | Should -Not -Match '(?i)session boundary' -Because "$($file.Directory.Name) must not hand off to a new session"
        }
    }

    It 'reference no removed tool' {
        foreach ($file in $script:Skills) {
            $text = Get-Content -Raw -LiteralPath $file.FullName
            foreach ($tool in $script:Removed) {
                $text | Should -Not -Match ([regex]::Escape($tool)) -Because "$($file.Directory.Name) cites $tool, which was removed"
            }
        }
    }

    It 'invoke no removed command' {
        foreach ($file in $script:Skills) {
            $text = Get-Content -Raw -LiteralPath $file.FullName
            foreach ($command in $script:RemovedCommands) {
                $text | Should -Not -Match "``/$command[`` ]" -Because "$($file.Directory.Name) invokes /$command, which was removed"
            }
        }
    }

    It 'cite COMPANIONS.md only to migrate it away' {
        $offenders = $script:Skills | Where-Object { $_.Directory.Name -ne 'install-all' } |
            Where-Object { (Get-Content -Raw -LiteralPath $_.FullName) -match 'COMPANIONS\.md' }
        $offenders | Should -BeNullOrEmpty
    }

    It 'detects a removed tool when one is cited (guard self-test)' {
        'run `pwsh -File tools/Test-DesignState.ps1`' | Should -Match ([regex]::Escape('Test-DesignState'))
        'then run `/track` to sync' | Should -Match '`/track[` ]'
    }
}
