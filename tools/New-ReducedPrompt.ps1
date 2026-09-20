#Requires -Version 7.0
<#
.SYNOPSIS
    Assembles a reduced-context prompt for one slice, sized for a smaller or
    local target model instead of the full-context prompt `/slice` hands to
    a frontier one.

.DESCRIPTION
    `/slice` hands over `AGENTS.md`, `agent.md` and the design docs regardless
    of what is receiving them (issue #12). That is right for a large-context
    frontier model and hostile to a small local one. This script emits an
    alternative: the target slice's own block from `design/30-slices.md`,
    `design/20-contract.md` **verbatim** (it is the authoritative surface and
    is never trimmed), and only the `AGENTS.md` sections `skills/slice/SKILL.md`
    itself cites by name as binding a slice — `agent.md` is dropped entirely.

    Which `AGENTS.md` sections count as "binding" is not guessed: it is read
    mechanically off `skills/slice/SKILL.md`'s own citations, of the form
    `` `AGENTS.md`, *Section Name* ``. That keeps the reduced set traceable to
    the command that actually governs `/slice`, and it stays correct if that
    command's citations change without this script's own logic changing. A citation may name
    `AGENTS.shared.md` or `AGENTS.md`; either way the section is looked up in the shared file
    first, then the repository's own `AGENTS.md`.

    This is a standalone tool, not a step `/slice` runs itself
    (`design/90-decisions.md`, 2026-08-04, "per-target prompt sizing ...
    does not belong bundled into a command file") — run it by hand, or from
    whatever launches a session against a smaller model, before invoking that
    model on a slice.

    Writes nothing. Emits the assembled prompt on the success stream (or to
    -OutFile), the same way `Read-DesignState.ps1` emits its graph.

.PARAMETER SliceId
    The slice to size a prompt for, e.g. `S4`. Matched against a `## S<n> —`
    or nested `### S<n> —` heading in `design/30-slices.md`.

.PARAMETER RepoRoot
    Repository root to read from. Defaults to the current directory.

.PARAMETER CommandFile
    The command file whose `AGENTS.md` citations decide which sections are
    "binding". A relative path is resolved against -KitRoot, since the canonical
    `skills/` tree lives in the AgentKit runtime, not in an installed target
    repository. Defaults to `skills/slice/SKILL.md`.

.PARAMETER KitRoot
    The AgentKit checkout to resolve -CommandFile's default (and any other
    relative -CommandFile) against. Defaults to the Home-install convention
    (AGENTS.shared.md, *House conventions*): a self-hosted checkout containing
    this script, then $env:AGENTKIT_HOME, then $HOME/.agent-kit.

.PARAMETER OutFile
    Write the assembled prompt here instead of the success stream.

.EXAMPLE
    ./tools/New-ReducedPrompt.ps1 -SliceId S4

.EXAMPLE
    ./tools/New-ReducedPrompt.ps1 -SliceId S4 -OutFile reduced-S4.md
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$SliceId,

    [string]$RepoRoot = (Get-Location).Path,

    [string]$CommandFile,

    [string]$KitRoot,

    [string]$OutFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-MarkdownSection {
    <#
      Returns the lines of the first heading whose trimmed text equals
      $HeadingText, up to (excluding) the next heading whose level is the
      same as or shallower than the one matched. $Lines is the whole file,
      already split.
    #>
    param([string[]]$Lines, [string]$HeadingText, [string]$SourceName)

    $startIndex = -1
    $level = 0
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^(#{1,6})\s+(.*?)\s*$') {
            if ($Matches[2] -eq $HeadingText) {
                $startIndex = $i
                $level = $Matches[1].Length
                break
            }
        }
    }
    if ($startIndex -lt 0) {
        return $null
    }

    $endIndex = $Lines.Count
    for ($i = $startIndex + 1; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match "^(#{1,$level})\s") {
            $endIndex = $i
            break
        }
    }

    return $Lines[$startIndex..($endIndex - 1)]
}

function Get-BoundSectionNames {
    <#
      Reads every `` `AGENTS.md`, *Section Name* `` (or `AGENTS.md, *Section
      Name*` without backticks) citation out of the command file, in first-
      appearance order, de-duplicated. This is the mechanical stand-in for
      "only the rules binding that slice" - the set a slice's own command
      file already says it depends on, not a fresh judgement made here.

      Both separators the command files actually use are matched: the comma
      form above, and `` `AGENTS.shared.md` § *Section Name* ``, which is now
      the more common of the two. Matching only one of them makes a citation
      restyled from one to the other silently drop its section out of the
      reduced prompt - which is not a visible failure, because the prompt
      still assembles, just without the rule it was supposed to carry.

      A citation wrapped across a line break is the same citation. Runs of
      whitespace inside the captured name collapse to one space before it is
      matched against a heading, so `` § *Session\nboundaries* `` resolves to
      *Session boundaries* rather than throwing as an unknown section.
    #>
    param([string]$CommandText)

    $names = [System.Collections.Generic.List[string]]::new()
    $seen = [System.Collections.Generic.HashSet[string]]::new()
    $pattern = '`?AGENTS(?:\.shared)?\.md`?\s*(?:,|§)?\s*\*([^*]+)\*'
    foreach ($m in [regex]::Matches($CommandText, $pattern)) {
        $name = ($m.Groups[1].Value -replace '\s+', ' ').Trim()
        if ($seen.Add($name)) { [void]$names.Add($name) }
    }
    return $names
}

function Get-SliceBlock {
    <#
      A slice heading sits at `##` (S1-S18) or, nested under `## Outstanding`, at `###`
      (S19 on) - the same two depths Test-DesignDrift.ps1 and Update-SlicesDocument.ps1's
      Get-SliceDocumentModel both recognise (design/90-decisions.md, 2026-08-30). The block
      ends at the next heading whose depth is equal to or shallower than the one matched, so
      a `###` slice's own body still stops at the next `## Landed` or a sibling `###` slice,
      while a `##` slice never stops early on `###` sub-structure.
    #>
    param([string[]]$Lines, [string]$SliceId)

    $startIndex = -1
    $level = 0
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match "^(#{2,3})\s+$([regex]::Escape($SliceId))\s+—") {
            $startIndex = $i
            $level = $Matches[1].Length
            break
        }
    }
    if ($startIndex -lt 0) {
        throw "No '## $SliceId —' or '### $SliceId —' heading in design/30-slices.md. If $SliceId has landed, its body was retired to the index and this script has nothing to reduce; read it from git history instead."
    }

    $endIndex = $Lines.Count
    for ($i = $startIndex + 1; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match "^#{1,$level}\s") {
            $endIndex = $i
            break
        }
    }

    # Trim a trailing '---' separator and blank lines the source uses between
    # slice blocks; they read as noise once the block stands alone.
    $block = [System.Collections.Generic.List[string]]::new([string[]]$Lines[$startIndex..($endIndex - 1)])
    while ($block.Count -gt 0 -and ($block[$block.Count - 1].Trim() -eq '' -or $block[$block.Count - 1].Trim() -eq '---')) {
        $block.RemoveAt($block.Count - 1)
    }
    return $block.ToArray()
}

function Resolve-AgentKitRoot {
    <#
        Home-install convention (AGENTS.shared.md, *House conventions*): self-hosted checkout
        first (a live kit working tree, so kit development reads its own uncommitted edits),
        then $env:AGENTKIT_HOME, then $HOME/.agent-kit. Same shape as Test-Companion.ps1's
        function of the same name, New-DesignDocs.ps1's Resolve-KitRoot, and
        Invoke-CodexCommand.ps1's Get-AgentKitInstallRoot.
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

$root = (Resolve-Path $RepoRoot).Path
if (-not $CommandFile) {
    $kitRootResolved = Resolve-AgentKitRoot -Explicit $KitRoot
    $CommandFile = Join-Path $kitRootResolved 'skills/slice/SKILL.md'
}
elseif (-not [System.IO.Path]::IsPathRooted($CommandFile)) {
    $kitRootResolved = Resolve-AgentKitRoot -Explicit $KitRoot
    $CommandFile = Join-Path $kitRootResolved $CommandFile
}

$slicesPath = Join-Path $root 'design/30-slices.md'
$contractPath = Join-Path $root 'design/20-contract.md'
foreach ($required in @($CommandFile, $slicesPath, $contractPath)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required file not found: $required"
    }
}

# The contract is two files: AGENTS.shared.md (every kit repository's rules) and the
# repository's own AGENTS.md (its project rules). The shared file is the repository's own copy
# when it has one - the kit's checkout does - and otherwise the installed kit's, resolved per
# AGENTS.shared.md's Home-install convention. Sections are looked up shared file first.
function Resolve-SharedContractPath {
    param([string]$RepoRootPath)

    $candidates = [System.Collections.Generic.List[string]]::new()
    $candidates.Add((Join-Path $RepoRootPath 'AGENTS.shared.md'))
    $selfHosted = Split-Path -Parent $PSScriptRoot
    if (Test-Path -LiteralPath (Join-Path $selfHosted '.git')) { $candidates.Add((Join-Path $selfHosted 'AGENTS.shared.md')) }
    if ($env:AGENTKIT_HOME) { $candidates.Add((Join-Path $env:AGENTKIT_HOME 'AGENTS.shared.md')) }
    $candidates.Add((Join-Path $HOME '.agent-kit/AGENTS.shared.md'))
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

$agentsSources = @(
    Resolve-SharedContractPath -RepoRootPath $root
    Join-Path $root 'AGENTS.md'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
if (-not $agentsSources) {
    throw "Required file not found: neither AGENTS.shared.md nor $(Join-Path $root 'AGENTS.md')"
}
$agentsSourceLines = foreach ($source in $agentsSources) {
    [pscustomobject]@{ Path = $source; Lines = [string[]](Get-Content -LiteralPath $source) }
}

$commandText = Get-Content -LiteralPath $CommandFile -Raw
$slicesLines = Get-Content -LiteralPath $slicesPath
$contractText = Get-Content -LiteralPath $contractPath -Raw

$sliceBlock = Get-SliceBlock -Lines $slicesLines -SliceId $SliceId
# @() because the pipeline unwraps a single-element list to a bare string, and under
# Set-StrictMode -Version Latest a string has no .Count - so a command file citing exactly one
# section threw a PropertyNotFoundException instead of assembling.
$boundSectionNames = @(Get-BoundSectionNames -CommandText $commandText)
if (-not $boundSectionNames.Count) {
    throw "No 'AGENTS.md, *Section Name*' citation found in $CommandFile. Nothing to bind the reduced prompt to - check the command file still cites its own rules by name."
}

$boundSections = foreach ($name in $boundSectionNames) {
    $section = $null
    foreach ($source in $agentsSourceLines) {
        $section = Get-MarkdownSection -Lines $source.Lines -HeadingText $name -SourceName $source.Path
        if ($section) { break }
    }
    if (-not $section) {
        throw "No section '$name' in $(($agentsSourceLines | ForEach-Object { $_.Path }) -join ' or '). The reduced prompt cannot assemble a rule it cannot find."
    }
    $section
    ''
}

$commandRelative = [System.IO.Path]::GetRelativePath($root, $CommandFile) -replace '\\', '/'

$output = [System.Collections.Generic.List[string]]::new()
$output.Add("# Reduced-context prompt — $SliceId")
$output.Add('')
$output.Add("Generated by ``tools/New-ReducedPrompt.ps1`` for a target model with less context than " +
    "the full ``/slice`` prompt assumes. It carries ``design/20-contract.md`` verbatim, only the " +
    "``AGENTS.md`` sections ``$commandRelative`` cites as binding a slice, and drops ``agent.md`` " +
    "entirely. Sections bound: $($boundSectionNames -join ', ').")
$output.Add('')
$output.Add('## Rules binding this slice')
$output.Add('')
$output.AddRange([string[]]$boundSections)
$output.Add('## Contract')
$output.Add('')
$output.Add($contractText.TrimEnd())
$output.Add('')
$output.Add('## Slice')
$output.Add('')
$output.AddRange([string[]]$sliceBlock)

$result = ($output -join "`n") + "`n"

if ($OutFile) {
    Set-Content -LiteralPath $OutFile -Value $result -Encoding utf8NoBOM -NoNewline
}
else {
    $result
}
