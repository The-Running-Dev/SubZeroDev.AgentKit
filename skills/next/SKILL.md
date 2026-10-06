---
name: next
description: Build the plan — take the next unfinished slice through to merge, then keep going until the plan is done or something genuinely blocks
argument-hint: "[optional: a slice id to start from, or 'one' to stop after a single slice]"
disable-model-invocation: true
---

Build `design/30-slices.md` to completion. **Do the work; do not describe it.** Each slice goes from code to merged pull request, then the next slice starts, in this same session. Stop only when the plan is finished or on a genuine blocker (`AGENTS.shared.md` § *When to stop*). Never end with "run /next again" or "start a fresh session" — that is the failure this command exists to remove.

With `$1` set to a slice id, start there. With `$1` set to `one`, stop after one slice.

## 0. Start clean

- `git status --short --branch`. Uncommitted work that is not yours: leave it, never stage, discard or stash it, and mention it in the report. It rides across every branch switch, so the files it touches are guarded for the whole run (step 2).
- If the current branch's pull request has merged, run `node tools/invoke-housekeeping.ts --repo-root .`: it switches to the default branch, pulls, and deletes every branch confirmed merged. It never stashes: uncommitted work rides across the switch untouched, and if git refuses the switch because that work would be overwritten, the run carries on from `origin/<default branch>` (step 2) and names the files in the report. Anything it escalates (`Escalate`) is left alone and named in the report; it does not stop the run.

## 1. Pick the slice

Run `node tools/get-next-slice.ts --repo-root .` (add `--slice $1` when `$1` is a slice id, on the first pass only). It fetches, reads the plan as `origin/<default branch>` has it — never the working copy, so a branch carrying an unmerged `Status: done` or a local default branch a failed pull left behind cannot decide what is finished — and returns one `State`. Act on it; do not re-derive it from the file:

- **`Resume`** — work from an earlier run is in flight: an open pull request (`PullRequest`), or a branch with no pull request yet (`Branch`), with commits or, if the run stopped before its first commit, without. Check out `Branch` (step 2) and continue: from step 3 if its work is complete, otherwise finish it in step 2 first. `OwnFiles` are that run's uncommitted edits: carry on with them. `AGENTS.shared.md` § *Git and delivery* applies: continue that branch, never a new one.
- **`Start`** — build `Slice` from `Base` in step 2.
- **`Finished`** — the plan is done: reconcile the design (step 7), then report and stop.
- **`Blocked`** — `Detail` says why (a failed fetch with git's error, a dependency cycle or gap, two branches or two open pull requests for one slice, `gh` unavailable). Report it and stop.

The rule it applies, for reading the plan by hand: a slice is a `## S<n>` heading and the lines under it; the next is the first, in document order, whose `Status:` is not `done` and whose `Depends on:` slices are all `done`; a slice with no `Status:` line is not done. Slices named in a `## Landed` table, or any other index of slices retired by an earlier version of the kit, are history: they count as `done`, and none is ever rebuilt.

## 2. Build it

- Branch in this worktree: `git switch -c slice/S<n>-<short-name> <Base>` for `Start`, `git switch <Branch>` for `Resume`. If git refuses the switch because uncommitted work would be overwritten, that is a blocker: stop and name the files.
- `GuardedFiles` from step 1 are someone else's work in progress, guarded for the whole slice: never stage, commit, revert or reformat them. If the slice has to change one of them, that is a blocker: stop and name the file, rather than mixing that work into the slice. Every other file you change is the slice's: `get-next-slice.ts` recorded what was already dirty when the slice started, so after an interruption it hands your edits back as `OwnFiles` rather than guarding them.
- Read the slice, `design/20-contract.md`, and the parts of `design/10-design.md` it touches. Read the code you are about to change in full.
- For each acceptance criterion, write a test that fails first where the criterion can be tested, then implement until it passes. Stay inside the slice's `Out of scope:` line.
- Where the code and the design disagree, do what works, keep going, and note it for the pull request (`AGENTS.shared.md` § *The design is the spec*).
- Set the slice's `Status:` line to `done` in `design/30-slices.md` in this same branch.
- Record the slice's decisions in `design/90-decisions.md` in this same branch: one entry for each material-ambiguity call (`AGENTS.shared.md` § *When to stop*) and each place the slice deliberately departs from the design. Ordinary implementation choices get no entry, and a slice with no such decision adds none. Each entry goes directly above the newest existing `### ` entry (at the end of the file when there is none), in the log's own shape:

  ```
  ### <YYYY-MM-DD> — S<n>: <the decision, in one line>
  Context: <what in the design or the code left it open>
  Chosen: <what was built>
  Rejected: <each reading not taken, and why>
  ```

  Never edit or remove an existing entry. Change nothing else in `design/`.

## 3. Check it locally

Run the repository's gates: the steps marked `# verification: true` in `.github/workflows/*.yml` (`node tools/test-gates-cache.ts --repo-root .` caches that list), or, where none are marked, the test suite, linter and type checker the repository uses. Fix failures before pushing. A gate that cannot run here is named as not run, with the reason — never reported as passed.

Then run the design check, which is advisory and never a gate: `node tools/test-design.ts --repo-root .`. It is read-only and checks that what `design/`, the command files and `AGENTS.md` state about the tree is true — cited scripts and commands exist, the contract's tables match the scripts and skills, every slice has a `Status:` line. Exit 2 means there is no `design/` and nothing to check.

- A reference **outside `design/`** that this slice broke — a skill citing a script the slice renamed — is the slice's own bug: fix it in this branch.
- Every other finding goes in the pull request's *Differs from design* section, one line each, and never stops the run. Never edit `design/` to clear one in a slice; step 7 reconciles them once the plan is finished.

## 4. Open the pull request

Commit by named path — never a guarded file (step 2) — `git diff --check`, push, and open a **non-draft** pull request. The description:

```
## What
<one or two sentences: what a user can now do>

## Criteria
- S<n>.1 — met: <the test or check that shows it>
- S<n>.2 — ...

## Differs from design
- <one line per place the code departs from design/, or omit the section>

## Verified
<each gate: passed / failed with its output / not run and why>
```

## 5. Get it merged

1. Wait for CI on the pushed head: `node tools/wait-pull-request-check.ts --pull-request <n> --head-sha <sha>`.
2. If a check failed, read its log (`gh run view --log-failed`), fix it, push, and wait again.
3. Read the review threads (`gh api graphql` on `pullRequest.reviewThreads`, paginated; fields `id isResolved isOutdated path line comments`). For each unresolved thread:
   - **A real defect** — fix it, push, wait for CI, then resolve the thread (`resolveReviewThread`).
   - **Wrong, or already handled** — reply with the evidence (`path:line`) and resolve it.
   - **Real but outside this slice** — open a GitHub issue for it, reply with the link, resolve it.
   - **Needs the user's judgement** (a product decision, not a code question) — leave it open; this is a blocker.
4. Merge: `node tools/merge-pull-request.ts --pull-request <n> --head-sha <sha>`. It waits for checks itself and refuses on anything unconfirmed. **A refusal stands** — never `--admin`, never merge another way. Fix what it names and retry; if it cannot be fixed, that is a blocker.
5. Prune with `tools/invoke-housekeeping.ts`, as in step 0.

Three failed attempts to fix the same CI failure or review defect is a blocker: stop and report what each attempt assumed and what it disproved.

## 6. Keep going

Return to step 1 for the next slice. Do not pause between slices, do not ask whether to continue, and do not suggest a new session — context compaction is handled by the host.

When step 1 returns `Finished`, go to step 7.

## 7. Reconcile the design

The spec holds still while slices are built against it; once the plan is finished, bring it up to date with what was built, in this same session. This is `/align` without the questions: it changes the documents only where the answer is already settled.

1. **Gather**, from the default branch: the *Differs from design* section of every pull request merged since `design/10-design.md` or `design/20-contract.md` last changed (`gh pr list --state merged --search "merged:>=<date>" --json number,title,body`); the `90-decisions.md` entries added since that date; and the findings of `node tools/test-design.ts --repo-root .`. If all three are empty, there is nothing to reconcile: skip to the report.
2. **Sort** each divergence, checking it against the code (`path:line`) rather than trusting the note:
   - **Transcription** — a renamed script, field or option, a moved file, a changed count, a contract table that no longer matches the tree. Correct the document.
   - **Already decided** — a `90-decisions.md` entry records the call (the ones step 2 appended). Make the document say what the entry chose, citing it.
   - **Needs the user** — the code and the design disagree about meaning and no entry settles it. Change nothing; it goes in the report.
   - **Already in agreement** — the document already says it. Nothing to do.
3. **Ship** what was corrected as one pull request on `align/<YYYY-MM-DD>`, through steps 3 to 5 like a slice. Edit only `10-design.md` and `20-contract.md`, and the text of slices that are not `done`; never the brief, never a `done` slice's acceptance criteria, never an existing `90-decisions.md` entry. The description lists each correction (document section ← `path:line` or decision entry) under *What*, and each *Needs the user* item under *Differs from design*. With nothing to correct, open no pull request.
4. **Hand over** the *Needs the user* items: open one GitHub issue listing each with its `path:line`, the document section and a recommendation (change the document or change the code, and why), and link it in the report. They are the only part left for `/align`. This step never stops the run and never asks mid-run.

## Report

Once, when the run stops, in the `AGENTS.shared.md` § *Reporting* shape:

- `Result:` — which slices merged in this run (with pull request links), and either "the plan is complete" with the reconciliation pull request (or "design already current") or exactly what stopped it.
- `Next:` — `Nothing — this is complete.`, the one decision or action the blocker needs from the user, or the *Needs the user* issue from step 7.
- `Verified:` — the gates and CI results for the last pull request, and anything that did not run.
- `Decisions:` — the material-ambiguity calls made along the way, one line each, if any mattered; each is already in `design/90-decisions.md`.
