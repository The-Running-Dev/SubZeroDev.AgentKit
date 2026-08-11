# Contract — the defect-to-merge path

> Scoped to `design/10-design.md`, which covers one path and not the whole kit. Read that
> file's scope warning first.

Two languages are under contract here, and they are not carried the same way.

`tools/` is PowerShell Core, and its shape — parameter lists, result fields, the state and
failure vocabularies — **is declared in the scripts themselves and is not restated here**
(`AGENTS.md`, *Single ownership*). This document names where each declaration lives and
then states what a declaration cannot: when a field is meaningful, what may never be
normalised, which parameter must not acquire a default and what that would defeat.

`.claude/commands/` is Markdown loaded into a model. It has no separate declaration to
point at, so its surface is stated here in full — invocation, what it reads and writes,
what it must output, what it must not do — which is what gives `/reconcile` something to
compare a command file against.

## Types

| Entity | Declared in | What the declaration cannot say |
|---|---|---|
| `WaitResult` | `tools/Wait-PullRequestCheck.ps1`, `New-WaitResult` | `Failure` is meaningful **only** when `State` is `NotEvaluated`; on `HeadMoved` the check collections are empty by design, because a moved head means no outcome was observed for the SHA asked about |
| `CheckRunResult` | `tools/Wait-PullRequestCheck.ps1`, `New-CheckRunResult` | `Bucket` is reproduced **verbatim from `gh`** and is never normalised, mapped, or lower-cased on its way out — a bucket nobody recognises must survive intact to be reported |
| The `State` vocabulary | same file, `Get-WaitExitCode` | The three states map to exit codes 0/1/2, and `Failed` is **not** an error: the script succeeded at determining a check failed |
| The `Failure` vocabulary | same file, the `Invoke-Wait` return paths | Enumerated with its raising conditions under *Error semantics* below, which is where the meaning lives |
| The drift result | `tools/Test-DesignDrift.ps1`, `New-DriftResult` | `Findings` and `Failures` are **not interchangeable**: a finding is "the two sides disagree", a failure is "this comparison did not happen". A non-empty `Failures` forces the whole run to *could not evaluate* however many findings it also collected (I12) |

`ThreadClass` is **not declared here.** Its five values and their meanings are owned by
`.claude/commands/resolve.md`, which is the canonical copy; declaring them a second time
is the divergence *Single ownership* forbids. Where this contract needs to refer to one it
names the class in prose.

`AuthorizationBatch` has no code representation. It is a conversational structure, and its
invariants are I3 and I4 below.

## Persisted schemas

**None.** No file, no cache, no state directory. This is a deliberate constraint, not an
absence: a persisted classification or approval is one that can be reused after the fact
it rested on has changed.

Migration story: not applicable, and any future proposal to persist any of this needs its
own decision-log entry naming what stops a stale record being trusted.

## Public surface

### `tools/Wait-PullRequestCheck.ps1`

**The parameter list is the script's own `param` block and is not copied here.** Read it
there. What that block cannot state, and what a change to it must preserve:

- `-HeadSha` is **mandatory and has no default, permanently.** Defaulting it to the current
  head is the one convenience that would defeat I2, the invariant the whole script exists
  to enforce — so this is a constraint on every future edit, not a description of today's
  signature.
- The `WaitResult` is emitted on the success stream **always, including on every failure
  path.** A caller that gets an exception loses the partial check list, which is the part
  worth reporting.
- Exit codes carry the state: 0 `Passed`, 1 `Failed`, 2 `NotEvaluated`. A caller branching
  on the exit code and a caller reading `.State` must reach the same conclusion.
- Never prompts. Never re-runs a check. Never merges, resolves, or writes anything.
- `-Quiet` suppresses the progress line only; the `WaitResult` is always emitted.

### `tools/Test-DesignDrift.ps1`

**The parameter list is the script's own `param` block and is not copied here.** What it
cannot state:

- It is **read-only against both sides.** It never edits `design/`, never edits an issue,
  and never opens or closes one. Which side of a drift is wrong is the user's call
  (`AGENTS.md`, *Tracking work*) — this script only establishes that the two disagree.
- Exit codes: 0 no drift, 1 drift found, 2 could not evaluate. **1 and 2 are different
  answers and must never collapse into each other** — "the ids disagree" is a finding,
  "`gh` is not authenticated" is the absence of one, and reporting the second as the first
  is the fabricated gate result *Verification* exists to prevent.
- A criterion id it cannot parse is reported as unparseable, never silently dropped. A
  dropped id is an id that appears to match.

### `.claude/commands/fix.md`

| | |
|---|---|
| Invocation | `/fix <issue number>`, `/fix <description>`, or `/fix` with a failing test in context |
| Reads | the defect source; **the bug issue's agent block**; the repository's gates via `/verify`; `AGENTS.md` |
| Writes | one branch, one or more commits, one draft pull request, and — only on the description path, only after reproducing — **one bug issue** |
| Must output | the reproduction evidence; the issue number it is implementing against; `/verify`'s three lists; the batch request; the pushed SHA; the `WaitResult` |
| Must not | edit `design/`, mark a pull request ready, resolve a thread, merge, or open an issue for a defect it did not reproduce |

**Stop conditions are not enumerated here.** They are owned by the `<!-- agent:start -->`
block in `.github/ISSUE_TEMPLATE/bug.md`, which states that a bug issue *is* the
specification and carries its constraints rather than pointing at them. `/fix` obeys that
block; it does not carry a second copy of it. Two conditions are `/fix`'s own, because they
precede the issue existing: the tree is dirty with work that is not this defect's, and the
defect cannot be reproduced.

Where the repository has no `.github/ISSUE_TEMPLATE/bug.md` — `INSTALL.md` stops rather
than overwriting an existing template set, so a target may have its own or none — `/fix`
reports that the authority document is absent and stops on the description path. The issue
path is unaffected, since the issue it was given carries whatever block that repository
uses.

### `.claude/commands/resolve.md` — amended, not replaced

The existing contract stands. Three changes:

| | |
|---|---|
| Ordering | Classification completes **before** the batch is requested |
| Delegation | "Confirm the checks are green on the new head SHA" is discharged by `Wait-PullRequestCheck.ps1`, not by reading `gh pr checks` by eye |
| Authorization | Cites the `AGENTS.md` batch rule rather than asking per action |

Everything else — the GraphQL query, the five classes, the fixed order, the report shape,
the `Never` list — is unchanged and stays owned by that file.

## Error semantics

### `Wait-PullRequestCheck.ps1`

| `WaitFailure` | Raised when | Retryable | Caller does |
|---|---|---|---|
| `HeadMoved` | `-HeadSha` ≠ the PR's current head | Yes, with the new SHA | Re-push or re-read the head, then call again. **Never** re-call with the old SHA |
| `TimedOut` | A check is still non-terminal at `-TimeoutSeconds` | Yes | Report the named checks as did-not-run. **Do not resolve** |
| `UnknownBucket` | A bucket outside the known sets | No | Stop. Report the bucket verbatim; the set needs widening deliberately |
| `NoChecksConfigured` | The pull request reports zero checks | No | Report that nothing was evaluated. **Do not resolve.** A repository with no CI cannot satisfy I1 by this route, and the honest answer is that the evidence does not exist rather than that it was favourable |
| `GhUnavailable` | `gh` missing or unauthenticated | No | Report as a gate that did not run, per `/verify` |
| `PullRequestMissing` | No such PR | No | Stop |

`State = Failed` is **not** an error — the script succeeded at determining that a check
failed. It exits 1 so a caller can branch on it, and the failing checks are in `.Failed`
with their buckets.

No bare `throw` of a string, and no terminating error for any of the five conditions above:
each returns a `WaitResult` carrying the reason, because a caller that gets an exception
loses the partial check list, which is the part worth reporting.

### Commands

A command's error semantics are its stop conditions. Both files above must stop and report
rather than route around; neither may substitute an adjacent action for a blocked one.

## Invariants

| | Statement | Owner |
|---|---|---|
| **I1** | No thread is resolved unless its class is `Defect`, its fix is in a commit reachable from `HeadSha`, and the `WaitResult` for that SHA has `State = Passed` | `resolve.md` |
| **I2** | `Wait-PullRequestCheck.ps1` never reports `Passed` or `Failed` for a SHA that was not the pull request's head at the moment it read the checks | the script |
| **I3** | A batch authorizes exactly the thread ids enumerated when it was granted, and no others | `AGENTS.md` |
| **I4** | A batch does not outlive the response that acts on it | `AGENTS.md` |
| **I5** | Every `reviewThreads` query paginates to exhaustion before any thread is classified | `resolve.md` |
| **I6** | `/fix` never writes to `design/` | `fix.md` |
| **I7** | An unrecognised check bucket yields `NotEvaluated`, never `Passed` — the script fails closed | the script |
| **I8** | A pull request with zero checks configured yields `NotEvaluated`, never `Passed` | the script |
| **I9** | The batch is **unavailable** in a repository the user does not own. Every action in it is requested individually there, as today | `AGENTS.md` |
| **I10** | `/fix` always implements against a bug issue's agent block — the one it was given, or the one it filed after reproducing. It never carries its own copy of those constraints | `fix.md` |
| **I11** | `/fix` never opens an issue for a defect it could not reproduce. That is a diagnosis report to the user, not a bug | `fix.md` |
| **I12** | `Test-DesignDrift.ps1` never reports a clean run for a comparison it could not complete — an unreadable tracker, an unparseable criterion id, or an unresolvable pin yields *could not evaluate*, never *no drift* | the script |
| **I13** | `Test-DesignDrift.ps1` writes nothing: not `design/`, not an issue, not git. It establishes that two sides disagree and stops there | the script |

I1 and I2 are the pair that matter. I2, I7, I8, I12 and I13 are the invariants enforced by
code rather than by instruction, and they are the only ones a reader may trust without
checking. I1 is the rule I2 exists to make enforceable.

**I12 and I13 are scope creep, knowingly taken.** `Test-DesignDrift.ps1` is not part of the
defect-to-merge path this document covers; it is contracted here because there is no other
contract document in the repository, and an uncontracted script is one nothing can be
checked against. If a second path is ever designed, these two move with the script.

I8 is the deliberate cost of I1. "No checks ran" and "checks ran and passed" are different
facts, and only one of them is evidence. A repository with no CI therefore cannot reach
resolution through this path at all — that is a real narrowing, taken knowingly, because
the alternative reports absence of failure as presence of success on exactly the action
that cannot be noticed afterwards.

## Unresolved

**None.** All three of the original open questions in `design/10-design.md` are answered
and appear above as I8, I9, and I10–I11 respectively. Every signature S1–S3 need is
determined, so `/slice`'s "the contract does not contain a signature you need" stop
condition should not fire on any of them.

Anything a slice discovers to be undetermined belongs here as a new item, with the slice
stopping — not resolved in the implementing session.
