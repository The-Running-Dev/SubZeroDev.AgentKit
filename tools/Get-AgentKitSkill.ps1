#Requires -Version 7.0
<#
.SYNOPSIS
    Reads a canonical skill with absolute kit dependency bindings.
.DESCRIPTION
    Global host adapters and the Codex launcher share this deterministic reader.
    It never writes a core copy. Project files, including migration's old kit copies
    and SKILL-local.md, stay project-relative. Only executable kit calls and citations
    are anchored; migration's deletion candidates must never point into the runtime.
#>
[CmdletBinding()]
param([Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]*$')][string] $Command)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Split-Path -Parent $PSScriptRoot).Replace('\','/')
$path = Join-Path $root "skills/$Command/SKILL.md"
if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Unknown AgentKit command '$Command': '$path' is missing." }
$text = [IO.File]::ReadAllText($path)
$text = $text.Replace('../../.claude/COMPANIONS.md', "$root/.claude/COMPANIONS.md")
# Executable examples must remain valid when the runtime root contains spaces or quotes.
$quotedRoot = $root.Replace("'", "''")
$text = [regex]::Replace($text, 'pwsh (?:-File )?(?:\./)?tools/([\w-]+[.]ps1)', [Text.RegularExpressions.MatchEvaluator]{ param($m) "pwsh -File '$quotedRoot/tools/$($m.Groups[1].Value)'" })
$text = [regex]::Replace($text, '(?m)^(\s*)(?:\./)?tools/([\w-]+[.]ps1)', [Text.RegularExpressions.MatchEvaluator]{ param($m) "$($m.Groups[1].Value)& '$quotedRoot/tools/$($m.Groups[2].Value)'" })
# Bare references in migration enumerate TARGET copies to classify/delete. Leave those
# identifiers untouched; its executable calls above still use the canonical runtime.
if ($Command -ne 'install-all') {
    foreach ($relative in @('AGENTS.shared.md','.claude/COMPANIONS.md','INSTALL.md','tools/','templates/')) {
        $pattern = '(?<![\w/\\.])(?:\./)?' + [regex]::Escape($relative)
        $replacement = "$root/$relative"
        $text = [regex]::Replace($text, $pattern, [Text.RegularExpressions.MatchEvaluator]{ param($m) $replacement })
    }
}
$text = [regex]::Replace($text, '(?<![\w/\\.])skills/([a-z0-9-]+)/SKILL[.]md', [Text.RegularExpressions.MatchEvaluator]{ param($m) "$root/$($m.Value)" })
@"
AgentKit canonical runtime: $root
Shared rules: $root/AGENTS.shared.md
Companion mechanism: $root/.claude/COMPANIONS.md
Kit script root: $root/tools/
Kit template root: $root/templates/
Project companions and project files remain relative to the calling project. In
/install-all, old-copy classification and deletion paths are TARGET project paths,
never canonical runtime paths. Keep the project working directory when running tools.
Quote absolute paths when executing PowerShell commands.

$text
"@
