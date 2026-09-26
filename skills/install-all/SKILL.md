---
name: install-all
description: One-time migration - delete each kit-owned file a repository still carries from before home install, only where its exact content matches something the kit actually shipped; ensure the pointer section; open a pull request per repository. Usage - /install-all (dry run), /install-all --apply, or /install-all SubZeroDev.GameEngine,SubZeroDev.Platform --apply
argument-hint: "[repo name[,repo name...]] [--apply]"
disable-model-invocation: true
---

<!-- companion:declared:start -->
**Per-repo companion:** `skills/install-all/SKILL-local.md`. Read it now, if it exists — an absent,
empty, or frontmatter-only file is no companion, and this file then stands alone.
It may override: `extra-steps`, `tightened-authorization`. It may never override anything in
[`.claude/COMPANIONS.md`](../../.claude/COMPANIONS.md) § *Never*, which is also where these categories are defined.
Without asking, it: `branch-commit-push-pr`.
<!-- companion:declared:end -->

Home install (`INSTALL.md` phase 4) stopped copying kit-owned files into a target repository at
all — `AGENTS.shared.md`, `skills/<name>/SKILL.md`, `.claude/COMPANIONS.md` and `tools/*.ps1` are
read from the installed kit now, never from a per-repo copy. Every `SubZeroDev.*` repository
installed before that change still carries a copy of each. **This command is the one-time
migration that removes them** — and only them: `skills/<name>/SKILL-local.md` companions are the
target's own and are never touched, in this command or any other.

Unlike the old `/install-all`, which ran `INSTALL.md`'s ordinary reconciliation across every
sibling repository, this command's job is narrower and runs, per repository, **exactly once**:
after a clean pass a repository has nothing left of the old copy-in model to migrate, and re-running
finds nothing to do (*Re-run*).

**Arguments**, in either order: an optional comma-separated repo-name list (as `/install-all`
always took it — see *Phase 0*), and the literal `--apply` flag. Bare (`/install-all`) is a **dry
run** across every discovered repository — it reports exactly what it would delete and what it
refuses to delete, and writes, commits, pushes and opens nothing. `--apply` is what actually does
those things. This is the house convention for a destructive operation (`AGENTS.shared.md` §
*House conventions*: "gate on an explicit flag, not a prompt") applied to a run that touches
eighteen repositories at once rather than one.

## Phase 0 — Discover

```powershell
$kitRoot = git rev-parse --show-toplevel
Get-ChildItem (Split-Path $kitRoot -Parent) -Directory -Filter 'SubZeroDev.*'
```

Run this from the repository that holds the installed kit; `$kitRoot` is that repository's
resolved Git root, and it is also the kit history Phase 1's check reads from.

- Drop the kit itself.
- **Resolve every candidate's real root** with `git -C <candidate> rev-parse --show-toplevel`
  before adding it to the list. Two paths resolving to the same root — a junction, a symlink, a
  Dropbox-synced duplicate — are one repository; keep the first, report the rest as skipped
  duplicates.
- **Not a git repository** — report and skip it. A repository with no history to have received a
  copy from has nothing for this command to migrate.
- Order: the explicit list in `$1` if given, else alphabetical.

## Phase 1 — Per target, classify the copies

Check the target for each of these, present or absent:

- `AGENTS.shared.md`
- `skills/*/SKILL.md` — the core files. **Never `skills/*/SKILL-local.md`** — a companion was never
  copied by any prior install, so it is never a candidate here, and this command does not open it,
  hash it, or report on it.
- `.claude/COMPANIONS.md`
- `tools/*.ps1`

For each one **present** in the target, ask whether its exact content was ever, at any point,
actually shipped by the kit — not whether it matches the kit's *current* copy, since a target
installed two years ago legitimately carries an older one:

```powershell
$blobSha = git hash-object <target-file>
git -C $kitRoot cat-file -e $blobSha 2>$null
```

- **Exit 0 — Deletable.** That exact byte content exists as a blob object somewhere in the kit's
  own git history, which is the kit's only record of what it ever released (`.claude/kit.json`'s
  `commit` field already treats a git sha as the kit's version; a blob's hash needs nothing more to
  say which commit shipped it). Safe to delete — nothing is lost, because the kit itself still
  holds this content, reachably, forever.
- **Anything else — refuses to delete.** The kit's history does not account for this content: a
  target's own edit to what was once a copy, or hand-authored content that happens to sit at a
  copied file's path. Report the path and the reason, and leave it in place. Deleting content this
  command cannot prove the kit once shipped is not a call it gets to make unasked
  (`AGENTS.shared.md` § *Hard rules*: "No deletion without approval, including proposed prunes" —
  the same principle `INSTALL.md`'s `agent.md` handling already applies).

**A repository holding none of the four globs is already migrated.** Report it as such and move to
the next target — this is the expected end state, not an error.

## Phase 2 — Ensure the pointer section

Run `INSTALL.md`'s own *The pointer section* procedure (phase 2) against the target, unmodified —
same direction rules for `AGENTS.md`/`CLAUDE.md`, same resolution-instruction requirement, same
stop condition. Do not restate that procedure here; a second copy is the one that goes stale.

- **Already correct** — report Already-satisfied.
- **Missing or stale** (absent, or still carrying an earlier install's literal resolved path
  instead of the resolution instruction) — write or update it, the same as an ordinary `/install`
  would.
- **Ambiguous direction** — both `AGENTS.md` and `CLAUDE.md` hold content, or neither does and
  there is no existing project-identity section to anchor one — report it under *Needs a decision*
  for that repository and move on **without** writing a pointer section there. This does not block
  Phase 1's deletions for the same repository; the two are independent writes; leaving one blocked
  is not a reason to leave the other undone.

## Phase 3 — Apply (only under `--apply`)

Everything below is skipped entirely on a dry run; Phase 4's report is produced from Phase 1 and
Phase 2's classification either way.

1. **Stage exactly the Deletable paths from Phase 1, by named path** — `git rm <path>` for each,
   never `git add -A`, `git add .`, or a bare-directory add. Also stage the pointer-section edit
   from Phase 2, if one was written.
2. **Run the companion validator and the write-surface guard, the same as the old `/install-all`
   did, on the same per-target boundary:**

   ```powershell
   pwsh ./tools/Test-Companion.ps1 -TargetRepo <target>
   pwsh ./tools/Test-WriteSurface.ps1 -TargetRepo <target>
   ```

   `Test-WriteSurface.ps1`'s defaults already carry this command's exact surface: `skills/`,
   `tools/` and `.claude/COMPANIONS.md` as delete-only (a write there that is not a deletion is out
   of surface), `AGENTS.md`/`CLAUDE.md` as ordinarily writable for the pointer section. **Exit 1 or
   exit 2 from either aborts that target's apply** — do not commit or push a target the guard could
   not confirm, or found something outside what this migration is allowed to touch. Record it under
   *Aborted* in the phase 4 report and continue to the next target.
3. **Commit, push a feature branch, and open a pull request** — the one place this command departs
   from the general "no separate ask" delegation's usual shape (`AGENTS.shared.md` § *Git and
   delivery*): here the pull request is opened **per repository**, not per session, and that is
   this command's own carve-out of the general rule, not a session-level exception. Commit message
   states plainly that this is the copy-removal migration and names the repository. The pull
   request body is Phase 1 and Phase 2's findings for that repository — every path deleted, every
   path refused and why, and the pointer-section result — not a placeholder deferring to `/pr`.

## Phase 4 — One consolidated report, then stop

Per target, in the order run:

```
## <repo>
Deleted:            <paths> — content matched the kit's own history
Refused:            <path> — <why: local edit / unaccounted-for content>
Already migrated:   <none of the four globs present>
Pointer section:    <applied / already correct / needs a decision>
Needs a decision:   <AGENTS.md/CLAUDE.md direction ambiguous — recommendation>
Aborted:            <target> — companion validator or write-surface guard, exit code
Branch / PR:        <link, or "dry run — nothing written">
```

Then one summary line: how many repositories are already migrated, how many were fully migrated
this run, how many have at least one refused file or a pointer-section decision pending, and how
many were aborted.

**On a dry run, this report is the deliverable** (`AGENTS.shared.md` § *Verification*: "a schema or
validator change is not done until it has rejected something" — the refused-file list is this
migration's own proof that it can tell a real copy from an edited one, before it is ever pointed at
eighteen repositories with `--apply`).

## Re-run

**Idempotent by content, not by a marker file.** Phase 1's check is "is this glob present, and does
it hash-match the kit's history" — a repository with nothing left under the four globs has nothing
to migrate and reports Already migrated, whether that is because a prior `--apply` run cleaned it
up or because the repository never carried a copy in the first place. There is no separate "have I
run here before" state to go stale or to reset by hand.

A file left behind under *Refused* stays refused on every subsequent run until the target's own
tree resolves it — by the target committing over it with kit-matching content, or by a person
deleting it by hand — the same as any other unresolved fork in this kit never gets guessed at
twice.

## What must not happen, in any target

- **No deletion of anything Phase 1's hash check did not confirm the kit's own history contains.**
  A near-miss is not a match; there is no partial-credit reconciliation here, only Phase 1's exact
  test.
- **No write, read for classification, or report on `skills/*/SKILL-local.md`**, in any target. A
  companion was never copied and is not this command's concern.
- No `git add -A`, `git add .`, or bare-directory add.
- No write to a target's `settings.json`, `settings.local.json`, `launch.json`, or `.claude/kit.json`
  — this command does not run `INSTALL.md`'s reconciliation and touches none of the per-repo files
  that procedure owns, beyond the pointer section named above.
- **No write to a target's `.git/hooks/`**, including the `commit-msg` hook `INSTALL.md` phase 1
  installs. `tools/Test-WriteSurface.ps1` reads `git status`, which does not report writes inside
  `.git/` at all, so this is the one artifact whose install this command's own guard cannot check —
  and an unattended pass does not write what it cannot verify it wrote. Report it as skipped;
  `/install` is where it is installed, attended.
- **No commit, push, or pull request on a dry run** — `--apply`'s absence means exactly that nothing
  is written, not "written but not pushed."
