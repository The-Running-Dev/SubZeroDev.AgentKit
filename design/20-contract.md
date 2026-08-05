# Contract — the defect-to-merge path

> Scoped to `design/10-design.md`, which covers one path and not the whole kit. Read that
> file's scope warning first.

Two languages are under contract here. `tools/` is PowerShell Core, and its contract is a
parameter block and an exit code. `.claude/commands/` is Markdown loaded into a model, and
its contract is its invocation, its required output, and its stop conditions — stated
here so `/reconcile` has something to compare a command file against.

## Types

```powershell
enum CheckState {
    Passed      # every check reached a terminal bucket, none failed
    Failed      # at least one check reached a failing terminal bucket
    NotEvaluated # head moved, timed out, or a bucket was not recognised
}

enum WaitFailure {
    HeadMoved          # -HeadSha is not the pull request's current head
    TimedOut           # -TimeoutSeconds elapsed with a check still non-terminal
    UnknownBucket      # gh reported a bucket outside the terminal/pending sets
    NoChecksConfigured # the pull request has no checks at all
    GhUnavailable      # gh absent, not on PATH, or not authenticated
    PullRequestMissing # no such pull request, or issues/PRs disabled
}

class CheckRunResult {
    [string]   $Name
    [string]   $Bucket   # verbatim from gh, never normalised away
    [bool]     $IsTerminal
}

class WaitResult {
    [CheckState]        $State
    [string]            $HeadSha       # the SHA actually evaluated
    [CheckRunResult[]]  $Passed
    [CheckRunResult[]]  $Failed
    [CheckRunResult[]]  $NotRun        # non-terminal at timeout, or unrecognised
    [WaitFailure]       $Failure       # set only when State is NotEvaluated
    [int]               $PollCount
}
```

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

## Public signatures

### `tools/Wait-PullRequestCheck.ps1`

```powershell
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [int]    $PullRequest,
    [Parameter(Mandatory)] [string] $HeadSha,
    [string] $Repository,                    # owner/repo; defaults to the current remote
    [int]    $TimeoutSeconds   = 900,
    [int]    $PollSeconds      = 20,
    [switch] $Quiet
)
# Emits: [WaitResult] on the success stream, always, including on failure.
# Exit codes: 0 = Passed
#             1 = Failed
#             2 = NotEvaluated (inspect .Failure)
```

- `-HeadSha` is **mandatory and has no default.** Defaulting it to the current head is the
  one convenience that would defeat the invariant it exists to enforce.
- Never prompts. Never re-runs a check. Never merges, resolves, or writes anything.
- `-Quiet` suppresses the progress line only; the `WaitResult` is always emitted.

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

I1 and I2 are the pair that matter. I2 is the only invariant in this contract enforced by
code rather than by instruction, and I1 is the rule it exists to make enforceable.

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
