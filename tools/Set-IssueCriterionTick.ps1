#Requires -Version 7.0
<#
.SYNOPSIS
    Ticks `Done when` checkboxes on a GitHub issue by criterion id, leaving every other byte of
    the body exactly as it was.

.DESCRIPTION
    `/slice` ticks a box in the same run it reports the criterion met (`AGENTS.shared.md`,
    *Tracking work*). Done ad hoc, that edit is a read-modify-write of the whole issue body, and
    the obvious PowerShell spelling of it corrupts the body: `$b = gh issue view N --json body
    --jq .body` captures native output as an ARRAY of lines, and the first string operation on
    it - `[regex]::Replace($b, ...)`, `"$b"`, `WriteAllText($f, $b)` - joins that array with
    spaces. Every newline in the body becomes a space, and every tool that reads criteria a line
    at a time (`Update-WorkMirror.ps1`, `Test-DesignDrift.ps1`) then finds none. That is what
    happened to SubZeroDev.GameEngine#535 on 2026-10-04.

    This script is the whole tick, so the edit is computed rather than re-improvised each run:

      1. Read the body through gh's JSON output on a UTF-8 stream (Invoke-GhRaw), never through
         PowerShell's native-command capture. Newlines inside a JSON string are escaped, so the
         body arrives as one exact string whatever the console encoding or line splitting.
      2. Replace the single box character of each named criterion's line, `- [ ] **<id>**`, with
         `x`. Nothing else in the body is touched: not line endings, not a trailing newline, not
         a box belonging to an id that was not named.
      3. Write the new body to a UTF-8 (no BOM) file and pass it with `--body-file`, never
         `--body`.
      4. Read the body back and compare it to what was written, byte for byte. A mismatch is
         reported as `RoundTripMismatch`, so a corrupted body is caught by the run that caused
         it rather than by the next parser that trips over it.

    Every named id must have exactly one checkbox line. A missing or duplicated id refuses before
    anything is written - a tick the report claims but the body cannot carry is a disagreement to
    bring back, not to paper over. An id whose box is already ticked is left as it is and listed
    in AlreadyTicked; if every named id is already ticked, nothing is written.

    The TickResult is emitted on the success stream always, including on every refusal. Exit
    codes carry the state: 0 Ticked, Unchanged and WouldTick; 1 Refused; 2 NotEvaluated. Never
    prompts.

.PARAMETER Issue
    The issue number.

.PARAMETER Id
    One or more criterion ids, exactly as they appear in bold on the checkbox line - `S3.1`,
    `W118.4`.

.PARAMETER Repository
    owner/repo. Defaults to the current git remote, via gh's own resolution.

.PARAMETER DryRun
    Read and compute, but write nothing. State is 'WouldTick' where a real run would have ticked.

.EXAMPLE
    ./tools/Set-IssueCriterionTick.ps1 -Issue 535 -Id W118.1, W118.2, W118.3
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [int]      $Issue,
    [Parameter(Mandatory)] [string[]] $Id,
    [string] $Repository,
    [switch] $DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-TickResult {
    param(
        [string]   $State,
        [int]      $Issue,
        [string]   $Refusal,
        [object[]] $Ticked        = @(),
        [object[]] $AlreadyTicked = @(),
        [object[]] $Missing       = @(),
        [object[]] $Ambiguous     = @(),
        [string]   $Detail
    )
    [pscustomobject]@{
        State         = $State
        Issue         = $Issue
        Refusal       = $Refusal
        Ticked        = @($Ticked)
        AlreadyTicked = @($AlreadyTicked)
        Missing       = @($Missing)
        Ambiguous     = @($Ambiguous)
        Detail        = $Detail
    }
}

function Get-TickExitCode {
    param([string]$State)
    switch ($State) {
        'Ticked'       { 0 }
        'Unchanged'    { 0 }
        'WouldTick'    { 0 }
        'Refused'      { 1 }
        'NotEvaluated' { 2 }
        default        { throw "Unknown TickResult state: $State" }
    }
}

function Invoke-GhRaw {
    <#
        The same reason Update-WorkMirror.ps1's Invoke-GhRaw exists: native-command capture
        decodes gh's UTF-8 through [Console]::OutputEncoding (the OEM code page on a Windows
        host) and splits it into lines. Either one is enough to change an issue body on its way
        back up, so stdout is read whole, as UTF-8, straight off the process.
    #>
    param([string[]] $GhArgs)
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = 'gh'
    foreach ($a in $GhArgs) { $psi.ArgumentList.Add($a) }
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $psi.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)
    $proc = [System.Diagnostics.Process]::Start($psi)
    $stderrTask = $proc.StandardError.ReadToEndAsync()
    $stdout = $proc.StandardOutput.ReadToEnd()
    $proc.WaitForExit()
    [pscustomobject]@{ Output = $stdout; Error = $stderrTask.Result; ExitCode = $proc.ExitCode }
}

function Get-IssueBody {
    <# The exact body string, or $null with .Failure set. #>
    param([int]$Issue, [string]$Repository)
    $ghArgs = @('issue', 'view', "$Issue", '--json', 'body')
    if ($Repository) { $ghArgs += @('-R', $Repository) }
    try {
        $result = Invoke-GhRaw -GhArgs $ghArgs
    }
    catch {
        return [pscustomobject]@{ Body = $null; Failure = $_.Exception.Message }
    }
    if ($result.ExitCode -ne 0) {
        return [pscustomobject]@{ Body = $null; Failure = "gh exited $($result.ExitCode): $("$($result.Error)".Trim())" }
    }
    try {
        $doc = [System.Text.Json.JsonDocument]::Parse($result.Output)
        try {
            $element = $doc.RootElement.GetProperty('body')
            $body = if ($element.ValueKind -eq [System.Text.Json.JsonValueKind]::Null) { '' } else { $element.GetString() }
        }
        finally { $doc.Dispose() }
    }
    catch {
        return [pscustomobject]@{ Body = $null; Failure = "unreadable gh output: $($_.Exception.Message)" }
    }
    [pscustomobject]@{ Body = $body; Failure = $null }
}

function Set-CriterionTick {
    <#
        Pure: the body with each named id's box set to `x`, and which ids were ticked, already
        ticked, missing, or ambiguous. Only the one box character on each matched line changes,
        so the result is the same length as the input. The id must be the bold token directly
        after the box - the shape `/track` writes and Update-WorkMirror.ps1 parses - which is
        also what stops `S1.1` from matching `S1.10`.
    #>
    param([string]$Body, [string[]]$Id)

    $ticked = [System.Collections.Generic.List[string]]::new()
    $already = [System.Collections.Generic.List[string]]::new()
    $missing = [System.Collections.Generic.List[string]]::new()
    $ambiguous = [System.Collections.Generic.List[string]]::new()
    $positions = [System.Collections.Generic.List[int]]::new()

    # `pwsh -File ... -Id A,B` binds the single string 'A,B', not an array, so a list is split
    # here rather than trusted to the caller's shell. No criterion id contains a comma or space.
    $ids = @($Id | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ } | Select-Object -Unique)

    foreach ($criterion in $ids) {
        $pattern = '(?m)^[ \t]*-[ \t]*\[(?<box>[ xX])\][ \t]*\*\*' + [regex]::Escape($criterion) + '\*\*'
        $found = [regex]::Matches($Body, $pattern)
        if ($found.Count -eq 0) { $missing.Add($criterion); continue }
        if ($found.Count -gt 1) { $ambiguous.Add($criterion); continue }
        $box = $found[0].Groups['box']
        if ($box.Value -eq ' ') { $ticked.Add($criterion); $positions.Add($box.Index) }
        else { $already.Add($criterion) }
    }

    $chars = $Body.ToCharArray()
    foreach ($p in $positions) { $chars[$p] = 'x' }

    [pscustomobject]@{
        Body          = [string]::new($chars)
        Ticked        = @($ticked)
        AlreadyTicked = @($already)
        Missing       = @($missing)
        Ambiguous     = @($ambiguous)
    }
}

function Invoke-Tick {
    param([int]$Issue, [string[]]$Id, [string]$Repository, [switch]$DryRun)

    $read = Get-IssueBody -Issue $Issue -Repository $Repository
    if ($null -ne $read.Failure) {
        return New-TickResult -State 'NotEvaluated' -Issue $Issue -Refusal 'GhUnavailable' -Detail $read.Failure
    }

    $plan = Set-CriterionTick -Body $read.Body -Id $Id
    if ($plan.Missing.Count -gt 0 -or $plan.Ambiguous.Count -gt 0) {
        $refusal = if ($plan.Missing.Count -gt 0) { 'CriterionMissing' } else { 'CriterionAmbiguous' }
        return New-TickResult -State 'Refused' -Issue $Issue -Refusal $refusal `
            -AlreadyTicked $plan.AlreadyTicked -Missing $plan.Missing -Ambiguous $plan.Ambiguous
    }
    if ($plan.Ticked.Count -eq 0) {
        return New-TickResult -State 'Unchanged' -Issue $Issue -AlreadyTicked $plan.AlreadyTicked
    }
    if ($DryRun) {
        return New-TickResult -State 'WouldTick' -Issue $Issue -Ticked $plan.Ticked -AlreadyTicked $plan.AlreadyTicked
    }

    $file = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($file, $plan.Body, [System.Text.UTF8Encoding]::new($false))
        $editArgs = @('issue', 'edit', "$Issue", '--body-file', $file)
        if ($Repository) { $editArgs += @('-R', $Repository) }
        $edit = Invoke-GhRaw -GhArgs $editArgs
    }
    finally {
        Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
    }
    if ($edit.ExitCode -ne 0) {
        return New-TickResult -State 'Refused' -Issue $Issue -Refusal 'EditRejected' `
            -AlreadyTicked $plan.AlreadyTicked -Detail ("$($edit.Error)$($edit.Output)".Trim())
    }

    $after = Get-IssueBody -Issue $Issue -Repository $Repository
    if ($null -ne $after.Failure) {
        return New-TickResult -State 'NotEvaluated' -Issue $Issue -Refusal 'GhUnavailable' `
            -Ticked $plan.Ticked -AlreadyTicked $plan.AlreadyTicked `
            -Detail "edited, but the body could not be read back to confirm it: $($after.Failure)"
    }
    if (-not [string]::Equals($after.Body, $plan.Body, [System.StringComparison]::Ordinal)) {
        return New-TickResult -State 'Refused' -Issue $Issue -Refusal 'RoundTripMismatch' `
            -Ticked $plan.Ticked -AlreadyTicked $plan.AlreadyTicked `
            -Detail "wrote $($plan.Body.Length) characters, read back $($after.Body.Length); the issue body needs restoring from its edit history"
    }

    New-TickResult -State 'Ticked' -Issue $Issue -Ticked $plan.Ticked -AlreadyTicked $plan.AlreadyTicked
}

# Guards the exit-calling wrapper so this script's tests can dot-source it instead - that
# defines every function above in the caller's scope, lets Mock intercept them, and skips
# straight past this block rather than exiting the test runner's own process.
if ($MyInvocation.InvocationName -ne '.') {
    $result = Invoke-Tick -Issue $Issue -Id $Id -Repository $Repository -DryRun:$DryRun
    $result
    exit (Get-TickExitCode -State $result.State)
}
