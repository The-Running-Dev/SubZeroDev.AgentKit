# Design — explicit design state

> **Scope.** This designs the mechanism `design/00-brief.md` asks for: a representation of
> current design state that is retrieved rather than reconstructed, and an agreement check
> that is arithmetic rather than reasoning. It does **not** redesign the kit's twenty-one
> commands — those were decided in `design/90-decisions.md` and stay there. What changes for
> them is stated below as a boundary condition, not as a redesign.
>
> **This file previously held the design of the defect-to-merge path** (`/fix`,
> `Wait-PullRequestCheck.ps1`, the authorization batch). That path landed as S1–S3; its
> contract stands in `design/20-contract.md` and its body is recoverable at
> `git show dfd1cab:design/10-design.md`, the same retirement convention
> `design/30-slices.md` uses for a landed slice.

The brief's problem is one sentence long: establishing what the design *currently is* costs a
semantic reconstruction, and reconstruction is generative, so it never converges. Everything
below follows from two commitments that answer that sentence directly.

**Current state is a fact with an address, not a conclusion drawn from prose.** A session
that needs to know what is true about `/track` reads the record for `/track`. It does not
read the corpus and decide.

**No generated prose is ever an input.** Facts flow one way — records into rendered regions —
and never back. This is what gives the system a fixed point, and it is the property most
easily lost later, so it is stated first and enforced in *Module boundaries*.

## Data model

Six entity kinds. Every one is persisted as text in the tree; nothing is cached, indexed, or
built. There is no state directory to rebuild before a question can be asked, which is the
brief's *no round-trip* non-goal expressed structurally rather than as a promise.

### Unit

The addressable thing design state is *about*. Four kinds, and they are the kinds the tree
already has: **command**, **script**, **document**, **invariant**. No new decomposition.

| Field | Type | Notes |
|---|---|---|
| `Id` | stable string | Assigned once. **Never reused, never renumbered** — the criterion-id precedent in `AGENTS.md` (*Tracking work*) applies to every id in this system |
| `Kind` | command \| script \| document \| invariant | |
| `Anchor` | tree path, or an invariant number | A **checked** restatement, not a copy — see *Every restatement is either forbidden or checked* below |
| `Owns` | one sentence | What this unit is responsible for. The only free prose in the record and deliberately capped |
| `Consumes`, `Exposes` | contract ids | |
| `Binds` | invariant ids | |
| `Live` | decision ids | Decisions whose claim is currently in force here |
| `Archival` | decision ids + dates | Superseded. Present so the history is reachable, **excluded from the orientation closure** |
| `Questions` | question ids | |
| `Work` | issue numbers | The tracker binding |
| `Evidence` | tree pointers | A test or a code path that demonstrates the unit does what the record says |

**Lifecycle.** A record is created when its artifact appears and is **retired, never deleted**
— a deleted command whose record vanished would leave every decision that cited it dangling,
and dangling is the one thing this system is built to make impossible. Retirement keeps the
id resolvable and marks it inactive.

**Identity is the `Id`, not the path.** A renamed command keeps its record; the `Anchor`
moves. This is the difference between an address and a name, and getting it the other way
round is what makes a rename a corpus-wide edit.

### Contract

A named surface one unit exposes and others consume.

| Field | Type | Notes |
|---|---|---|
| `Id` | stable string | |
| `Owner` | unit id | Exactly one. A contract with two owners is a defect in the split, not a feature |
| `Declaration` | tree pointer, or `prose` | Where the *shape* is declared. `prose` only for a Markdown command surface, which has no declaration to point at |
| `Semantics` | prose | **What the declaration cannot say** — when a field is meaningful, what must never be normalised, which parameter must not acquire a default. `AGENTS.md`, *Single ownership*, unchanged and now mechanically addressable |
| `Consumers` | — | **Derived.** Never written |

### Invariant

Extraction, not invention: `design/20-contract.md` already distinguishes the invariants
enforced by code from those enforced by instruction, and already says only the first kind may
be trusted without checking. That distinction becomes a field.

| Field | Type | Notes |
|---|---|---|
| `Id` | `I<n>` | The existing thirteen keep their numbers |
| `Statement` | one sentence | |
| `Owner` | unit id | |
| `Enforcement` | `code` \| `instruction` | |
| `Evidence` | tree pointer | **Required when `Enforcement` is `code`**, and its absence is a finding. An invariant claimed to be mechanically enforced with nothing pointing at the mechanism is the claim this field exists to stop |
| `BoundBy` | — | **Derived.** Never written |

### Decision

The extraction the brief asks for, and the part most likely to be misread as a duplicate of
the log, so the distinction is stated rather than implied.

**A log entry records what was decided on a date. A decision record records what is true
now.** The entry never changes when its decision is superseded; the record does. They are a
fact and its history, not two copies of one fact — which is why extraction does not violate
*Single ownership*, and why the log stays append-only and untouched.

| Field | Type | Notes |
|---|---|---|
| `Id` | stable string | |
| `Date` | date | Not an identity — the log has several entries per date |
| `Anchor` | the log heading it binds to | Must resolve to **exactly one** heading. Zero or two is a finding |
| `Status` | `accepted` \| `superseded` | |
| `SupersededBy` | decision id | Required when `Status` is `superseded`. The log's existing `Amends:` line is the prose ancestor of this field |
| `Claim` | short prose | The standing claim, and **the only thing a session reads instead of the entry**. Capped by the orientation budget, which is what keeps it a claim rather than a summary |
| `Affects` | unit ids | |

**The rejected alternatives stay in the log and are not extracted.** They are the reason the
log exists (`AGENTS.md`, *Decision logging*) and they are read when relitigating a choice, not
when orienting. Pulling them into the state layer would put the largest and least-consulted
half of the corpus back inside the per-unit budget.

### Question

| Field | Type | Notes |
|---|---|---|
| `Id`, `Text` | | |
| `Status` | `open` \| `answered` | |
| `AnsweredBy` | decision or invariant id | Required when `answered` |
| `Affects` | unit ids | |

The `## Open` staging area in `design/90-decisions.md` keeps its existing job — a to-do bound
for the tracker. A *question* is the other thing that section currently absorbs: something
undecided that blocks reasoning about a unit. Separating them is what makes "unresolved
questions affecting this unit" answerable at all.

### WorkRef

**GitHub is the authority for a slice's acceptance criteria, its completion, and its order.**
No file in the repository is. What the checkout carries is a `WorkRef` — a mirror, generated,
explicitly not authoritative, and stale by default.

| Field | Type | Notes |
|---|---|---|
| `Issue` | integer | The binding. Authoritative |
| `Title`, `State`, `Criteria`, `Rank` | | **Mirrored.** Every one of these is a copy of a tracker fact and may be stale |
| `MirroredAt` | commit sha | When the mirror was last generated |

**Authority transfers at issue creation.** Before an issue exists, `/slices` output is a
*proposal*, not criteria — a slice has no acceptance criteria until it has an issue. That
sequencing is what lets "no file is the authority" and "`/slices` drafts criteria" both be
true, and it is the only reading under which the brief's two work-state lines do not
contradict each other.

`Rank` degrades rather than failing: a project field where a project exists, otherwise
milestone then issue number. `/track` "adds issues to an existing project, and never creates
one" (`design/90-decisions.md`, 2026-08-03), so a repository with no project must still
produce an order, and an order that silently disappeared would break the offline criterion
without saying so.

### Marked region

Not a record — a structure inside a prose document. An opening marker naming **which
projection of which source** it renders, a body, a closing marker.

This **generalises the existing agent-fence rule** rather than replacing it. `AGENTS.md`
(*Tracking work*) already says an issue's `<!-- agent:start -->` block is regenerable and
everything outside it is not; that rule becomes the general one, stated once, and the issue
block becomes an instance of it. Every command that currently restates it points at it
instead.

A region's identity is (document, projection id) and must be unique within the document.
Nested or unbalanced markers are a finding, not a parse failure to route around.

### Derived, and where derived facts may appear

Reverse edges are **derived and never written**: which units an invariant binds, which units
consume a contract, which units a decision affects in the other direction. Writing them would
create the second copy that rots.

They still have to be *readable* — "which units does I3 bind" is a question a human offline
must be able to answer. So they appear exactly one way: as a **projection into a marked
region**. Generated, checked, one-directional. This is the whole reason the marked-region
mechanism carries its weight rather than being a documentation nicety.

### Every restatement is either forbidden or checked

The governing rule, and the honest generalisation of `AGENTS.md`'s *a document states only
what the tree cannot*.

A record's `Anchor`, a contract's `Declaration`, an invariant's `Evidence` and a decision's
`Anchor` are all restatements of something in the tree or the log. They are permitted
**because each one is a reference whose resolution is mechanically checked** — the path
exists, the heading resolves to exactly one entry, the test is present. A restatement with no
check is forbidden; a restatement with a check is a binding. Every blocking divergence class
in *Control flow* is an instance of this rule.

### The orientation closure

The brief's 16,384-byte ceiling is only checkable if "the state loaded to begin work" is a
*defined set*. It is:

> **closure(U) = record(U), plus the record of every id `record(U)` names directly, excluding
> `Archival`.** One hop. Not transitive.

Three consequences, all load-bearing:

- **One hop is the line between orienting and investigating.** Following a decision's claim
  to the units it also affects is pursuing a question, not starting work. An unbounded closure
  reaches everything, because decisions bind many units, and the budget would be unmeetable
  by construction.
- **Archival exclusion is what makes a fixed ceiling survivable against a monotonic corpus.**
  The brief records the log as append-only and growing at roughly two design commits a day.
  Closure size therefore grows with a unit's *live* decisions, not with all decisions ever
  made about it, and superseding a decision *shrinks* the closure. Without this the ceiling
  is a countdown.
- **The measurement must equal what is actually read**, so each record is separately
  openable and the closure is a sum of whole records. A representation where records share a
  file would make the metric understate the load, because a reader opens the file. This is
  the one place the design constrains storage granularity, and *Alternatives considered*
  records why.

The largest closure is **named by the checker, not predicted here**. `/track` and the
document units are the plausible candidates and neither is worth asserting without the
measurement.

### Persisted versus in-memory

Persisted: every record, every marked region, every projection. In-memory and never written:
the parsed graph, all derived edges, closure sizes, the check result, and the live half of
any tracker comparison. **No cache and no index**, so there is nothing that must be current
before a question can be asked and nothing that can be current-looking and wrong.

## Module boundaries

| Module | Owns | Depends on | Exposes |
|---|---|---|---|
| The state set | Every record. The facts | nothing | Text, readable unaided |
| The reader | The record grammar, and the rule that **no line is silently skipped** | the state set | A parsed graph, or a parse failure naming the line |
| The graph validator | Reference and existence classes | the reader | Findings |
| The projector | Rendering one projection from records | the reader | Text |
| The projection checker | Comparing a rendered region against the tree's copy | the projector, the tree | Findings |
| The budget meter | Closure computation and the ceiling | the reader | Findings, and the largest unit by name |
| The mirror generator | Refreshing `WorkRef` mirrors | `gh`, the reader | Written mirrors. **`/track`'s alone** |
| The divergence checker | The closed class list, the freeze gate, the three-list report | validator, projection checker, budget meter, `design/FROZEN.md` | Three lists and an exit code |
| `AGENTS.md` | The marked-region rule; the freeze rule | nothing | The rule every command cites |
| `design/20-contract.md` | The class ids and each one's blocking status | nothing | The list CI is judged against |

Direction: `state set → reader → {validator, projector, meter} → checker → {CI, commands}`.
The projector writes into documents; nothing reads a generated region back. **Acyclic**, and
the acyclicity rests on that one condition — a projection consumed as an input closes the
loop and restores the generative pass this design exists to remove.

**The mechanism is inside its own subject matter, and that is data, not a cycle.** The checker
is a `tools/` script, so it is a unit with a record, which the checker validates. The class
list lives in a document, which is a unit, which the checker validates. No module depends on
its own output; the self-reference is that the state set describes the tree it is checked
against, which is the point. It is also why one blocking class compares the checker's declared
class ids against the contract document's list — the one restatement the system cannot check
by any other means.

**Two boundary conditions the rest of the kit imposes.**

`tools/*.ps1` is installed into targets (`INSTALL.md`, phase 1) and the kit's own `design/`
never is. So the checker ships to eighteen repositories that have no state set. It must
therefore report **could not evaluate** on an absent state set — never clean. Zero records is
the same shape as I8's zero checks configured: absence of a finding is not a finding of
absence, and a target must not be told its design state agrees with anything.

Every command this design touches must **degrade to today's behaviour when the state set is
absent**. That, not a version check, is what makes the brief's zero-hard-stops promise
mechanical rather than aspirational.

## Control flow

### Orient — a session begins work on one unit

The payoff path, and the one the brief's cost criterion measures.

1. Resolve the unit by name to its record.
2. Read the closure: the record, plus one hop.
3. Begin. **No corpus read, no reconstruction, and `design/90-decisions.md` is not opened.**

What makes this different from reading a well-organised document is not the reading — it is
that step 1 is a lookup with one answer. Today the same step is a judgement about which parts
of 216 KB are still true.

### Record — a decision is made

1. Append the entry to `design/90-decisions.md`, in the existing format, unchanged. Nothing
   already there is touched.
2. Write the decision record: anchor, status, claim, affected units.
3. Update the affected unit records — usually moving one decision id from `Live` to
   `Archival` and adding one.
4. Regenerate projections.
5. Run the checker.

Steps 2 and 3 are the new cost, and they are the trade this design makes: **a small
structured write at every decision, in exchange for no large read at any session start.**
Whether that trade pays is the brief's cost criterion, and it is measured, not argued.

Step 4 before step 5 is not optional — checking before regenerating reports every projection
as stale, which trains the reader to ignore the report.

### Check — CI, or `/verify`, or a command's own gate

1. Parse the state set. A line the grammar does not recognise is **reported as unparseable
   and never skipped** — the I12 precedent, which exists because a dropped id is an id that
   appears to match.
2. Validate the graph.
3. Regenerate every projection into memory and compare against the tree's copy.
4. Compute every closure and compare against the ceiling.
5. Read `design/FROZEN.md`. If it exists, **downgrade every blocking class to reported** and
   say how many were downgraded.
6. Emit three lists — **findings, reports, and what could not be evaluated** — and an exit
   code, on the `/verify` and `Test-DesignDrift.ps1` pattern: 0 clean, 1 findings, 2 could not
   evaluate, with **2 taking precedence over 1**.

**A class is blocking only if it can be evaluated from the checkout alone.** This is the rule
that decides the closed list, and it is not a convenience — a class needing the network fails
in exactly the environment where the failure means nothing, and `GhUnavailable` reported as a
divergence is the fabricated gate result *Verification* exists to prevent.

Blocking, therefore, are the classes that read only the checkout: an unresolvable id; a record
whose anchor names a path that is not there; a tree artifact of a unit kind with no record; a
projection that does not match its regeneration; a malformed or nested region; a duplicate or
renumbered id; a decision anchor resolving to zero or two log headings; a log entry with no
decision record; an invariant enforced by `code` with no evidence pointer; a closure over the
ceiling; and the checker's class ids disagreeing with the contract document's list.

Reported and never blocking: mirror staleness, and anything needing the tracker. Pin
ancestry, because a shallow CI checkout has no history to answer it with — see *Failure
modes*. And every semantic disagreement, permanently, because the brief's *no formal
specification of behaviour* non-goal puts them out of reach and a build that fails on a
model's opinion is a build nobody trusts.

**A freeze suppresses findings, not failures.** Exit 2 stands during a freeze. The freeze
permits known staleness (`AGENTS.md`, *The design freeze*); it does not permit a checker that
could not run, and treating those the same would make the freeze a way to turn the gate off.

### Migrate — once, on this repository only

The 54 log entries are read once and their live claims extracted; the entries are not touched.
Records are written for the units the tree already has. This runs exactly once here and
**never in a target**, which is the whole of the brief's scope answer expressed as a flow.

## Failure modes

| Failure | Detection | Response | User sees |
|---|---|---|---|
| A record names an id that does not exist | Graph validation | Finding, blocking | The referring record, the missing id |
| A record's anchor names a path not in the tree | `Test-Path` | Finding, blocking | Both, and which of the two is wrong is **the user's call** |
| A tree artifact of a unit kind has no record | Set difference, both directions | Finding, blocking | The unrecorded artifact |
| A record's line does not parse | The reader | **Could not evaluate**, exit 2 | The file and line, verbatim. Never dropped |
| A marked region is unbalanced or nested | Marker scan | Finding, blocking | The document and the marker |
| A projection differs from its regeneration | Regenerate to memory, compare | Finding, blocking | A diff of the region |
| Line endings differ but content does not | Normalise before comparing | **Not a finding** | Nothing |
| A decision anchor resolves to zero or two headings | Heading scan of the log | Finding, blocking | The anchor and the count |
| A log entry has no decision record | Set difference against the log's headings | Finding, blocking | The entry's heading |
| A closure exceeds 16,384 bytes | The meter | Finding, blocking | The unit, its size, and its largest contributor |
| An invariant enforced by `code` has no evidence | Field check | Finding, blocking | The invariant id |
| `gh` absent or unauthenticated | Non-zero exit on first call | **Could not evaluate** for tracker classes only; the rest of the run completes | Named as a comparison that did not happen |
| A shallow CI checkout | No history for `merge-base` | **Could not evaluate** for ancestry, and never a pass | That ancestry was not checked, and why |
| The tracker moved during a mirror refresh | Not detected | Mirror is stale, which is its normal state | `MirroredAt`, so staleness is visible rather than inferred |
| The state set is absent entirely | Zero records | **Could not evaluate**, exit 2. Never clean | That nothing was checked — the I8 shape |
| `design/FROZEN.md` exists | File exists | Downgrade blocking to reported; exit 2 still stands | The count downgraded, and the marker's `Frozen because` and `Lifts when` **verbatim** |
| A claim in a record is simply wrong | **Not detected** | Nothing | Nothing — see below |

**The last row is the residual risk and it is irreducible.** Every mechanical property of the
state set is checked; the *truth* of a standing claim is a behavioural assertion, which the
brief's non-goals put permanently out of scope. What the design buys is that a wrong claim is
now wrong in **one addressable place** rather than distributed across a corpus, so a human who
finds it fixes it once. That is a smaller promise than "the design cannot be wrong", and it is
the honest one.

**Line endings deserve the row they get.** `agent.md` already records `prettier --check`
reporting false failures on a Windows working tree because `core.autocrlf` gives CRLF locally
against an LF blob. A projection checker that compares bytes without normalising would fail
every region on every Windows checkout, which is the house platform.

**State left behind on any failure:** the tree exactly as it was. The checker writes nothing —
`Test-DesignDrift.ps1`'s I13 shape, for the same reason: which side of a divergence is wrong
is the user's decision, and a checker that resolved one would be making it.

## Concurrency and ordering

**Nothing is concurrent.** One author, sequential sessions by policy (`AGENTS.md`, *Session
boundaries*), and the brief states this outright.

What enforces it is git and nothing else. Two sessions writing state on divergent branches
produce a merge conflict, which is the intended and sufficient behaviour. Records are
per-unit, so a conflict is localised to the units both sessions touched rather than spanning
the corpus — a property of the granularity choice rather than of any locking.

Three orderings do matter, and none of them is enforced by a lock:

- **Regenerate before checking.** Otherwise every projection reports stale and the report
  becomes noise.
- **Regeneration must be idempotent and order-independent.** Regenerating twice must produce
  the same bytes, and regenerating region A must not change what region B renders to. Without
  both, "regenerate then compare" gives different answers on different runs, and the check
  stops being a check. This is a constraint on the projector, and it is the one place the
  design forbids something a plausible implementation would otherwise do.
- **Authority transfers before criteria are cited.** A slice's criteria are the issue's from
  the moment the issue exists; a session reading the proposal after that point is reading a
  mirror. Nothing enforces this but the sequencing of `/slices` then `/track`.

The one genuine external race is the tracker moving while a mirror is being written. It is
**not** detected, and detection is not worth buying: the mirror is stale by construction,
`MirroredAt` says so, and GitHub is authoritative for anyone who can reach it.

## Alternatives considered

**Storage granularity: one file per record.** Rejected: grouping records into a document per
unit kind, which gives a human offline seven files to read instead of a few hundred and was
the better answer on that criterion alone. It loses on measurement honesty — the ceiling
counts the bytes a session loads, an agent handed a grouped document loads the document, and
the metric would understate the real load while passing. The brief is explicit that a line
which cannot be honestly checked is not finished being written, so the representation that
makes the check honest wins, and the human-reading case is bought back by the grouped views
existing as **projections** instead of as storage.

**Format: constrained Markdown with a line grammar.** Rejected: **JSON**, which is
dependency-free and schema-validatable natively in PowerShell, but escapes every multi-line
claim into a single line and fails the read-it-unaided criterion outright — a criterion the
brief states twice. **YAML**, which reads well and carries block scalars, but needs a module
PowerShell Core does not ship, putting an `Install-Module` between a checkout and its own
design state. **Front matter inside each unit file**, which has no drift between a unit and
its record because they are the same file, but has no home for the invariant and document
units, ships kit design state into eighteen targets, and puts a 12 KB command file inside its
own 16 KB budget.

**Staleness detection: regenerate and compare.** Rejected: **a digest of the source stored in
the region marker**, which is cheaper and needs no generator at check time, but is a second
copy of a fact and matches happily when both sides were edited together. And **convention
alone** — the rule stated in `AGENTS.md` and nothing checking it — which is precisely the
shape `design/90-decisions.md` (2026-08-10) records failing within a day of being written,
where a repin claimed as done had reached one issue of seventeen.

**Decisions: extract the standing claim, leave the entry.** Rejected: **pointers into the log
with no extraction**, which duplicates nothing and is the purest reading of *Single
ownership*, but makes the brief's first done criterion unsatisfiable by construction —
resolving the pointer means opening the file the criterion forbids opening. And
**restructuring the log into records**, which is the only option with genuinely one copy, and
is a fenced non-goal.

**Work state: GitHub authoritative, with a committed mirror.** Rejected: **keeping the local
document authoritative**, today's behaviour, which leaves the two-database duplication the
brief measured. And **GitHub with no local mirror**, which is the cleanest single home and
fails the offline criterion — a checkout could no longer say what the outstanding work is or
in what order, and `/slices` and `/redteam` would lose the set view.

**Blocking rule: evaluable from the checkout alone.** Rejected: **everything mechanical
blocks**, which is stricter and simpler to state, but fails a build for `gh` being
unauthenticated — an absent comparison reported as a divergence, which is the exact
substitution *Verification* forbids. And **report everything, block nothing**, which collides
with no freeze and has no teeth; a convention nothing checks is the failure this whole design
is a response to.

**Freeze behaviour: suppress findings, keep exit 2.** Rejected: **suppressing everything
during a freeze**, which is the simpler rule and the more literal reading of the done line,
but makes writing `design/FROZEN.md` a way to switch the gate off entirely — including for a
broken checker, which has nothing to do with the staleness a freeze is meant to permit.

## Open questions

1. **Is the standing corpus outside `design/` made of document units?** The brief enumerates
   forty-nine units and `AGENTS.md`, `agent.md`, `.claude/COMPANIONS.md`, `INSTALL.md` and
   `README.md` are not among them — yet `AGENTS.md` owns I3, I4, I9 and the marked-region
   rule, and is the largest single carrier of design state in the repository at 34,899 bytes.
   **Recommendation: yes.** An invariant whose owner is not a unit is a dangling edge in a
   system whose central promise is that nothing dangles, and adding them uses the existing
   `document` kind rather than inventing one. The cost is that the brief's count of five reads
   as an enumeration of `design/`'s documents rather than of the kind, which is a wording
   change to a checkable line and therefore yours.

2. **Does the closed class list live in `design/20-contract.md` or in `AGENTS.md`?** The brief
   requires a single named document; it names `AGENTS.md` for the marked-region rule and leaves
   this one open. **Recommendation: the contract document**, carrying the class ids and each
   one's blocking status, with the checker declaring the detection and the two compared by a
   blocking class of their own — the `Test-WriteSurface.ps1` pattern, where the script holds
   the canonical list and the command file points at it. `AGENTS.md` is the alternative and it
   is not unreasonable: what fails a build is policy. This sets a public contract, so it is
   yours rather than mine.

3. **Which workflow is the cost baseline?** The brief requires
   `tools/Measure-Session.ps1` output for "a named, repeatable workflow" recorded before
   anything lands, and re-run after. Which workflow decides whether the payoff number means
   anything, and a model choosing its own benchmark is not a measurement. Two candidates worth
   naming: a `/reconcile` pass, which is the cycle the brief indicts and therefore the most
   favourable; or `/slice` on a real slice, which is the common case and the more honest one.
   **Recommendation: `/slice`**, because a benchmark chosen to flatter the change is the
   reporting failure *Verification* is about.

4. **Do `templates/design/*.md` get records?** They are the seed shipped to targets — product
   surface rather than this repository's design state, and `/install` already compares them.
   **Recommendation: no**, treating them as payload; the cost is that a change to the seed then
   has no design-state address, which is a real and small loss. Raised because it is a scope
   line rather than a technical one.
