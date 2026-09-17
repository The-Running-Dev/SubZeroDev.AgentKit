#Requires -Version 7.0
<#
.SYNOPSIS
    Validates the core/companion split between the installed kit and a target repository.

.DESCRIPTION
    Per .claude/COMPANIONS.md: every skills/<name>/SKILL.md ships as a core a target repository
    never copies or edits, optionally paired with a companion the target holds itself at
    skills/<name>/SKILL-local.md. The core enumerates which categories the companion may
    override; COMPANIONS.md owns the category vocabulary and the never-list.

    Cores and .claude/COMPANIONS.md itself are kit-owned and read from the installed kit
    (AGENTS.shared.md, *House conventions* -> Home-install convention: self-hosted, then
    $env:AGENTKIT_HOME, then $HOME/.agent-kit) - a target repository holds no copy of either.
    Companions are the target's own and are read from -TargetRepo.

    The core's fence is a declared marked region, id "companion" (AGENTS.shared.md, *Marked regions*):
    <!-- companion:declared:start --> ... <!-- companion:declared:end -->. The bare form means
    projected, so a core carrying it rather than the declared form is nonconforming.

    None of that is checkable by reading the core files alone, which is the whole reason this
    script exists - AGENTS.shared.md, *Verification*: "A schema or validator change is not done until
    it has rejected something."

    The category ids are read out of .claude/COMPANIONS.md's own table rather than duplicated
    here. That file is the canonical copy; a second list in this script would be the copy that
    rots, and the divergence would be invisible because both would still parse.

    What is checked, per finding rule:

      MissingBlock            A core has no <!-- companion:declared:start --> ... :end fence
      DuplicateBlock          A core has more than one
      WrongCompanionPath      The fence names a path other than <name>-local.md
      NoCategories            A core declares an empty override list
      UnknownCategory         A core declares an id absent from COMPANIONS.md's table
      OrphanCompanion         A <name>-local.md in the target with no <name>/SKILL.md core in the kit
      UnknownCompanionHeading A companion heading that is not a category id
      UndeclaredCategory      A companion overrides a category its core did not allow
      EmptyCategory           A companion heading with nothing under it

    A companion that is missing, empty, or frontmatter-only is *absent* - counted, never a
    finding. That is COMPANIONS.md's *Absence* rule, and treating any of the three as an
    override of nothing is precisely the bug this rule exists to prevent.

.PARAMETER TargetRepo
    Repository whose companions are validated. Defaults to the current directory.

.PARAMETER KitRoot
    Installed kit to read cores and .claude/COMPANIONS.md from. Defaults to the Home-install
    convention's resolution order (self-hosted, then $env:AGENTKIT_HOME, then $HOME/.agent-kit).

.PARAMETER Quiet
    Suppress the printed report; the result object and exit code are unchanged.

.EXAMPLE
    ./tools/Test-Companion.ps1
    Validate this repository's companions against the resolved installed kit.

.EXAMPLE
    ./tools/Test-Companion.ps1 -TargetRepo D:\Projects\Some.Repo
    Validate another repository's companions against the same resolved kit.
#>
[CmdletBinding()]
param(
    [string] $TargetRepo = (Get-Location).Path,
    [string] $KitRoot,
    [switch] $Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-AgentKitRoot {
    <#
        Home-install convention (AGENTS.shared.md, *House conventions*): self-hosted checkout
        first (a live kit working tree, so kit development reads its own uncommitted edits),
        then $env:AGENTKIT_HOME, then $HOME/.agent-kit. Same shape as Invoke-CodexCommand.ps1's
        Get-AgentKitInstallRoot and New-DesignDocs.ps1's Resolve-KitRoot.
    #>
    param([string] $Explicit)

    if ($Explicit) {
        return (Resolve-Path -LiteralPath $Explicit).Path
    }

    $selfHosted = Split-Path -Parent $PSScriptRoot
    if (Test-Path -LiteralPath (Join-Path $selfHosted '.git')) {
        return $selfHosted
    }

    if ($env:AGENTKIT_HOME -and (Test-Path -LiteralPath $env:AGENTKIT_HOME)) {
        return $env:AGENTKIT_HOME
    }

    $synced = Join-Path $HOME '.agent-kit'
    if (Test-Path -LiteralPath $synced) {
        return $synced
    }

    throw "Could not find a kit checkout under '$selfHosted', `$env:AGENTKIT_HOME, or '$synced'. Pass -KitRoot explicitly."
}

function New-CompanionFinding {
    param(
        [Parameter(Mandatory)][string] $Path,
        [Parameter(Mandatory)][string] $Rule,
        [Parameter(Mandatory)][string] $Detail
    )
    [pscustomobject]@{ Path = $Path; Rule = $Rule; Detail = $Detail }
}

<#
    Reads the category ids out of COMPANIONS.md's table. Rows look like:
      | `vocabulary` | What this repository calls ... |
    The leading-pipe anchor is what keeps this from also matching the backticked ids used in
    the prose above and below the table.
#>
function Get-CompanionCategory {
    param([Parameter(Mandatory)][string] $CompanionsDoc)

    $text = [System.IO.File]::ReadAllText($CompanionsDoc) -replace "`r`n", "`n"
    $ids = [System.Collections.Generic.List[string]]::new()
    foreach ($m in [regex]::Matches($text, '(?m)^\|\s*`([a-z][a-z0-9-]*)`\s*\|')) {
        $id = $m.Groups[1].Value
        if (-not $ids.Contains($id)) { $ids.Add($id) }
    }
    , @($ids)
}

<#
    Strips a leading `---`-fenced frontmatter block. Returns the body only; a file with no
    frontmatter comes back unchanged.
#>
function Remove-Frontmatter {
    param([Parameter(Mandatory)][AllowEmptyString()][string] $Text)
    [regex]::Replace($Text, "(?s)\A---\n.*?\n---\n", '')
}

<#
    COMPANIONS.md, *Absence*: missing, empty and frontmatter-only are one case. Returns $true
    for all three, so a caller never has to know which it was.
#>
function Test-CompanionAbsent {
    param([Parameter(Mandatory)][string] $Path)

    if (-not (Test-Path -LiteralPath $Path)) { return $true }
    $text = [System.IO.File]::ReadAllText($Path) -replace "`r`n", "`n"
    if ([string]::IsNullOrWhiteSpace($text)) { return $true }
    return [string]::IsNullOrWhiteSpace((Remove-Frontmatter -Text $text))
}

<#
    Parses one core's fenced companion block. Returns $null when there is no fence at all;
    BlockCount lets the caller tell "one" from "more than one" without re-scanning.
#>
function Get-CoreDeclaration {
    param([Parameter(Mandatory)][string] $Path)

    $text = [System.IO.File]::ReadAllText($Path) -replace "`r`n", "`n"
    $blocks = [regex]::Matches($text, '(?s)<!-- companion:declared:start -->(.*?)<!-- companion:declared:end -->')
    if ($blocks.Count -eq 0) { return $null }

    $body = $blocks[0].Groups[1].Value

    $pathMatch = [regex]::Match($body, '`(skills/[A-Za-z0-9._-]+/SKILL-local\.md)`')
    $declaredPath = if ($pathMatch.Success) { $pathMatch.Groups[1].Value } else { '' }

    $categories = [System.Collections.Generic.List[string]]::new()
    $listMatch = [regex]::Match($body, '(?s)It may override:(.*?)\.\s')
    if ($listMatch.Success) {
        foreach ($m in [regex]::Matches($listMatch.Groups[1].Value, '`([a-z][a-z0-9-]*)`')) {
            $id = $m.Groups[1].Value
            if (-not $categories.Contains($id)) { $categories.Add($id) }
        }
    }

    [pscustomobject]@{
        BlockCount   = $blocks.Count
        CompanionPath = $declaredPath
        Categories   = @($categories)
    }
}

<#
    Returns one row per `##` heading in a companion, with whether anything but whitespace sits
    under it. An empty heading is an override that asserts nothing, which COMPANIONS.md keeps
    distinct from having no companion at all.
#>
function Get-CompanionHeading {
    param([Parameter(Mandatory)][string] $Path)

    $body = Remove-Frontmatter -Text ([System.IO.File]::ReadAllText($Path) -replace "`r`n", "`n")
    # Not $matches - that is an automatic variable, and clobbering it here would silently
    # corrupt any -match result the caller was still holding.
    $headings = [regex]::Matches($body, '(?m)^##[ \t]+(.+?)[ \t]*$')
    $rows = [System.Collections.Generic.List[object]]::new()

    for ($i = 0; $i -lt $headings.Count; $i++) {
        $start = $headings[$i].Index + $headings[$i].Length
        $end = if ($i + 1 -lt $headings.Count) { $headings[$i + 1].Index } else { $body.Length }
        $rows.Add([pscustomobject]@{
                Name    = $headings[$i].Groups[1].Value.Trim('`', ' ')
                HasBody = -not [string]::IsNullOrWhiteSpace($body.Substring($start, $end - $start))
            })
    }
    , @($rows)
}

function Invoke-CompanionCheck {
    param(
        [Parameter(Mandatory)][string] $TargetRepo,
        [Parameter(Mandatory)][string] $KitRoot
    )

    $kitSkillsDir = Join-Path $KitRoot 'skills'
    $companionsDoc = Join-Path $KitRoot '.claude/COMPANIONS.md'

    if (-not (Test-Path -LiteralPath $kitSkillsDir)) {
        return [pscustomobject]@{
            State = 'NotEvaluated'; Findings = @(); CoreCount = 0; CompanionCount = 0; AbsentCount = 0
            Detail = "Installed kit at '$KitRoot' has no skills/ directory."
        }
    }
    if (-not (Test-Path -LiteralPath $companionsDoc)) {
        return [pscustomobject]@{
            State = 'NotEvaluated'; Findings = @(); CoreCount = 0; CompanionCount = 0; AbsentCount = 0
            Detail = "Installed kit at '$KitRoot' has no .claude/COMPANIONS.md - the category vocabulary is read from it, so there is nothing to validate against."
        }
    }

    $validCategories = Get-CompanionCategory -CompanionsDoc $companionsDoc
    if ($validCategories.Count -eq 0) {
        return [pscustomobject]@{
            State = 'NotEvaluated'; Findings = @(); CoreCount = 0; CompanionCount = 0; AbsentCount = 0
            Detail = "No category ids found in '$companionsDoc' - its table is missing or its shape changed."
        }
    }

    $targetSkillsDir = Join-Path $TargetRepo 'skills'
    $kitNames = @(if (Test-Path -LiteralPath $kitSkillsDir) { Get-ChildItem -LiteralPath $kitSkillsDir -Directory | Select-Object -ExpandProperty Name } else { @() })
    $targetNames = @(if (Test-Path -LiteralPath $targetSkillsDir) { Get-ChildItem -LiteralPath $targetSkillsDir -Directory | Select-Object -ExpandProperty Name } else { @() })
    $allNames = @($kitNames + $targetNames | Select-Object -Unique | Sort-Object)

    $findings = [System.Collections.Generic.List[object]]::new()
    $coreCount = 0
    $companionCount = 0
    $absentCount = 0

    foreach ($name in $allNames) {
        $corePath = Join-Path $kitSkillsDir "$name/SKILL.md"
        $companionPath = Join-Path $targetSkillsDir "$name/SKILL-local.md"
        $coreRel = "skills/$name/SKILL.md"
        $companionRel = "skills/$name/SKILL-local.md"

        if (-not (Test-Path -LiteralPath $corePath)) {
            if (Test-Path -LiteralPath $companionPath) {
                $findings.Add((New-CompanionFinding $companionRel 'OrphanCompanion' "No core at $coreRel in the installed kit. A companion overrides a core; on its own it overrides nothing and will never be read."))
            }
            continue
        }

        $coreCount++
        $decl = Get-CoreDeclaration -Path $corePath

        if ($null -eq $decl) {
            $findings.Add((New-CompanionFinding $coreRel 'MissingBlock' 'No <!-- companion:declared:start --> block. Every core must declare what its companion may override, even when the answer is a short list.'))
            continue
        }

        if ($decl.BlockCount -gt 1) {
            $findings.Add((New-CompanionFinding $coreRel 'DuplicateBlock' "$($decl.BlockCount) companion blocks; exactly one is allowed."))
        }
        if ($decl.CompanionPath -ne $companionRel) {
            $findings.Add((New-CompanionFinding $coreRel 'WrongCompanionPath' "Block names '$($decl.CompanionPath)'; expected '$companionRel'."))
        }
        if ($decl.Categories.Count -eq 0) {
            $findings.Add((New-CompanionFinding $coreRel 'NoCategories' 'Declares no overridable categories. A core that allows nothing needs no companion mechanism - say so by removing the block, not by leaving the list empty.'))
        }
        foreach ($cat in $decl.Categories) {
            if ($validCategories -notcontains $cat) {
                $findings.Add((New-CompanionFinding $coreRel 'UnknownCategory' "'$cat' is not a category in .claude/COMPANIONS.md."))
            }
        }

        if (Test-CompanionAbsent -Path $companionPath) {
            $absentCount++
            continue
        }
        $companionCount++

        foreach ($heading in (Get-CompanionHeading -Path $companionPath)) {
            if ($validCategories -notcontains $heading.Name) {
                $findings.Add((New-CompanionFinding $companionRel 'UnknownCompanionHeading' "'## $($heading.Name)' is not a category in .claude/COMPANIONS.md."))
                continue
            }
            if ($decl.Categories -notcontains $heading.Name) {
                $findings.Add((New-CompanionFinding $companionRel 'UndeclaredCategory' "'$($heading.Name)' is a valid category, but $coreRel does not allow it to be overridden."))
            }
            if (-not $heading.HasBody) {
                $findings.Add((New-CompanionFinding $companionRel 'EmptyCategory' "'## $($heading.Name)' has nothing under it. An empty category still reads as an override; delete the heading instead."))
            }
        }
    }

    [pscustomobject]@{
        State          = if ($findings.Count -gt 0) { 'Invalid' } else { 'Valid' }
        Findings       = @($findings)
        CoreCount      = $coreCount
        CompanionCount = $companionCount
        AbsentCount    = $absentCount
        Detail         = ''
    }
}

function Get-CompanionExitCode {
    param([string] $State)
    switch ($State) {
        'Valid'        { 0 }
        'Invalid'      { 1 }
        'NotEvaluated' { 2 }
        default        { throw "Unknown companion state: $State" }
    }
}

function Write-CompanionReport {
    param([Parameter(Mandatory)][object] $Result)

    switch ($Result.State) {
        'Valid' {
            Write-Host "Companion split OK - $($Result.CoreCount) core(s) checked, $($Result.CompanionCount) companion file(s) present, $($Result.AbsentCount) core(s) with no companion."
        }
        'Invalid' {
            Write-Host "Companion split VIOLATED - $($Result.Findings.Count) finding(s) across $($Result.CoreCount) core(s) and $($Result.CompanionCount) companion file(s):"
            foreach ($f in $Result.Findings) { Write-Host "  [$($f.Rule)] $($f.Path) - $($f.Detail)" }
        }
        'NotEvaluated' {
            Write-Host "Could not evaluate: $($Result.Detail)"
        }
    }
}

# Guarded so the tests can dot-source this instead - same structure as Test-WriteSurface.ps1
# and Test-DesignDrift.ps1, and for the same reason.
if ($MyInvocation.InvocationName -ne '.') {
    $resolvedKitRoot = Resolve-AgentKitRoot -Explicit $KitRoot
    $result = Invoke-CompanionCheck -TargetRepo $TargetRepo -KitRoot $resolvedKitRoot
    if (-not $Quiet) { Write-CompanionReport -Result $result }
    $result
    exit (Get-CompanionExitCode -State $result.State)
}
