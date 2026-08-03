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
| `.claude/commands/*.md` | The stage commands, plus `install.md` |
| `design/*.md` | Five design docs. Check phase 2 before creating the directory |
| `.github/ISSUE_TEMPLATE/*.md` | `bug.md`, `story.md`. **If the target already has templates, stop and report** — do not overwrite or merge. A repository with its own templates has a triage process, and replacing it silently changes how every future issue is filed |
| `codex/PROFILES.md` | **Skip by default**, and report it as skipped. Install only if the target shows evidence of Codex use — a `.codex/` directory, a profile reference, or the user saying so. Asking in every install is noise |

`INSTALL.md` itself is **not** installed into targets. It is the kit's procedure, and a copy in the target is a copy that drifts.

**Two things under `.claude/` are not yours.** `settings.json`, `settings.local.json` and `launch.json` are the target's — report what is there and never write them; a tracked `settings.json` pins the model and permission mode deliberately. `.claude/worktrees/` holds full checkouts, **including copies of the very instruction files you are installing**. Classify against the repository root only. A glob that reaches into a worktree writes into a throwaway checkout and reports success.

**`90-decisions.md` is the kit's own decision log.** Its entries are decisions about building the kit and mean nothing in a target. Install the heading, the preamble, and the `## Open` section — **never the entries**. The target's log starts empty and gets the decisions this install makes. This is the one artifact where a straight file copy is wrong, and it is easy to miss because the file looks like a template.

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

### `.claude/commands/`

Copy every command in the kit. If the target already has a command of the same name, stop and report — a same-named command doing something else is a trap for whoever types it next. Rewrite the `design/` path inside them if phase 2 relocated it.

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
2. Write the approved files. Preserve UTF-8 and LF.
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
5. `git -C <target> status --short` and `git diff --check`.
6. **Stage nothing and commit nothing.** Show what changed and let the user commit. The kit's own contract requires named-path staging, and an installer that commits for you is an installer that has staged something you did not read.

Report what was created, what was reconciled and how, and what remains for the user to decide.

---

## Re-running

Installing again upgrades. The classification in phase 1 is what makes it safe: an unchanged file is identical and skipped, and a file the target has since edited is divergent and reconciled with the target winning. **Never treat a re-install as a reset** — the target's edits since the last install are the accumulated knowledge the kit does not have.

## What installing must not do

- Not commit, push, or open a pull request.
- Not touch the target's existing documentation, source, or configuration beyond the artifacts listed in phase 1.
- Not reformat or "improve" prose it is not otherwise changing.
- Not run `git add -A`, `git add .`, or a bare-directory add.
- Not delete anything without explicit approval, including lessons it proposes pruning.
- Not install `codex/PROFILES.md` into a repository that has never been used with Codex.
