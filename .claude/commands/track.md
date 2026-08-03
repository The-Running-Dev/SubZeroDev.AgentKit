---
description: Sync design/ into GitHub issues and milestones. Idempotent - safe to re-run.
argument-hint: [milestone name]
---

Reconcile `design/` against this repository's GitHub tracker. This command is the kit's single home for GitHub writes, and the authorization carve-out that permits them is in `AGENTS.md`, *Tracking work* — read it before writing anything.

Re-running must be a no-op when nothing has changed. That is the property that makes this safe to run often, and it is the first thing to get right.

## Before anything

```powershell
gh auth status
gh repo view --json nameWithOwner,owner,hasIssuesEnabled,viewerPermission
```

- **Only write to a repository the user owns** and has push permission on. Stop otherwise.
- If issues are disabled, stop and say so.
- If the remote is not the repository you think it is, stop.

## What syncs

### Slices → issues

For each `## S<n> — <name>` in `design/30-slices.md`:

- Search existing issues, **open and closed**, for a title beginning `S<n> —`. A closed issue means the slice is done — do not reopen it and do not open a second one.
- If none exists, open one titled `S<n> — <name>` with the slice's `Delivers`, `Acceptance` and `Out of scope` in the body, and a line pointing at `design/30-slices.md`.
- If one exists and the slice's acceptance criteria have changed, **report the difference — do not edit the issue.** A slice whose criteria moved after work started is a design change, and the user decides whether the issue or the doc is wrong.

`design/30-slices.md` stays authoritative for what a slice *is*. The issue tracks whether it is *done*.

### Open items → issues

For each bullet under `## Open` in `design/90-decisions.md`:

- Title from the bolded lead sentence. Body is the full bullet.
- Match on title to avoid duplicates.
- After opening the issue, **remove the bullet from `## Open`** and say you did. That section exists so items do not rot; once an item is tracked, leaving it in both places is the duplication this kit's contract forbids.
- An item that is a *decision* rather than a *todo* does not belong in an issue. Leave it and say why.

### Milestone

`$1` names the milestone; with no argument, do not invent one — ask.

**Creating a milestone needs explicit approval.** Propose the name and which issues would attach, then wait. Milestones are structural and few; issues are cheap and many, which is why only the latter is carved out.

## Labels

Use `slice` and `open` if they exist. Create them if missing — say that you did. Do not invent a wider taxonomy.

## Projects

GitHub Projects v2 needs the `project` token scope, which `repo` does not include. If `gh project list --owner <owner>` fails on scope, **say so and stop** — do not work around it. The fix is the user running `gh auth refresh -s project` in an interactive terminal; you cannot complete an OAuth flow.

## Report

- Issues opened, with numbers and titles
- Issues that already existed, skipped
- Slices whose criteria drifted from their issue
- Open items removed from `90-decisions.md`
- Anything skipped, and why

## Never

- Close an issue. Work being finished is not something this command can observe.
- Comment on, edit, or label an issue opened by someone else.
- Write to a repository the user does not own.
- Delete a milestone or a label.
