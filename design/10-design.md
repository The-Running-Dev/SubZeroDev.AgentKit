# Design — the defect-to-merge path

> **Scope warning, read before treating this as authoritative.** This document describes
> **one path through the kit**: taking a defect from report to a merge-ready pull request.
> It is not a design of the AgentKit as a whole. `design/00-brief.md` was
> written on 2026-08-19, but it states a different problem — making design state explicit —
> so there is still no whole-repository design for this to sit inside. `/redteam`,
> `/contract` and `/reconcile` read this file as authoritative — they should read it as
> authoritative **for this path only**, and treat every other part of the kit as designed in
> `design/90-decisions.md`, which is where every other command was decided.

The path already exists in pieces. `/verify` runs the gates and reports what did not run,
`/resolve` classifies and resolves review threads, `/pr` writes the description and defers
the merge. What has no owner is the entry point for a defect that is **not** a slice and
**not** already a review thread, the wait for checks on a named head SHA, and the
authorization shape that lets one approval cover push, pull request, and resolution.

## Data model

Nothing here is persisted. Every entity lives in one session, and that is the design
rather than an omission — persisting a classification or an approval across sessions is
what would make a stale one usable.

### Defect

The unit of work. Distinct from a slice: it has no contract signature, no `Done when`
criteria, and no entry in `design/30-slices.md`.

| Field | Type | Notes |
|---|---|---|
| `Source` | `Issue` \| `ReviewThread` \| `Description` \| `FailingTest` | Determines the entry path below |
| `IssueNumber` | integer | Given for `Issue`; **filed by `/fix` after reproducing** otherwise |
| `Reproduction` | evidence, required | **Derived by running something**, never by reading code |
| `Branch` | string | Derived: `fix/<issue>-<slug>` |

`Reproduction` is a required field and the one with teeth. A defect whose claim has not
been reproduced is a *claim*, and `/resolve` already forbids changing code to satisfy one
(*Not sustained*). The same rule applies when the claim arrives as an issue rather than a
bot comment.

`IssueNumber` is **not** nullable by the time a fix is written, and that is the load-bearing
decision in this model. `.github/ISSUE_TEMPLATE/bug.md` states that a bug issue *is* the
specification — a bug has no design document behind it, so its agent block carries the
constraints rather than pointing at them. A defect with no issue therefore has no authority
document, and the only alternative is for `fix.md` to carry a second copy of those
constraints. So the description path files one, and both paths converge on the same shape
before any code is touched.

The ordering matters as much as the rule: the issue is filed **after** reproduction, so its
`Reproduce` section is something that was run rather than something that was claimed. A
defect that cannot be reproduced never becomes an issue at all — the template calls that a
diagnosis task rather than an implementation one, and filing it as a bug would mislabel it.

### ReviewThread

Read from the GitHub GraphQL `reviewThreads` connection. Identity is the `PRRT_` node id.

| Field | Type | Notes |
|---|---|---|
| `Id` | string | `PRRT_…` |
| `IsResolved` | bool | |
| `IsOutdated` | bool | **The line moved. Not an answer.** |
| `Path`, `Line` | string, integer | |
| `Comments` | list | Paginated — see *Failure modes* |
| `Class` | `ThreadClass` | **Derived, in-session.** Semantics owned by `.claude/commands/resolve.md` |

### CheckRun

| Field | Type | Notes |
|---|---|---|
| `Name` | string | |
| `Bucket` | terminal or non-terminal | Unknown buckets are non-terminal — see *Failure modes* |
| `HeadSha` | string | **Part of the identity, not an attribute** |

A check result without the SHA it ran against is not a fact about anything. Every rule in
`/resolve` and `/pr` that says "green" means "green on this SHA", and this model makes the
SHA impossible to drop.

### AuthorizationBatch

The new entity, and the reason this design needs a decision entry rather than just a
command file. It exists only in the conversation.

| Field | Type | Notes |
|---|---|---|
| `Actions` | enumerated set | Exactly what was named when the approval was requested |
| `ThreadIds` | list of `PRRT_…` | **Enumerated at grant time.** May be empty |
| `PullRequest` | integer, nullable | Null when the batch will open one |
| `Granted` | bool | |

Two invariants make this a specific approval rather than a standing one, and both are the
whole point:

- **`ThreadIds` is fixed at grant time.** A thread discovered after the approval — which is
  the normal case, since pushing triggers a fresh bot review — is not in the batch.
- **The batch does not survive the response that acts on it.** It is not a session-level
  permission.

## Module boundaries

| Module | Owns | Depends on | Exposes |
|---|---|---|---|
| `tools/Wait-PullRequestCheck.ps1` | Polling checks to a terminal state against a named SHA | `gh` | Exit code, one report object |
| `AGENTS.md` *Git and delivery* | The `AuthorizationBatch` policy | nothing | The rule the commands cite |
| `.claude/commands/resolve.md` | Thread classification and resolution | the waiter, the policy | — |
| `.github/ISSUE_TEMPLATE/bug.md` | A defect's constraints, as its agent block | nothing | The specification `/fix` implements against |
| `.claude/commands/fix.md` | The defect entry point | the template, the policy, `/verify`, `/pr`, `/resolve` | — |

Dependency direction is `fix.md → {bug.md, resolve.md}`, `resolve.md → {waiter,
AGENTS.md}`, and `pr.md → waiter`. Acyclic, and it stays acyclic on one condition worth
stating because it is easy to violate later: **`resolve.md` must never reference
`fix.md`.** A defect found during review is fixed in place by `/resolve`, exactly as
today; it does not hand off to `/fix`.

`bug.md` is a dependency and not merely a template. It already declares itself the home for
a bug's constraints, so it sits in this graph the way `20-contract.md` sits under a slice —
`fix.md` reads it and obeys it rather than restating it.

`/verify` is depended on by name and is **not modified**. It discovers gates and reports
three lists; nothing in this path improves on that, and the temptation to inline "run
typecheck, lint, test" — which is what the source specification did — is the
`Single ownership` failure this design exists to avoid.

## Control flow

### Path A — a defect reported outside a pull request

Triggered by `/fix`, from an issue number or a description.

1. **Reproduce**, in the working tree. A failing test that fails for the stated reason.
   Refuse if the tree is dirty with work that is not this defect's (`AGENTS.md` *Safe
   start*). If it cannot be reproduced, stop and report it as a diagnosis task — no issue,
   no branch, no code touched.
2. **Establish the authority document.** On the issue path it already exists. On the
   description path, file one now from `.github/ISSUE_TEMPLATE/bug.md`, with step 1's
   evidence as its `Reproduce` section. From here both paths are identical, and everything
   after this obeys that issue's agent block.
3. **Branch** `fix/<issue>-<slug>` from the default branch, carrying the reproduction with
   it. The branch cannot be named before step 2, which is why it is not step 1.
4. Fix. Smallest correct change, no adjacent tidying. Never on the default branch.
5. `/verify` — discover and run the gates, keep the did-not-run list.
6. Commit by named path.
7. **Ask.** The batch here names two actions: push, and open a pull request. `ThreadIds`
   is empty because there are none.
8. Push. Open the pull request as a draft, closing the issue from step 2; `/pr` writes the
   description and asks separately before marking it ready. That second ask is unchanged
   and stays outside the batch.
9. Wait for checks on the pushed SHA.
10. Report. Merge is `/pr`'s and the user's.

### Path B — a defect raised as a review thread

Triggered by `/resolve` on an existing pull request. The change to the existing flow is
step 1 moving ahead of the approval.

1. Fetch every thread, paginated. Classify all of them. Present the table.
2. Fix the `Defect` threads. File issues for `Out of scope`; reply to `Not sustained` and
   `Already decided`; bring `Ambiguous` back one at a time.
3. `/verify`.
4. Commit.
5. **Ask.** The batch names three actions — push, update the pull request, and resolve —
   and enumerates the specific `PRRT_` ids the fix satisfies.
6. Push.
7. Wait for checks on the new head SHA.
8. Resolve **only** the enumerated ids, and only if the checks passed.
9. Report, including threads left open and why.

The ordering constraint that makes step 5 meaningful is that classification is complete
before the approval is requested. Under the source specification the approval came first,
which asks for a yes covering threads nobody has read.

## Failure modes

| Failure | Detection | Response | User sees |
|---|---|---|---|
| `gh` absent or unauthenticated | Non-zero exit on first call | Stop. Do not fall back to `gh pr view` | Named as a gate that did not run |
| Head SHA moved between commit and wait | Waiter compares its argument against the PR's current head | **Refuse.** Report neither pass nor fail | "Checks were not evaluated: head moved to `<sha>`" |
| A check never reports | Timeout | Stop, do not resolve | The check named, and that it never concluded |
| A check is flaky | Not detected by the waiter | The waiter **must not re-run**. A second run is a new fact, not a confirmation | — |
| Unknown check bucket | Bucket not in the terminal set | Treat as non-terminal, then time out. **Fail closed** | The bucket name, verbatim |
| No checks configured at all | Zero checks reported | `NotEvaluated`. **Never green** | That nothing was evaluated, so this path cannot reach resolution here |
| No `bug.md` in the repository | `Test-Path` before the description path files anything | Stop. The issue path is unaffected | That the authority document is absent, so there is nothing to implement against |
| Defect cannot be reproduced | The test does not fail, or fails for another reason | Stop **before** filing or branching | A diagnosis report, not a bug issue |
| A thread beyond page 1 | Only by paginating | `--paginate` is mandatory | — |
| New threads appear after the push | Re-query after the waiter returns | Not in the batch. Ask again | The new count, and a fresh ask |
| The fix is wrong | Checks fail on the new SHA | Batch is spent. Loop back to fix; the resolve half does not carry over | — |

The unpaginated-threads case deserves naming rather than a table row. Resolving a subset
while reporting the whole is indistinguishable, afterwards, from resolving the whole — and
`/resolve` already records that resolution is the one action here that cannot be noticed
later. That is why pagination is a contract invariant and not a nicety.

State left behind on any failure: a branch, a commit, possibly a pushed SHA and a draft
pull request. Nothing resolved, nothing merged, nothing closed. Every one of those is
visible and reversible by hand, which is the property that makes stopping safe at any
step.

## Concurrency and ordering

**Nothing runs concurrently.** The fixed order — classify, fix, verify, commit, ask, push,
wait, resolve — is the safeguard, and `/resolve` already says so in those words.

What enforces it is worth being honest about, because it is mostly not enforced. The
waiter's refusal to report on a non-head SHA is the **only mechanical** enforcement in the
path. Everything else is instruction in a command file, obeyed by a model. That is the
same footing every other command in this kit stands on, but it means the ordering rule
cannot be described as guaranteed. The one place it is guaranteed is the place where
getting it wrong is invisible afterwards, which is where the guarantee was worth buying.

There is one genuine external race: a human or a bot pushing to the branch between the
commit and the wait. It is detected, not prevented, and detection is sufficient — the
response is to refuse rather than to report a stale result.

## Alternatives considered

**One command carrying all ten phases.** The source specification as written. Rejected:
its phases 0–3 and 6–10 restate `AGENTS.md` *Safe start*, `/verify`'s three-list report,
`/resolve`'s five-class table and GraphQL query, and `/pr`'s merge deferral. *Single
ownership* — "two copies of a rule is a promise they will diverge" — makes that the one
shape this kit may not take. Splitting into a policy change, a script, an amendment, and
one genuinely new command touches four files instead of one and duplicates nothing.

**An inline polling loop in the command file.** `while true; … sleep 20` as specified.
Rejected twice over: it is bash against a PowerShell-Core house convention, and polling
and comparing buckets is a 🔴 item in the avoidable-work taxonomy — "arithmetic over
files, counting, collecting metrics… should leave the model entirely". A model re-deriving
"are all buckets terminal?" on every iteration is the exact cost `Measure-Session.ps1` was
written to stop paying elsewhere.

**The batch as a session-level standing authorization.** Simplest to obey, and closest to
what "minimum interaction" asks for. Rejected: a bot review fires on the push the batch
authorized, so the threads that appear afterwards are precisely the ones nobody has read —
and a standing permission would cover them. Fixing `ThreadIds` at grant time costs one
extra ask in the case where new threads appear, and only in that case.

**Extend `/slice` to handle defects.** No new command, and `/slice` already branches,
commits, pushes and opens a draft. Rejected: `/slice` selects work by reading `Done when`
boxes off a tracker issue and implements against a contract signature. A defect has
neither, so every one of those steps would need an "unless it is a bug" branch — and the
2026-08-04 entry that gave `/slice` its branch-and-PR behaviour did so on the reasoning
that one slice means one branch and one session, which a defect does not participate in.

**Checkpoint before classification**, per the source specification's phase order.
Rejected: it requests approval to resolve threads before any thread has been read, while
the same specification reserves ambiguous threads for the human. The two cannot both hold.
Moving classification ahead of the ask costs nothing — the threads are already fetched by
then — and makes the approval name its own subject.

## Open questions

All three original questions are answered and recorded as invariants in
`design/20-contract.md`; they are kept here with their answers so the reasoning is not lost
to a diff. Nothing in this design is currently blocked on information I do not have.

1. ~~What should the waiter do when a pull request has no checks configured?~~
   **Answered: `NotEvaluated`** (I8). Zero checks is trivially "nothing pending", which
   would have reported green and permitted resolution on a repository with no CI. Reporting
   *unknown* blocks this path in every repository without workflows, and the kit installs
   into repositories that have none — that narrowing was accepted, because the alternative
   reports absence of failure as presence of success.
2. ~~Should `/fix` open an issue for a defect that arrived as a description?~~
   **Answered: yes, after reproducing** (I10, I11). The apparent conflict with "bugs are
   filed by hand" dissolved on inspection: the reason `/track` does not open them is that a
   bug has no upstream document to make the write idempotent, which is a fact about
   `/track` and not a rule that bugs are sacred. The decisive argument was the other way
   round — `.github/ISSUE_TEMPLATE/bug.md` states that a bug issue **is** the
   specification, so a described defect that never becomes an issue has no authority
   document, and `fix.md` would have to carry those constraints itself, duplicating a file
   that declares itself their home. Filing after reproduction rather than before makes the
   `Reproduce` section evidence instead of a claim; a defect that cannot be reproduced is a
   diagnosis task and is never filed as a bug.

The residual cost of 2, accepted: an issue now enters the tracker without a human having
first decided the defect is real. Reproduction is what stands in for that judgement, which
is weaker than a person reading it, and it is the reason I11 exists.
3. ~~Does the batch apply when the pull request belongs to someone else?~~
   **Answered: unavailable** (I9). `AGENTS.md` already scopes every tracker carve-out to a
   repository the user owns and that is the one boundary it does not relax; the batch is a
   carve-out of the same kind, so it stops at the same line. Actions are requested
   individually there, exactly as today — a foreign repository loses the compression, not
   the capability.
