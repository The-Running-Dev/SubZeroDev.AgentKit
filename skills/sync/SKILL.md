---
name: sync
description: Update the machine-wide AgentKit checkout to a stable release. Usage - /sync, or /sync <version>
argument-hint: "[version]"
disable-model-invocation: true
---

Update the machine-wide kit. That is the whole upgrade: every command, script and `AGENTS.shared.md` runs from that one checkout, so no repository needs changing for a new release to reach it. The files a repository does hold — `design/`, the pointer section, the `commit-msg` hook — are created by the commands that use them (`tools/ensure-project-files.ts`) and are the repository's own afterwards.

## Resolve the installed kit

Resolve the kit root from `AGENTKIT_HOME`, otherwise the home directory's `.agent-kit`. The canonical source is `https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git`.

- If absent, clone that source with Git into the kit root.
- If present, run `git -C "<kit-root>" remote get-url origin` and require the canonical source before executing anything from it.
- Run `node "<kit-root>/setup.ts"`, adding `--version "<requested-version>"` only when the user supplied a version. Substitute absolute paths and quote them for the calling shell.
- If the installed checkout predates `setup.ts`, use README's temporary bootstrap clone procedure. Do not advance the old checkout by hand.

The default selects the newest valid stable `vYYYY.MM.DD` tag, including an optional `.N` suffix. It never falls back to `main`; that branch requires an explicit request.

## This repository

Write nothing here. Where the current repository still holds files an older kit copied into it — `.claude/kit.json`, `skills/*/SKILL-local.md`, a kit-owned `tools/*.ps1` — name them in the report: `/install` reconciles and deletes them on sign-off, and `/install-all` handles many repositories at once.

## Report

In the `AGENTS.shared.md` § *Reporting* shape:

- The version selected, the commit it resolved to, and whether `<kit-root>` was cloned fresh or already present.
- If setup cannot select or check out a version: say so, with its error, and stop.
- Leftovers found in this repository, if any.

## Never

- Force-push, reset, or discard uncommitted work in `~/.agent-kit`. It is shared across every repository that runs this command.
- Run `main` implicitly. A stable tag is the default; `main` is an explicit version request.
- Write, commit or push anything in the current repository.

## Re-run

Meant to be run routinely. A re-run selects the current newest stable release again and lets `node setup.ts` update the existing checkout safely.
