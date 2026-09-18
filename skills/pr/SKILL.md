---
name: pr
description: Take the current branch's pull request to merge-ready — description, gates, then review threads
disable-model-invocation: true
---

<!-- companion:declared:start -->
**Per-repo companion:** `skills/pr/SKILL-local.md`. Read it now, if it exists — an absent,
empty, or frontmatter-only file is no companion, and this file then stands alone.
It may override: `vocabulary`, `extra-steps`, `gate-commands`, `tightened-authorization`. It may never override anything in
[`.claude/COMPANIONS.md`](../../.claude/COMPANIONS.md) § *Never*, which is also where these categories are defined.
<!-- companion:declared:end -->

Take the work on the current branch to merged, in four phases, in order.

**This command owns the sequence. It does not own the procedure of any phase it delegates.** Phase 2 is `skills/check/SKILL.md`, phase 3 is `skills/resolve/SKILL.md`, and phase 4 is `tools/Merge-PullRequest.ps1`, each run in full, in this same session. Those files stay the single home for how a gate is discovered and how a thread is classified — this one never restates them, because a second copy of a rule is a promise it will diverge (`AGENTS.shared.md`, *Single ownership*). Both remain invocable on their own: `/check` to run the gates against any tree, `/resolve` to work threads on a pull request this command did not open.

**This repository's convention outranks any default in this command.** They genuinely differ — one sibling enables auto-merge as standard practice, another forbids it outright, a third leaves every merge to its owner. **Read the repository's own instruction file before doing anything**, and follow what it says. If it is silent, open the PR and leave the merge alone.

> Three rules below — push before announcing, no AI attribution, and no deployed URL before the deploy succeeds — are stated canonically in `AGENTS.shared.md` (*Git and delivery*, *House conventions*, *Verification*). They are repeated here because this file is injected on its own and the rules fire at exactly these moments. If they ever disagree, `AGENTS.shared.md` is correct and this file has drifted.

## Phase 1 — the pull request and its description

```powershell
git status --short --branch
if (git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null) {
  git log --oneline '@{u}..HEAD'
} else {
  Write-Host "No upstream configured for this branch — push first: git push -u origin HEAD"
}
git diff --check
gh pr view --json number,isDraft,url,title 2>$null
```

- **Every commit must be pushed first.** Announcing a PR invites an immediate merge, and a commit pushed after that lands on a branch nobody merges. **Check for an upstream before running the ahead/behind comparison** — `@{u}..HEAD` on a branch with no upstream configured errors rather than reporting anything, so guard it as above and, where none is configured, state the next step (`git push -u origin HEAD`) rather than pushing on your own initiative; pushing still follows this repository's own authorization rule. Once an upstream exists, `@{u}..HEAD` must be empty before you announce anything.
- **Never open a PR from the default branch.** If that is where the work is, stop and say so — moving commits to a branch is the user's call.
- Stage by explicit named path. Never `git add -A`, `git add .`, or a bare directory.

**Never open a pull request as a draft.** A draft is invisible to the reviewers and CI gates that ignore drafts, which makes "opened" and "actually in review" two different states someone has to remember to reconcile. Open it ready.

**Check for a PR already open on this branch before creating one.** `/slice` and `/fix` open theirs when they finish (`skills/slice/SKILL.md`, `skills/fix/SKILL.md`). If `gh pr view` finds one, write the real description onto it and do not open a second. If none exists — work predating this convention, or `/pr` run standalone — open one; that write is carved out of the authorization rule (`AGENTS.shared.md`, *Git and delivery*), as is the merge phase 4 reaches by way of the script named there.

**Before writing the description, compare what this branch was meant to do against what it changed.** The gates answer whether the tree still works; the review threads answer whether the code is good. Neither notices a file changed for a reason nothing stated, or a criterion reported met with nothing behind it. *One slice at a time* is the rule this repository leans on hardest and the only one nothing but an implementing session's own discipline enforces, so naming both directions here is what turns it from an instruction into something observable — and it happens in this phase because the result then goes into the body as it is composed rather than as a later edit.

```powershell
$default = gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'
git fetch origin $default --quiet
git diff --name-only (git merge-base "origin/$default" HEAD) HEAD
```

**The stated intent comes from the front door, and there are three.** Take it from whichever opened this branch — never from your own recollection of the session, which is the one input that agrees with the diff by construction:

- **`/slice`** — the criteria ids under the matching issue's `Done when`, plus the slice's `Touches` line in `design/30-slices.md`. Both are already authoritative and both are already ids and paths rather than prose: `/slice` reports by id and may not touch a file outside `Touches` without saying why first (`skills/slice/SKILL.md`), so the comparison is checkable rather than a judgement about a summary.
- **`/fix`** — the issue's `<!-- agent:start -->` block, the cause `/fix` stated before it wrote the patch, and the reproduction that cause had to clear (`skills/fix/SKILL.md`). This path carries no criteria ids, so the second direction below has no left-hand side and the report says so rather than reporting it clean.
- **Neither** — `/pr` standalone, or work predating the convention. Intent is the issue the branch closes, plus the commit messages.

**Report both directions, by path and by id.**

- **Changes nothing stated accounts for** — a path on the diff that no criterion, no `Touches` entry, and no named cause reaches. Name every one.
- **Statements with nothing behind them** — a criterion about to be listed under `Criteria met` in the agent block below, with no path on the diff implementing it. This direction checks that block against itself, which is the reason it belongs in the phase that writes it and not in a later pass.

Three kinds of path are accounted for without a criterion of their own, and naming one is a false positive rather than a finding: a `design/` file corrected as descriptive drift in this same commit (`skills/slice/SKILL.md` § *Correcting the document as you go*); the decision-log entry and design-state records a decision obliges (`AGENTS.shared.md`, *Writing a design-state record*); and `.claude/verify-report.json` where phase 2 wrote it into this branch rather than leaving it unstaged.

**Where intent cannot be established, the verdict is `not assessed` and says why.** No issue, no ids, and commit messages that state no intent is a real state — and inferring the intent from the diff would make the check agree with itself every time, which is worse than not running it, because it reads as a clean result (`AGENTS.shared.md`, *A findings report states what it examined*).

**It is informational, and it changes neither side.** It never blocks the pull request, never edits `design/30-slices.md` or an issue to match the diff, and never widens or reverts the diff to match the statement — *Report drift, change neither side* (`AGENTS.shared.md`, *Tracking work*). A scope check that blocks becomes a thing to argue past, and both this repository's rule and the mechanism this is adapted from agree on that.

**The verdict line goes in the agent block, beside the two statements it is derived from. Where it is anything other than clean, one sentence naming it goes in the human-first paragraph as well.** That asymmetry is deliberate: a reviewer who reads only the top of the body is exactly the reader this check exists to reach, and a clean verdict is not worth their attention while a drifted one is.

Same shape as an issue — human first, agent detail fenced:

```markdown
**What changed, and why.** Two or three sentences someone reviewing can follow without
reading the diff. State what was decided and why it was not the obvious alternative.

Closes #<n>

### Verified
Not yet run — the gates run next and this section is replaced with their report.

---
<details><summary><b>Agent detail</b></summary>
<!-- agent:start -->

- **Slice:** S3 — `design/30-slices.md` § S3 @ `a1b2c3d`
- **Criteria met:** S3.1, S3.2
- **Left undone:** S3.3 — <why>
- **Scope:** clean | drift | missing | not assessed — <the unaccounted paths, the
  unevidenced ids, or why intent could not be established>
<!-- agent:end -->
</details>
```

- Long-form reasoning belongs in the decision log or the plan, not the PR body. Say what changed and why; link the rest.
- **No AI attribution** — no `Co-Authored-By` naming an assistant, no "Generated with" footer.

## Phase 2 — the gates

**Run `skills/check/SKILL.md` in full**, against the branch and worktree this PR points at, then replace the description's `Verified` section with its report **verbatim** — the same three lists, not a summary. Restating it from memory is the fabricated gate result that command exists to prevent. `/check` validates its own `.claude/verify-report.json` before rendering it (`tools/Test-VerifyReport.ps1`); a report that fails that validation is not copied into the PR — fix the artifact and re-render first.

- **Do not claim a check passed that did not run.** The did-not-run list goes into the description word for word, including the reason each entry did not run.
- **Do not fix a failing gate here.** That prohibition belongs to `/check` and this command does not relax it by wrapping it — a failing gate ends in a decision put to the user, not a repair (`AGENTS.shared.md`, *Working with me*).

## Phase 3 — review threads

**Check review *threads*, not requested reviewers.** An automated reviewer can leave threads that block merge and do **not** appear in `gh pr view --json reviewRequests,latestReviews`. If `required_review_thread_resolution` is on, the unresolved count *is* the merge blocker regardless of what the checks say.

**Run `skills/resolve/SKILL.md` in full** — its query, its five classes, its fixed order of operations, its delegation. Fixing and resolving are delegated in this repository and need no separate ask (`AGENTS.shared.md`, *Git and delivery*); `Ambiguous` threads still come to the user one at a time.

**This phase always runs — never leave it to a separate invocation.** Query the threads as soon as the PR is open and the `Verified` section is written. A PR opened ready starts its automated reviewers immediately, so "no threads yet" at the moment of opening means *not yet*, not *none*.

Where the query comes back empty, **give the automated reviewers one bounded wait rather than declaring the PR clean**: `pwsh -File tools/Wait-PullRequestCheck.ps1 -PullRequest <n> -HeadSha <pushed SHA>` (path relative to the kit install root, not this repo — `AGENTS.shared.md` § *House conventions* → Home-install convention), then re-query the threads once. Threads found on the re-query are classified and worked exactly as above.

**One wait, not a poll loop** — phases 1 and 2 are minutes and a human reviewer is however long a human takes, and those are not the same wait. Re-running `/pr` on a branch whose description and `Verified` section are already current is a no-op through phases 1 and 2 and lands straight here.

Where threads remain `Ambiguous` or otherwise unresolved after this phase, **that is where the command ends** — report the check outcomes and the thread count and stop, saying plainly that `/pr` (or `/resolve` on its own) picks this up again when later review arrives. Phase 4 is not reached, because the script it calls would refuse on exactly that state anyway.

## Phase 4 — merge

**Run `tools/Merge-PullRequest.ps1`** (path relative to the kit install root, not this repo — `AGENTS.shared.md` § *House conventions* → Home-install convention):

```powershell
pwsh -File tools/Merge-PullRequest.ps1 -PullRequest <n> -HeadSha <the SHA phase 2 gated>
```

`-HeadSha` is the commit phase 2's gates actually ran against, not whatever `gh pr view` reports now. Passing the current head instead would merge a commit that was pushed after the gates ran as though it had passed them — which is the single failure this whole phase is shaped to prevent.

**The script decides, not you.** It confirms the pull request is open and not a draft, that its head is still that SHA, that every check reached a terminal passing state, and that no review thread is unresolved — then merges with `--match-head-commit`. Its preconditions and its fail-closed behaviour are its own (`AGENTS.shared.md`, *Git and delivery*); this file does not restate them, and you do not re-derive them by reading a checks page.

- **A refusal is the answer, not an obstacle.** Report the `Refusal` verbatim and stop. Never re-run it with a different SHA to get a different result, never merge through `gh` or the API directly, and never reach for `--admin`.
- **`NotEvaluated` is not a failure and must not be reported as one.** It means the state could not be read — an unavailable `gh`, a timeout, a repository with no checks configured. Name which, and leave the PR open.
- `-DryRun` evaluates every gate and merges nothing; use it when you want the decision without the consequence.

**Where this repository's instruction file withholds the merge delegation, skip this phase entirely** — report the check outcomes and the thread state, and stop. The rule at the top of this file holds: the repository's own convention outranks any default here, in this direction as much as the other.

**Never state a deployed URL** until the deploy for that exact merge commit reports success. A merged PR is not a deployed site.
