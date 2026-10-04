#Requires -Version 7.0
<#
.SYNOPSIS
    Launches `codex` configured for the tier AGENTS.shared.md's *Models* section routes a command
    to, so a session never runs on whatever config the shell happened to have open.

.DESCRIPTION
    codex/PROFILES.md defines four profiles - architect (Sol, deep reasoning, read-only),
    author (Sol, deep reasoning, workspace-write), builder (Terra, implementation), quick
    (Codex Spark, implementation) - but nothing picks one from a command name. AGENTS.shared.md's
    *Models* routing table names a tier per command; this script is that lookup.

    architect and author share a model and effort and differ only in sandbox mode: architect
    is read-only, for the two deep-reasoning commands that must never touch the tree
    (/brief, /redteam); author is workspace-write, for the deep-reasoning commands
    whose normal work is writing to design/ (/interview, /design, /plan, /align). A
    single read-only 'architect' used to back all of these (issue #252) and blocked every
    one of them except /redteam and /brief from doing its job.

    It does NOT launch via `codex --profile <name>`. That flag layers
    `$CODEX_HOME/<name>.config.toml` on top of the base user config (`codex --help`), and
    codex/PROFILES.md documents those per-profile files as something a person sets up by
    hand on their own machine - the kit's own installer (`INSTALL.md` phase 1, the
    `codex/PROFILES.md` row) refuses to write them into a target repo. A machine without
    them - the common case for a fresh clone - makes every `--profile` flag resolve to
    nothing, silently running the base config regardless of which tier was requested
    (see issue #117). This script instead passes each profile's `model`,
    `model_reasoning_effort`, `approval_policy`, and `sandbox_mode` straight to `codex` via
    `-m`, `-c model_reasoning_effort=<x>`, `-a`, and `-s`, mirroring codex/PROFILES.md's
    0.134+ per-file values below - no `$CODEX_HOME` file needs to exist. Keep
    `$profileConfig` below in sync with codex/PROFILES.md by hand; Invoke-CodexCommand.Tests.ps1's
    "profiles match codex/PROFILES.md" Describe block (W3, issue #299) enforces that automatically.

    This is a mechanical lookup over a table, not judgement; the judgement (which tier a novel
    task needs) still belongs to whoever is running the session.

    -Effort overrides the profile's baked-in reasoning effort via `-c
    model_reasoning_effort=<value>`, for the routing table's documented exception (a difficult
    slice under /next at high). It does not change which profile is selected.

    /redteam's requirement ("strongest model, different vendor from the design author") is
    a constraint this script cannot enforce - it maps /redteam to `architect`, the
    strongest local Codex profile, but vendor diversity is the caller's call to make before
    running it.

    Every invocation also carries `-c project_doc_max_bytes=<n>`, `<n>` computed fresh each
    run from the AGENTS.md/AGENTS.override.md files Codex would actually load for the launch
    directory (Get-ProjectDocByteBudget, below). Codex 0.153.4's default
    (project_doc_max_bytes = 32768, codex-rs/config/defaults.toml) was smaller than this
    repository's AGENTS.md before its shared part moved to AGENTS.shared.md (49761 bytes), and
    a project AGENTS.md can grow past it again; codex-rs/core/src/agents_md.rs truncates
    silently past it (a `tracing::warn!`, nothing surfaced in the session) - so a session
    launched without this flag never sees the file past that point. See codex/PROFILES.md's
    *Output and context budget* section for the full citation of that source.

.PARAMETER Command
    The command name, with or without a leading slash (e.g. 'next' or '/next').

.PARAMETER Effort
    Override the profile's model_reasoning_effort for this run only (low, medium, high,
    xhigh, max). Passed as `-c model_reasoning_effort=<Effort>`.

.PARAMETER List
    Print the full command-to-profile table and exit. No command required.

.PARAMETER WhatIf
    Print the resolved codex invocation instead of running it.

.PARAMETER SkillArguments
    Explicit routed-wrapper user arguments. They are encoded as a JSON array inside the canonical
    skill prompt, preserving argument boundaries, quotes, spaces, and newlines. They are never
    interpreted as additional Codex CLI flags or model/profile overrides.

.PARAMETER CodexArgs
    Everything after the command name/flags is passed through to `codex` verbatim (for example,
    prompt text). This is the legacy direct-launcher interface.

.EXAMPLE
    ./tools/Invoke-CodexCommand.ps1 next
    Resolves /next to the 'builder' profile and runs codex with that profile's model,
    effort, approval policy, and sandbox mode passed directly.

.EXAMPLE
    ./tools/Invoke-CodexCommand.ps1 next -Effort high
    Resolves /next to 'builder' but overrides effort to high for a difficult slice.

.EXAMPLE
    ./tools/Invoke-CodexCommand.ps1 -List
    Prints the full mapping without launching anything.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string] $Command,

    [ValidateSet('low', 'medium', 'high', 'xhigh', 'max')]
    [string] $Effort,

    [switch] $List,

    [switch] $WhatIf,

    [string[]] $SkillArguments,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $CodexArgs = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Mirrors AGENTS.shared.md's *Models* routing table. Tier -> profile per codex/PROFILES.md:
# deep reasoning (read-only) -> architect, deep reasoning (writes) -> author,
# implementation -> builder.
$commandProfiles = [ordered]@{
    'brief'            = 'architect'   # writes nothing (brief.md, *Re-run*)
    'interview'        = 'author'      # writes design/00-brief.md
    'design'           = 'author'      # writes design/10-design.md and design/20-contract.md
    'plan'             = 'author'      # writes design/30-slices.md
    'redteam'          = 'architect'   # strongest local profile; vendor diversity is on the caller
    'align'            = 'author'      # writes design/ once the user has decided
    'next'             = 'builder'
    'fix'              = 'builder'
    'install'          = 'builder'
    'install-all'      = 'builder'
    'install-review'   = 'builder'
    'sync'             = 'builder'
}

# Mirrors codex/PROFILES.md's "Codex 0.134.0 and later" per-file values. --profile is not
# used to load these (see .DESCRIPTION) - keep this table in sync with PROFILES.md by hand.
$profileConfig = [ordered]@{
    'architect' = @{ Model = 'gpt-5.6-sol';         Effort = 'high';   Approval = 'on-request'; Sandbox = 'read-only' }
    'author'    = @{ Model = 'gpt-5.6-sol';         Effort = 'high';   Approval = 'on-request'; Sandbox = 'workspace-write' }
    'builder'   = @{ Model = 'gpt-5.6-terra';       Effort = 'medium'; Approval = 'on-request'; Sandbox = 'workspace-write' }
    'quick'     = @{ Model = 'gpt-5.3-codex-spark'; Effort = 'medium'; Approval = 'on-request'; Sandbox = 'workspace-write' }
}

# The tier each profile resolves to, spelled exactly as AGENTS.shared.md's *Models* table
# spells it. Stamped into the child environment - see $tierEnvironment below.
$profileTiers = [ordered]@{
    'architect' = 'Deep reasoning'
    'author'    = 'Deep reasoning'
    'builder'   = 'Implementation'
    'quick'     = 'Implementation'
}

function Get-AgentKitInstallRoot {
    <#
        Resolves the kit install root per AGENTS.shared.md's Home-install convention: this repo checkout
        first (self-hosted dev), then $env:AGENTKIT_HOME, then $HOME/.agent-kit. Self-hosted takes
        priority so a session launched from a live kit working tree reads its own uncommitted
        skill edits rather than a possibly-stale synced checkout at $HOME/.agent-kit.
    #>
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

    throw "Could not find a kit checkout under '$selfHosted', `$env:AGENTKIT_HOME, or '$synced'."
}

function Get-SkillContent {
    <#
        Reads one skill's full SKILL.md text from the install root, for inlining into a prompt
        this script hands to a launched codex process. A citation by path only works when the
        launched process can open that path itself - true today because this repo is the install
        root, not guaranteed once the kit is actually installed elsewhere and the sandboxed
        session's workspace is scoped to a different project.
    #>
    param([Parameter(Mandatory)][string] $Name)

    $root = Get-AgentKitInstallRoot
    $reader = Join-Path $root 'tools/Get-AgentKitSkill.ps1'
    if (-not (Test-Path -LiteralPath $reader -PathType Leaf)) {
        throw "Skill reader not found at '$reader' (install root '$root'). Set `$env:AGENTKIT_HOME or install the kit to `$HOME/.agent-kit."
    }
    return & $reader -Command $Name
}

function New-AgentKitSkillPrompt {
    <#
        Builds the one prompt handed to Codex for an ordinary routed command. The command's
        canonical SKILL.md is the instruction source; the launcher must not ask Codex to dispatch
        through another wrapper, because that would either recurse or depend on a wrapper that is
        absent from a home install. User arguments are represented as JSON so one argument cannot
        become several arguments through shell parsing.
    #>
    param(
        [Parameter(Mandatory)][string] $Name,
        [string[]] $UserArguments = @()
    )

    $skill = Get-SkillContent -Name $Name
    $argumentJson = ConvertTo-Json -InputObject @($UserArguments) -Compress
    return @"
Execute the canonical /$Name procedure below directly in this routed session. Do not invoke
another AgentKit wrapper, skill-dispatch command, or global adapter.

--- canonical skills/$Name/SKILL.md ---
$skill
--- end canonical skill ---

User arguments (JSON array; preserve each element exactly):
$argumentJson
"@
}

function Get-ProjectDocByteBudget {
    <#
    Mirrors codex-rs/core/src/agents_md.rs's discovery and accounting (verified against
    the openai/codex source at tag rust-v0.153.4, matching the installed codex-cli
    0.153.4): walk up from the launch directory to the nearest ancestor containing a
    project marker (default `.git`), then back down to the launch directory, taking the
    first of AGENTS.override.md / AGENTS.md present in each directory. Codex charges the
    shared project_doc_max_bytes budget the raw byte length of each such file, in that
    root-to-cwd order, and truncates once the running total would exceed it; assembly
    separators are appended afterwards and are not charged. Returning the exact sum of
    what would be loaded is therefore the smallest budget that loads all of it un-truncated.
    #>
    param([string] $StartDir = (Get-Location).Path)

    $cwd = Get-Item -LiteralPath $StartDir
    $walk = $cwd
    $root = $cwd
    while ($walk) {
        if (Test-Path -LiteralPath (Join-Path $walk.FullName '.git')) {
            $root = $walk
            break
        }
        $walk = $walk.Parent
    }

    $dirs = [System.Collections.Generic.List[System.IO.DirectoryInfo]]::new()
    $d = $cwd
    while ($true) {
        $dirs.Insert(0, $d)
        if ($d.FullName -eq $root.FullName -or -not $d.Parent) { break }
        $d = $d.Parent
    }

    $total = 0
    foreach ($dir in $dirs) {
        $candidate = Join-Path $dir.FullName 'AGENTS.override.md'
        if (-not (Test-Path -LiteralPath $candidate)) {
            $candidate = Join-Path $dir.FullName 'AGENTS.md'
        }
        if (Test-Path -LiteralPath $candidate) {
            $total += (Get-Item -LiteralPath $candidate).Length
        }
    }
    return $total
}

if ($List) {
    $commandProfiles.GetEnumerator() | ForEach-Object {
        $p = $profileConfig[$_.Value]
        [pscustomobject]@{
            Command  = "/$($_.Key)"
            Profile  = $_.Value
            Model    = $p.Model
            Effort   = $p.Effort
            Approval = $p.Approval
            Sandbox  = $p.Sandbox
            Tier     = $profileTiers[$_.Value]
        }
    } | Format-Table -AutoSize
    return
}

if (-not $Command) {
    throw "No command given. Pass a command name (e.g. 'next') or -List to see the table."
}

$normalized = $Command.TrimStart('/')
$useSkillArguments = $PSBoundParameters.ContainsKey('SkillArguments')

# See Get-ProjectDocByteBudget's own comment for the source citation. Computed once per
# launch, from the launch directory, and applied to every codex process this script starts.
$projectDocBudget = Get-ProjectDocByteBudget

if (-not $commandProfiles.Contains($normalized)) {
    $known = (@($commandProfiles.Keys) | Sort-Object | ForEach-Object { "/$_" }) -join ', '
    throw "No profile mapping for '/$normalized'. Known commands: $known. Pass --profile to codex directly for anything else."
}

$codexProfile = $commandProfiles[$normalized]
$selectedConfig = $profileConfig[$codexProfile]
$resolvedEffort = if ($Effort) { $Effort } else { $selectedConfig.Effort }

$codexInvocationArgs = @(
    '-m', $selectedConfig.Model,
    '-c', "model_reasoning_effort=$resolvedEffort",
    '-c', "project_doc_max_bytes=$projectDocBudget",
    '-a', $selectedConfig.Approval,
    '-s', $selectedConfig.Sandbox
)
if ($useSkillArguments) {
    $codexInvocationArgs += (New-AgentKitSkillPrompt -Name $normalized -UserArguments $SkillArguments)
}
else {
    $codexInvocationArgs += $CodexArgs
}

# Stamp the resolved tier into the child environment. Environment variables cross the sandbox
# boundary where `~/.codex/` config files do not, so a session can state its own tier as a
# fact rather than infer it from its self-report.
$tierEnvironment = [ordered]@{
    AGENTKIT_TIER    = $profileTiers[$codexProfile]
    AGENTKIT_MODEL   = $selectedConfig.Model
    AGENTKIT_EFFORT  = $resolvedEffort
    AGENTKIT_COMMAND = "/$normalized"
    AGENTKIT_PROFILE = $codexProfile
}

if ($WhatIf) {
    $stamp = ($tierEnvironment.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' '
    Write-Output "$stamp codex $($codexInvocationArgs -join ' ')"
    return
}

foreach ($entry in $tierEnvironment.GetEnumerator()) {
    Set-Item -Path "Env:$($entry.Key)" -Value $entry.Value
}

& codex @codexInvocationArgs
exit $LASTEXITCODE
