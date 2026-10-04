#Requires -Version 7.0
<#
.SYNOPSIS
    Checks that the facts design/, the command files and the agent contract state about the tree
    are true: cited tools exist, named commands exist, the contract's tables match the scripts and
    skills, and the slices document is well formed.

.DESCRIPTION
    The design is written once and not kept in sync with the code, so prose drifting from the
    tree is expected and is /align's to reconcile. What this script checks is narrower: the
    mechanical facts an agent acts on without re-checking - a script path it will run, a command
    it will tell the user to type, a parameter it will pass, a dependency it will wait on. Each
    wrong one is a finding with the file and line that states it.

    Checks:
      MissingTool        a tools/<path> cited in AGENTS.shared.md, AGENTS.md, skills/*/SKILL.md
                         or design/00-30 that exists neither in the repository nor in the kit.
      UnknownCommand     a backticked /<name> or /agentkit:<name> that is neither a skill in the
                         repository or the kit nor a host command on $script:HostCommands.
      MissingScript, UnknownParameter, UnlistedParameter, UnlistedScript
                         the contract's Scripts (`tools/`) table against tools/*.ps1 and each
                         script's param block. A row reading "see the script" is exempt from
                         both parameter checks.
      UnlistedCommand, MissingCommand
                         the contract's Commands (`skills/<name>/SKILL.md`) table against skills/.
      MissingStatus, DuplicateSlice, UnknownDependency
                         design/30-slices.md's ## S<n> slices.

    Only text above a "## Landed" heading is read: below it is history that names retired tools
    and slices on purpose. The two table checks run only where the contract has the kit-shaped
    headings above, so another repository's own contract is not held to the kit's table format.

    Read-only: it never writes, stages or stashes anything. Exit codes: 0 Passed, 1 Failed (one
    or more findings), 2 NotEvaluated (no design/ directory to check). Never prompts.

.PARAMETER RepoRoot
    Repository to check. Defaults to the current directory.

.PARAMETER Quiet
    Suppresses the human-readable report only. The result object is always emitted.

.EXAMPLE
    pwsh ./tools/Test-Design.ps1
#>
[CmdletBinding()]
param(
    [string] $RepoRoot,
    [switch] $Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Commands the agent host itself provides. A backticked /<name> on this list is not a kit command
# and needs no skill behind it.
$script:HostCommands = @(
    'add-dir', 'agents', 'bug', 'clear', 'code-review', 'compact', 'config', 'context', 'cost',
    'doctor', 'exit', 'export', 'fast', 'help', 'hooks', 'ide', 'init', 'login', 'logout', 'mcp',
    'memory', 'model', 'permissions', 'plugin', 'pr-comments', 'release-notes', 'resume', 'review',
    'rewind', 'security-review', 'status', 'statusline', 'ultrareview', 'usage'
)

$script:ScriptsHeading  = '(?m)^## Scripts \(`tools/`\)[ \t]*\r?$'
$script:CommandsHeading = '(?m)^## Commands \(`skills/<name>/SKILL\.md`\)[ \t]*\r?$'
$script:LandedHeading   = '(?m)^## Landed[ \t]*\r?$'

function New-Finding {
    param([string] $Check, [string] $File, [int] $Line, [string] $Message)
    [pscustomobject]@{ Check = $Check; File = $File; Line = $Line; Message = $Message }
}

function Get-LineNumber {
    param([string] $Text, [int] $Index)
    ([regex]::Matches($Text.Substring(0, $Index), "`n")).Count + 1
}

# The live part of a document: everything above its ## Landed heading, if it has one.
function Get-LivePart {
    param([string] $Text)
    $m = [regex]::Match($Text, $script:LandedHeading)
    if ($m.Success) { $Text.Substring(0, $m.Index) } else { $Text }
}

function Get-Section {
    param([string] $Text, [string] $HeadingPattern)
    $m = [regex]::Match($Text, $HeadingPattern)
    if (-not $m.Success) { return $null }
    $start = $m.Index + $m.Length
    $next = [regex]::Match($Text.Substring($start), '(?m)^## ')
    $end = if ($next.Success) { $start + $next.Index } else { $Text.Length }
    [pscustomobject]@{ Start = $start; Text = $Text.Substring($start, $end - $start) }
}

# Data rows of the first Markdown table in a section: cells and the absolute line number.
function Get-TableRows {
    param([string] $Document, $Section)
    $rows = @()
    $seenHeader = $false
    foreach ($m in [regex]::Matches($Section.Text, '(?m)^\|.*$')) {
        $line = $m.Value.TrimEnd("`r")
        if ($line -match '^\|\s*:?-{3,}') { continue }
        if (-not $seenHeader) { $seenHeader = $true; continue }
        $cells = @($line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
        $rows += [pscustomobject]@{ Cells = $cells; Line = Get-LineNumber $Document ($Section.Start + $m.Index) }
    }
    $rows
}

function Get-DeclaredParameter {
    param([string] $Path)
    $tokens = $null; $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$tokens, [ref]$errors)
    if (-not $ast.ParamBlock) { return @() }
    @($ast.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath })
}

function Get-ScannedFile {
    param([string] $Root)
    $names = @('AGENTS.shared.md', 'AGENTS.md')
    $skills = Join-Path $Root 'skills'
    if (Test-Path -LiteralPath $skills) {
        $names += @(Get-ChildItem -LiteralPath $skills -Directory | Sort-Object Name | ForEach-Object {
            if (Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md')) { "skills/$($_.Name)/SKILL.md" }
        })
    }
    $names += @('design/00-brief.md', 'design/10-design.md', 'design/20-contract.md', 'design/30-slices.md')
    @($names | Where-Object { Test-Path -LiteralPath (Join-Path $Root $_) })
}

function Get-SkillName {
    param([string] $Root)
    $skills = Join-Path $Root 'skills'
    if (-not (Test-Path -LiteralPath $skills)) { return @() }
    @(Get-ChildItem -LiteralPath $skills -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md') } |
        ForEach-Object Name)
}

function Test-ReferenceFact {
    param([string] $Root, [string] $Kit, [string[]] $Files)
    $known = @(@(Get-SkillName $Root) + @(Get-SkillName $Kit) + $script:HostCommands | Select-Object -Unique)
    foreach ($file in $Files) {
        $text = Get-LivePart (Get-Content -LiteralPath (Join-Path $Root $file) -Raw)
        foreach ($m in [regex]::Matches($text, '(?<![\w./-])tools/[A-Za-z0-9._/-]*[A-Za-z0-9_/-]')) {
            $inRepo = Test-Path -LiteralPath (Join-Path $Root $m.Value)
            $inKit = Test-Path -LiteralPath (Join-Path $Kit $m.Value)
            if (-not ($inRepo -or $inKit)) {
                New-Finding 'MissingTool' $file (Get-LineNumber $text $m.Index) "$($m.Value) exists neither in the repository nor in the kit"
            }
        }
        foreach ($m in [regex]::Matches($text, '`/(?:agentkit:)?([a-z][a-z0-9-]*)(?=[`\s:\]])')) {
            $name = $m.Groups[1].Value
            # `/agentkit:<name>` is the namespace written generically, not a command called agentkit.
            if ($name -eq 'agentkit' -or $known -contains $name) { continue }
            New-Finding 'UnknownCommand' $file (Get-LineNumber $text $m.Index) "$($m.Value.TrimStart('`')) is neither a skill nor a host command"
        }
    }
}

function Test-ScriptsTable {
    param([string] $Root, [string] $File, [string] $Text)
    $section = Get-Section $Text $script:ScriptsHeading
    if (-not $section) { return }
    $listed = @()
    foreach ($row in Get-TableRows $Text $section) {
        if ($row.Cells.Count -lt 2) { continue }
        $exempt = $row.Cells[1] -match 'see the script'
        $params = @([regex]::Matches($row.Cells[1], '`[^`]*`') | ForEach-Object {
            [regex]::Matches($_.Value, '(?<![\w-])-([A-Za-z][A-Za-z0-9]*)') | ForEach-Object { $_.Groups[1].Value }
        } | Select-Object -Unique)
        foreach ($sm in [regex]::Matches($row.Cells[0], '`([A-Za-z0-9._-]+\.ps1)`')) {
            $name = $sm.Groups[1].Value
            $listed += $name
            $path = @((Join-Path $Root "tools/$name"), (Join-Path $Root $name)) |
                Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
            if (-not $path) {
                New-Finding 'MissingScript' $File $row.Line "$name is listed but exists in neither tools/ nor the repository root"
                continue
            }
            if ($exempt) { continue }
            $declared = @(Get-DeclaredParameter $path)
            foreach ($p in $params) {
                if (-not ($declared | Where-Object { $_ -eq $p })) {
                    New-Finding 'UnknownParameter' $File $row.Line "$name does not declare -$p"
                }
            }
            foreach ($d in $declared) {
                if (-not ($params | Where-Object { $_ -eq $d })) {
                    New-Finding 'UnlistedParameter' $File $row.Line "$name declares -$d, which its row does not list"
                }
            }
        }
    }
    $tools = Join-Path $Root 'tools'
    if (-not (Test-Path -LiteralPath $tools)) { return }
    foreach ($script in Get-ChildItem -LiteralPath $tools -Filter '*.ps1' -File | Sort-Object Name) {
        if ($script.Name -like '*.Tests.ps1') { continue }
        if (-not ($listed | Where-Object { $_ -eq $script.Name })) {
            New-Finding 'UnlistedScript' $File (Get-LineNumber $Text ($section.Start)) "tools/$($script.Name) is not listed in the Scripts table"
        }
    }
}

function Test-CommandsTable {
    param([string] $Root, [string] $File, [string] $Text)
    $section = Get-Section $Text $script:CommandsHeading
    if (-not $section) { return }
    $skills = @(Get-SkillName $Root)
    $listed = @()
    foreach ($row in Get-TableRows $Text $section) {
        $m = [regex]::Match($row.Cells[0], '^`([a-z][a-z0-9-]*)`$')
        if (-not $m.Success) { continue }
        $name = $m.Groups[1].Value
        $listed += $name
        if ($skills -notcontains $name) {
            New-Finding 'MissingCommand' $File $row.Line "$name is listed but skills/$name/SKILL.md does not exist"
        }
    }
    foreach ($s in $skills) {
        if ($listed -notcontains $s) {
            New-Finding 'UnlistedCommand' $File (Get-LineNumber $Text $section.Start) "skills/$s/SKILL.md has no row in the Commands table"
        }
    }
}

function Test-Slices {
    param([string] $File, [string] $Text)
    $live = Get-LivePart $Text
    $landed = $Text.Substring($live.Length)
    $headings = @([regex]::Matches($live, '(?m)^## S(\d+)\b'))
    $known = @($headings | ForEach-Object { [int]$_.Groups[1].Value }) +
             @([regex]::Matches($landed, '\bS(\d+)\b') | ForEach-Object { [int]$_.Groups[1].Value })
    $seen = @{}
    foreach ($h in $headings) {
        $id = [int]$h.Groups[1].Value
        $line = Get-LineNumber $live $h.Index
        $rest = $live.Substring($h.Index + $h.Length)
        $next = [regex]::Match($rest, '(?m)^#{1,2} ')
        $body = if ($next.Success) { $rest.Substring(0, $next.Index) } else { $rest }
        if ($seen.ContainsKey($id)) {
            New-Finding 'DuplicateSlice' $File $line "S$id is already used at line $($seen[$id])"
        } else {
            $seen[$id] = $line
        }
        if ($body -notmatch '(?m)^Status:[ \t]*(todo|done)[ \t]*\r?$') {
            New-Finding 'MissingStatus' $File $line "S$id has no 'Status: todo' or 'Status: done' line"
        }
        $dep = [regex]::Match($body, '(?m)^Depends on:(.*)$')
        if ($dep.Success) {
            foreach ($d in [regex]::Matches($dep.Groups[1].Value, '\bS?(\d+)\b')) {
                $depId = [int]$d.Groups[1].Value
                if ($known -notcontains $depId) {
                    New-Finding 'UnknownDependency' $File $line "S$id depends on S$depId, which is neither a slice heading nor in the Landed index"
                }
            }
        }
    }
}

function Invoke-DesignCheck {
    param(
        [Parameter(Mandatory)] [string] $RepoRoot,
        [Parameter(Mandatory)] [string] $KitRoot
    )
    $root = (Resolve-Path -LiteralPath $RepoRoot).Path
    if (-not (Test-Path -LiteralPath (Join-Path $root 'design') -PathType Container)) {
        return [pscustomobject]@{ State = 'NotEvaluated'; Findings = @(); Checked = @() }
    }
    $files = @(Get-ScannedFile $root)
    $findings = @(Test-ReferenceFact -Root $root -Kit $KitRoot -Files $files)

    $contract = Join-Path $root 'design/20-contract.md'
    if (Test-Path -LiteralPath $contract) {
        $text = Get-Content -LiteralPath $contract -Raw
        $findings += @(Test-ScriptsTable -Root $root -File 'design/20-contract.md' -Text $text)
        $findings += @(Test-CommandsTable -Root $root -File 'design/20-contract.md' -Text $text)
    }
    $slices = Join-Path $root 'design/30-slices.md'
    if (Test-Path -LiteralPath $slices) {
        $findings += @(Test-Slices -File 'design/30-slices.md' -Text (Get-Content -LiteralPath $slices -Raw))
    }
    [pscustomobject]@{
        State    = if ($findings.Count) { 'Failed' } else { 'Passed' }
        Findings = $findings
        Checked  = $files
    }
}

function Get-DesignCheckExitCode {
    param([string] $State)
    switch ($State) { 'Passed' { 0 } 'Failed' { 1 } default { 2 } }
}

if ($MyInvocation.InvocationName -ne '.') {
    if (-not $RepoRoot) { $RepoRoot = (Get-Location).Path }
    $result = Invoke-DesignCheck -RepoRoot $RepoRoot -KitRoot (Split-Path $PSScriptRoot -Parent)
    if (-not $Quiet) {
        switch ($result.State) {
            'NotEvaluated' { Write-Host "Design check: NotEvaluated - no design/ under $RepoRoot." }
            'Passed'       { Write-Host "Design check: Passed - $($result.Checked.Count) files, no findings." }
            default {
                Write-Host "Design check: Failed - $($result.Findings.Count) finding(s)."
                foreach ($f in $result.Findings) { Write-Host "  $($f.Check) $($f.File):$($f.Line) $($f.Message)" }
            }
        }
    }
    $result
    exit (Get-DesignCheckExitCode -State $result.State)
}
