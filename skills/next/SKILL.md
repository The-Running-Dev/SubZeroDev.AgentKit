---
name: next
description: Build the plan — take the next unfinished slice through to merge, then keep going until the plan is done or something genuinely blocks
argument-hint: "[optional: a slice id to start from, or 'one' to stop after a single slice]"
disable-model-invocation: true
---

Build `design/30-slices.md` to completion. **Do the work; do not describe it.** Each slice goes from code to merged pull request, then the next slice starts, in this same session. Stop only when the plan is finished or on a genuine blocker (`AGENTS.shared.md` § *When to stop*). Never end with "run /next again" or "start a fresh session" — that is the failure this command exists to remove.

With `$1` set to a slice id, start there. With `$1` set to `one`, stop after one slice.

## 0. Start clean

- `git status --short --branch`. Uncommitted work that is not yours: leave it, work in a separate branch, and mention it in the report. Never stage, discard or stash it.
- If the current branch's pull request has merged, run `pwsh -File tools/Invoke-Housekeeping.ps1 -RepoRoot .`: it switches to the default branch, pulls, and deletes every branch confirmed merged. It never stashes: uncommitted work rides across the switch untouched, and if git refuses the switch because that work would be overwritten, the run carries on from `origin/<default branch>` (step 2) and names the files in the report. Anything it escalates (`Escalate`) is left alone and named in the report; it does not stop the run.
- If an open pull request from an earlier run of this command exists for an unfinished slice, check out its branch and continue from step 3 rather than starting over.

## 1. Pick the slice

Read `design/30-slices.md`. A slice is a `## S<n>` heading and the lines under it. The next slice is the first, in document order, whose `Status:` is not `done` and whose `Depends on:` slices are all `done`. A slice with no `Status:` line is not done.

Only `## S<n>` headings are candidates. Prose, a `## Landed` table, and any other index of slices retired by an earlier version of the kit are history: every slice named there counts as `done`, a `Depends on:` pointing at one is satisfied, and none is ever rebuilt.

If none is left, the plan is finished: report that and stop. If slices remain but every one waits on an unfinished dependency, report the cycle or gap and stop.

## 2. Build it

- Branch `slice/S<n>-<short-name>` off the up-to-date default branch (`git fetch`, then `git switch -c slice/S<n>-<short-name> origin/<default branch>`).
- Read the slice, `design/20-contract.md`, and the parts of `design/10-design.md` it touches. Read the code you are about to change in full.
- For each acceptance criterion, write a test that fails first where the criterion can be tested, then implement until it passes. Stay inside the slice's `Out of scope:` line.
- Where the code and the design disagree, do what works, keep going, and note it for the pull request (`AGENTS.shared.md` § *The design is the spec*).
- Set the slice's `Status:` line to `done` in `design/30-slices.md` in this same branch. Change nothing else in `design/`.

## 3. Check it locally

Run the repository's gates: the steps marked `# verification: true` in `.github/workflows/*.yml` (`pwsh -File tools/Test-GatesCache.ps1 -RepoRoot .` caches that list), or, where none are marked, the test suite, linter and type checker the repository uses. Fix failures before pushing. A gate that cannot run here is named as not run, with the reason — never reported as passed.

Then run the design check: `pwsh -File tools/Test-Design.ps1 -RepoRoot .`. It is read-only and checks that what `design/`, the command files and `AGENTS.md` state about the tree is true — cited scripts and commands exist, the contract's tables match the scripts and skills, every slice has a `Status:` line. Exit 2 means there is no `design/` and nothing to check.

- **A finding this slice's change caused** — a script renamed without its citations, a parameter added without its contract row, a skill added without its row — is fixed in this branch, the same as a failing test.
- **A finding in design prose this slice did not touch** goes in the pull request's *Differs from design* section, one line each, and does not stop the run. Do not edit `design/` to clear it beyond what this slice itself changed.

## 4. Open the pull request

Commit by named path, `git diff --check`, push, and open a **non-draft** pull request. The description:

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

1. Wait for CI on the pushed head: `pwsh -File tools/Wait-PullRequestCheck.ps1 -PullRequest <n> -HeadSha <sha>`.
2. If a check failed, read its log (`gh run view --log-failed`), fix it, push, and wait again.
3. Read the review threads (`gh api graphql` on `pullRequest.reviewThreads`, paginated; fields `id isResolved isOutdated path line comments`). For each unresolved thread:
   - **A real defect** — fix it, push, wait for CI, then resolve the thread (`resolveReviewThread`).
   - **Wrong, or already handled** — reply with the evidence (`path:line`) and resolve it.
   - **Real but outside this slice** — open a GitHub issue for it, reply with the link, resolve it.
   - **Needs the user's judgement** (a product decision, not a code question) — leave it open; this is a blocker.
4. Merge: `pwsh -File tools/Merge-PullRequest.ps1 -PullRequest <n> -HeadSha <sha>`. It waits for checks itself and refuses on anything unconfirmed. **A refusal stands** — never `--admin`, never merge another way. Fix what it names and retry; if it cannot be fixed, that is a blocker.
5. Prune with `tools/Invoke-Housekeeping.ps1`, as in step 0.

Three failed attempts to fix the same CI failure or review defect is a blocker: stop and report what each attempt assumed and what it disproved.

## 6. Keep going

Return to step 1 for the next slice. Do not pause between slices, do not ask whether to continue, and do not suggest a new session — context compaction is handled by the host.

When the plan is finished, run the design check once more on the default branch. If it still reports findings, open one GitHub issue listing them (check, `file:line`, message), so `/align` has them in one place, and link it in the report. Do not fix them in this run.

## Report

Once, when the run stops, in the `AGENTS.shared.md` § *Reporting* shape:

- `Result:` — which slices merged in this run (with pull request links), and either "the plan is complete" or exactly what stopped it.
- `Next:` — `Nothing — this is complete.`, or the one decision or action the blocker needs from the user.
- `Verified:` — the gates and CI results for the last pull request, and anything that did not run.
- `Decisions:` — the material-ambiguity calls made along the way, one line each, if any mattered.
