#Requires -Version 7.0
#Requires -Modules Pester

<#
  Set-IssueCriterionTick.ps1 exits the process on every path, so these tests dot-source it -
  the guard at its foot skips the exit-calling wrapper - and talk to a fake GitHub instead of
  the real one.

  The fake answers BOTH ways a script can reach gh, from one stored body:

    - Invoke-GhRaw, the script's own UTF-8 whole-stream call, gets stdout exactly as gh writes it.
    - `gh` itself, called as a native command, gets what PowerShell's native-command capture
      actually hands back: stdout split into an array of lines, the final newline dropped.

  That second half is what makes the round-trip test a regression test rather than a test of
  today's code path. SubZeroDev.GameEngine#535 lost every newline because its tick read the body
  with `$b = gh issue view N --json body --jq .body` and then treated `$b` as a string, which
  joins the line array with spaces. Point Get-IssueBody back at that capture and the round-trip
  tests below fail on the first byte comparison.
#>

BeforeAll {
    # Mock needs a resolvable `gh` even where the CLI is not installed (Merge-PullRequest.Tests.ps1).
    function gh {}

    $script:ScriptPath = Join-Path $PSScriptRoot 'Set-IssueCriterionTick.ps1'
    . $script:ScriptPath -Issue 1 -Id 'unused'

    # A /track-shaped body: narrative, criteria, the agent fence, non-ASCII, trailing newline.
    $script:Lf = @(
        '## W118 — The week''s own rules belong to the campaign'
        ''
        'Six physics fields move from constants onto the campaign (§7.14).'
        ''
        '### Done when'
        ''
        '- [ ] **W118.1** `weeklyTimeUnits` is read from the campaign'
        '- [ ] **W118.2** `lateFeeBasisPoints` is read from the campaign'
        '- [x] **W118.3** already ticked by an earlier run'
        '- [ ] **W118.10** a later id sharing the W118.1 prefix'
        ''
        '<details><summary>Agent</summary>'
        ''
        '<!-- agent:start -->'
        'Scope and criteria: `design/30-slices.md` § W118 @ `deadbee`'
        '<!-- agent:end -->'
        '</details>'
        ''
    ) -join "`n"

    function Set-FakeIssue {
        param([string]$Body, [switch]$ReadFails, [switch]$EditFails, [scriptblock]$Mangle)
        $script:Server = [pscustomobject]@{ Body = $Body; Edits = [System.Collections.Generic.List[object]]::new() }
        $script:ReadFails = [bool]$ReadFails
        $script:EditFails = [bool]$EditFails
        $script:Mangle = $Mangle
    }

    # The one fake GitHub both mocks share. Returns gh's stdout as the CLI writes it.
    function Invoke-FakeGh {
        param([string[]]$GhArgs)
        if ($GhArgs[0] -eq 'issue' -and $GhArgs[1] -eq 'view') {
            if ($script:ReadFails) { return [pscustomobject]@{ Output = ''; Error = 'HTTP 404'; ExitCode = 1 } }
            $jqAt = [array]::IndexOf($GhArgs, '--jq')
            $out = if ($jqAt -ge 0 -and $GhArgs[$jqAt + 1] -eq '.body') { $script:Server.Body + "`n" }
                   else { (@{ body = $script:Server.Body } | ConvertTo-Json -Compress) + "`n" }
            return [pscustomobject]@{ Output = $out; Error = ''; ExitCode = 0 }
        }
        if ($GhArgs[0] -eq 'issue' -and $GhArgs[1] -eq 'edit') {
            if ($script:EditFails) { return [pscustomobject]@{ Output = ''; Error = 'GraphQL: Could not resolve to an issue'; ExitCode = 1 } }
            $fileAt = [array]::IndexOf($GhArgs, '--body-file')
            $bodyAt = [array]::IndexOf($GhArgs, '--body')
            $new = if ($fileAt -ge 0) { [System.IO.File]::ReadAllText($GhArgs[$fileAt + 1], [System.Text.UTF8Encoding]::new($false)) }
                   else { $GhArgs[$bodyAt + 1] }
            if ($script:Mangle) { $new = & $script:Mangle $new }
            $script:Server.Edits.Add(@($GhArgs))
            $script:Server.Body = $new
            return [pscustomobject]@{ Output = "https://github.com/o/r/issues/1`n"; Error = ''; ExitCode = 0 }
        }
        throw "fake gh: unexpected call: $($GhArgs -join ' ')"
    }

    Mock Invoke-GhRaw { Invoke-FakeGh -GhArgs $GhArgs }

    # Native-command capture: an array of lines, trailing newline dropped, $LASTEXITCODE set.
    Mock gh {
        $r = Invoke-FakeGh -GhArgs ([string[]]$args)
        $global:LASTEXITCODE = $r.ExitCode
        $lines = @($r.Output -split "`r?`n")
        if ($lines.Count -gt 0 -and $lines[-1] -eq '') { $lines = $lines[0..($lines.Count - 2)] }
        $lines
    }
}

Describe 'Set-IssueCriterionTick round trip' {
    It 'reads the body as the exact stored string, newlines and trailing newline included' {
        Set-FakeIssue -Body $script:Lf

        $read = Get-IssueBody -Issue 535

        $read.Failure | Should -BeNullOrEmpty
        $read.Body | Should -BeOfType [string]
        $read.Body | Should -BeExactly $script:Lf
    }

    It 'changes nothing in the body but the named boxes' {
        Set-FakeIssue -Body $script:Lf
        $expected = $script:Lf.Replace('- [ ] **W118.1**', '- [x] **W118.1**').Replace('- [ ] **W118.2**', '- [x] **W118.2**')

        $result = Invoke-Tick -Issue 535 -Id 'W118.1', 'W118.2'

        $result.State | Should -Be 'Ticked'
        $result.Ticked | Should -Be @('W118.1', 'W118.2')
        [string]::Equals($script:Server.Body, $expected, [System.StringComparison]::Ordinal) | Should -BeTrue
        ($script:Server.Body -split "`n").Count | Should -Be ($script:Lf -split "`n").Count
    }

    It 'keeps CRLF line endings as CRLF' {
        $crlf = $script:Lf.Replace("`n", "`r`n")
        Set-FakeIssue -Body $crlf

        (Invoke-Tick -Issue 535 -Id 'W118.1').State | Should -Be 'Ticked'

        $script:Server.Body | Should -BeExactly $crlf.Replace('- [ ] **W118.1**', '- [x] **W118.1**')
    }

    It 'adds no trailing newline to a body that had none' {
        $bare = $script:Lf.TrimEnd("`n")
        Set-FakeIssue -Body $bare

        Invoke-Tick -Issue 535 -Id 'W118.2' | Out-Null

        $script:Server.Body | Should -BeExactly $bare.Replace('- [ ] **W118.2**', '- [x] **W118.2**')
    }

    It 'does not tick W118.10 when W118.1 is named' {
        Set-FakeIssue -Body $script:Lf

        Invoke-Tick -Issue 535 -Id 'W118.1' | Out-Null

        $script:Server.Body | Should -Match '(?m)^- \[ \] \*\*W118\.10\*\*'
    }

    It 'takes a comma-joined id list as one string, the way pwsh -File binds it' {
        Set-FakeIssue -Body $script:Lf

        $result = Invoke-Tick -Issue 535 -Id 'W118.1,W118.2, W118.3'

        $result.State | Should -Be 'Ticked'
        $result.Ticked | Should -Be @('W118.1', 'W118.2')
        $result.AlreadyTicked | Should -Be @('W118.3')
    }

    It 'passes the body with --body-file, never --body' {
        Set-FakeIssue -Body $script:Lf

        Invoke-Tick -Issue 535 -Id 'W118.1' | Out-Null

        $script:Server.Edits.Count | Should -Be 1
        $script:Server.Edits[0] | Should -Contain '--body-file'
        $script:Server.Edits[0] | Should -Not -Contain '--body'
    }

    It 'carries -Repository to every gh call' {
        Set-FakeIssue -Body $script:Lf

        Invoke-Tick -Issue 535 -Id 'W118.1' -Repository 'o/r' | Out-Null

        Should -Invoke Invoke-GhRaw -Times 3 -Exactly -ParameterFilter { ($GhArgs -join ' ') -match ' -R o/r' }
    }
}

Describe 'Set-IssueCriterionTick refusals and no-ops' {
    It 'refuses a missing id and writes nothing' {
        Set-FakeIssue -Body $script:Lf

        $result = Invoke-Tick -Issue 535 -Id 'W118.1', 'W118.9'

        $result.State | Should -Be 'Refused'
        $result.Refusal | Should -Be 'CriterionMissing'
        $result.Missing | Should -Be @('W118.9')
        $script:Server.Edits.Count | Should -Be 0
    }

    It 'refuses an id with two checkbox lines and writes nothing' {
        Set-FakeIssue -Body ($script:Lf + "- [ ] **W118.1** duplicated`n")

        $result = Invoke-Tick -Issue 535 -Id 'W118.1'

        $result.Refusal | Should -Be 'CriterionAmbiguous'
        $result.Ambiguous | Should -Be @('W118.1')
        $script:Server.Edits.Count | Should -Be 0
    }

    It 'writes nothing when every named box is already ticked' {
        Set-FakeIssue -Body $script:Lf

        $result = Invoke-Tick -Issue 535 -Id 'W118.3'

        $result.State | Should -Be 'Unchanged'
        $result.AlreadyTicked | Should -Be @('W118.3')
        $script:Server.Edits.Count | Should -Be 0
    }

    It 'reports WouldTick under -DryRun and writes nothing' {
        Set-FakeIssue -Body $script:Lf

        $result = Invoke-Tick -Issue 535 -Id 'W118.1', 'W118.3' -DryRun

        $result.State | Should -Be 'WouldTick'
        $result.Ticked | Should -Be @('W118.1')
        $result.AlreadyTicked | Should -Be @('W118.3')
        $script:Server.Edits.Count | Should -Be 0
    }

    It 'is NotEvaluated when the body cannot be read' {
        Set-FakeIssue -Body $script:Lf -ReadFails

        $result = Invoke-Tick -Issue 535 -Id 'W118.1'

        $result.State | Should -Be 'NotEvaluated'
        $result.Refusal | Should -Be 'GhUnavailable'
        $result.Detail | Should -Match 'HTTP 404'
    }

    It 'carries gh''s text through when the edit is rejected' {
        Set-FakeIssue -Body $script:Lf -EditFails

        $result = Invoke-Tick -Issue 535 -Id 'W118.1'

        $result.Refusal | Should -Be 'EditRejected'
        $result.Detail | Should -Match 'Could not resolve'
    }

    It 'refuses with RoundTripMismatch when the body read back is not the body written' {
        Set-FakeIssue -Body $script:Lf -Mangle { param($b) $b.Replace("`n", ' ') }

        $result = Invoke-Tick -Issue 535 -Id 'W118.1'

        $result.State | Should -Be 'Refused'
        $result.Refusal | Should -Be 'RoundTripMismatch'
    }
}

Describe 'Get-TickExitCode' {
    It 'maps <State> to <Code>' -ForEach @(
        @{ State = 'Ticked'; Code = 0 }
        @{ State = 'Unchanged'; Code = 0 }
        @{ State = 'WouldTick'; Code = 0 }
        @{ State = 'Refused'; Code = 1 }
        @{ State = 'NotEvaluated'; Code = 2 }
    ) {
        Get-TickExitCode -State $State | Should -Be $Code
    }
}
