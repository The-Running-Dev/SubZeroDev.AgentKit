# Slices

> **Two paths appear here.** The **defect-to-merge path** landed as S1–S3; its bodies are
> retired to the index under `## Landed` and its design body to
> `git show dfd1cab:design/10-design.md`. The **explicit design-state mechanism**, designed in
> the current `design/10-design.md` and contracted in `design/20-contract.md`, is sliced under
> `## Outstanding` as S4–S17.

The riskiest assumption in the first path was that a check result can be tied to a named head
SHA reliably enough to gate an irreversible action on it — S1 did nothing else, so that was
proven before any policy changed.

The riskiest assumption in the second is the **16,384-byte closure ceiling**, because the brief
attaches an abandonment clause to it: if the ceiling cannot be met on this repository's own
corpus, the project stops and reports rather than relaxing it. S4 writes the records for the two
units most likely to blow it and completes their closures; S5 measures. The ceiling is therefore
exercised in the second slice of the set rather than at the end of the migration, and it is
re-measured at every migration slice after that.

`/track` should be run after this document is reviewed. **Do not open issues from here.**

## How this document is kept

**A slice's full body lives here only until it lands.** Once its issue is closed the body is
retired to the index below, which keeps the name, the issue number, and the commit the body
was last complete at. Nothing is lost — `git show <sha>:design/30-slices.md` returns it, and
the issue's agent block still pins `§ S<n> @ <sha>` for its own criteria.

The reason is the churn loop in `AGENTS.md`, *The design freeze*: a landed slice's criteria
have no reader left except a drift check, and every pass over them is a pass that can
rewrite the slice after it. Retiring them shrinks what any later pass can touch. `/reconcile`
is barred from this document outright (`.claude/commands/reconcile.md`), so the two rules are
the same rule from either end.

**`/slices` appends new slices under `## Outstanding`.** Never renumber, and never reuse a
retired id — criterion ids are cited by closed issues and are expensive to withdraw
(`design/90-decisions.md`, 2026-08-03).

**This convention is itself under review.** `design/20-contract.md` § *Unresolved* holds an open
item on what `## Outstanding` becomes once GitHub is the authority for acceptance criteria
(I28). Until it is resolved, this document behaves exactly as it does today and the slices
below are **proposals** rather than criteria — authority transfers when `/track` creates each
issue (`design/10-design.md`, § *WorkRef*).

## Contract questions

**Two outstanding and one answered.** The first is already an item in `design/20-contract.md`
§ *Unresolved*; the second was found by this re-run and is **not there yet**. A third was found
and **answered in the same session**, and what it obliges is recorded below rather than acted on
— writing all of it is `/contract`'s, at `opus`/`high`.

**Where the `outstanding` projection renders.** `design/20-contract.md` § *Unresolved* — *Where
a slice's criteria are rendered once GitHub is the authority* — does not determine which
document hosts it. That projection is in the projector's minimum set (`design/20-contract.md`
§ `tools/Update-DesignProjection.ps1`), so the gap reaches **S7** as well as **S14**. Both
slices name it and stop at it rather than choosing; neither adds a new item, because the item
is already there.

**What the invariant unit set is — answered.** § *Artifacts of a unit kind* took the difference
against `I<n>` **citations in `AGENTS.md` and the command files**, which picks out two ids;
§ *Invariants* says a row moves into the generated region the commit its record is written, and
the brief names an invariant as a unit whose state must be obtainable, which points at the whole
table. **The table holds** — decided 2026-08-19, on the ground that an invariant nothing happens
to quote is still a rule the kit binds itself to, and a set defined by citation makes the kind
nearly empty and splits § *Invariants* permanently.

The amendment is `/contract`'s and the log entry belongs in the same commit as it, so that no
window exists in which the log describes a contract that does not say it. Two things change
together: the `invariant` row of § *Artifacts of a unit kind*, and the citation scan in
`tools/Test-DesignState.ps1` that implements it. **S17** below is what the answer obliges, and
until it lands the checker reports the unwritten records rather than the three surplus ones it
reports today — the same interim state § *Interim findings are expected* describes, except that
CI is wired now and the build is red for the duration.

**Which class resolves a tree pointer that is not a unit's `Anchor`.** `AnchorMissing` is
scoped to `Unit` records by both this contract and the checker. `Contract.Declaration` and the
`Evidence` field on a unit or an invariant record are tree pointers, and no blocking class
resolves any of them — which is the unchecked restatement **I15** forbids. It reaches **S16**,
which cannot write a `Declaration` until it is answered, and **S17**, which writes an `Evidence`
pointer for every invariant the contract holds by code. It is already live in the tree, where
unit records carry `Evidence` pointers that nothing standing resolves.

A slice that discovers something *else* undetermined stops and adds it to § *Unresolved*. It
does not resolve it in the implementing session.

## Outstanding

### A note on counts

No slice below states how many records it must write. The unit set is fixed by the globs in
`design/20-contract.md` § *Artifacts of a unit kind*, and the count moves every time this
project adds a script or an invariant — including within this slice set. `UnrecordedArtifact`
is the check; a number written here would be a second copy that is wrong by the next commit.

### Interim findings are expected

The checker lands at S5 and CI is not wired until S12. Between those two points the check
reports real blocking findings on every run — unrecorded artifacts, unresolved ids, stale
projections — because the migration is deliberately partial. That is the designed state of the
repository during S5–S11, not a defect, and it is why S12 rather than S5 carries the CI wiring.

---

## S4 — The state set becomes readable, and today's cost goes on the record
Delivers: You can open a folder of plain Markdown files and read what is currently true about
a part of the kit — and run one command that reads those files back and tells you exactly which
line it could not understand, quoting it, rather than skipping it and carrying on. The same
session records what a piece of work costs today, so the claim that this project made things
cheaper can later be checked instead of argued.
Touches: `tools/Read-DesignState.ps1`, `tools/Read-DesignState.Tests.ps1`, `design/state/`,
         `design/cost.md`, `design/20-contract.md` (§ *Persisted schemas* grammar block; the
         I17 and I24 rows of § *Invariants*)
Depends on: none
Acceptance:
  - S4.1 `design/cost.md` exists and carries `tools/Measure-Session.ps1` output for a `/slice`
    session run against a corpus with **no `design/state/` directory**, naming the session, the
    slice measured, and the totals. It states that measurement covers Claude Code only and names
    Codex and Copilot as unmeasured.
  - S4.2 `tools/Read-DesignState.ps1` emits the graph on the success stream and raises no
    terminating error for any input: given a record in which every line is malformed, it returns
    a graph carrying one entry in `Failures` per unrecognised line and exits without throwing.
  - S4.3 A line matching no production is reported with its file, its line number, and the line
    text **byte-for-byte**. Across every file in `design/state/`, no line is absent from both
    `Records` and `Failures`.
  - S4.4 An absent `design/state/` yields a graph with `Root` empty, zero `Records` and zero
    `Failures`, and writes nothing to the error stream.
  - S4.5 `git status --short` is empty after a run against a state set — including a run whose
    every record failed to parse.
  - S4.6 Records exist for `unit/command/track` and `unit/document/agents-md`, and for **every id
    those two records name directly**, so that both closures are complete rather than truncated
    by absent records.
  - S4.7 A record whose `Id` line disagrees with the id its file path implies parses, and the
    graph carries both values, so the checker can raise `IdCollision` without re-reading the file.
  - S4.8 A field line appearing after the first `##` is reported as unparseable rather than
    accepted as a late field, and a field name appearing twice in one record is reported.
  - S4.9 A list field present with nothing after the colon parses as an empty list; an omitted
    list field leaves no entry for that field on the record. The two are distinguishable in the
    emitted graph.
  - S4.10 A record carrying `Consumers`, `BoundBy`, or an `Affects` field yields a `Failures`
    entry for that line — the grammar has no production for a derived edge (I17).
  - S4.11 `design/20-contract.md` § *Persisted schemas* no longer carries the grammar block; it
    points at `tools/Read-DesignState.ps1`, in the same commit, and the I17 and I24 rows of
    § *Invariants* read `Enforcement: code` with `tools/Read-DesignState.Tests.ps1` as evidence.
Out of scope: the checker, the projector, the mirror generator, any finding class, the closure
    meter, and records for any unit outside those two closures. No CI wiring.

---

## S5 — The checker, and the ceiling is either met or the project stops
Delivers: You can run one command and get three separate answers — what disagrees, what is
merely noted, and what could not be checked at all — plus the name of the unit whose design
state is the largest and how close it sits to the ceiling. If that ceiling cannot be met on this
repository's own material, this is the slice that says so and stops, rather than quietly raising
it.
Touches: `tools/Test-DesignState.ps1`, `tools/Test-DesignState.Tests.ps1`, `design/cost.md`,
         `design/20-contract.md` (§ *Invariants* rows owned by the checker and the validator)
Depends on: S4
Acceptance:
  - S5.1 `Test-DesignState.ps1` declares exactly the class ids in `design/20-contract.md`
    § *The divergence classes* — blocking, reported, and could-not-evaluate alike.
    `ClassListDisagreement` fires when a class id is present on one side only, and does so in
    both directions.
  - S5.2 All three lists are emitted on every run, including when one or more is empty. An empty
    list appears as an empty list and is never omitted.
  - S5.3 Exit codes are 0 clean, 1 findings, 2 could not evaluate, and a run carrying both
    findings and a could-not-evaluate exits 2.
  - S5.4 Against an absent or empty `design/state/`, the run reports `StateSetAbsent`, exits 2,
    and reports zero findings. It never exits 0.
  - S5.5 A closure is the unit's record plus every record it names directly, excluding
    `Archival` entries and excluding any record whose `Status` is `retired`. A live record naming
    a retired one raises no finding, and a retired record's `Anchor` is not checked against the
    tree.
  - S5.6 Every run names the largest closure, the unit it belongs to, its size in bytes, and the
    single record contributing most of it — on a clean run as well as a failing one, as a report
    line and never as a finding.
  - S5.7 `ClosureOverBudget` fires at 16,385 bytes and does not fire at 16,384.
  - S5.8 With `design/FROZEN.md` present, every blocking class is emitted as a report instead,
    the count downgraded is stated, and the marker's `Frozen because` and `Lifts when` lines are
    reproduced **verbatim**. A run that also carries a could-not-evaluate still exits 2.
  - S5.9 `git status --short` is empty after a run that found blocking divergences.
  - S5.10 With `tools/Update-DesignProjection.ps1` absent or exiting non-zero, `ProjectorFailed`
    is reported and `ProjectionStale` is named as uncomputed. The run never reports the
    projections as matching.
  - S5.11 With `gh` absent or unauthenticated, `TrackerUnavailable` is reported, the tracker
    classes are named as not compared, and every other class still runs to completion.
  - S5.12 The largest closure over the records that exist is recorded in `design/cost.md`. **If
    either closure written at S4.6 exceeds 16,384 bytes the slice stops and reports** rather than
    changing the ceiling, per the brief's abandonment line.
  - S5.13 The § *Invariants* rows whose owner is the checker, the validator or the budget meter
    flip to `Enforcement: code` with `tools/Test-DesignState.Tests.ps1` as evidence, in the same
    commit, and only where a test in that file exercises them.
Out of scope: the projector, the mirror generator, any wiring into `verify.yml` or `/verify`,
    and records for any further unit. The projector's absence is a contracted case
    (`ProjectorFailed`), not a gap to work around.

---

## S6 — The marked-region rule is stated once, and `companion` says it is hand-written
Delivers: Anyone reading the agent contract finds a single statement of which prose regions a
generator may overwrite and which it must never touch. Every companion block in the kit now says
so in its own opening marker, so a generator arriving later cannot mistake someone's hand-written
block for its own output.
Touches: `AGENTS.md`, `.claude/COMPANIONS.md`, every file under `.claude/commands/`,
         `tools/Test-Companion.ps1`, `tools/Test-Companion.Tests.ps1`,
         `design/90-decisions.md` (§ *Open*)
Depends on: none
Acceptance:
  - S6.1 `AGENTS.md` states the marked-region rule for both kinds — the bare marker is projected
    and is overwritten on every regeneration, the `:declared:` marker is hand-authored and is
    never written — and the agent-fence wording it carries today is replaced by a reference to
    that statement rather than left standing beside it.
  - S6.2 Exactly one document states the rule. A search of the tree for the wording finds it in
    `AGENTS.md` and nowhere else; `.claude/COMPANIONS.md` names `companion` as a declared region
    and points at `AGENTS.md` for what declared means, without restating the marker forms.
  - S6.3 Every file under `.claude/commands/` carries `<!-- companion:declared:start -->` and
    `<!-- companion:declared:end -->`, and no file under that directory carries the bare
    `companion` form.
  - S6.4 `tools/Test-Companion.ps1` matches the declared form; its `MissingBlock` message and its
    doc comment name that form; a file carrying the bare `companion` form is reported as missing
    its block rather than accepted.
  - S6.5 `tools/Test-Companion.Tests.ps1` covers both directions — a declared block passes, a
    bare block fails — and the run states both counts.
  - S6.6 `tools/Test-Companion.ps1` run across `.claude/commands/` reports zero missing blocks,
    and `tools/Sync-Kit.ps1`'s call into it still succeeds.
  - S6.7 The `## Open` item in `design/90-decisions.md` recording this migration is removed,
    because it is now done.
Out of scope: the projector and any projected region; records for the documents touched;
    migrating `<!-- agent:start -->` blocks in issue bodies — those are already conforming, which
    is why the bare form means projected.

---

## S7 — Prose regions that regenerate, and prove they both overwrite and preserve
Delivers: Facts that can only be worked out by looking across the whole set — which parts an
invariant binds, which parts consume a given surface — appear as readable tables inside the
documents that need them, and one command regenerates every one. A hand edit inside a generated
region is gone after regenerating; a hand edit outside one survives untouched. Both are
demonstrated with counts rather than promised.
Touches: `tools/Update-DesignProjection.ps1`, `tools/Update-DesignProjection.Tests.ps1`,
         `tools/Test-DesignState.ps1`, the documents that acquire regions,
         `design/20-contract.md` (§ *Invariants* rows owned by the projector)
Depends on: S4, S5, S6
Acceptance:
  - S7.1 `Update-DesignProjection.ps1` renders the `units`, `bound-by`, `consumers`,
    `decision-affects`, `question-affects`, `invariants` and `agent` projections named in
    `design/20-contract.md` § `tools/Update-DesignProjection.ps1`.
  - S7.2 `-DryRun` renders to the success stream and writes nothing: `git status --short` is
    empty afterwards.
  - S7.3 Regenerating twice produces byte-identical files, and regenerating any one region leaves
    every other region's rendered output unchanged (I25).
  - S7.4 A hand edit **inside** a projected region is gone after one regeneration, and a hand edit
    **outside** every region survives it. Both are proven by test and the run states both counts.
  - S7.5 No byte outside a projected region is ever written: a document containing no region is
    byte-identical after a regeneration, and no region is created by the projector.
  - S7.6 A `companion` declared region hand-edited before a regeneration is byte-identical after
    it (I29).
  - S7.7 An unbalanced or nested region causes the projector to refuse, naming the document and
    the marker, rather than repairing or writing through it.
  - S7.8 Rendering a projection into an empty region and into a region already holding stale
    content produces identical bytes — the rendered content is never an input to the render (I14).
  - S7.9 `Test-DesignState.ps1` invokes the projector with `-DryRun` and raises `ProjectionStale`
    on a region whose content differs from its regeneration, and does **not** raise it when the
    only difference is CRLF against LF.
  - S7.10 The `agent` projection renders an issue's agent block to the success stream and writes
    nothing to the tracker; no module of this mechanism calls `gh` to write.
  - S7.11 The `outstanding` projection is **not delivered**, and the slice's report names
    `design/20-contract.md` § *Unresolved* as the reason. No new item is added there.
  - S7.12 The § *Invariants* rows owned by the projector and evidenced by
    `tools/Update-DesignProjection.Tests.ps1` flip to `Enforcement: code` in the same commit.
    **I14 does not flip** — S7.8 is a proxy, not enforcement, and the contract records that no
    mechanical enforcement is available for it.
Out of scope: the `outstanding` projection and everything downstream of it; the mirror
    generator; records for any unit beyond those already written; CI wiring.

---

## S8 — Every command in the kit has a record
Delivers: For any of the kit's commands you can open one file and see what it is responsible
for, which surfaces it uses and offers, which rules bind it, which decisions are in force for it
and which have been superseded — without opening the decision log at all.
Touches: `design/state/units/command/`, `design/state/contracts/`, the projected regions
Depends on: S4, S7
Acceptance:
  - S8.1 Every file matched by the `command` glob in `design/20-contract.md` § *Artifacts of a
    unit kind* has a record, and `UnrecordedArtifact` reports none for that kind in either
    direction.
  - S8.2 Every contract named in a command record's `Consumes` or `Exposes` has a record whose
    `Owner` is the unique active unit exposing it; `OwnerMismatch` reports none.
  - S8.3 Every command record's `Anchor` resolves to a path in the tree; `AnchorMissing` reports
    none for that kind.
  - S8.4 `UnresolvedId` reports none among the records this slice writes.
  - S8.5 Projections are regenerated in the same commit and `ProjectionStale` reports none.
  - S8.6 The largest closure is named with its size and its largest contributor, and none of the
    records written here exceeds 16,384 bytes. Over budget stops the slice.
Out of scope: script, document and invariant records; decision and question records beyond those
    a command record names directly; CI wiring; any edit to `design/90-decisions.md` other than
    an appended entry.

---

## S9 — Every script and standing document has a record
Delivers: The same for the kit's scripts and for the documents that carry design state — the
agent contract, the design documents, the templates the kit ships, the issue templates — so a
document that owns a rule is itself addressable rather than a name in somebody's table.
Touches: `design/state/units/script/`, `design/state/units/document/`,
         `design/state/contracts/`, the projected regions
Depends on: S8
Acceptance:
  - S9.1 Every file matched by the `script` and `document` globs has a record, and
    `UnrecordedArtifact` reports none for either kind in either direction.
  - S9.2 The named exclusions have no record: no `*.Tests.ps1`, no `*-local.md`, no
    `design/FROZEN.md`, no `CLAUDE.md`.
  - S9.3 Every script record whose script has a Pester test file names that file in `Evidence`,
    and every `Evidence` pointer resolves to a path in the tree.
  - S9.4 `AnchorMissing`, `UnresolvedId` and `OwnerMismatch` all report none.
  - S9.5 Projections are regenerated in the same commit and `ProjectionStale` reports none.
  - S9.6 The largest closure across every unit recorded so far is named with its size, and none
    exceeds 16,384 bytes. Over budget stops the slice.
Out of scope: invariant, decision and question records; CI wiring; adding any artifact to the
    tree so that a record has something to point at — records follow artifacts, never the
    reverse.

---

## S10 — Every invariant has a record, and the contract's table is generated from them
Delivers: The numbered invariants stop existing only as a table in one document. Each becomes
its own record naming what it says, who owns it, whether code or instruction enforces it, and
what evidences that — and the table in the contract becomes a rendering of those records rather
than a second copy that can drift from them.
Touches: `design/state/units/invariant/`, `design/20-contract.md` (§ *Invariants*), the
         projected regions
Depends on: S7, S8, S9
Acceptance:
  - S10.1 Every `I<n>` cited in `AGENTS.md` or in any file under `.claude/commands/` has a
    record, and the set difference is empty in both directions.
  - S10.2 Every record whose `Enforcement` is `code` carries an `Evidence` pointer that resolves
    to a path in the tree; `EnforcementUnevidenced` reports none. A record whose `Enforcement` is
    `instruction` and which carries no `Evidence` raises no finding.
  - S10.3 An invariant record's `Anchor` is the invariant number itself, and its resolution is
    checked for well-formedness and uniqueness rather than with `Test-Path`.
  - S10.4 `design/20-contract.md` § *Invariants* is a projected region rendering the `invariants`
    projection; a hand edit inside it is gone after one regeneration, and the surrounding prose
    of that section survives.
  - S10.5 Projections are regenerated in the same commit and `ProjectionStale` reports none.
  - S10.6 The largest closure is named with its size, and none exceeds 16,384 bytes. Over budget
    stops the slice.
Out of scope: decision and question records; changing what any invariant says; promoting an
    `instruction` row to `code` — that happens in the slice that writes the test, never here.

---

## S11 — Every logged decision has a record, and open questions become addressable
Delivers: The standing claim of every decision ever logged becomes retrievable one file at a
time, with superseded ones marked and pointing at whatever replaced them. Orienting on a command
means reading the decisions currently in force for it, not reading the whole log. Open questions
get the same treatment, so "what is unresolved about this part" is a question with an answer.
Touches: `design/state/decisions/`, `design/state/questions/`, `design/state/units/`,
         the projected regions
Depends on: S8, S9, S10
Acceptance:
  - S11.1 Every `### ` heading in `design/90-decisions.md` has exactly one decision record whose
    `Anchor` resolves to it. `LogEntryUnrecorded` and `DecisionAnchorAmbiguous` both report none.
  - S11.2 Every record whose `Status` is `superseded` carries a `SupersededBy` naming a record
    that exists, and no record whose `Status` is `accepted` carries one.
  - S11.3 No decision record carries an `Affects` field, and no question record carries one.
  - S11.4 The rejected alternatives are not extracted: no decision record's prose reproduces the
    log entry's `Rejected:` line.
  - S11.5 A question record exists for each item in `design/20-contract.md` § *Unresolved*, and
    every `question/` id named by a unit record resolves.
  - S11.6 Every unit record's `Live` and `Archival` name only decisions that exist, and no
    decision id appears in both on the same record.
  - S11.7 This slice's diff against `design/90-decisions.md` shows **additions only** — no line
    of a pre-existing entry deleted, reordered, or reformatted (I26).
  - S11.8 Projections are regenerated in the same commit, `ProjectionStale` reports none, and the
    largest closure across the whole state set is named with its size. **This is the real ceiling
    measurement** — decisions are the fattest closure contributor. Over budget stops the project
    and reports, per the brief's abandonment line.
Out of scope: rewriting, reformatting or reordering any log entry; extracting rejected
    alternatives; turning a `## Open` todo into anything other than what `/track` already does
    with it; CI wiring.

---

## S12 — The check runs in CI, and has rejected one of every blocking class
Delivers: A change that leaves the design state disagreeing with the tree fails its own build.
And the evidence that the check constrains anything at all is on the record: every blocking class
has rejected a real divergence and accepted a near-miss, with both counts stated, rather than a
validator that has never once failed being called proven.
Touches: `.github/workflows/verify.yml`, `.claude/commands/verify.md`,
         `tools/Test-DesignState.Tests.ps1`
Depends on: S5, S7, S8, S9, S10, S11
Acceptance:
  - S12.1 `verify.yml` runs `tools/Test-DesignState.ps1` and fails the build on exit 1 and on
    exit 2 alike. A run that could not evaluate is not a passing build.
  - S12.2 Every blocking class in `design/20-contract.md` § *The divergence classes* has a test
    that constructs a real divergence and confirms the class fires, and a test that constructs a
    near-miss and confirms it does not. The run states both counts.
  - S12.3 A test proves that with `design/FROZEN.md` present no blocking class fails the build,
    and that a could-not-evaluate still exits 2 during a freeze.
  - S12.4 `/verify` discovers the new gate and reports it in its three lists, including naming it
    as a gate that did not run when it could not.
  - S12.5 On a clean checkout of this repository at the commit this slice lands, the check exits
    0 and names the largest closure and its size.
  - S12.6 Against a checkout with `design/state/` removed, the check exits 2 reporting
    `StateSetAbsent`, and never 0.
Out of scope: the mirror generator and the tracker classes; changing any class's blocking status;
    adding a class — that is a contract amendment and stops the slice.

---

## S13 — Commands orient from the record, and keep working where there is none
Delivers: A session starting work on one part of the kit reads that part's record and one hop
out, rather than reconstructing the picture from the corpus. And in every repository the kit is
installed in — none of which has records — each command behaves exactly as it does today.
Touches: `.claude/commands/`, `AGENTS.md`
Depends on: S8, S9, S10, S11
Acceptance:
  - S13.1 Every command file that establishes what is currently true about a unit states that it
    reads that unit's closure, and that `design/90-decisions.md` is not opened to establish it.
  - S13.2 Every command and script this project touches states its behaviour when `design/state/`
    is absent, and that behaviour is today's (I27).
  - S13.3 No command cites a `WorkRef` as authority; where a mirror is quoted, its `MirroredAt`
    is quoted alongside it (I28).
  - S13.4 The sequence a decision follows — append the log entry unchanged, write the decision
    record, update the affected units, regenerate, then check — is stated in exactly one place and
    referenced from the commands, never restated per command.
  - S13.5 No command file restates the marked-region rule; each points at `AGENTS.md`.
  - S13.6 With `design/state/` removed from the tree, `tools/Test-Companion.ps1`,
    `tools/Test-DesignDrift.ps1`, `tools/Sync-Kit.ps1` and `tools/Wait-PullRequestCheck.ps1` pass
    their existing test suites unchanged.
Out of scope: changing what any command does beyond stating these obligations; model routing and
    tier policy, which the brief fences as a non-goal; `/install` and `/kit-sync` beyond what the
    compatibility promise requires — that is S15.

---

## S14 — Work state: a mirror that says when it was taken
> **Blocked.** `design/20-contract.md` § *Unresolved* does not determine where the `outstanding`
> projection renders. This slice cannot be started until that item is resolved by `/contract`,
> and S14.8 below is written against a host document that does not yet exist.

Delivers: From a checkout with no network you can still see what work is outstanding, in what
order, and what each item asks for — presented as a mirror stamped with when it was taken, never
as the authority. GitHub stays the authority for whether the work is done.
Touches: `tools/Update-WorkMirror.ps1`, `tools/Update-WorkMirror.Tests.ps1`,
         `design/state/work/`, `.claude/commands/track.md`,
         `tools/Update-DesignProjection.ps1`
Depends on: S7, S12, and the resolution of `design/20-contract.md` § *Unresolved*
Acceptance:
  - S14.1 `Update-WorkMirror.ps1` writes `WorkRef` records and nothing else — never an issue,
    never a label, never a milestone, never git.
  - S14.2 Every write stamps `MirroredAt` with the current commit, including a write that changed
    no other field.
  - S14.3 `Rank` degrades: a project field where a project exists, otherwise milestone, otherwise
    issue number. Falling through to issue number raises no finding, and no emitted `WorkRef`
    lacks a `Rank`.
  - S14.4 With `gh` absent or unauthenticated, the run reports could-not-evaluate and writes no
    mirror. It never writes an empty one.
  - S14.5 With `design/FROZEN.md` present it does not run, and says so.
  - S14.6 `/track` is the only command that invokes it, and no other command writes a `WorkRef`.
  - S14.7 `MirrorStale` fires when a `WorkRef`'s `MirroredAt` is not the current commit, and is
    reported rather than blocking.
  - S14.8 The `outstanding` projection renders the outstanding work, its order, and each item's
    criteria from the `WorkRef` mirrors into the region the resolved contract item names, and a
    reader with no network obtains all three by opening that document.
Out of scope: creating a GitHub project; opening, closing or labelling an issue — those stay
    `/track`'s own carved-out writes; detecting the tracker moving mid-refresh, which the design
    declines to buy.

---

## S15 — The installed repositories keep working, and the cost is settled
Delivers: Every repository the kit is installed in keeps working exactly as it did, with the new
scripts shipped and honestly reporting that there is nothing there to check. And the claim that
this project made orienting cheaper is settled by two measurements printed side by side rather
than by argument.
Touches: `INSTALL.md`, `design/cost.md`, `design/90-decisions.md` (§ *Open*)
Depends on: S12, S13
Acceptance:
  - S15.1 `INSTALL.md` phase 1's artifact list agrees with `tools/` by set difference in both
    directions, checked mechanically rather than by reading.
  - S15.2 `/install-all` across the installed targets reports **zero hard stops attributable to
    this work**, with the number of targets reached and the number of stops both stated.
  - S15.3 In a target, `tools/Test-DesignState.ps1` exits 2 reporting `StateSetAbsent`, and never
    0.
  - S15.4 No target acquires a `design/state/` directory, and no target's `design/` is otherwise
    modified by this work.
  - S15.5 `design/cost.md` carries the after-measurement — `tools/Measure-Session.ps1` output for
    a `/slice` session run with the state set present — beside the S4.1 baseline, with both totals
    stated, and repeats that measurement covers Claude Code only with Codex and Copilot unmeasured.
  - S15.6 The `## Open` item in `design/90-decisions.md` recording `INSTALL.md`'s artifact list
    is removed, because it is now checked.
Out of scope: migrating any target's design state — the brief fences this permanently; changing
    `/install`, `/install-all`, `/kit-sync` or `tools/Sync-Kit.ps1` beyond what the compatibility
    promise requires; re-running the baseline, which was taken once and is not re-taken.

---

## S16 — Every part says what it offers and what it leans on
> **Blocked.** § *Contract questions* above — no blocking class resolves a tree pointer that is
> not a unit's `Anchor`, and a `Contract` record's `Declaration` is one. Writing one would be
> the unchecked restatement I15 forbids. This slice cannot be started until `/contract` answers
> it, and S16.1 below is written against a check that does not yet exist.

Delivers: For any part of the kit you can already see what it is responsible for. Now you can
also see which surfaces it offers to everything else and which ones it leans on — so "what
breaks if I change this" is a list you read rather than a search you run. And where two parts
claim the same surface, or none does, the check says so instead of letting it through.
Touches: `design/state/contracts/`, `design/state/units/`, `design/state-index.md`
         (the `consumers` region)
Depends on: S7, S8, S9, and the resolution of § *Contract questions*
Acceptance:
  - S16.1 A `Contract` record exists for every surface `design/20-contract.md` § *Public
    surface* names and for nothing else, each carrying `Owner`, `Declaration` and `Semantics`.
    `Declaration` is a path in the tree, or the literal `prose` for a Markdown command surface
    that has no declaration to point at.
  - S16.2 `OwnerMismatch` reports none across the real state set — the first run in which that
    class has records to compare, rather than only the synthetic pair S12.2 built for it.
  - S16.3 Every unit that names another unit's surface carries it in `Consumes`, and every unit
    that offers one carries it in `Exposes`. Checked by set difference against the tree in both
    directions with both counts stated, not by reading: `tools/Sync-Kit.ps1` naming
    `tools/Test-Companion.ps1`, and `tools/Test-DesignState.ps1` naming
    `tools/Read-DesignState.ps1` and `tools/Update-DesignProjection.ps1`, are among the edges it
    must recover.
  - S16.4 `UnresolvedId` reports none among the records this slice writes, and no record
    acquires a `Consumers` field — that edge is derived and is never written (I17).
  - S16.5 `design/state-index.md`'s `consumers` region renders one row per contract naming its
    consuming units, in place of the empty-set row it renders today, and `ProjectionStale`
    reports none after regeneration in the same commit.
  - S16.6 No record is written for a surface with no file behind it. `tools/Update-WorkMirror.ps1`
    is contracted and unwritten and gets none here, because a `Declaration` pointing at an absent
    file is the shape `AnchorMissing` exists to reject.
  - S16.7 The largest closure across the whole state set is named with its size and its largest
    contributor. This slice adds edges to the closures that are already the largest in the set,
    so **over budget stops the project and reports**, per the brief's abandonment line. It does
    not raise the ceiling, and it does not drop a contract record to get back under it.
Out of scope: `WorkRef` records and the `outstanding` projection, which are S14's; the invariant
    backlog, whose size § *Contract questions* does not determine; widening any class or adding
    one — that is a contract amendment and stops the slice; CI wiring, which S12 already carries.

---

## S17 — Every rule the kit binds itself to becomes a file
> **Blocked, on two things.** `/contract` has not yet made the amendment § *Contract questions*
> records as answered, so § *Artifacts of a unit kind* still defines the invariant set by
> citation. And S17.3 writes an `Evidence` pointer, which is the tree pointer no blocking class
> resolves — the second open question there.

Delivers: Every rule the kit holds itself to becomes a file you can open — not just the handful
that happen to be quoted in the agent contract. Each says what it requires, who is answerable
for it, whether it is held up by code or only by instruction, and what you can go read to check
that claim. The contract's table stops being half generated and half kept by hand.
Touches: `design/state/invariants/`, `design/state/units/`,
         `design/20-contract.md` (§ *Invariants*), the projected regions
Depends on: S10, S12, and the amendment § *Contract questions* records as answered
Acceptance:
  - S17.1 Every `I<n>` row in `design/20-contract.md` § *Invariants* has exactly one record, and
    `UnrecordedArtifact` reports none for the invariant kind in either direction.
  - S17.2 § *Invariants* is a single projected region with no hand-authored tail of rows left
    below it; a hand edit inside it is gone after one regeneration, and the section's surrounding
    prose survives.
  - S17.3 Each record's `Enforcement` reproduces the row it came from and **no row's value
    changes in this slice** — a row promotes only in the slice that writes its evidencing test.
    Every record whose `Enforcement` is `code` carries an `Evidence` pointer that resolves;
    `EnforcementUnevidenced` reports none.
  - S17.4 Every unit an invariant record names as `Owner` carries that id in its `Binds`, and
    `UnresolvedId` reports none among the records this slice writes.
  - S17.5 No sentence of the prose standing below § *Invariants* today is lost: each is either
    carried into a record's `Statement` or left as prose outside the region, and the slice states
    which, per note. The notes on I15 and I16 naming no test, on I26's row, and on where I12 and
    I13 live are named individually in that account.
  - S17.6 `tools/Test-DesignState.ps1` exits 0 on a clean checkout of this repository at the
    commit this slice lands, which closes the window S12 opened by wiring CI over a partial
    migration.
  - S17.7 The largest closure across the whole state set is named with its size and its largest
    contributor. Over budget stops the project and reports, per the brief's abandonment line.
Out of scope: changing what any invariant says, adding one, or removing one — each is a contract
    amendment and stops the slice; promoting an `Enforcement` row to `code`; the contract kind and
    the `Consumes`/`Exposes` edges, which are S16's; CI wiring, which S12 already carries.

## Landed

| Slice | Name | Issue | Criteria | Body complete at |
|---|---|---|---|---|
| **S1** | Wait for a pull request's checks against a named commit | [#9](../../issues/9), closed | S1.1–S1.10 | `af610a6` |
| **S2** | One approval covers push, pull request, and the threads it names | [#10](../../issues/10), closed | S2.1–S2.9 | `af610a6` |
| **S3** | A defect that is not a slice gets a front door | [#11](../../issues/11), closed | S3.1–S3.14 | `af610a6` |

What each delivered, in one line, because the index is the only place a reader now meets
them:

- **S1** — `tools/Wait-PullRequestCheck.ps1`, which watches a pull request's checks against a
  named head SHA and refuses to answer at all if someone pushed while it was watching.
- **S2** — one approval covering push, pull-request update, and the exact review threads it
  names, in `AGENTS.md` and `.claude/commands/resolve.md`.
- **S3** — `/fix`, the entry point for a defect that has no slice: reproduce, get to a bug
  issue, branch, fix, hand off to the same single approval.
