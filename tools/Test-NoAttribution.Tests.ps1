#Requires -Version 7.0
#Requires -Modules Pester

<#
  Regression coverage for issue #340 (enforce the no-AI-attribution rule mechanically).
  Two mechanisms, two Describe blocks: the commit-msg hook (S.1-S.3, strips locally) and
  Test-NoAttribution.ps1 (S.4-S.5, the CI-side gate for commits made without the hook).
#>


# -Skip: is evaluated during discovery, so this is the one variable safe to compute at
# top level; everything else is recomputed inside each Describe's own BeforeAll, because a
# $script: variable set during discovery is not in scope once Pester's run phase starts
# (tools/Test-CIWorkflow.Tests.ps1 carries the same note).
$script:SkipHookTests = -not (Get-Command sh -ErrorAction SilentlyContinue)

Describe 'tools/git-hooks/commit-msg: strips AI attribution locally (#340 S.2/S.3)' {

    BeforeAll {
        $script:ShPath = (Get-Command sh -ErrorAction SilentlyContinue).Source
        $script:HookPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/git-hooks/commit-msg'

        function Invoke-Hook([string[]]$Lines) {
            $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) "commit-msg-test-$([guid]::NewGuid()).txt"
            Set-Content -LiteralPath $tempFile -Value $Lines -NoNewline:$false
            & $script:ShPath $script:HookPath $tempFile | Out-Null
            $result = Get-Content -LiteralPath $tempFile
            Remove-Item -LiteralPath $tempFile -ErrorAction SilentlyContinue
            return , $result
        }
    }

    It 'strips a Co-authored-by: Claude trailer and the blank line above it' -Skip:$script:SkipHookTests {
        $out = Invoke-Hook @('Fix the thing', '', 'Co-authored-by: Claude <noreply@anthropic.com>')
        $out | Should -Be @('Fix the thing')
    }

    It 'strips a Co-authored-by: Codex trailer' -Skip:$script:SkipHookTests {
        $out = Invoke-Hook @('Fix the thing', '', 'Co-authored-by: Codex <noreply@openai.com>')
        $out | Should -Be @('Fix the thing')
    }

    It 'strips a Co-authored-by: Copilot trailer' -Skip:$script:SkipHookTests {
        $out = Invoke-Hook @('Fix the thing', '', 'Co-authored-by: Copilot <noreply@github.com>')
        $out | Should -Be @('Fix the thing')
    }

    It 'strips a "Generated with [Claude Code]" footer' -Skip:$script:SkipHookTests {
        $out = Invoke-Hook @('Fix the thing', '', 'Generated with [Claude Code](https://claude.com/claude-code)')
        $out | Should -Be @('Fix the thing')
    }

    It 'strips a "🤖 Generated with" footer' -Skip:$script:SkipHookTests {
        $out = Invoke-Hook @('Fix the thing', '', '🤖 Generated with Claude Code')
        $out | Should -Be @('Fix the thing')
    }

    It 'leaves a message with none of the trigger strings byte-identical (S.3)' -Skip:$script:SkipHookTests {
        $original = @('Fix the thing', '', 'Body text that mentions a co-author is not the same trailer shape.')
        $out = Invoke-Hook $original
        $out | Should -Be $original
    }

    It 'never exits non-zero (strip, do not reject - issue #340 agent block)' -Skip:$script:SkipHookTests {
        $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) "commit-msg-test-$([guid]::NewGuid()).txt"
        Set-Content -LiteralPath $tempFile -Value @('Fix the thing', '', 'Co-authored-by: Claude <noreply@anthropic.com>')
        & $script:ShPath $script:HookPath $tempFile | Out-Null
        $exitCode = $LASTEXITCODE
        Remove-Item -LiteralPath $tempFile -ErrorAction SilentlyContinue
        $exitCode | Should -Be 0
    }
}

Describe 'Test-NoAttribution.ps1: CI gate catches commits made without the hook (#340 S.4/S.5)' {

    BeforeAll {
        $script:GateScriptPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/Test-NoAttribution.ps1'
        $script:ScratchRepo = Join-Path ([System.IO.Path]::GetTempPath()) "no-attribution-test-$([guid]::NewGuid())"
        New-Item -ItemType Directory -Path $script:ScratchRepo | Out-Null
        Push-Location $script:ScratchRepo
        git init -q -b main
        git config user.email 'test@example.invalid'
        git config user.name 'Test'

        'one' | Out-File -FilePath 'file.txt' -Encoding utf8
        git add file.txt
        git commit -q -m 'Clean commit, no attribution'
        $script:CleanSha = (git rev-parse HEAD).Trim()

        'one-b' | Out-File -FilePath 'file.txt' -Encoding utf8
        git add file.txt
        git commit -q -m 'Second clean commit, no attribution'
        $script:SecondCleanSha = (git rev-parse HEAD).Trim()

        'two' | Out-File -FilePath 'file.txt' -Encoding utf8
        git add file.txt
        git commit -q -m "Add a feature`n`nCo-authored-by: Claude <noreply@anthropic.com>"
        $script:CoAuthoredSha = (git rev-parse HEAD).Trim()

        'three' | Out-File -FilePath 'file.txt' -Encoding utf8
        git add file.txt
        git commit -q -m "Add another feature`n`nGenerated with [Claude Code](https://claude.com/claude-code)"
        $script:GeneratedWithSha = (git rev-parse HEAD).Trim()
        Pop-Location
    }

    AfterAll {
        Remove-Item -LiteralPath $script:ScratchRepo -Recurse -Force -ErrorAction SilentlyContinue
    }

    It 'passes a range with no attribution' {
        Push-Location $script:ScratchRepo
        try {
            & $script:GateScriptPath -BaseSha $script:CleanSha -HeadSha $script:SecondCleanSha
            $LASTEXITCODE | Should -Be 0
        } finally {
            Pop-Location
        }
    }

    It 'fails a range containing a Co-authored-by: Claude trailer' {
        Push-Location $script:ScratchRepo
        try {
            & $script:GateScriptPath -BaseSha $script:CleanSha -HeadSha $script:CoAuthoredSha
            $LASTEXITCODE | Should -Be 1
        } finally {
            Pop-Location
        }
    }

    It 'fails a range containing a "Generated with [Claude Code]" footer' {
        Push-Location $script:ScratchRepo
        try {
            & $script:GateScriptPath -BaseSha $script:CoAuthoredSha -HeadSha $script:GeneratedWithSha
            $LASTEXITCODE | Should -Be 1
        } finally {
            Pop-Location
        }
    }

    It 'falls back to checking only the head commit when BaseSha is the all-zeros first-push sentinel' {
        Push-Location $script:ScratchRepo
        try {
            & $script:GateScriptPath -BaseSha ('0' * 40) -HeadSha $script:CoAuthoredSha
            $LASTEXITCODE | Should -Be 1

            & $script:GateScriptPath -BaseSha ('0' * 40) -HeadSha $script:CleanSha
            $LASTEXITCODE | Should -Be 0
        } finally {
            Pop-Location
        }
    }

    It 'B1.1 regression: fails closed rather than passing when HeadSha is missing' {
        { & $script:GateScriptPath -BaseSha $script:CleanSha -HeadSha '' } | Should -Throw
    }
}
