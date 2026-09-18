#Requires -Version 7.0
<#
.SYNOPSIS
    Launches `codex` configured for the tier that matches a command's requirement in
    AGENTS.shared.md, so the tier gate in "Model, effort, and review budget" never has to catch
    a mismatch caused by launching on whatever config the shell happened to have open.

.DESCRIPTION
    codex/PROFILES.md defines four profiles - architect (Sol, deep reasoning, read-only),
    author (Sol, deep reasoning, workspace-write), builder (Terra, implementation), quick
    (Codex Spark, implementation) - but nothing picks one from a command name. AGENTS.shared.md's
    *Command routing* table names a tier per command; this script is that lookup.

    architect and author share a model and effort and differ only in sandbox mode: architect
    is read-only, for the two deep-reasoning commands that must never touch the tree
    (/brief, /redteam); author is workspace-write, for the deep-reasoning commands
    whose normal work is writing to design/ (/design, /spec, /plan, /align). A
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

    This is exactly the kind of mechanical, repeated lookup AGENTS.shared.md's own "What should
    stop being model work" table calls 🔴 Definitely avoidable - arithmetic over a table,
    not judgement. The judgement (which tier a *novel* task needs) still belongs to
    whoever is running the session; this script only removes the "which flags do I type
    for a command I already know the tier of" step.

    -Effort overrides the profile's baked-in reasoning effort via `-c
    model_reasoning_effort=<value>`, for the routing table's documented exceptions (a large
    /slice at high, an /align mechanical-edit pass at medium instead of the profile's
    default). It does not change which profile is selected.

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

    /resume is the one command this script does not run as a single `codex` invocation.
    Its own procedure needs a deep-reasoning align phase and an implementation-tier track
    phase, and Codex profiles cannot switch mid-session - so this script is the case
    skills/resume/SKILL.md's *Split across sessions* names, and chains two separate
    `codex` processes ('author' then 'builder') instead of picking one profile for the whole
    run (issue #253). The human still runs `./tools/Invoke-CodexCommand.ps1 resume` once;
    nothing prompts them between the two processes.

    Under home-install, the launched codex processes do not necessarily share this script's
    own working directory with the kit checkout, so the two prompts below cannot just tell
    the session to go open a kit file by path - Get-SkillContent reads
    skills/resume/SKILL.md from the install root (Get-AgentKitInstallRoot) itself, and its
    text is inlined into the prompt instead.

.PARAMETER Command
    The command name, with or without a leading slash (e.g. 'help' or '/help').

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
    prompt text or `resume <id>`). This is the legacy direct-launcher interface.

.EXAMPLE
    ./tools/Invoke-CodexCommand.ps1 help
    Resolves /help to the 'quick' profile and runs codex with that profile's model,
    effort, approval policy, and sandbox mode passed directly.

.EXAMPLE
    ./tools/Invoke-CodexCommand.ps1 slice -Effort high -- "implement S4"
    Resolves /slice to 'builder' but overrides effort to high for a large slice.

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

# Mirrors AGENTS.shared.md's *Command routing* table. Tier -> profile per codex/PROFILES.md:
# deep reasoning (read-only) -> architect, deep reasoning (writes design/) -> author,
# implementation -> builder or quick.
# Where routing names two tiers for one command (a decide phase and a mechanical phase),
# this maps to the tier of the phase that runs first / gates the rest.
$commandProfiles = [ordered]@{
    'brief'            = 'architect'   # writes nothing (brief.md, *Re-run*)
    'design'           = 'author'      # writes design/10-design.md
    'spec'             = 'author'      # writes design/20-contract.md
    'plan'             = 'author'      # writes design/30-slices.md
    'redteam'          = 'architect'   # strongest local profile; vendor diversity is on the caller
    'slice'            = 'builder'
    'align'            = 'author'      # deciding which side is correct gates its own mechanical edits
    'docs'             = 'builder'
    'track'            = 'builder'
    'check'            = 'builder'
    'pr'               = 'builder'
    'resolve'          = 'builder'
    'fix'              = 'builder'
    'tune'             = 'builder'
    'install'          = 'builder'
    'install-all'      = 'builder'
    'sync'             = 'builder'
    'help'             = 'quick'
    'next'             = 'builder'    # orients like /help but acts, so it needs write access
    'clean'            = 'quick'
    'install-review'   = 'builder'
    'hold'             = 'builder'
    # 'resume' is deliberately absent here - it needs two profiles in one run (see the
    # special case below, issue #253), which a single entry in this table cannot express.
}

# Mirrors codex/PROFILES.md's "Codex 0.134.0 and later" per-file values. --profile is not
# used to load these (see .DESCRIPTION) - keep this table in sync with PROFILES.md by hand.
$profileConfig = [ordered]@{
    'architect' = @{ Model = 'gpt-5.6-sol';         Effort = 'high';   Approval = 'on-request'; Sandbox = 'read-only' }
    'author'    = @{ Model = 'gpt-5.6-sol';         Effort = 'high';   Approval = 'on-request'; Sandbox = 'workspace-write' }
    'builder'   = @{ Model = 'gpt-5.6-terra';       Effort = 'medium'; Approval = 'on-request'; Sandbox = 'workspace-write' }
    'quick'     = @{ Model = 'gpt-5.3-codex-spark'; Effort = 'medium'; Approval = 'on-request'; Sandbox = 'workspace-write' }
}

# The tier each profile resolves to, spelled exactly as AGENTS.shared.md's *Model, effort, and
# review budget* table spells it. This is the value stamped into the child environment so
# the gate never has to infer a tier from a self-report, and never has to read a config
# file the sandbox puts out of reach - see $tierEnvironment below.
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
    Write-Output "/resume runs two processes, not one - 'author'/high for its align phase, then 'builder'/medium for its track phase. See -Command resume -WhatIf."
    return
}

if (-not $Command) {
    throw "No command given. Pass a command name (e.g. 'help') or -List to see the table."
}

$normalized = $Command.TrimStart('/')
$useSkillArguments = $PSBoundParameters.ContainsKey('SkillArguments')

# See Get-ProjectDocByteBudget's own comment for the source citation. Computed once per
# launch, from the launch directory, and applied to every codex process this script starts.
$projectDocBudget = Get-ProjectDocByteBudget

# /resume's own procedure (skills/resume/SKILL.md, Phase 2 and Phase 3) requires its
# align phase at deep-reasoning tier and its track phase at implementation tier, "in this
# same session." Codex profiles cannot switch mid-session (codex/PROFILES.md), so one `codex`
# invocation can never satisfy both halves - issue #253. This chains two separate `codex`
# processes instead, so the human still runs this script once and nothing prompts them
# in between: the align half is a real 'author' session, the track half a real 'builder'
# session, and each is stamped with its own tier exactly as a standalone /align or /track
# invocation would be.
if ($normalized -eq 'resume') {
    $resumeSkill = Get-SkillContent -Name 'resume'
    $resumeArguments = if ($useSkillArguments) { ConvertTo-Json -InputObject @($SkillArguments) -Compress } else { $null }

    $alignPrompt = @'
This is session 1 of /resume's Split across sessions. Its full procedure follows.

'@ + $resumeSkill + @'


Run it as session 1: refuse if not frozen, Phase 1, Phase 2, and Commit. Stop there - a
second, separately-launched process runs session 2.
'@ + $(if ($useSkillArguments) { "`nUser arguments (JSON array; preserve each element exactly):`n$resumeArguments" } else { '' })
    $trackPrompt = @'
This is session 2 of /resume's Split across sessions. Its full procedure follows.

'@ + $resumeSkill + @'


Run it as session 2: read session 1's commit, then run Phase 3 and Report exactly as
written there.
'@ + $(if ($useSkillArguments) { "`nUser arguments (JSON array; preserve each element exactly):`n$resumeArguments" } else { '' })

    $alignConfig = $profileConfig['author']
    $trackConfig = $profileConfig['builder']

    $alignArgs = @(
        '-m', $alignConfig.Model,
        '-c', "model_reasoning_effort=$($alignConfig.Effort)",
        '-c', "project_doc_max_bytes=$projectDocBudget",
        '-a', $alignConfig.Approval,
        '-s', $alignConfig.Sandbox
    ) + $(if ($useSkillArguments) { @() } else { $CodexArgs }) + @($alignPrompt)

    $trackArgs = @(
        '-m', $trackConfig.Model,
        '-c', "model_reasoning_effort=$($trackConfig.Effort)",
        '-c', "project_doc_max_bytes=$projectDocBudget",
        '-a', $trackConfig.Approval,
        '-s', $trackConfig.Sandbox,
        $trackPrompt
    )

    $alignStamp = [ordered]@{
        AGENTKIT_TIER    = $profileTiers['author']
        AGENTKIT_MODEL   = $alignConfig.Model
        AGENTKIT_EFFORT  = $alignConfig.Effort
        AGENTKIT_COMMAND = '/resume-align'
        AGENTKIT_PROFILE = 'author'
    }
    $trackStamp = [ordered]@{
        AGENTKIT_TIER    = $profileTiers['builder']
        AGENTKIT_MODEL   = $trackConfig.Model
        AGENTKIT_EFFORT  = $trackConfig.Effort
        AGENTKIT_COMMAND = '/resume-track'
        AGENTKIT_PROFILE = 'builder'
    }

    if ($WhatIf) {
        $alignStampText = ($alignStamp.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' '
        $trackStampText = ($trackStamp.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' '
        Write-Output "$alignStampText codex $($alignArgs -join ' ')"
        Write-Output "$trackStampText codex $($trackArgs -join ' ')"
        return
    }

    foreach ($entry in $alignStamp.GetEnumerator()) { Set-Item -Path "Env:$($entry.Key)" -Value $entry.Value }
    & codex @alignArgs
    if ($LASTEXITCODE -ne 0) {
        throw "/resume's align phase (codex process 1 of 2, 'author' profile) exited $LASTEXITCODE - stopping before the track phase runs against a possibly-incomplete align."
    }

    foreach ($entry in $trackStamp.GetEnumerator()) { Set-Item -Path "Env:$($entry.Key)" -Value $entry.Value }
    & codex @trackArgs
    exit $LASTEXITCODE
}

if (-not $commandProfiles.Contains($normalized)) {
    $known = (@($commandProfiles.Keys) + 'resume' | Sort-Object | ForEach-Object { "/$_" }) -join ', '
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

# AGENTS.shared.md's tier gate is told to resolve a Codex session's tier from its configuration
# rather than its self-report. On the profile that matters most - `architect`, which is
# `sandbox_mode = read-only` and scoped to the workspace - that configuration lives in
# `~/.codex/`, outside the sandbox, so the session cannot read it and the gate falls to its
# documented last resort (the self-report) and stops. That is the failure this stamping
# removes: environment variables cross the sandbox boundary, config files do not.
#
# The gate reads AGENTKIT_TIER first, the configuration second, and the self-report last.
# Only a session launched through this script carries the stamp, which is why it is a
# hardening on top of the configuration read and not a replacement for it.
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
