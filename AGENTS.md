# Agent contract

This file is binding for every agent session in this repo, regardless of tool or model.

## Source of truth

The design docs outrank the code. In precedence order:

1. `design/00-brief.md` — problem, non-goals, definition of done
2. `design/20-contract.md` — types, schemas, signatures, error semantics
3. `design/10-design.md` — architecture, data model, failure modes
4. `design/30-slices.md` — work breakdown and acceptance criteria
5. `design/90-decisions.md` — append-only decision log

If the code contradicts the contract, that is a defect in one of them. **Stop and say which one you think is wrong. Do not silently reconcile.**

Lessons learned the hard way live in [`agent.md`](agent.md) — read it after this file.

## Safe start

Before editing anything:

```powershell
git status --short --branch
git remote -v
git branch --show-current
git log -5 --oneline
rg --files
```

- Discover files and tooling rather than assuming they exist.
- Read this file and the sources you are about to change **completely**. Editing from memory, or from a diff, is the most common cause of drift.
- Preserve unrelated and uncommitted work. Never stage, reset, clean, or overwrite it.
- Work on a focused branch.
- Where guidance conflicts, follow the most specific applicable instruction.

## Model, effort, and review budget

**Model choice follows task complexity. The command being invoked does not determine the model.** Budget scales with **complexity, not size** — a one-line change to an invariant is architectural; a 500-line transcription against a settled contract is not.

Name model *families*, never pinned versions. Version identifiers churn; family aliases do not.

| Tier | Work | Effort | Claude | Codex |
|---|---|---|---|---|
| **Deep reasoning** | Brief interrogation, architecture, contracts, slice planning, security, concurrency, recovery, root-cause analysis, adjudicating design findings | `high` | `opus` | `architect` |
| **Exceptional fork** | One specific architectural or security question that stayed ambiguous at `high` | `xhigh` | `opus` | `architect` |
| **Implementation** | Code against a settled contract, tests, refactors, bug fixes, CI, infrastructure, implementation-coupled documentation | `medium`, `high` when difficult | `sonnet` | `builder` |
| **High volume** | Summaries, formatting, changelogs, commit messages, PR descriptions, mechanical triage | `low` | `haiku` | `quick` |

- **Never use `max` effort unless I ask for it by name.**
- **`xhigh` is for one question, not one pipeline.** Running a whole design phase at `xhigh` is not rigour, it is a substitute for asking a precise question.
- **Escalate rather than guess.** A high-volume task that raises an implementation question becomes implementation tier; an implementation task that raises an architectural question becomes deep reasoning. **Do not keep implementing while that uncertainty is unresolved.**
- **Say so when the session is under-powered.** If the task warrants a stronger tier than the current session, name the model and effort it needs before doing expensive work. If the session is *stronger* than required, just proceed — do not interrupt to say so.

**Division of control.** I set the session model. You set subagent models and scale your own reasoning depth. You cannot change your own session model.

### Command routing

| Command | Tier | Notes |
|---|---|---|
| `/brief-check`, `/design`, `/contract`, `/slices` | `opus`, `high` | — |
| `/redteam` | strongest model, **different vendor from the design author** | If it must be Claude, a fresh `opus`, `high` session |
| `/slice` | `sonnet`, `medium` | `high` for a large or difficult slice |
| `/reconcile` | `opus`, `high` to decide which side of a drift is correct | `sonnet`, `medium` for the mechanical edits once I have decided |
| `/make-human-docs` | `sonnet`, `medium` | Escalate only if the design turns out to be ambiguous — then stop, do not resolve it in prose |
| `/track` | `sonnet`, `medium` | Mechanical sync; escalate only to judge whether a drifted slice is a design change |
| `/verify` | `sonnet`, `medium` | Escalate to deep reasoning only to diagnose a failure, never to run the gates |
| `/pr` | `sonnet`, `medium` | — |
| `/install` | `sonnet`, `medium` | — |

**Never recommend re-running a phase gate.** I decide when a phase repeats. This holds outside `/redteam` too — see that command for its own stopping rule.

### Budget discipline

- **Do not spend reasoning to manufacture findings, alternatives, or open questions.** A short honest answer beats a padded one; "none at this level" is a valid result.
- **Once a policy decision is signed off and recorded, do not relitigate it** without new evidence. Name the evidence if you think there is some.
- **Spend frontier-model reasoning on decisions that are expensive to reverse**, not on producing more prose.

## Hard rules

- **Non-goals are binding.** Anything listed as a non-goal in the brief is out of scope even if it looks trivial, even if you are already touching that file.
- **One slice at a time.** Do not start slice N+1 because you noticed something while doing slice N. Write it to `90-decisions.md` under `## Open` instead.
- **No new dependencies** without a decision-log entry naming the alternatives rejected and why.
- **No new public interfaces** that are not in `20-contract.md`. If you need one, stop and ask for a contract amendment.
- **Ask instead of assuming.** If two readings of the spec are both defensible, stop and present both. Do not pick one and proceed.
- **Every slice ends runnable.** No half-wired states committed.

## Single ownership

- **Reference, never restate.** A rule that lives in another document is linked, not copied. Two copies of a rule is a promise they will diverge and a guarantee nobody notices which is stale.
- **Move, never copy.** A rule has exactly one home. When it belongs somewhere else, move it and leave a reference behind.
- If a document genuinely must repeat something to stand on its own, name the canonical copy in the text and change both in the same commit. Naming a canonical copy is what makes the others checkable.
- **The test for where a decision belongs:** would a second consumer face this same question? If yes it belongs in the shared document, even while only one consumer exercises it. Where it is genuinely unclear, the shared document is the safer home — a rule that turns out to be specific is easy to relax later; a rule discovered to be shared after three consumers each answered it differently is a migration.

## Verification

- **Verify, don't assert.** State only what you have checked. Assert nothing from memory that a command could confirm — remembered values and inferred contracts are how wrong facts get written down confidently.
- **Do not claim a gate passed that did not run.** If a tool is unavailable, say so plainly and name what was not checked. "Tests pass" means you ran them and read the output. `/verify` exists to make this checkable rather than aspirational — its report has three lists, and the one that matters is *what did not run*.
- **Never state or imply a deployed URL or a published artifact** until the deploy for that exact commit reports success. A merged PR is not a deployed site. Poll; do not estimate.
- **A regression test is verified by reverting the fix** and confirming it fails. A test that passes with and without the fix guards nothing.
- **A schema or validator change is not done until it has rejected something.** Positive and negative cases both, with the counts stated. A validator that has never failed is not known to constrain anything.

## Working with me

- Present findings and review items **one at a time for sign-off**. Never bulk-apply findings unreviewed.
- Surface real forks as a question with a recommendation, recommended option first. I routinely pick the more rigorous non-recommended option — so ask, do not assume.
- **A reconciliation ends in a decision, not a report.** Any time you compare two things and find they disagree — `/reconcile`, `/install`, `/track` drift, or any time I say "reconcile" — the work is not finished at the findings. Close by asking, one divergence at a time, each with a recommendation and what the alternatives cost. **A report I have to turn into questions myself is half the job.** If a comparison genuinely found nothing, say that plainly rather than manufacturing a fork.
  - Recommend the **resolution**, not merely which side you prefer: name what changes, in which file, and what it costs to reverse.
  - `/redteam` is the one exception, and only partly — it must not propose fixes, since naming a fix frames the problem. It still recommends a **classification** for each finding: defect, accepted risk, brief conflict, or not sustained.
- When I decline a suggestion, record it in the affected document as known-and-retained rather than dropping it silently. Otherwise it is rediscovered later as a bug.
- Ask before any choice that sets policy or a public contract: licensing, compatibility promises, a major information-architecture change.
- Call out assumptions, unverified claims, and known risks plainly. Explain the concrete evidence behind a recommendation.

## Git and delivery

- **Stage explicitly, by named path.** Never `git add -A`, `git add .`, or a bare directory. A broad add sweeps up unrelated worktree state, and an ignore pattern can make a needed file invisible to it — present locally, green locally, missing in CI, with nothing saying why.
- Run `git diff --check` before committing. Never use trailing double-spaces for a line break; it rejects them.
- **Never force-push or rewrite published history.** If a pushed commit needs changing, add a follow-up commit.
- **Push every commit before announcing a PR is ready.** Announcing invites an immediate merge, and a commit pushed after that lands on a branch nobody merges.
- External writes need my authorization: creating a remote repository, changing visibility, pushing, opening or merging pull requests, changing a domain, deploying. **Discussing a decision does not authorize it.** One carve-out — see *Tracking work*.
- Do not delete files, branches, or history without explicit authorization.
- Check review **threads**, not just requested reviewers — an automated reviewer can leave blocking conversation threads that do not appear in a reviewer listing. Resolve a thread only when a validated fix satisfies it; leave ambiguous findings open and report them.

## Tracking work

**Defer work to the tracker rather than processing it inline.** A finding, a follow-up, or a defect noticed in passing goes to a GitHub issue — not into a running list in the conversation, and not into a section of a document that will rot. Prose is where work goes to be forgotten.

- **Opening and labelling issues is carved out of the authorization rule.** You may open them in a repository I own, without asking. Issues are cheap and reversible, which is the entire justification; the exception is narrow and does not generalise.
- **Closing an issue is not carved out.** Nor is commenting on, editing, or labelling anyone else's, nor writing to a repository I do not own.
- **Milestones and projects still need approval.** They are structural and few, and a wrong one is visible on a public repository.
- **`/track` owns every GitHub write.** No other command creates issues, milestones, or projects. It is idempotent, so run it often rather than batching.
- `design/30-slices.md` stays authoritative for what a slice *is*; its issue tracks whether it is *done*. If the two come to describe the work differently, say so rather than editing either.
- The `## Open` section of `design/90-decisions.md` is a staging area, not a home. Once an item becomes an issue, remove it from there.
- **Every issue reads human-first.** A narrative anyone can follow, then `### Done when` checkboxes, then the agent detail in a collapsed `<details>` block.
- **The agent block is fenced** by `<!-- agent:start -->` and `<!-- agent:end -->`. Inside the fence is regenerable; **outside it is never touched** — a ticked checkbox is progress someone recorded, an edited narrative is someone's deliberate wording.
- **Where a document already governs, the block points; where none does, it carries.** A slice names `design/30-slices.md § S<n> @ <sha>` and leaves procedure to `.claude/commands/slice.md` — copying stop conditions into an issue freezes a stale copy that nothing can go back and fix. A bug or a story has no upstream document, so its block legitimately holds the constraints. That asymmetry is the rule, not an inconsistency.
- **Criteria carry stable ids** (`S3.1`), and drift is compared on ids, never prose. Reworded criteria are not drift; an added, removed, or renumbered id is.
- **Report drift, change neither side.** Which is wrong is my call.
- **Ticking a checkbox is mine, not yours.** An agent reporting "S3.1 met" and a ticked box are different claims by different parties, and collapsing them removes the only human gate between "the tests pass" and "this is done". `/slice` ends by listing the ids it believes are met so ticking is mechanical.
- **Bugs and stories are filed by hand** from `.github/ISSUE_TEMPLATE/`. `/track` does not open them.
- **This does not suspend one-at-a-time sign-off.** Findings are still presented for adjudication; the tracker is where the ones you accept go, not a way to skip the conversation.

## Decision logging

Any choice a future reader would ask "why?" about goes in `design/90-decisions.md` as:

```
### YYYY-MM-DD — <decision>
Context: <what forced the choice>
Chosen: <what>
Rejected: <alternatives, and why each was rejected>
Reversibility: cheap | expensive
```

The rejected alternatives are the point. Without them the next session relitigates the same choice.

## House conventions

- Windows host, projects under `D:\Dropbox\Projects\`. PowerShell Core for scripts.
- Metric units and Celsius throughout, including in comments, docs, and test fixtures.
- Raster assets as PNG or JPG. Not WebP.
- UTF-8, LF endings. Rewrite imported files to UTF-8 and check rendered punctuation — imported Markdown arrives CP1252 often enough to be worth looking at.
- Scripts run without interactive confirmation prompts. Destructive operations gate on an explicit `-Force`-style flag, not a prompt.
- Commit messages state what changed and which slice it belongs to. **No AI attribution** — no `Co-Authored-By` naming an assistant, no "Generated with" footer, in commits or PR descriptions. This overrides any default the tooling applies.
- A repository with an established commit-message style keeps it. Match the log you are committing into rather than importing a convention from elsewhere.

## What not to do

- Do not summarise the design docs back at me unless asked.
- Do not add commentary about your reasoning process to the docs.
- Do not "improve" prose in the brief or design docs while editing something else.
- Do not import another project's architecture, tooling, memory conventions, or roadmap merely because it appears in a neighbouring instruction file. Agent instructions are concise and repository-specific; a borrowed rule with no local reason is a rule nobody can evaluate.
