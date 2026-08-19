# Installing the kit into a repository

You are an agent. The normal case: you are working **in the kit** and have been told to run it against a target repository. It also works in reverse — opened in the target, pointed at the kit. Either way this file is the procedure. Follow it in order.

**Installing is a reconciliation, not a copy.** A target repository that already has agent instructions has them for a reason, and those reasons are usually better informed than this kit's defaults — they were written against a real codebase. Where the kit and the target disagree, that is a finding to report, not a file to overwrite.

The kit's own `AGENTS.md` binds you while you do this. In particular: read completely before editing, present findings one at a time for sign-off, stage by named path, and do not write anything in phases 0–2.

---

## Phase 0 — Orient

Establish both ends before touching anything.

```powershell
# the kit
Get-ChildItem <kit-root> -Recurse -File | Where-Object FullName -notmatch '\\\.git\\'

# the target
git -C <target> rev-parse --absolute-git-dir --show-toplevel
git -C <target> status --short --branch
git -C <target> log -5 --oneline
```

- **Resolve the real repository root.** `git rev-parse --show-toplevel` is authoritative, not the path you were given. A junction, a symlink, or a Dropbox-synced duplicate means two paths address one repository — install once, at the resolved root, and say in your report which path that was. Installing "both" writes the same files twice and reports success twice.
- **Do not require a clean worktree.** Record what is dirty and leave it alone. Uncommitted work is the thing most likely to be destroyed by an install, and refusing to run is a worse answer than working around it.
- **If the target is not a git repository**, say so and stop. Almost everything the kit asserts — decision logs, slices, staged commits — assumes version control.

## Phase 1 — Classify

For every artifact the kit installs, assign exactly one state. Do not skip to reconciliation with the states half-assigned; the interesting cases are the ones you would otherwise notice late.

| State | Meaning | Handling |
|---|---|---|
| **Absent** | Nothing at that path | Create it |
| **Identical** | Byte-identical to the kit's copy | Skip silently |
| **Divergent** | Present, different content | Reconcile — phase 2 |
| **Occupied** | The path is used for something unrelated | Stop. Relocating is a decision, not a fix |

The artifacts:

| Artifact | Notes |
|---|---|
| `AGENTS.md` | The contract. Most often divergent |
| `CLAUDE.md` | Pointer to `AGENTS.md` in the kit's arrangement — but see below |
| `agent.md` | Lessons. Seeded, then pruned |
| `.claude/commands/<name>.md` | The stage commands, plus `install.md`. **Cores — the kit owns these outright**, so they are not classified against the target's copy at all; see below |
| `.claude/commands/<name>-local.md` | **The target's companions. Never an installed artifact, never classified, never written or deleted by anything here.** The kit ships none |
| `.claude/COMPANIONS.md` | The core/companion mechanism itself. Kit-owned outright, same as a core |
| `tools/*.ps1` | Reporting helpers, currently `Measure-Session.ps1`, `Wait-PullRequestCheck.ps1`, `New-DesignDocs.ps1`, `Sync-Kit.ps1`, `Test-GatesCache.ps1`, `Invoke-DoneHousekeeping.ps1`, `Test-DesignDrift.ps1`, `Test-Companion.ps1`, `Read-DesignState.ps1`, `Test-DesignState.ps1`, `Update-DesignProjection.ps1`, `Test-WriteSurface.ps1`, `Test-VerifyReport.ps1`. Root `tools/` is commonly occupied — classify the directory before writing into it, and stop if it holds something unrelated rather than sharing it |
| `templates/design/*.md` | Five seed design docs, written to `design/` in the target. Check phase 2 before creating the directory |
| `.github/ISSUE_TEMPLATE/*.md` | `bug.md`, `story.md`. **If the target already has templates, stop and report** — do not overwrite or merge. A repository with its own templates has a triage process, and replacing it silently changes how every future issue is filed |
| `codex/PROFILES.md` | **Skip by default**, and report it as skipped. Install only if the target shows evidence of Codex use — a `.codex/` directory, a profile reference, or the user saying so. Asking in every install is noise |

**A core command file is not reconciled.** `.claude/COMPANIONS.md` splits every command into a core the target never edits and an optional companion at `.claude/commands/<name>-local.md` that the target owns entirely. That removes the reconciliation for this class structurally rather than solving it again on every pass: a core installs or updates **outright**, with no proposal, no fork, and no phase 2. Read that file before running this one; it is the single home for the category vocabulary, the never-list, and the absence rule, and none of it is restated here.

Two states remain, and both come out of `Sync-Kit.ps1`'s report rather than being judged by eye:

- **`Unmigrated-Blocked`** — the target edited a core and has no companion for it. Nothing is overwritten. It carries into phase 3 as a fork whose recommended resolution is always the same: move the edit into `.claude/commands/<name>-local.md`, within the categories that core declares. This is a one-time migration, not a recurring reconciliation.
- **`Superseded`** — the target edited a core *and* has a companion for it, so the core was taken outright and the edit overwritten. Report it; do not treat it as needing a decision. Adopting a companion is the decision.

**On a re-install (`.claude/kit.json` already present), classify `.claude/commands/*.md`, `.claude/COMPANIONS.md` and `tools/*.ps1` by running `tools/Sync-Kit.ps1 -TargetRepo <target> -KitRoot <kit-root> -DryRun`, not by reading each file.** It diffs every kit-owned file against the sha the target was last synced from and reports Added/Updated (unmodified, safe to take), Superseded and Unmigrated-Blocked (the two core states above), Divergent-Skipped (a **non-command** kit-owned file the target edited — carry into phase 2 as a fork, same as any other divergence), Collision-Skipped (a new kit file whose name the target already used for something else), and RemovedUpstream (the kit deleted it upstream). Fold its report into phase 1's classification directly — an `Updated`/`Added`/`Superseded` row is **Identical-once-applied**, a `Divergent-Skipped`/`Collision-Skipped` row is **Divergent**, and `Unmigrated-Blocked` and `RemovedUpstream-Skipped` have no state in the table above and go into phase 3 as their own kinds of fork. **On a first install (no `.claude/kit.json` yet), skip it and classify by hand as usual** — everything is Absent, and the script needs a recorded sha to diff from that does not exist yet.

**Validate the split after any write to `.claude/commands/`:**

```powershell
pwsh <kit-root>/tools/Test-Companion.ps1 -TargetRepo <target>
```

Exit 1 names every core missing its declaration block and every companion overriding a category its core does not allow. Exit 2 means it could not evaluate — `.claude/COMPANIONS.md` absent or its table unreadable — and is not a pass.

`INSTALL.md` itself is **not** installed into targets. It is the kit's procedure, and a copy in the target is a copy that drifts.

**Record which kit commit was installed.** Write `.claude/kit.json` in the target:

```json
{ "source": "https://github.com/The-Running-Dev/SubZeroDev.AgentKit", "commit": "<kit HEAD sha>", "installed": "YYYY-MM-DD" }
```

The kit's commit **is** its version — a hand-maintained `VERSION` file would drift from the tree it claims to describe, and this one cannot. On a re-install, read the recorded commit first and report how far behind the target is:

```powershell
git -C <kit> log --oneline <recorded>..HEAD
```

That list is what the upgrade actually consists of. Without it, "is this repo current?" is answerable only by hashing every file, which is what the first three installs had to do.

**`branch` is an optional fourth field, written only by `/kit-sync`** (`.claude/commands/kit-sync.md`), recording which branch of the kit that command last synced from. Plain `/install` neither reads nor writes it. A `kit.json` without it is not stale — it just means `/kit-sync` has never run here.

**Two things under `.claude/` are not yours.** `settings.json`, `settings.local.json` and `launch.json` are the target's — report what is there and never write them; a tracked `settings.json` pins the model and permission mode deliberately.

**One exception, bounded to two events.** `tools/Measure-Session.ps1` runs as a `SessionEnd` hook and a `UserPromptSubmit` hook, which can only live in `settings.json`. Installing them is permitted under all of these, together:

- **Only the `hooks.SessionEnd` and `hooks.UserPromptSubmit` keys**, and only this script's two hooks. Every other key is untouchable — `permissions` and `model` especially, which are the deliberate pins the rule above exists to protect.
- **Propose the exact JSON and wait.** This is not covered by any carve-out; it is a write to a file that controls how the target's sessions behave.
- **If a hook already exists on either event, stop and report that event.** Do not append to it, do not merge into it. A second hook on one event is a behaviour the target did not ask for. The other event may still be installed, and saying which you skipped is the point.
- **Absent `settings.json`** may be created containing only these hooks, under the same sign-off.
- **Needs PowerShell 7 on `PATH`.** Check with `Get-Command pwsh`; if it is missing, skip the hooks, install the script, and say which you did.
- **`-Watch` must never exit non-zero.** It runs on every prompt, and exit 2 on `UserPromptSubmit` blocks the prompt *and erases what the user typed*. Every failure path in it exits 0 in silence. A change that can break that invariant makes it uninstallable, not merely buggy.

Nothing else about the target's configuration is yours, and this exception does not generalise to a third event later. It has been widened once, from one event to two, and that took a signed-off decision entry naming what it cost — which is the bar. Widening it again is a decision, not an install detail. `.claude/kit.json` **is** yours: it is this procedure's own record, written in phase 4. `.claude/worktrees/` holds full checkouts, **including copies of the very instruction files you are installing**. Classify against the repository root only. A glob that reaches into a worktree writes into a throwaway checkout and reports success.

**The seed is `templates/design/`; the kit's own `design/` is never installed.** The seed holds a brief template, three empty documents, and a decision log carrying only its heading, preamble and `## Open` section. The kit's `design/` holds the kit's own design and its decision entries, which are decisions about *building the kit* and mean nothing in a target. Copy from `templates/design/` and never from `design/`.

That split replaces a carve-out this file used to carry — install `90-decisions.md`'s heading but never its entries — which was the one place a straight file copy was wrong, and easy to miss because the file looked like a template. Separating the seed from the instance by directory makes a straight copy correct again, so there is no longer a rule to remember here. The hazard it guarded against is now a path, not a caveat.

## Phase 2 — Reconcile

Work each divergence into a proposal. Write nothing yet.

### `design/` — check the path before anything else

The kit installs its design docs at `design/` in the repository root. That default exists because **`docs/` is usually not free**: a documentation site rooted there makes `docs/design/` part of its build context, and a `COPY . .` in `docs/Dockerfile` bakes internal design documents into a published image. Root `design/` sidesteps that entirely, which is why it is the default rather than an option.

Two things still need checking:

- **Is `design/` already occupied?** Some repositories use it for design *assets* — mockups, source files, brand material. If so, stop. Sharing the directory is not a fix, and picking a different name is a decision, not a detail.
- **Does the target already have a home for long-form reasoning?** A `plans/`, `adr/`, `decisions/` or `rfc/` directory with real content means the question is not "where do the kit's files go" but "what is left for them to do". Say what `design/` adds that the existing directory does not, and how the two relate — a second home for the same kind of document is the duplication the kit's own contract forbids. If the honest answer is that it adds nothing, install the commands and skip the directory.

If you do relocate, **rewrite the path everywhere the kit names it, and find those files with a search rather than working from a list.** A list in this file will rot and the count will be wrong before the list is — `agent.md`, `AGENTS.md`, `README.md` and the command files all carry it, and a hand-maintained enumeration in this very file has already been wrong once.

Relocation has an expensive-to-reverse component: every cross-reference breaks if the directory moves again. Get sign-off and log it.

### `AGENTS.md` and `CLAUDE.md` — establish the direction first

The kit's arrangement is: `AGENTS.md` holds the contract, `CLAUDE.md` is a pointer. Some repositories invert it. **Both are correct**; the principle is one file with one answer, not which file it is.

**Work out which file holds content before touching either.** A file of a few hundred bytes that links to the other is a pointer, and a pointer is a deliberate arrangement, not an empty file waiting to be filled. Merging the kit's sections into one is the single most destructive thing this install can do.

- **Neither exists** — install the kit's `AGENTS.md`, and add a project identity section at the top: what the repository owns, what it does not, and its companions. Get that from the target's `README.md` and existing instructions rather than inventing it. `CLAUDE.md` becomes the pointer.
- **One holds content, the other is a pointer** — **keep the direction as it stands.** Install the kit's sections into the file that holds content and leave the pointer alone. Do not flip it to match the kit. If the pointer file states *why* it is a pointer, read that reason before proposing anything — at least one repository's pointer exists because an earlier mechanical copy rewrote nine real references into paths that do not exist.
- **One holds content, the other is absent** — present the fork: move the content into `AGENTS.md` and reduce the other to a pointer, or leave the content where it is and make `AGENTS.md` the pointer. Recommend keeping the existing direction; it is the smaller change and it is what the project's history refers to.
- **Both hold content** — stop and report. The target already has the failure the kit exists to prevent, and resolving it is the user's call, not a side effect of installing.

Merging into whichever file holds content: the kit's sections are the baseline; the target's project-specific content is preserved **verbatim**. Where both state a rule on the same subject, **the target's wins** — it was written against a real codebase — and you report the difference rather than silently resolving it. Where the target's rule is the *same* rule in different words, keep one and say which you dropped.

Never delete a rule you do not understand. An instruction with no obvious reason usually has an expensive one.

### `agent.md`

The kit ships this seeded with lessons harvested from other projects. It says so in its own header, and it says to delete what does not apply.

- **Absent** — install the seed, then **prune it as part of the install and propose the deletions.** The file loads into context every session, so a lesson kept for a stack the target does not use is a cost paid forever. A docs-only repository does not need the CI-permissions lesson; a repository with no container build does not need the image-digest one.
- **Present, with content** — **the target's file wins wholesale. Do not merge the seed into it.** Offer individual kit lessons only where one is both demonstrably absent and demonstrably applicable, one at a time. A lessons file that has been maintained is the most expensive artifact in the repository to have earned and the cheapest to dilute.
- **Present under another name** — same rule, and keep the target's name.

**Check provenance before offering any lesson back.** The kit's seed was harvested from real repositories, and some of those repositories are targets. Re-installing a lesson into the repository it came from re-imports that repo's own hard-won specifics in generalised, evidence-stripped form — and it will read as new, because the wording has changed. If a kit lesson describes something that already appears in the target's own file with more detail, it did not come from somewhere else; it came from here. Drop it silently and say so in the report.

### `.claude/commands/` and `tools/`

**First install:** copy every command and tool script in the kit, plus `.claude/COMPANIONS.md`. If the target already has a command of the same name, stop and report — a same-named command doing something else is a trap for whoever types it next. Rewrite the `design/` path inside them if phase 2 relocated it.

**Re-install:** this is `tools/Sync-Kit.ps1`'s report from phase 1, already computed. Nothing left to propose for the `Added`/`Updated`/`Superseded` rows — they apply in phase 4 by re-running the same command without `-DryRun`. The `Divergent-Skipped`, `Collision-Skipped`, `Unmigrated-Blocked` and `RemovedUpstream-Skipped` rows are what phase 3 asks about, one at a time.

**A relocated `design/` path is now an `Unmigrated-Blocked` command, not a `Divergent-Skipped` one**, and its resolution has changed with it. Rewriting the path inside nineteen command files was always a local edit the kit could never take back; under the split it belongs in each affected command's companion, under `document-map`, and the core stays the kit's. That is what makes a relocated target able to receive command updates at all — the case the 2026-08-05 sync entry recorded as latent and unfixed.

### Rules the target already states

The kit's `AGENTS.md` carries conventions harvested from several projects. If the target already states one of them, **do not add a second copy**. Report it as already-satisfied. Two copies of a rule is a promise they will diverge.

## Phase 3 — Report, then wait

Produce this, and **stop**:

```
## Installing <kit-root> → <resolved target root>

Absent (will create):     <paths>
Identical (skipping):     <paths>
Divergent (proposed):     <path> — <what differs, what I propose, why>
Occupied (blocked):       <path> — <what holds it>
Cores taken outright:     <paths> — no reconciliation; Superseded rows named separately
Unmigrated cores:         <path> — local edit, no companion; move it into <name>-local.md
Already satisfied:        <target rule> covers <kit rule>
Pruning from agent.md:    <lesson> — <why it cannot apply here>
Decisions needing you:    <the forks, one at a time, recommendation first>
Dirty files, untouched:   <paths from phase 0>
```

**An install is a reconciliation, so it ends in a decision, not a report** (`AGENTS.md`, *Working with me*). The block above is not the deliverable — closing with the questions is. Every divergence you listed becomes a question with a recommendation and the cost of each alternative.

Present the decisions **one at a time**. Do not batch them, and do not proceed on the ones you think are obvious while waiting on the rest — a later answer can change an earlier one. If nothing diverged, say the install is a no-op; do not invent a fork to have something to ask.

## Phase 4 — Apply

Only after sign-off.

1. **Re-check the target's state first.** Phase 0's snapshot is stale by now — a long reconciliation gives the user time to commit, branch, or edit the very file you are about to move. Re-run `git status --short --branch` and diff your source-of-truth for any moved content against `HEAD`, not against what you read in phase 0.
2. Write the approved files. Preserve UTF-8 and LF. **On a re-install, apply `.claude/commands/*.md`, `.claude/COMPANIONS.md` and `tools/*.ps1` by re-running `tools/Sync-Kit.ps1 -TargetRepo <target> -KitRoot <kit-root>` — the same call as phase 1, without `-DryRun`.** It applies every `Added`/`Updated`/`Superseded` file, advances the target's `syncedCommit`, and leaves every `Divergent-Skipped`/`Collision-Skipped`/`Unmigrated-Blocked` file untouched by design; write those by hand only where phase 3's sign-off approved it. Pass `-Force` only if a `RemovedUpstream` row was approved for deletion. **Never write a `-local.md` companion** — a companion is the target's, and an installer that authors one has written the repository's policy for it.
3. **Record every fork that had a real alternative** — the relocation, the `AGENTS.md`/`CLAUDE.md` direction, anything the target overrode, anything skipped. **Rejected alternatives included**; without them the next install relitigates the same choices, and the commonest question a re-install faces is "why is it set up this way here?"

   The log's home, in this order — the first that applies:

   1. **`design/90-decisions.md`**, if `design/` was installed.
   2. **The target's own slice-local decision log**, if it has one that is not an architecture ADR set.
   3. **A `Why it is installed this way` subsection** in whichever instruction file holds content, listing each fork as one line with its rejected alternatives compressed to a clause.

   **Never put install decisions into an architecture ADR set.** Different audience, different lifetime, and ADR numbers are usually cited across repositories — tooling setup does not belong among them.

   **Skipping `design/` does not skip this.** A repository that already has the design chain under other names is exactly the one where the reasoning is least obvious later, because the mapping is invisible from the file tree.
4. **Verify, with commands, not by recollection:**
   - **Nothing was lost in a move.** Every non-blank line of the file you moved content out of must appear in the file you moved it into. Diff it mechanically; do not eyeball it. Expect exactly the lines you deliberately changed, and be able to name each one.
   - **No rule appears twice.** Search the target for the distinctive phrase of each rule you added — not for the rule's topic. You are looking for your own duplicates, and you will have made some: this install's own verification caught two that careful authoring did not.
   - **No stale paths.** If you relocated anything, search for the old path. Hits in the decision log are correct; hits anywhere else are not.
   - **The core/companion split holds.** `pwsh <kit-root>/tools/Test-Companion.ps1 -TargetRepo <target>`, exit 0. A companion the target wrote during this install to resolve an `Unmigrated-Blocked` row is exactly what this catches when it overrides a category its core does not allow.
5. **Write `.claude/kit.json`**'s `commit` field with the kit's current HEAD sha and today's date — now, after the work succeeded, not before it. This is the whole-kit reconciliation marker and stays this phase's to write. If step 2 ran `Sync-Kit.ps1`, it has already written `syncedCommit` itself, scoped to what it actually synced — a separate field, not a second copy of this one.
6. `git -C <target> status --short` and `git diff --check`.
7. **Stage nothing and commit nothing.** Show what changed and let the user commit. The kit's own contract requires named-path staging, and an installer that commits for you is an installer that has staged something you did not read.

Report what was created, what was reconciled and how, and what remains for the user to decide.

---

## Re-running

Installing again upgrades. The classification in phase 1 is what makes it safe: an unchanged file is identical and skipped, and a file the target has since edited is divergent and reconciled with the target winning. **Never treat a re-install as a reset** — the target's edits since the last install are the accumulated knowledge the kit does not have.

**Command files are the exception, and it is the point of the split.** A core is the kit's outright, so a re-install takes it without asking; the target's accumulated knowledge for a command lives in its companion, which no re-install reads or writes. The one case that still stops is `Unmigrated-Blocked` — an edit that has not moved there yet — and it stops precisely so the knowledge is not lost on the way.

**Open by reading `.claude/kit.json` and naming the gap.** `git -C <kit> log --oneline <recorded>..HEAD` is the upgrade, stated as commits rather than as a diff of files. Report it before phase 1, because it tells the user what they are about to get. Update the recorded commit only in phase 4, after the install actually succeeds — a version marker written ahead of the work claims an upgrade that did not happen.

## What installing must not do

- Not commit, push, or open a pull request.
- Not touch the target's existing documentation, source, or configuration beyond the artifacts listed in phase 1.
- Not reformat or "improve" prose it is not otherwise changing.
- Not run `git add -A`, `git add .`, or a bare-directory add.
- Not delete anything without explicit approval, including lessons it proposes pruning.
- Not install `codex/PROFILES.md` into a repository that has never been used with Codex.
- Not write, rewrite, or delete any `.claude/commands/*-local.md`. Proposing what one should contain to clear an `Unmigrated-Blocked` row is this procedure's job; authoring it is the target's.
