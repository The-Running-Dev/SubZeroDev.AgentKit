---
name: sync
description: Update the machine-wide AgentKit checkout at a stable release, then run INSTALL.md's reconciliation against this repository. Usage - /sync, or /sync <version>
argument-hint: "[version]"
disable-model-invocation: true
---

Update the machine-wide kit, then reconcile it into this repository — the two steps `/install` needs, done back to back, without requiring a branch checkout in the target.

**This repository must be the target, not the kit.** If this tree contains `INSTALL.md` and `skills/design/SKILL.md`, it is the kit itself; stop and say so rather than cloning the kit into itself.

## Resolve the installed kit

Resolve the kit root from `AGENTKIT_HOME`, otherwise the home directory's `.agent-kit`. The canonical source is `https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git`.

- If absent, clone that source with Git into the kit root.
- If present, run `git -C "<kit-root>" remote get-url origin` and require the canonical source before executing anything from it.
- Run `node "<kit-root>/setup.ts"`, adding `--version "<requested-version>"` only when the user supplied a version. Substitute absolute paths and quote them for the calling shell.
- If the installed checkout predates `setup.ts`, use README's temporary bootstrap clone procedure. Do not advance the old checkout by hand.

The default selects the newest valid stable `vYYYY.MM.DD` tag, including an optional `.N` suffix. It never falls back to `main`; that branch requires an explicit request. Rollback to a release with only the old front door needs `pwsh`; setup refuses before checkout when it is unavailable.

## Reconcile

Read `INSTALL.md` from `<kit-root>` and follow it exactly, with `<kit-root>` as `<kit-root>` and this repository as `<target>`. It is the same procedure `/install` runs — this command only gets the kit there first. Do not restate its phases here; execute them, and stop at its phase 3 report as instructed.

**One addition to phase 4's `.claude/kit.json` write:** record the selected version, alongside the existing `source`, `commit` and `installed` fields:

```json
{ "source": "<source>", "version": "<selected version>", "commit": "<kit HEAD sha>", "installed": "YYYY-MM-DD" }
```

That field is diagnostic only; it does not override the stable default on a later run.

## Report

Everything `INSTALL.md` phase 3 already requires, plus:

- Selected version and whether `<kit-root>` was cloned fresh or already present
- If setup cannot select or check out a version: say so, and stop there — do not fall through to reconciliation against an unknown checkout

## Never

- Force-push, reset, or discard uncommitted work in `~/.agent-kit`. It is shared across every repository that runs this command.
- Run `main` implicitly. A stable tag is the default; `main` is an explicit version request.
- Write, rewrite, or delete this repository's own `skills/*/SKILL-local.md` files, where any exist.
- Commit to, or push to, *this* repository's default branch. Delivery is `INSTALL.md` phase 4 step 8's feature branch and pull request, unchanged by syncing from a branch — this command adds nothing to it and does not restate it.

## Re-run

Meant to be run routinely. A re-run selects the current newest stable release again and lets
`node setup.ts` update the existing checkout safely; reconciliation still runs against the target
exactly as `/install` describes there.
