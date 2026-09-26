---
name: sync
description: Update the machine-wide AgentKit checkout at a stable release, then run INSTALL.md's reconciliation against this repository. Usage - /sync, or /sync <version>
argument-hint: "[version]"
disable-model-invocation: true
---

<!-- companion:declared:start -->
**Per-repo companion:** `skills/sync/SKILL-local.md`. Read it now, if it exists — an absent,
empty, or frontmatter-only file is no companion, and this file then stands alone.
It may override: `extra-steps`, `tightened-authorization`. It may never override anything in
[`.claude/COMPANIONS.md`](../../.claude/COMPANIONS.md) § *Never*, which is also where these categories are defined.
Without asking, it: `branch-commit-push-pr`, `merge-when-green`.
<!-- companion:declared:end -->

Update the machine-wide kit, then reconcile it into this repository — the two steps `/install` needs, done back to back, without requiring a branch checkout in the target.

**This repository must be the target, not the kit.** If this tree contains `INSTALL.md` and `skills/design/SKILL.md`, it is the kit itself; stop and say so rather than cloning the kit into itself.

## Resolve the installed kit

```powershell
$kitHome = if ($env:AGENTKIT_HOME) { $env:AGENTKIT_HOME } else { Join-Path $HOME '.agent-kit' }
$source = 'https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git'
```

- **Absent** — clone the canonical source, then run the checked-out bootstrap:

  ```powershell
  git clone $source $kitHome
  & (Join-Path $kitHome 'setup.ps1') -Version $1
  ```

- **Present** — confirm it is a checkout of the canonical source before running anything from it:

  ```powershell
  $origin = (git -C $kitHome remote get-url origin).Trim()
  if ($origin -ne $source) { throw "'$kitHome' has origin '$origin', not '$source'." }
  & (Join-Path $kitHome 'setup.ps1') -Version $1
  ```

`$1` is an optional version. With no argument, `setup.ps1` selects the newest valid stable `vYYYY.MM.DD` tag, including an optional `.N` suffix. It never selects `main` as a fallback; pass `main` explicitly only for that opt-in. If the selected release predates `setup.ps1`, stop and report that it needs a post-front-door release to perform the rollback.

## Reconcile

Read `INSTALL.md` from `$kitHome` and follow it exactly, with `$kitHome` as `<kit-root>` and this repository as `<target>`. It is the same procedure `/install` runs — this command only gets the kit there first. Do not restate its phases here; execute them, and stop at its phase 3 report as instructed.

**One addition to phase 4's `.claude/kit.json` write:** record the selected version, alongside the existing `source`, `commit` and `installed` fields:

```json
{ "source": "<source>", "version": "<selected version>", "commit": "<kit HEAD sha>", "installed": "YYYY-MM-DD" }
```

That field is diagnostic only; it does not override the stable default on a later run.

## Report

Everything `INSTALL.md` phase 3 already requires, plus:

- Selected version and whether `$kitHome` was cloned fresh or already present
- If setup cannot select or check out a version: say so, and stop there — do not fall through to reconciliation against an unknown checkout

## Never

- Force-push, reset, or discard uncommitted work in `~/.agent-kit`. It is shared across every repository that runs this command.
- Run `main` implicitly. A stable tag is the default; `main` is an explicit version request.
- Write, rewrite, or delete this repository's `skills/*/SKILL-local.md`. They are the reason a routine sync can take every core outright; a sync that edited them would be reconciling the very thing the split moved out of its way.
- Commit to, or push to, *this* repository's default branch. Delivery is `INSTALL.md` phase 4 step 8's feature branch and pull request, unchanged by syncing from a branch — this command adds nothing to it and does not restate it.

## Re-run

Meant to be run routinely. A re-run selects the current newest stable release again and lets
`setup.ps1` update the existing checkout safely; reconciliation still runs against the target
exactly as `/install` describes there.
