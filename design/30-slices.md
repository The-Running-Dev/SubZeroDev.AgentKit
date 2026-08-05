# Slices — the defect-to-merge path

> Scoped to `design/10-design.md` and `design/20-contract.md`, which cover one path and not
> the whole kit. Read the scope warning in the design doc first.

Three slices. The riskiest assumption in the design is that a check result can be tied to a
named head SHA reliably enough to gate an irreversible action on it — S1 does nothing else,
so that is proven or disproven before any policy changes.

`/track` should be run after this document is reviewed. **Do not open issues from here.**

## Contract questions

**None outstanding.** `design/20-contract.md` § Unresolved is empty: zero checks configured
yields `NotEvaluated` (I8, exercised by S1.10), the batch is unavailable in a repository the
user does not own (I9, stated by S2.9), and `/fix` files a bug issue after reproducing and
implements against its agent block (I10 and I11, exercised by S3.11–S3.14).

A slice that discovers something undetermined stops and adds it to § Unresolved. It does not
resolve it in the implementing session.

---

## S1 — Wait for a pull request's checks against a named commit

Delivers: A script that watches a pull request's checks until they finish and says plainly
whether they passed, failed, or could not be judged — and that refuses to answer at all if
someone pushed a new commit while it was watching. Today every command that says "confirm
the checks are green on the new head SHA" leaves the reader to do that by eye, which is how
a stale result gets treated as a fresh one.

Touches: `tools/Wait-PullRequestCheck.ps1`, `tools/Wait-PullRequestCheck.Tests.ps1`,
`.github/workflows/verify.yml`

Depends on: none

Acceptance:
  - S1.1 Invoked with `-PullRequest` and `-HeadSha` where every check has concluded and
    none failed, emits a `WaitResult` with `State = Passed`, `HeadSha` equal to the
    argument, every check named in `.Passed`, and exits 0.
  - S1.2 Where at least one check has a failing terminal bucket, emits `State = Failed`
    with that check in `.Failed` carrying its bucket verbatim, and exits 1.
  - S1.3 Where a check is non-terminal on the first read and terminal on a later one, the
    script polls rather than returning early: `.PollCount` is greater than 1 and the final
    state reflects the later read.
  - S1.4 Where `-HeadSha` does not match the pull request's current head, emits
    `State = NotEvaluated` and `Failure = HeadMoved`, exits 2, and **`.Passed` and
    `.Failed` are both empty** — it reports no check outcome at all.
  - S1.5 Where a bucket outside the recognised sets is returned, emits
    `State = NotEvaluated` and `Failure = UnknownBucket` with the bucket string reproduced
    verbatim in the result, and exits 2. It never reports `Passed`.
  - S1.6 The set of terminal buckets is established by reading `gh`'s own output or
    documentation during implementation, not from memory, and the source is named in the
    script's comment header.
  - S1.7 `-TimeoutSeconds` elapsing with a check still non-terminal yields
    `Failure = TimedOut` with that check in `.NotRun`, exit 2.
  - S1.8 Pester tests cover S1.1–S1.5 and S1.7 with `gh` stubbed, and the run states the
    count of passing and failing cases separately — the negative cases S1.4, S1.5 and S1.7
    must each be shown failing when the guard they test is removed.
  - S1.9 The script completes with no interactive prompt under `pwsh` on Windows, and
    `verify.yml` runs the new test file alongside the existing `Measure-Session` tests.
  - S1.10 Where the pull request reports zero checks, emits `State = NotEvaluated` and
    `Failure = NoChecksConfigured`, exits 2, and does **not** report `Passed` — covered by
    a Pester case counted among S1.8's negative cases.

Out of scope: Any change to `resolve.md` or `pr.md` to call this script. The script ships
standing alone and unused; wiring it up is S2.

---

## S2 — One approval covers push, pull request, and the threads it names

Delivers: `/resolve` stops asking separately for each external step. It classifies every
review thread first, then asks once — naming the exact threads it intends to resolve — and
that single yes covers pushing, updating the pull request, and resolving those threads and
no others. Threads that appear afterwards, which is what a fresh bot review produces, need
a new ask rather than riding on the old one.

Touches: `AGENTS.md` (*Git and delivery*), `.claude/commands/resolve.md`,
`design/90-decisions.md`

Depends on: S1

Acceptance:
  - S2.1 `AGENTS.md` defines the authorization batch: the actions it may cover, that its
    thread ids are fixed when the approval is requested, and that it does not outlive the
    response acting on it. It is stated once, in `AGENTS.md`, and cited elsewhere.
  - S2.2 `resolve.md`'s order of operations places full classification before the approval
    request, and the approval request enumerates `PRRT_` ids.
  - S2.3 `resolve.md` discharges "confirm the checks are green on the new head SHA" by
    calling `Wait-PullRequestCheck.ps1` with the pushed SHA, and states that resolution
    proceeds only on `State = Passed`.
  - S2.4 `resolve.md` requires re-querying threads after the wait, and states that any
    thread not in the granted batch requires a fresh ask.
  - S2.5 The GraphQL query in `resolve.md` paginates to exhaustion (`--paginate`, with the
    inner `comments` connection's `pageInfo` used), and the file states that classifying
    from a partial fetch is the failure the pagination prevents.
  - S2.6 `resolve.md` still owns the five classes and the `Never` list, and `AGENTS.md`
    does not restate them; the batch rule in `AGENTS.md` does not restate the classes.
  - S2.7 A `design/90-decisions.md` entry records the batch in the logged format, naming
    the rejected alternatives — the specification's pre-classification checkpoint, a
    session-level standing authorization, and keeping resolution as its own separate ask.
  - S2.8 The entry states explicitly that the `/slice` draft-PR carve-out does **not**
    justify batching resolution, and that the batch rests on classification-first instead.
  - S2.9 `AGENTS.md` states that the batch is **unavailable** in a repository the user does
    not own, and that actions are requested individually there — the same boundary every
    other carve-out in *Tracking work* stops at.

Out of scope: `/fix`, and any `README.md` or `kit-help.md` change. Also `/pr` — it may call
the waiter too, but changing two commands in one slice means a failure cannot be attributed
to one of them.

---

## S3 — A defect that is not a slice gets a front door

Delivers: `/fix` — the entry point for a bug reported as an issue or described in a
sentence, which today has no command. `/slice` needs a slice id and a contract signature; a
bug has neither. `/fix` reproduces the defect first, makes sure there is a bug issue to work
against — filing one from the template if the defect arrived as a sentence — then branches,
fixes, runs the repository's gates, and hands off to the same single approval S2
established. The issue is the specification it obeys, so the command itself stays short.

Touches: `.claude/commands/fix.md`, `AGENTS.md` (*Command routing*, *Session boundaries*,
*Tracking work*), `README.md`, `.claude/commands/kit-help.md`, `design/90-decisions.md`

Depends on: S2

Acceptance:
  - S3.1 `fix.md` exists, takes an issue number or a description, and derives the branch as
    `fix/<issue>-<slug>` — after the issue exists, never before.
  - S3.2 It reproduces before filing, branching, or editing, and where the defect cannot be
    reproduced it stops and reports a diagnosis task: no issue is filed, no branch is
    created, no code is touched.
  - S3.3 It references `/verify`, `/pr`, `/resolve` and `.github/ISSUE_TEMPLATE/bug.md` by
    name, and restates none of their content — no gate list, no classification table, no
    GraphQL query, no merge rule, and **no copy of the bug template's agent block** appears
    in `fix.md`.
  - S3.4 It never edits `design/`, never marks a pull request ready, never resolves a
    thread, and never merges. Each is stated.
  - S3.5 `AGENTS.md` *Command routing* gains a `/fix` row at `sonnet`/`medium`, with the
    escalation condition named.
  - S3.6 `AGENTS.md` *Session boundaries* states that `/fix` → `/verify` → `/pr` →
    `/resolve` share one session, for the same reason the slice loop does — the did-not-run
    list must be carried verbatim.
  - S3.7 `README.md` § *Stage map* and `kit-help.md` place `/fix` outside the numbered
    stages, alongside `/verify`, `/pr` and `/resolve`.
  - S3.8 The command name is checked against Claude Code's built-in commands before the
    file is created, the way `install-all` was, and the check is reported.
  - S3.9 A `design/90-decisions.md` entry records `/fix`, naming as rejected: extending
    `/slice` to defects, and one command carrying the whole ten-phase specification. It
    also records the issue-filing decision, naming as rejected never filing one — which
    would force `fix.md` to carry the template's constraints — and filing before
    reproducing, which mislabels an unreproducible report as a bug.
  - S3.10 `resolve.md` contains no reference to `fix.md` — the dependency runs one way only.
  - S3.11 On the description path, `/fix` files one issue from
    `.github/ISSUE_TEMPLATE/bug.md` **after** reproducing, with the reproduction as its
    `Reproduce` section, and states the issue number it is then implementing against.
  - S3.12 `/fix` states that the issue's `<!-- agent:start -->` block is its specification,
    and obeys its stop conditions — contract change, adjacent defects, verify-by-reverting —
    without restating them. Only two stop conditions are `fix.md`'s own, because they
    precede the issue: a dirty tree, and a defect that will not reproduce.
  - S3.13 Where the repository has no `.github/ISSUE_TEMPLATE/bug.md`, the description path
    stops and says the authority document is absent; the issue-number path is unaffected.
  - S3.14 `AGENTS.md` *Tracking work* records that `/fix` files a bug issue on the
    description path — narrowing "bugs and stories are filed by hand", which names `/track`
    — and that it never files one for a defect it could not reproduce.

Out of scope: Any change to `/verify`, to `.github/ISSUE_TEMPLATE/bug.md` itself, or to
`tools/Sync-Kit.ps1` — which does not exist yet, but whose future author must not hardcode
the kit-owned file count that this slice changes.
