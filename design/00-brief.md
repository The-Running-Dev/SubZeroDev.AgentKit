# Brief — explicit design state for the agent kit

> **The content here is mine.** A model may interrogate it (`/brief-check`), and may type it
> under my direction, but may not invent the problem, the non-goals, or the definition of
> done. Where a line below was derived from the repository rather than dictated, it says so.

> *At SubZeroDev, we use AI to automate writing donkeys. The purpose of this redesign is to
> stop doing that.*

## Problem

An expensive reasoning model reconstructs the project's current design state from prose every
time it needs to work on the project. The design is encoded implicitly, spread across
documents, so checking that any two parts of it still agree requires semantic reasoning —
there is no cheaper way to ask the question.

The cycle, as it actually runs: design documents are written; contracts, schemas and
assumptions evolve; implementation discovers things that invalidate earlier decisions; some
documents are updated and others are not; the documents drift from each other and from the
tree; a high-reasoning model rereads a large part of the corpus, reconstructs what the
architecture now is, finds the contradictions, the obsolete decisions and the missing updates,
and rewrites the documents. Then development continues and it repeats.

This is observable in the repository, not inferred:

- **The reconstruction is generative, so it has no fixed point.** `design/90-decisions.md`
  (2026-08-10) measured one turn of it in `SubZeroDev.SkyNetHR`: 22 commits, one of which
  touched `src/`; roughly 14,600 lines of design churn against 3,222 lines of source, with
  `design/` at HEAD running 6,733 lines specifying 3,222 lines of software. Landing S1 produced
  a reconciliation that emitted sixteen decisions and 534 lines of design change — which
  rewrote S2's acceptance criteria before S2 had been started.
- **Reconstruction produces forks that carry no decision.** `design/90-decisions.md`
  (2026-08-11): `20-contract.md` declared `enum CheckState`, `enum WaitFailure`,
  `class CheckRunResult` and `class WaitResult` against a script that declares none of them.
  That is live contract drift, a fork `/reconcile` would raise and an `opus` decision to
  settle, with no behaviour either way.
- **The corpus that has to be reconstructed is already the largest artifact here.**
  `design/90-decisions.md` is 133,512 bytes across 54 append-only entries, and it — not
  `design/10-design.md` — is where the kit's twenty-one commands were designed.
  `10-design.md` covers one path through the kit and nothing else; it, `20-contract.md` and
  `30-slices.md` each open with a warning saying so.
- **Work state is a second database made of Markdown checkboxes.** Acceptance criteria live in
  `design/30-slices.md` and are copied into GitHub issues, which already carry completion,
  history, labels, milestones, dependencies and review state natively. The two then have to be
  kept in agreement. `design/90-decisions.md` (2026-08-10) records the failure this invites: a
  repin claimed as done had been applied to one issue of seventeen, with fourteen still citing
  a commit that was not an ancestor of `main`, and nothing in the repository able to say so.

Partial mitigations exist and are not the fix. `design/FROZEN.md` stops the loop by permitting
known staleness rather than removing its cause. `/track` syncs slices into issues, which keeps
two databases agreeing rather than collapsing them to one. `tools/Test-DesignDrift.ps1` takes
criterion-id set arithmetic and pin ancestry off the model, which is the mechanical sliver of a
much larger comparison. `design/30-slices.md` retires landed slice bodies, and `20-contract.md`
states only what the tree cannot — both shrink what a pass can touch without changing what a
pass is. Each was the right local move; together they reduce the blast radius of the cycle and
leave the cycle running.

**The problem is the repeated semantic reconstruction, not the number of Markdown files.**

## Who it is for

Derived from the repository, not dictated — correct any line that is wrong.

One human — me — working through agent sessions, plus the agent sessions themselves as the
other consumer. I am the only author of design state and the only adjudicator of a divergence.

The kit runs under three vendors: Claude Code, Codex, and Copilot. `AGENTS.md` (*Session
boundaries*) **requires** a second vendor for `/redteam`, so anything a single vendor's tooling
can read and another cannot is not usable here.

The kit is installed in eighteen `SubZeroDev.*` repositories. This brief's subject is the
kit-owned mechanism, proven on this repository's own corpus as its first and only migration;
those eighteen are owed a compatibility promise and are not migrated here (see *Non-goals*).

## Non-goals

Binding. Out of scope for every agent, permanently, until this file changes — including when
one of them looks trivial, and including when a session is already touching that file.

- **No target repository is migrated.** The eighteen installed `SubZeroDev.*` repositories are
  owed a compatibility promise (see *Definition of done*) and nothing more. `/install`,
  `/install-all`, `/kit-sync` and `tools/Sync-Kit.ps1` are not in scope for change beyond what
  that promise requires.
- **The existing decision log is not retroactively restructured.** `design/90-decisions.md`
  stays append-only prose. Live facts are extracted out of it; the entries themselves are not
  rewritten, reformatted, split, or reordered.
- **Answering "what is the current design" never requires a network round-trip, a running
  service, or a background process.** No daemon, no server, no index that must be rebuilt
  before the question can be asked.
- **Multi-vendor support is not dropped.** Anything only one vendor's tooling can read is
  disqualified. `AGENTS.md` (*Session boundaries*) requires `/redteam` to run on a different
  vendor from the design author, so a single-vendor representation would break the pipeline's
  one adversarial gate.
- **The human is not removed from adjudication.** Where a divergence needs judgement, it is
  reported and I decide. Nothing resolves a judgement call on my behalf.
- **Model routing and tier policy are not changed.** The table in `AGENTS.md` (*Model, effort,
  and review budget*), the vendor alias list, and *Command routing* are not this project's to
  edit. Spending less reasoning is the goal; redefining which model does what is a different
  project. **This bars the edit, not the topic.** Taking a command's mechanical half out of a
  session altogether — so that no model runs it, rather than a cheaper one — is that different
  project's to define, and this line neither authorises it here nor forecloses it there.
  Whichever project makes such a change owns the *Command routing* edit it implies.
- **No formal specification of behaviour.** No specification language, model checking, proofs,
  or executable specification of what the software does. Assertions about *references and
  existence* — this path exists, this id is present, this commit is an ancestor — are in scope;
  assertions about behaviour are not.
- **Design state never writes to the tree.** No source generated from a contract, no code
  edited to make a divergence go away, no auto-resolution in the design's favour. Design state
  is compared against the tree and never authors it. This does not conflict with the
  overwriting of marked prose regions described under *Definition of done*: generated
  documentation is not code.
- **No dashboard, query UI, or web view.** Nothing to serve, host, or open in a browser.
- **What a slice is, and the session-boundary rules, do not change.** A slice remains a
  vertical unit of work with acceptance criteria; `AGENTS.md` (*Session boundaries*) is
  untouched. **Where** slice data lives may move; **what a slice is** may not.

## Definition of done

Every line is a statement that can be observed to be true or false. A line that cannot be
checked is not finished being written.

**Explicit current state**

- For any named unit — a command file, a `tools/` script, a document, or an invariant, with the
  set fixed by `design/20-contract.md` § *Artifacts of a unit kind* — the current design state
  about it is obtainable
  **without opening `design/90-decisions.md`**: contracts it consumes, contracts it exposes,
  invariants that apply to it, accepted decisions, superseded decisions, unresolved questions
  affecting it, dependent GitHub work, and implementation evidence.
- The design state loaded to begin work on any one named unit — its own record and the one hop
  of records that record references — is **at most 16,384 bytes**, **excluding that unit's own
  artifact and its retired companion**. Checked mechanically across every unit, with the largest
  one named in the report. This ceiling is fixed and does not rise as the corpus grows.
- **The companion is excluded because retirement is what moves bytes out of the bound.** A
  session beginning work reads the active half; the archival half is where superseded decisions
  and retired edges go precisely so they stop being read. Counting it would make retirement move
  bytes from one counted file to another and save nothing — which is the whole of what the
  two-file split buys. **This is a correction, not the widening *Abandonment* below forbids.**
  The mechanism has never counted the companion, `design/10-design.md` and `design/20-contract.md`
  have always said it does not, and this line was the outlier that said otherwise; no measured
  number changes, because no companion is large enough to have moved one.
- **That unit's own artifact is measured and reported beside the bounded number on every run,
  and is itself never bounded.** It is not design state — it is what design state is *about* —
  and for any one unit it is a constant, paid for opening the file the session came to work on.
  Counting it inside the bound made every measurement a verdict on file size rather than on the
  mechanism, which is a claim this brief never set out to make and cannot act on; omitting it
  from the report instead would certify a number nobody reads against. So it is excluded from
  the budget and reported in full, always, and the two numbers are named separately.
- No existing entry in `design/90-decisions.md` is modified. Checkable: this project's commits
  to that file show additions only — no line of a pre-existing entry is deleted, reordered, or
  reformatted.

**Authority and overwriting**

- Every prose region derived from structured state is delimited by an unambiguous
  machine-readable boundary.
- Regeneration is proven in both directions, with counts stated: a hand edit **inside** a
  marked region is gone after regenerating, and a hand edit **outside** one survives it. A
  mechanism that has never overwritten anything is not known to overwrite; one that has never
  preserved anything is not known to preserve.
- `AGENTS.md` (*Tracking work*) states the marked-region rule, and exactly one document states
  it.

**Work state**

- No file in the repository is the authority for a slice's acceptance criteria. GitHub is.
- From a checkout with **no network**, a reader can still obtain the outstanding work list, its
  order, and each item's criteria.

**Divergence**

- A single named document carries a closed list of divergence classes that fail CI. Every class
  not on that list is reported and never fails a build.
- The CI check has **rejected at least one real divergence of each blocking class and accepted
  at least one near-miss**, with both counts stated. A validator that has never failed is not
  known to constrain anything.
- While `design/FROZEN.md` exists, no blocking class fails CI. Exercised by a test, not
  asserted.

**Offline and unaided**

- A person with a `git clone`, no network, no agent, and no tooling can read the current design
  state directly. Checkable: the artifacts are opened and read, with nothing run.

**Cost**

- A baseline is recorded and committed **before any change lands**: `tools/Measure-Session.ps1`
  output for a named, repeatable workflow run against the current corpus.
- The same workflow is re-run after the change and the two measurements are reported side by
  side. The report states that measurement covers Claude Code only, and names Codex and Copilot
  as unmeasured.

**Compatibility, and what is not migrated**

- Only `SubZeroDev.AgentKit`'s own `design/` is migrated. No other repository is.
- After the change, `/install-all` across the eighteen installed targets reports **zero hard
  stops attributable to this work**. An unmigrated target keeps working exactly as it does now.

**Abandonment**

- If the 16 KB ceiling cannot be met on this repository's own corpus **once every executed
  decision has been given its site**, the project **stops and reports** rather than relaxing the
  ceiling. A relaxed ceiling is the failure mode this brief exists to prevent, not a smaller
  version of success.
- **The number has not moved and does not move: 16,384 bytes.** What was re-scoped on
  2026-09-01 is what it counts, not how much it allows — see `design/90-decisions.md` for the
  evidence that forced it. A later change that raises the number, or that quietly widens what is
  excluded from it, is the relaxation this line forbids. The 2026-09-05 companion correction is
  the only exclusion added since, and § *Definition of done* above states why it is a correction
  rather than a widening.

*(The abandonment line is mine to propose and yours to strike — it is the one criterion here
that was not derived from an answer you gave.)*

## Environment

Marked lines are derived from the repository rather than dictated — correct any that is wrong.

**Concurrency.** One author of design state: me. Sessions are sequential by policy, not by
lock — `AGENTS.md` (*Session boundaries*) requires a fresh session at each stage boundary, and
nothing prevents two running at once. *(derived)* Nothing needs to survive two sessions writing
design state simultaneously on divergent branches; git's own conflict handling is the whole
concurrency story.

**Platform.** Windows host, PowerShell Core, projects under `D:\Dropbox\Projects\`. Every
file in `tools/` is a `.ps1`. CI is GitHub Actions on `windows-latest` (`verify.yml`).
*(derived from `AGENTS.md` § House conventions and the tree.)*

**Vendors.** Claude Code, Codex, and Copilot. `tools/Measure-Session.ps1` reads Claude Code
transcripts only: Codex writes a schema it has no reader for, and Copilot records no token
usage at all. Any measured claim about cost is therefore available under one vendor of three,
and must say so.

**Offline.** A plain `git clone` with no network, no agent, and no tooling must be able to
answer *what is the current design*, read directly by a human. Work state may require the
network (GitHub is authoritative for it) provided a checkout can still answer what the work is
and in what order.

**Scale, measured at `6bdd8dc` — the commit before this brief was written.**
`design/90-decisions.md` is 133,512 bytes across 54 append-only entries. `design/` totals
166,733 bytes; adding `AGENTS.md` (34,899), `agent.md` (7,566) and `.claude/COMPANIONS.md`
(7,196), the standing corpus a session reads to orient is 216,394 bytes. The kit has 21 command
files, ten scripts and seven Pester test files in `tools/`, five documents in `design/`, and
thirteen numbered invariants (I1–I13). It is installed in eighteen repositories.

These figures are a **baseline**, not a description — they are what the *Cost* criteria are
measured against, and they are expected to be out of date the moment anything lands.

**Rate of change.** Measured over the repository's whole history, 2026-08-03 to 2026-08-19:
36 of 79 commits touch `design/` — 46%, averaging about two a day. The corpus grows
monotonically; `design/90-decisions.md` is append-only and nothing is ever removed from it.

**Repositories not owned.** The kit is used in repositories where every external write is
requested individually (`AGENTS.md`, *Tracking work*; invariant I9). Nothing may assume write
access to a tracker.

## Lifespan

**Maintained for years.** This becomes standing infrastructure that the kit ships. That
justifies the full pipeline on it — `/design`, `/contract`, `/redteam` on a second vendor per
`AGENTS.md` (*Session boundaries*), then `/slices` — and it is why the compatibility promise to
the eighteen installed targets is in the definition of done rather than treated as someone
else's problem later.
