#Requires -Version 7.0
<#
.SYNOPSIS
    Launches `codex` configured for the tier that matches a command's requirement in
    AGENTS.md, so the tier gate in "Model, effort, and review budget" never has to catch
    a mismatch caused by launching on whatever config the shell happened to have open.

.DESCRIPTION
    codex/PROFILES.md defines four profiles - architect (Sol, deep reasoning, read-only),
    author (Sol, deep reasoning, workspace-write), builder (Terra, implementation), quick
    (Codex Spark, implementation) - but nothing picks one from a command name. AGENTS.md's
    *Command routing* table names a tier per command; this script is that lookup.

    architect and author share a model and effort and differ only in sandbox mode: architect
    is read-only, for the two deep-reasoning commands that must never touch the tree
    (/brief-check, /redteam); author is workspace-write, for the deep-reasoning commands
    whose normal work is writing to design/ (/design, /contract, /slices, /reconcile). A
    single read-only 'architect' used to back all of these (issue #252) and blocked every
    one of them except /redteam and /brief-check from doing its job.

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
    `$profileConfig` below in sync with codex/PROFILES.md by hand; nothing enforces that
    automatically.

    This is exactly the kind of mechanical, repeated lookup AGENTS.md's own "What should
    stop being model work" table calls 🔴 Definitely avoidable - arithmetic over a table,
    not judgement. The judgement (which tier a *novel* task needs) still belongs to
    whoever is running the session; this script only removes the "which flags do I type
    for a command I already know the tier of" step.

    -Effort overrides the profile's baked-in reasoning effort via `-c
    model_reasoning_effort=<value>`, for the routing table's documented exceptions (a large
    /slice at high, an /reconcile mechanical-edit pass at medium instead of the profile's
    default). It does not change which profile is selected.

    /redteam's requirement ("strongest model, different vendor from the design author") is
    a constraint this script cannot enforce - it maps /redteam to `architect`, the
    strongest local Codex profile, but vendor diversity is the caller's call to make before
    running it.

    /unfreeze is the one command this script does not run as a single `codex` invocation.
    Its own procedure needs a deep-reasoning reconcile phase and an implementation-tier
    track phase "in this same session" (.claude/commands/unfreeze.md), but Codex profiles
    cannot switch mid-session - so this script chains two separate `codex` processes ('author'
    then 'builder') instead of picking one profile for the whole run (issue #253). The human
    still runs `./tools/Invoke-CodexCommand.ps1 unfreeze` once; nothing prompts them between
    the two processes.

.PARAMETER Command
    The command name, with or without a leading slash (e.g. 'kit-help' or '/kit-help').

.PARAMETER Effort
    Override the profile's model_reasoning_effort for this run only (low, medium, high,
    xhigh, max). Passed as `-c model_reasoning_effort=<Effort>`.

.PARAMETER List
    Print the full command-to-profile table and exit. No command required.

.PARAMETER WhatIf
    Print the resolved codex invocation instead of running it.

.PARAMETER CodexArgs
    Everything after the command name/flags is passed through to `codex` verbatim (e.g.
    the prompt text, or `resume <id>`).

.EXAMPLE
    ./tools/Invoke-CodexCommand.ps1 kit-help
    Resolves /kit-help to the 'quick' profile and runs codex with that profile's model,
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

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $CodexArgs = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Mirrors AGENTS.md's *Command routing* table. Tier -> profile per codex/PROFILES.md:
# deep reasoning (read-only) -> architect, deep reasoning (writes design/) -> author,
# implementation -> builder or quick.
# Where routing names two tiers for one command (a decide phase and a mechanical phase),
# this maps to the tier of the phase that runs first / gates the rest.
$commandProfiles = [ordered]@{
    'brief-check'      = 'architect'   # writes nothing (brief-check.md, *Re-run*)
    'design'           = 'author'      # writes design/10-design.md
    'contract'         = 'author'      # writes design/20-contract.md
    'slices'           = 'author'      # writes design/30-slices.md
    'redteam'          = 'architect'   # strongest local profile; vendor diversity is on the caller
    'slice'            = 'builder'
    'reconcile'        = 'author'      # deciding which side is correct gates its own mechanical edits
    'make-human-docs'  = 'builder'
    'track'            = 'builder'
    'verify'           = 'builder'
    'pr'               = 'builder'
    'resolve'          = 'builder'
    'fix'              = 'builder'
    'refine'           = 'builder'
    'install'          = 'builder'
    'install-all'      = 'builder'
    'kit-sync'         = 'builder'
    'kit-help'         = 'quick'
    'next'             = 'builder'    # orients like /kit-help but acts, so it needs write access
    'clean'            = 'quick'
    'install-code-review-agent' = 'builder'
    'freeze'           = 'builder'
    # 'unfreeze' is deliberately absent here - it needs two profiles in one run (see the
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

# The tier each profile resolves to, spelled exactly as AGENTS.md's *Model, effort, and
# review budget* table spells it. This is the value stamped into the child environment so
# the gate never has to infer a tier from a self-report, and never has to read a config
# file the sandbox puts out of reach - see $tierEnvironment below.
$profileTiers = [ordered]@{
    'architect' = 'Deep reasoning'
    'author'    = 'Deep reasoning'
    'builder'   = 'Implementation'
    'quick'     = 'Implementation'
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
    Write-Output "/unfreeze runs two processes, not one - 'author'/high for its reconcile phase, then 'builder'/medium for its track phase. See -Command unfreeze -WhatIf."
    return
}

if (-not $Command) {
    throw "No command given. Pass a command name (e.g. 'kit-help') or -List to see the table."
}

$normalized = $Command.TrimStart('/')

# /unfreeze's own procedure (.claude/commands/unfreeze.md, Phase 2 and Phase 3) requires its
# reconcile phase at deep-reasoning tier and its track phase at implementation tier, "in this
# same session." Codex profiles cannot switch mid-session (codex/PROFILES.md), so one `codex`
# invocation can never satisfy both halves - issue #253. This chains two separate `codex`
# processes instead, so the human still runs this script once and nothing prompts them
# in between: the reconcile half is a real 'author' session, the track half a real 'builder'
# session, and each is stamped with its own tier exactly as a standalone /reconcile or /track
# invocation would be.
if ($normalized -eq 'unfreeze') {
    $reconcilePrompt = @'
Run /unfreeze's Phase 1 and Phase 2 per .claude/commands/unfreeze.md: report `Frozen because`
and `Lifts when` verbatim from design/FROZEN.md, delete that file, then run
.claude/commands/reconcile.md in full against the now-unfrozen tree. If reconciliation touched
design/, stage those files by name and commit them together with the marker's own deletion -
one commit, not two, per AGENTS.md's Git and delivery section. Stop after that commit (or after
confirming nothing needed committing) and report what reconcile found and changed. Do not run
Phase 3 (/track) - a second, separately-launched process runs it next.
'@
    $trackPrompt = @'
Continuing /unfreeze (.claude/commands/unfreeze.md): its Phase 1 (delete design/FROZEN.md) and
Phase 2 (/reconcile) already ran to completion in a prior process - read its last commit to see
what changed. Run .claude/commands/track.md in full, per unfreeze.md's Phase 3. Then produce
unfreeze.md's Report: state the freeze is lifted, what /reconcile found and changed, and what
/track synced. If /track surfaced something needing a decision, stop and ask rather than
resolving it inline.
'@

    $reconcileConfig = $profileConfig['author']
    $trackConfig = $profileConfig['builder']

    $reconcileArgs = @(
        '-m', $reconcileConfig.Model,
        '-c', "model_reasoning_effort=$($reconcileConfig.Effort)",
        '-a', $reconcileConfig.Approval,
        '-s', $reconcileConfig.Sandbox
    ) + $CodexArgs + @($reconcilePrompt)

    $trackArgs = @(
        '-m', $trackConfig.Model,
        '-c', "model_reasoning_effort=$($trackConfig.Effort)",
        '-a', $trackConfig.Approval,
        '-s', $trackConfig.Sandbox,
        $trackPrompt
    )

    $reconcileStamp = [ordered]@{
        AGENTKIT_TIER    = $profileTiers['author']
        AGENTKIT_MODEL   = $reconcileConfig.Model
        AGENTKIT_EFFORT  = $reconcileConfig.Effort
        AGENTKIT_COMMAND = '/unfreeze-reconcile'
        AGENTKIT_PROFILE = 'author'
    }
    $trackStamp = [ordered]@{
        AGENTKIT_TIER    = $profileTiers['builder']
        AGENTKIT_MODEL   = $trackConfig.Model
        AGENTKIT_EFFORT  = $trackConfig.Effort
        AGENTKIT_COMMAND = '/unfreeze-track'
        AGENTKIT_PROFILE = 'builder'
    }

    if ($WhatIf) {
        $reconcileStampText = ($reconcileStamp.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' '
        $trackStampText = ($trackStamp.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' '
        Write-Output "$reconcileStampText codex $($reconcileArgs -join ' ')"
        Write-Output "$trackStampText codex $($trackArgs -join ' ')"
        return
    }

    foreach ($entry in $reconcileStamp.GetEnumerator()) { Set-Item -Path "Env:$($entry.Key)" -Value $entry.Value }
    & codex @reconcileArgs
    if ($LASTEXITCODE -ne 0) {
        throw "/unfreeze's reconcile phase (codex process 1 of 2, 'author' profile) exited $LASTEXITCODE - stopping before the track phase runs against a possibly-incomplete reconcile."
    }

    foreach ($entry in $trackStamp.GetEnumerator()) { Set-Item -Path "Env:$($entry.Key)" -Value $entry.Value }
    & codex @trackArgs
    exit $LASTEXITCODE
}

if (-not $commandProfiles.Contains($normalized)) {
    $known = (@($commandProfiles.Keys) + 'unfreeze' | Sort-Object | ForEach-Object { "/$_" }) -join ', '
    throw "No profile mapping for '/$normalized'. Known commands: $known. Pass --profile to codex directly for anything else."
}

$codexProfile = $commandProfiles[$normalized]
$selectedConfig = $profileConfig[$codexProfile]
$resolvedEffort = if ($Effort) { $Effort } else { $selectedConfig.Effort }

$codexInvocationArgs = @(
    '-m', $selectedConfig.Model,
    '-c', "model_reasoning_effort=$resolvedEffort",
    '-a', $selectedConfig.Approval,
    '-s', $selectedConfig.Sandbox
)
$codexInvocationArgs += $CodexArgs

# AGENTS.md's tier gate is told to resolve a Codex session's tier from its configuration
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
