---
name: autoupdate-env
description: Show the exact command to disable or restore the AgentKit update notice for one shell session, via AGENTKIT_AUTO_UPDATE. Usage - /autoupdate-env on|off
argument-hint: on|off
disable-model-invocation: true
---

<!-- companion:declared:start -->
**Per-repo companion:** `skills/autoupdate-env/SKILL-local.md`. Read it now, if it exists — an
absent, empty, or frontmatter-only file is no companion, and this file then stands alone.
It may override: `vocabulary`, `extra-steps`. It may never override anything in
[`.claude/COMPANIONS.md`](../../.claude/COMPANIONS.md) § *Never*, which is also where these categories are defined.
<!-- companion:declared:end -->

Emit the exact command to set `AGENTKIT_AUTO_UPDATE` for the current shell session — the override
`Get-UpdateNotice` (`tools/Get-AgentKitSkill.ps1`) checks before it ever reads
`~/.agent-kit-state/config.json`, so it wins over whatever `/autoupdate` last set. It is scoped to
one environment on purpose: a process's own environment variable, not a file, so it is gone the
moment that shell closes and never touches another session on the machine (`README.md` §
*Update checks are automatic, and on by default*).

## Why this command only emits, never sets

A tool call run by this agent does not keep shell state between calls — each command is its own
process, so running `$env:AGENTKIT_AUTO_UPDATE = '0'` as a tool call would be invisible to the very
next command in this same session. The only shell that keeps the variable for the length of a
session is the user's own interactive terminal. So this command's job is to hand back the exact
line to run there — the same pattern `/tune` uses for the same reason (`skills/tune/SKILL.md`,
*Emit; do not execute*).

## Read the argument

**$ARGUMENTS** must be `on` or `off` (case-insensitive). Anything else is refused: report the two
valid forms and take no action.

## Emit

- **off** — suppress the notice for the rest of this shell session:

  ```powershell
  $env:AGENTKIT_AUTO_UPDATE = '0'
  ```

- **on** — clear the override and fall back to whatever `/autoupdate` (or its default, on) has set:

  ```powershell
  Remove-Item Env:AGENTKIT_AUTO_UPDATE -ErrorAction SilentlyContinue
  ```

`Get-UpdateNotice` matches `^(0|off|false|no)$` case-insensitively, so `0`, `off`, `false`, or `no`
all disable it — `0` above is one valid form, not the only one.

## Report

Hand back the one line above for the requested direction, and say plainly that it applies only to
the shell it is run in — not this machine, not this repository, and not a value `/autoupdate` can
see or change.

## Never

- Never run the `$env:` assignment as a tool call in this session and report it as done — it would
  not survive to the next command, and reporting it as if it had is a false completion claim
  (`AGENTS.shared.md` § *Verification*).
- Never write to `~/.agent-kit-state/config.json`. That file is `/autoupdate`'s, not this
  command's.

## Re-run

Stateless. Re-running with the same argument emits the same line; nothing here is stored between
runs.
