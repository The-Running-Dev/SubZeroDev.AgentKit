---
name: autoupdate
description: Turn the AgentKit update-availability notice on or off, persisted to ~/.agent-kit-state/config.json. Usage - /autoupdate on|off
argument-hint: on|off
disable-model-invocation: true
---

<!-- companion:declared:start -->
**Per-repo companion:** `skills/autoupdate/SKILL-local.md`. Read it now, if it exists — an absent,
empty, or frontmatter-only file is no companion, and this file then stands alone.
It may override: `vocabulary`, `extra-steps`. It may never override anything in
[`.claude/COMPANIONS.md`](../../.claude/COMPANIONS.md) § *Never*, which is also where these categories are defined.
<!-- companion:declared:end -->

Toggle whether this machine-user is shown the AgentKit update-availability notice, by calling
`Get-AgentKitSkill.ps1 -SetAutoUpdate`. The setting persists to `~/.agent-kit-state/config.json`
and applies to every session on this machine from now on, not just this one — `README.md` §
*Update checks are automatic, and on by default* and `tools/Get-AgentKitSkill.ps1` own what the
notice is, when it fires, and what `-SetAutoUpdate` writes; neither is restated here.

## Read the argument

**$ARGUMENTS** must be `on` or `off` (case-insensitive). Anything else — empty, misspelled, extra
words — is refused: report the two valid forms and take no action.

## Resolve the kit root and run it

Resolve the kit install root per `AGENTS.shared.md` § *House conventions* → *Home-install
convention* (self-hosted checkout first, then `$env:AGENTKIT_HOME`, then `$HOME/.agent-kit`), then:

```powershell
& '<kit-root>/tools/Get-AgentKitSkill.ps1' -SetAutoUpdate <On|Off>
```

Capitalize the argument (`On`/`Off`) — the script's `-SetAutoUpdate` parameter is
`ValidateSet('On','Off')` and rejects any other casing.

## Report

State the new setting and the config path the script reports back. This changes the setting for
every session on this machine, not just this one — say so plainly when turning it off, since that
is the surprising direction.

## Never

- Never edit `~/.agent-kit-state/config.json` by hand. The script owns its shape.
- Never treat this as a one-session suppression — that is `/autoupdate-env`, not this command.

## Re-run

Idempotent. Setting the same value again reports the same result; the script always writes the
full desired state rather than toggling.
