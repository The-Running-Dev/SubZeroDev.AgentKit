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
    $script:DesignDocs = @('00-brief', '10-design', '20-contract', '30-slices') |
        ForEach-Object {
            # The Landed index is history and names retired tools by design; only the live text is checked.
            $text = Get-Content -Raw -LiteralPath (Join-Path $script:RepoRoot "design/$_.md")
            [pscustomobject]@{ Name = "$_.md"; Text = ($text -split '(?m)^## Landed\s*$')[0] }
        }
    $script:Slices = Get-Content -Raw -LiteralPath (Join-Path $script:RepoRoot 'design/30-slices.md')

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

    It 'never stashes a dirty tree' {
        $script:Next | Should -Match '(?i)never stash'
        $script:Next | Should -Not -Match 'git stash'
    }

    It 'treats the Landed index as done and never rebuilds it' {
        $script:Next | Should -Match '## Landed'
        $script:Next | Should -Match 'none is ever rebuilt'
    }
}

Describe 'design/ (the live spec the build commands read)' {
    It 'cites no removed tool or command' {
        foreach ($doc in $script:DesignDocs) {
            foreach ($tool in $script:Removed) {
                $doc.Text | Should -Not -Match ([regex]::Escape($tool)) -Because "$($doc.Name) cites $tool, which was removed"
            }
            foreach ($command in $script:RemovedCommands) {
                $doc.Text | Should -Not -Match "``/$command[`` ]" -Because "$($doc.Name) invokes /$command, which was removed"
            }
        }
    }

    It 'does not describe a session boundary or a design freeze' {
        foreach ($doc in $script:DesignDocs) {
            $doc.Text | Should -Not -Match '(?i)session boundar' -Because $doc.Name
            $doc.Text | Should -Not -Match 'FROZEN\.md' -Because $doc.Name
        }
    }

    It 'gives every slice heading a Status line, so /next selection is never ambiguous' {
        $headings = [regex]::Matches($script:Slices, '(?m)^#{2,3} S(\d+)[^
]*
?
(?<body>(?:(?!^#{1,3} ).*
?
?)*)')
        foreach ($m in $headings) {
            $m.Groups['body'].Value | Should -Match '(?m)^Status: (todo|done)\s*$' -Because "slice S$($m.Groups[1].Value) needs a Status line"
        }
    }

    It 'keeps the migrated slices S1-S32 as a Landed index, not as slice headings' {
        $script:Slices | Should -Match '(?m)^## Landed\s*$'
        foreach ($n in 1..32) {
            $script:Slices | Should -Match "\|\s*\*\*S$n\*\*\s*\|" -Because "S$n must stay in the Landed index"
            $script:Slices | Should -Not -Match "(?m)^#{2,3} S$n" -Because "S$n must not be a buildable heading"
        }
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
