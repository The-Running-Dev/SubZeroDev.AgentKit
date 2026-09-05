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
below follows from three commitments that answer that sentence directly.

**Current state is a fact with an address, not a conclusion drawn from prose.** A session
that needs to know what is true about `/track` reads the record for `/track`. It does not
read the corpus and decide.

**No generated prose is ever an input.** Facts flow one way — records into rendered regions —
and never back. This is what gives the system a fixed point, and it is the property most
easily lost later, so it is stated early and enforced in *Module boundaries*.

**Nothing a session must read grows with the corpus.** The brief fixes a ceiling and says it
never rises; a representation where any counted field accumulates makes that ceiling a
countdown rather than a bound. Every record field in the counted set is therefore bounded by
the unit's own surface or by work in progress, and *The orientation closure* discharges that
field by field rather than asserting it. The unit's own artifact is bounded by nothing but its
own size, which is why it sits outside the budget and inside the report — *Whether the ceiling
can be met* is where that split is argued.

## Data model

Six entity kinds. Every one is persisted as text in the tree; nothing is cached, indexed, or
built. There is no state directory to rebuild before a question can be asked, which is the
brief's *no round-trip* non-goal expressed structurally rather than as a promise.

### Unit

The addressable thing design state is *about*. Four kinds, and they are the kinds the tree
already has: **command**, **script**, **document**, **invariant**. No new decomposition.

A unit is **one record in two files**: the *active record*, which is everything true now, and
its *retired companion*, which holds the halves that have left the working set. One id, one
record, two files, and the split is the whole subject of *Retirement is relocation, never
deletion* below. The active record carries:

| Field | Type | Notes |
|---|---|---|
| `Id` | stable string | Assigned once. **Never reused, never renumbered** — the criterion-id precedent in `AGENTS.md` (*Tracking work*) applies to every id in this system |
| `Kind` | command \| script \| document \| invariant | |
| `Status` | `active` \| `retired` | Retirement's representation. A retired record keeps its id resolvable, leaves every closure, and stops having its `Anchor` checked against the tree |
| `Anchor` | tree path, or an invariant number | A **checked** restatement, not a copy — see *Every restatement is either forbidden or checked* below |
| `Owns` | one sentence | What this unit is responsible for. The only free prose in the record and deliberately capped |
| `Consumes`, `Exposes` | contract ids | Active contracts only |
| `Binds` | invariant ids | Active invariants only |
| `Live` | decision ids | Decisions in force here **whose terms are not yet stated anywhere this unit's reader already goes** |
| `Questions` | question ids | Open, and blocking work on this unit |
| `Work` | issue numbers | The tracker binding, open issues only |
| `Evidence` | tree pointers | A test or a code path that demonstrates the unit does what the record says |

The retired companion carries one half per active edge, and nothing else:

| Field | Retires from | What has become true |
|---|---|---|
| `Consumed`, `Exposed` | `Consumes`, `Exposes` | The contract retired, and this unit no longer names that surface |
| `Bound` | `Binds` | The invariant retired |
| `Archival` | `Live` | A later decision replaced its terms |
| `Answered` | `Questions` | The question no longer blocks work here |
| `Worked` | `Work` | The issue closed |

**Lifecycle.** A record is created when its artifact appears and is **retired, never deleted**
— a deleted command whose record vanished would leave every decision that cited it dangling,
and dangling is the one thing this system is built to make impossible. `Status` is what marks
it inactive, and it is the same field shape `Decision` and `Question` already carry rather than
a third way of saying the same thing. The *date* of retirement is deliberately not a field: it
is recoverable from the record's own file history, and storing it would be the second copy
*Single ownership* forbids. The same reasoning holds for every retired half.

**Identity is the `Id`, not the path.** A renamed command keeps its record; the `Anchor`
moves. This is the difference between an address and a name, and getting it the other way
round is what makes a rename a corpus-wide edit. It is also why every pointer in this model
names an id rather than a path wherever an id exists to name.

### Contract

A named surface one unit exposes and others consume.

| Field | Type | Notes |
|---|---|---|
| `Id` | stable string | |
| `Status` | `active` \| `retired` | As on `Unit`, and for the same reason |
| `Owner` | unit id | Exactly one. A contract with two owners is a defect in the split, not a feature. **The one reverse edge that stays written** — see *Derived* below, which also says what checks it |
| `Declaration` | tree pointer, or `prose` | Where the *shape* is declared. `prose` only for a Markdown command surface, which has no declaration to point at |
| `Semantics` | prose | **What the declaration cannot say** — when a field is meaningful, what must never be normalised, which parameter must not acquire a default. `AGENTS.md`, *Single ownership*, unchanged and now mechanically addressable |
| `Consumers` | — | **Derived.** Never written |

### Invariant

Extraction, not invention: `design/20-contract.md` already distinguishes the invariants
enforced by code from those enforced by instruction, and already says only the first kind may
be trusted without checking. That distinction becomes a field.

| Field | Type | Notes |
|---|---|---|
| `Id` | `I<n>` | The existing numbering is never renumbered |
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
| `Status` | `accepted` \| `superseded` | **Two values, not three.** Absorption is not a status — see below |
| `SupersededBy` | decision id | Required when `Status` is `superseded`. The log's existing `Amends:` line is the prose ancestor of this field |
| `StatedIn` | sites, each `<id> § <heading>` | **Where this decision's terms now stand, per unit it governs.** Empty until the decision is executed; see *Absorption* below |
| `Claim` | short prose | The standing claim, and **the only thing a session reads instead of the entry**. Capped by the orientation budget, which is what keeps it a claim rather than a summary |
| `Affects` | — | **Derived** from the units whose `Live` or `Archival` names this decision, together with the units its `StatedIn` sites resolve to. Never written |

**Absorption is a property of a (unit, decision) pair, which is why `Status` keeps two values
and why the pair is recorded here rather than on the unit.** One decision routinely governs
several units — a routing rule binds both `AGENTS.md` and the command file it routes. Its
terms may be written into one of those artifacts and not the other, so "the artifact states
this" is true of a pair and meaningless of the decision alone. Putting it on `Status` would
force one unit's reader to inherit another unit's answer. Putting it on the *unit* — an
`Absorbed` list of decision ids, which is what the 2026-08-29 entry decided — is correct about
the pair and wrong about the budget: that list accumulates one entry per decision for the life
of the repository, inside the one file the ceiling counts. Recording the pair on the decision
puts it on the side that is **not** counted once the decision has been executed, which is what
makes the ceiling a bound instead of a countdown. *Alternatives considered* records the fork.

**The rejected alternatives stay in the log and are not extracted.** They are the reason the
log exists (`AGENTS.md`, *Decision logging*) and they are read when relitigating a choice, not
when orienting. Pulling them into the state layer would put the largest and least-consulted
half of the corpus back inside the per-unit budget.

**Supersession is a forest, not a graph.** `SupersededBy` chains must terminate, and they
terminate in an `accepted` decision. A chain that revisits a decision — `A` superseded by `B`
while `B` is superseded by `A`, or a decision naming itself — leaves a history that is
internally contradictory with no standing terms anywhere in it, and every id in it resolves,
so nothing else on the closed list would notice. The check is a walk with a visited set, and
it is cheap now precisely because no cycle has been written yet; a persisted one needs a human
to reconstruct intent, because the record no longer says which claim was meant to stand.

### Question

| Field | Type | Notes |
|---|---|---|
| `Id`, `Text` | | |
| `Status` | `open` \| `answered` | |
| `AnsweredBy` | decision or invariant id | Required when `answered` |
| `Affects` | — | **Derived** from the units whose `Questions` or `Answered` names this question. Never written |

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
milestone then issue number. A repository with no project is an ordinary state rather than a
broken one — the account may not own it, the `project` scope may never have been granted, or
`/track` may not have run in it yet — so a mirror written there must still produce an order,
and an order that silently disappeared would break the offline criterion without saying so.

### Marked region

Not a record — a structure inside a prose document. An opening marker naming **which projection**
it renders and **whether the projector writes it**, a body, a closing marker. The marker does not
name its source: the id determines the projection and the projection determines the source, so a
source named in the marker would be a second copy at the one site with hundreds of copies.
`design/20-contract.md` § *Marked regions* fixes the two marker forms and says why the bare one
means projected.

This **generalises the existing agent-fence rule** rather than replacing it. `AGENTS.md`
(*Tracking work*) already says an issue's `<!-- agent:start -->` block is regenerable and
everything outside it is not; that rule becomes the general one, stated once, and the issue
block becomes an instance of it. Every command that currently restates it points at it
instead.

A region's identity is (document, projection id) and must be unique within the document.
Nested or unbalanced markers are a finding, not a parse failure to route around.

### Derived, and where derived facts may appear

Reverse edges are **derived and never written**: which units an invariant binds
(`Invariant.BoundBy`), which units consume a contract (`Contract.Consumers`), which units a
decision is in force for (`Decision.Affects`), and which units a question blocks
(`Question.Affects`). Writing them would create the second copy that rots. The unit's end of each
of those edges *is* written, because the closure is one hop from the unit record and a derived
field is not in a record to be hopped from.

**`Contract.Owner` is the one reverse edge that stays written.** A contract record read alone must
still say who owns it, which is the offline criterion, and "exactly one owner" is a statement
about the contract rather than about the units. It is therefore the second copy, so it is the
*checked* kind rather than the forbidden kind: a blocking class compares it against the unique
active unit whose `Exposes` names that contract. That check is also the only mechanical
enforcement "exactly one" has ever had.

**`Decision.StatedIn` is not a reverse edge and does not join it.** It points *forward*, at a
place in the corpus, exactly as `Decision.Anchor` points forward at the log heading that
records the decision. The two are the same shape: the anchor names where the decision was
*made*, the site names where it is *executed*. It names a unit id rather than a path for the
reason identity is an id everywhere else here — a rename must not invalidate it.

They still have to be *readable* — "which units does I3 bind" is a question a human offline
must be able to answer. So they appear exactly one way: as a **projection into a marked
region**. Generated, checked, one-directional. This is the whole reason the marked-region
mechanism carries its weight rather than being a documentation nicety.

### Every restatement is either forbidden or checked

The governing rule, and the honest generalisation of `AGENTS.md`'s *a document states only
what the tree cannot*.

A record's `Anchor`, a contract's `Declaration`, an invariant's `Evidence`, a decision's
`Anchor` and each of a decision's `StatedIn` sites are all restatements of something in the
tree or the log. They are permitted **because each one is a reference whose resolution is
mechanically checked** — the path exists, the heading resolves to exactly one entry, the test
is present. A restatement with no check is forbidden; a restatement with a check is a binding.
Every blocking divergence class is an instance of this rule.

**What none of these checks is the meaning.** A resolving `Anchor` does not prove the entry
says what the `Claim` says, a present `Evidence` file does not prove the test enforces the
invariant, and a resolving site does not prove the section states the decision. That is the
bargain the rule makes, it is the same bargain everywhere it applies, and the residual it
leaves is named in *Failure modes* rather than left to be discovered.

### Retirement is relocation, never deletion

One rule, one mechanism, and the reason the closure has a fixed point at all.

> **An edge or a record leaves the working set by moving to the retired companion, never by
> being removed. The id stays resolvable; the companion is in no closure.**

Every active edge on a unit has exactly one counterpart in the companion, listed in the table
under *Unit* above. There are no exceptions and no edge without a home, which is what closes
the case a `Consumes` edge presented: a contract that retires used to leave its consumer with
a choice between pointing at something excluded from every closure and deleting an edge the
rule forbids deleting. It now moves, like everything else, and costs nothing to keep.

**Relocation crosses a file boundary, and that is the point.** Moving a half within one file
takes the referenced record out of the closure and leaves the reference *bytes* in it — an id
string per retired edge, accumulating for the life of the repository inside the one file the
meter counts. That is a slower countdown, not a bound. The companion is a separate file, is
never any closure's member, and so a retirement removes both the record and the reference from
the counted set. This is the one place the design constrains storage granularity for a second
time, and it is the same reason as the first: the metric must equal what is read.

**Relocation is reversible and the halves are disjoint.** Reverting a document amendment moves
the id back; nothing was destroyed. An id appearing in both halves of one edge is a finding,
not a merge to be resolved by preferring one.

### Absorption — where a decision's terms come to stand

Absorption is **not** retirement, and conflating the two is what made the previous revision's
accounting wrong in both directions. A superseded decision is history. An absorbed decision is
**in force**, and its terms have simply moved from its record to somewhere the unit's reader
already goes. Nothing retires; a claim changes address.

> **`StatedIn` names a site — `<id> § <heading>` — for each unit this decision governs whose
> reader now finds its terms there. A site must resolve to exactly one heading, and it must be
> somewhere that unit's reader already reaches: a section of the unit's own `Anchor`, or a
> section of a record already one hop from it.**

Three properties, and all three are needed:

- **It is per-pair and carries a pointer.** A blanket assertion is not expressible, and the
  heading must resolve to exactly one heading in the named file.
- **The reach rule is what makes absorption honest rather than an erasure.** A claim may only
  move to a place the session was going to open anyway. Moving it anywhere else would reduce
  the measured closure without reducing what is read, and a metric that can be improved
  without improving the thing it measures has stopped being a metric.
- **The check restricts what can absorb, so no rule about kinds is needed.** A `.ps1` has no
  headings for the pointer to resolve against, so a decision about a script is executed by
  amending that script's **contract** — `<contract id> § Semantics`, a record already one hop
  away — rather than by writing prose into code. The restriction falls out of the mechanism
  instead of being a second rule someone has to remember, and it lands the claim exactly where
  `AGENTS.md`'s *a document states only what the tree cannot* would have put it.

**Why this ends monotonic growth, which supersession could not.** A decision about a policy
document is *executed* by writing the rule into that document. Absorption is therefore the
terminal state of every such decision, normally reached in the same commit that lands it — so
a unit's `Live` set is the decisions **not yet stated where its reader looks**: an in-flight
working set bounded by what is in progress, rather than a history bounded by nothing. That set
is non-empty in exactly the case it should be, a freeze, where a contradiction is recorded in a
pull request and the document is deliberately left alone. And because the site lives on the
decision, executing one *removes* bytes from the unit's closure and adds none.

**A section is amended in place; a record set is appended to.** That asymmetry is the whole
arithmetic. Ten decisions about one clause of `AGENTS.md` are ten records — and one section,
rewritten ten times. Absorption is the conversion from the first to the second.

**A decision may not be both `Live` on a unit and stated in it.** The two say opposite things
about where the reader finds the terms, and a record that says both is not a merge to resolve
but a finding.

### Every reference sits in the half its referent's state requires

The rule that makes the halves mean something, checked in **both** directions. A reference in
the wrong half resolves perfectly and every id exists, so nothing else on the closed list sees
it — and what a reader gets is a superseded claim presented as current, an accepted claim
hidden as history, or an unresolved blocker omitted.

| Reference sits in | Referent's status must be |
|---|---|
| `Consumes`, `Exposes` | contract `active` |
| `Consumed`, `Exposed` | contract `retired` |
| `Binds` | invariant `active` |
| `Bound` | invariant `retired` |
| `Live` | decision `accepted` |
| `Archival` | decision `superseded` |
| `Questions` | question `open` |
| `Answered` | question `answered` |
| `Work` | `WorkRef` open |
| `Worked` | `WorkRef` closed |
| a `StatedIn` site | unit `active` |

The table is **total**: every half has a required status and every status has a half, so there
is no combination the check declines to judge. That totality is the property, not the rows —
a partial table is how one-directional checking got written in the first place.

**This is also what lets the closure stop excluding things.** The previous definition excluded
retired halves and retired records because an active record could name them; under this table
it cannot, so the exclusion moves out of the meter and into the representation, where a check
holds it. A rule enforced by a filter at measurement time is one every other consumer has to
remember; a rule enforced by the shape of the data is one nobody can forget.

### A decision nothing names is an interrupted write

An accepted decision must be named by at least one unit's `Live`, or name at least one site in
`StatedIn`. A superseded one must be named by at least one `Archival`. `Decision.Affects` is
never empty.

Without this, a log entry and a decision record can exist with no unit naming either. Every
written id is valid, the derivation yields the empty set, and the decision sits outside every
unit's orientation state — visible only to a reader who goes looking in the place the brief
says orientation must not need. A later session cannot tell that from an intentional zero-unit
decision, because nothing distinguishes them. It is cheap to forbid now, while an empty
`Affects` has no established meaning; once one exists and is deliberate, the check can no
longer be added without adjudicating each case.

The same reasoning does **not** extend to questions. An open question that blocks nothing yet
is a real state — it is what `design/20-contract.md` § *Unresolved* holds today — and
requiring a unit would force the noticing session to invent an affected unit in order to
record the question at all.

### The orientation closure

The brief's 16,384-byte ceiling is only checkable if "the state loaded to begin work" is a
*defined set*. It is:

> **closure(U) = the active record of U, plus the record of every id that record names
> directly.** One hop. Not transitive. The companion is not in it, and neither is U's own
> artifact: that is measured and reported beside the bounded figure, never inside it (I23).

Five consequences, all load-bearing:

- **One hop is the line between orienting and investigating.** Following a decision's claim
  to the units it also affects is pursuing a question, not starting work. An unbounded closure
  reaches everything, because decisions bind many units, and the budget would be unmeetable
  by construction.
- **No record field in the counted set grows with the corpus**, and that is discharged per
  field rather than asserted. `Consumes`, `Exposes` and `Binds` are bounded by the unit's real
  surface. `Questions` by open questions, `Work` by
  open issues, `Evidence` by the unit's tests. `Owns` is one sentence. Everything that
  accumulates — superseded decisions, answered questions, closed issues, executed decisions,
  retired contracts — has left for the companion or for a site on the decision. That is the
  brief's *does not rise as the corpus grows* made structural instead of aspirational, and it
  is the property the whole retirement mechanism exists to buy. **`Live` is the one bound that
  is maintained rather than held**: it is decisions in flight only while each executed decision
  is given its site, and nothing detects a unit where that has stopped happening. The artifact
  is the term this does not bound at all, and *Whether the ceiling can be met* below is where
  both are confronted rather than absorbed into a caveat.
- **The artifact is measured and reported, and deliberately not budgeted.** For any one unit it
  is a constant: a session beginning work on that unit opens that file whatever the state set
  says, so admitting it to the bound adds the same number to every reading and changes which
  unit is worst not at all. What it does change is what the budget is a statement about — with
  the artifact in, "under 16,384 bytes" is a claim about how large the repository's files are
  allowed to be, which is a constraint this design has no business imposing and no lever to
  satisfy. Excluded, the number is once again a statement about the mechanism, which is the only
  thing the mechanism can act on. It is reported on every run so that the total a session
  actually reads is never hidden behind the bounded half.
- **Absorption is a shrink, and it is a real one rather than an accounting one.** Executing a
  decision into its site removes the record from the closure, and what the reader gains is a
  file open it no longer performs. The site's own bytes were going to be read either way: the
  reach rule puts every site either in another counted record or in the unit's own artifact,
  and the artifact is the one file a session beginning work on that unit opens unconditionally.
  That is what stops a claim escaping to a place no reading covers — and it is why the artifact
  leaving the *bound* does not reopen the gap that admitting it closed, because what closed that
  gap was the reach rule and the artifact staying in the *report*, not the arithmetic.
- **The measurement must equal what is actually read**, so each record is separately
  openable and the closure is a sum of whole files. A representation where records share a
  file would make the metric understate the load, because a reader opens the file. It is the
  same argument that puts the retired halves in their own file rather than lower down in the
  same one. It is also the argument that keeps the artifact in the *report* — what a reader
  opens must be stated — rather than in the bound, which is a different question.

Nothing is filtered at measurement time. The closure has no exclusion clause left, because
*Every reference sits in the half its referent's state requires* removed the need for one.

The largest closure is **named by the checker, not predicted here.** No number belongs in this
document: it would be a second copy of a measurement, and it is the copy that rots.

### Whether the ceiling can be met

It can be, and the two things that make it meetable have both now happened. Neither moved the
ceiling: the criterion's scope changed on 2026-09-01 — the brief bounds the records and reports
the artifact, where before it bounded their sum — and the absorption this section calls the
remediable half of the gap was then performed. Both were named here in advance rather than
discovered afterwards, which is what this section was written to make checkable. This section
states the shape of the problem; the measurement itself belongs to the checker and to
`design/cost.md`, not here.

**Whether it is met on any given day is the checker's to say.** A number written down here would
be a second copy of a measurement, and it is the copy that rots — as the previous revision's
flat "it is not met today" did, surviving both the re-scope and the absorption that falsified
it.

**The artifact dominated every reading, and no number for it belongs here** — the checker names
the largest closure and its largest contributor on every run, and a figure written down is the
copy that rots. On a document unit of any size the artifact alone exceeded the ceiling, and
that was never a bookkeeping failure the retirement mechanism could fix, because every field it
bounds is already bounded. A term the mechanism cannot move, added identically to every
reading, is not a budget — it is a verdict on file size wearing a budget's clothes, and it
crowded out the one breach that *was* actionable. Excluding it from the bound is what let that
breach become visible again; keeping it in the report is what stops the exclusion becoming a
number nobody reads against.

**Absorption is the one part of the gap that is remediable, and skipping it is how a record
closure breaches on its own.** `Live` is bounded by decisions in flight only while step 4 of
*Record* is actually taken; where a decision's terms are written into a document and no site
is named, the id stays and the set becomes the history it was designed not to be. Nothing
detects that — it is the residual *Failure modes* names — so it is arithmetic that has to be
performed rather than a property that holds itself. A policy document accumulating decisions
faster than they are absorbed is therefore the case to watch, and it is the case where the
checker's report is the only warning available.

**Bounding the sum meant a file-size limit on the repository, and that is why the sum is not
what is bounded.** With the artifact in, "every unit under 16,384 bytes" was within a few
kilobytes of "no command file, script, or document exceeds about ten kilobytes" — a constraint
on the whole tree, imposed by the design-state mechanism, and a much larger claim than anything
else in this document. The design-state mechanism is not entitled to make it. Two remedies were
foreclosed before this one and remain so:

- **Splitting a large document into one unit per section is rejected, as it was twice before.**
  It divides the artifact the same way it divides the `Live` set, and it fails for the same
  reasons: two units anchored on one file breaks the one-record-per-artifact bijection that
  makes "nothing is unrecorded" a checkable set difference, and it moves every anchor onto a
  heading that a rename invalidates. Reaching for it because the arithmetic demanded it would
  be relitigating a settled decision under pressure, which is the failure the decision log
  exists to prevent.
- **Relaxing or retiring the ceiling stays foreclosed.** The brief names a relaxed ceiling as
  the failure mode it exists to prevent, and the number is unchanged at 16,384 bytes. What was
  re-scoped is what the number counts. That distinction is the whole of this revision, and a
  later change that raises the figure — or that widens the exclusion past the one term named
  here — is the relaxation the brief forbids, not a further re-scope.

**What the design does about it is report, precisely and on every run.** The checker names the
unit with the largest closure, its size, and its largest contributor, on a clean run as well as
a failing one, and names the unit's artifact beside the bounded figure rather than inside it.
Saying both on every run is what keeps the excluded term from becoming invisible and the gap
from being rediscovered as a surprise. Whether the project proceeds, re-scopes, or stops
remains a judgement the brief reserves — and it is not a model's to make.

### Persisted versus in-memory

Persisted: every record, every companion, every marked region, every projection. In-memory and
never written: the parsed graph, all derived edges, closure sizes, reported totals, the check
result, and the live half of any tracker comparison. **No cache and no index**, so there is
nothing that must be current before a question can be asked and nothing that can be
current-looking and wrong.

## Module boundaries

| Module | Owns | Depends on | Exposes |
|---|---|---|---|
| The state set | Every record and companion. The facts | nothing | Text, readable unaided |
| The reader | The record grammar, and the rule that **no line is silently skipped** | the state set | A parsed graph, or a parse failure naming the line |
| The graph validator | Reference and existence classes, including every pointer resolution, the half/status table, and supersession acyclicity | the reader, the tree | Findings |
| The projector | Rendering one projection from records | the reader | Text |
| The projection checker | Comparing a rendered region against the tree's copy | the projector, the tree | Findings |
| The budget meter | Closure computation and the ceiling | the reader, the tree | Findings, and the largest unit and its largest contributor by name |
| The mirror generator | Refreshing `WorkRef` mirrors | `gh`, the reader | Written mirrors. **`/track`'s alone** |
| The divergence checker | The closed class list, the freeze gate, the three-list report | validator, projection checker, budget meter, `design/FROZEN.md` | Three lists and an exit code |
| `AGENTS.md` | The marked-region rule; the freeze rule | nothing | The rule every command cites |
| `design/20-contract.md` | The class ids and each one's blocking status | nothing | The list CI is judged against |

Direction: `state set → reader → {validator, projector, meter} → checker → {CI, commands}`,
with the validator, the projection checker and the meter additionally reading the tree they
are checking against. The projector writes into documents; nothing reads a generated region
back. **Acyclic**, and the acyclicity rests on that one condition — a projection consumed as
an input closes the loop and restores the generative pass this design exists to remove.

**The mechanism is inside its own subject matter, and that is data, not a cycle.** The checker
is a `tools/` script, so it is a unit with a record, which the checker validates. The class
list lives in a document, which is a unit, which the checker validates. No module depends on
its own output; the self-reference is that the state set describes the tree it is checked
against, which is the point. It is also why one blocking class compares the checker's declared
class ids against the contract document's list — the one restatement the system cannot check
by any other means.

**The meter now reads the tree, and that is a widening worth naming.** Resolving a site's
heading and sizing a unit's artifact both need the checkout, which the validator already
needed, and the second is no longer incidental — the artifact is measured on its own and
reported beside the sum rather than counted inside it (I23). It is not a read of a projection,
so it does not close the loop, and it needs nothing but the checkout, so it does not disturb
the blocking rule below.

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

1. Resolve the unit by name to its active record.
2. Read the closure: the record, plus one hop, plus the unit's own artifact.
3. Begin. **No corpus read, no reconstruction, and `design/90-decisions.md` is not opened.**

What makes this different from reading a well-organised document is not the reading — it is
that step 1 is a lookup with one answer. Today the same step is a judgement about which parts
of 216 KB are still true.

Decisions already executed against this unit have no record in the closure and do not need
one: their terms are in the sections the session is opening regardless — the unit's own
artifact, or a contract record already one hop away, both of which the closure counts whether
or not a decision was written into them. That is what makes absorption a strict saving.

### Record — a decision is made

**The steps are `AGENTS.md` § *Writing a design-state record*'s and are not restated here.**
That is the copy an installed target carries and the one `/reconcile`, `/contract` and `/design`
cite; a second numbered list here is the copy that rots, and it rotted once already — the
contract's abbreviated version outlived the insertion of the `StatedIn` step and went on
numbering five where there were six. What belongs here is why the sequence has the shape it
has.

**The structured writes are the new cost, and they are the trade this design makes: a small
structured write at every decision, in exchange for no large read at any session start.**
Whether that trade pays is the brief's cost criterion, and it is measured, not argued.

**Naming the site is a step rather than a later cleanup pass, precisely so that it is not one.**
Writing a decision's terms into the document it governs is the ordinary case for a policy
document and the command file it governs, and a claim that is executed but not addressed leaves
its id in `Live` — which is where an in-flight set silently becomes a history. Nothing detects
that (*Failure modes*, the residual rows), so the only thing holding it is that the write
happens in the same change.

**Regeneration precedes the check, and that ordering is not optional** — checking before
regenerating reports every projection as stale, which trains the reader to ignore the report.

**Absorption also happens without a decision being made**, when an amendment finally writes an
already-recorded decision into its site: name the site, drop the id from `Live`, regenerate,
check. It is the path a freeze defers and an unfreeze completes.

### Check — CI, or `/verify`, or a command's own gate

1. Parse the state set. A line the grammar does not recognise is **reported as unparseable
   and never skipped** — the I12 precedent, which exists because a dropped id is an id that
   appears to match.
2. Validate the graph: resolve every pointer a record carries against the tree or the log,
   apply the half/status table in both directions, walk the supersession chains, and confirm
   every decision is named by something.
3. Regenerate every projection into memory and compare against the tree's copy.
4. Compute every closure and compare against the ceiling; compute every reported total.
5. Read `design/FROZEN.md`. If it exists, **downgrade every blocking class to reported** and
   say how many were downgraded.
6. Emit three lists — **findings, reports, and what could not be evaluated** — and an exit
   code, on the `/verify` and `Test-DesignDrift.ps1` pattern: 0 clean, 1 findings, 2 could not
   evaluate, with **2 taking precedence over 1**.

**A class is blocking only if it can be evaluated from the checkout alone.** This is the rule
that decides the closed list, and it is not a convenience — a class needing the network fails
in exactly the environment where the failure means nothing, and an unavailable tracker reported
as a divergence is the fabricated gate result *Verification* exists to prevent. Reported and
never blocking, therefore: mirror staleness and anything needing the tracker; pin ancestry,
because a shallow CI checkout has no history to answer it with; and every semantic disagreement,
permanently, because the brief's *no formal specification of behaviour* non-goal puts them out
of reach and a build that fails on a model's opinion is a build nobody trusts.

**The class ids themselves are `design/20-contract.md`'s, and this document does not list
them.** That was settled when the closed list was given a home, and it is the difference
between a rule and a copy of a rule: the membership *rule* is a design decision and is stated
above, while the roster it admits is a list CI is judged against and belongs in exactly one
place. The failure modes below name what fails and what the caller sees; assigning each an id
is `/contract`'s.

**A freeze suppresses findings, not failures.** Exit 2 stands during a freeze. The freeze
permits known staleness (`AGENTS.md`, *The design freeze*); it does not permit a checker that
could not run, and treating those the same would make the freeze a way to turn the gate off.

### Migrate — once, on this repository only

Every log entry is read once and its live claim extracted; the entries are not touched.
Records are written for the units the tree already has, and a decision already written into a
document is given its site rather than a `Live` edge — migration is where most of this
repository's absorption happens, in one pass, because most of its decisions were executed
long ago. This runs exactly once here and **never in a target**, which is the whole of the
brief's scope answer expressed as a flow.

## Failure modes

| Failure | Detection | Response | User sees |
|---|---|---|---|
| A record names an id that does not exist | Graph validation | Finding, blocking | The referring record, the missing id |
| A record's anchor names a path not in the tree | `Test-Path` | Finding, blocking | Both, and which of the two is wrong is **the user's call** |
| A tree artifact of a unit kind has no record | Set difference, both directions | Finding, blocking | The unrecorded artifact |
| A record's line does not parse | The reader | **Could not evaluate**, exit 2 | The file and line, verbatim. Never dropped |
| A companion exists with no active record, or duplicates a field the active record carries | File pairing | Finding, blocking | Both files |
| A reference sits in a half its referent's status does not allow, in either direction | The half/status table | Finding, blocking | The record, the half, the referent, and the status that contradicts it |
| A `StatedIn` site resolves to zero or two headings | Heading scan of the site's file | Finding, blocking | The decision, the site, and the count |
| A `StatedIn` site is not somewhere the named unit's reader already reaches | Reach check against the unit's anchor and its one-hop records | Finding, blocking | The decision, the site, and the unit |
| A decision is both `Live` on a unit and stated in it | Cross-record check | Finding, blocking | The unit and the decision |
| An accepted decision no unit names and no site places | Empty derived `Affects` | Finding, blocking | The decision, and that it is an interrupted write |
| A `SupersededBy` chain revisits a decision, or a decision names itself | Chain walk with a visited set | Finding, blocking | The cycle, in order |
| An id appears in both halves of one edge | Set intersection per edge across the pair of files | Finding, blocking | The record, the edge, and the id |
| A marked region is unbalanced or nested | Marker scan | Finding, blocking | The document and the marker |
| A projection differs from its regeneration | Regenerate to memory, compare | Finding, blocking | A diff of the region |
| Line endings differ but content does not | Normalise before comparing | **Not a finding** | Nothing |
| A decision anchor resolves to zero or two headings | Heading scan of the log | Finding, blocking | The anchor and the count |
| A log entry has no decision record | Set difference against the log's headings | Finding, blocking | The entry's heading |
| A closure exceeds the ceiling | The meter | Finding, blocking | The unit, its bounded size, its largest contributor — **always a record** — and that unit's own artifact size, named separately and never folded into the bounded one |
| An invariant enforced by `code` has no evidence | Field check | Finding, blocking | The invariant id |
| `gh` absent or unauthenticated | Non-zero exit on first call | **Could not evaluate** for tracker classes only; the rest of the run completes | Named as a comparison that did not happen |
| A shallow CI checkout | No history for `merge-base` | **Could not evaluate** for ancestry, and never a pass | That ancestry was not checked, and why |
| The tracker moved during a mirror refresh | Not detected | Mirror is stale, which is its normal state | `MirroredAt`, so staleness is visible rather than inferred |
| The state set is absent entirely | Zero records | **Could not evaluate**, exit 2. Never clean | That nothing was checked — the I8 shape |
| `design/FROZEN.md` exists | File exists | Downgrade blocking to reported; exit 2 still stands | The count downgraded, and the marker's `Frozen because` and `Lifts when` **verbatim** |
| A claim in a record is simply wrong | **Not detected** | Nothing | Nothing — see below |
| A site's section is reworded and stops stating its decision | **Not detected** | Nothing | Nothing — see below |

**The last two rows are the residual risk and it is irreducible.** Every mechanical property of
the state set is checked; the *truth* of a standing claim, and whether a section still says what
a `StatedIn` site says it says, are both behavioural assertions, which the brief's non-goals
put permanently out of scope. What the design buys is that a wrong claim is now wrong in **one
addressable place** rather than distributed across a corpus, so a human who finds it fixes it
once. That is a smaller promise than "the design cannot be wrong", and it is the honest one.

**Absorption's residual is narrower than it first looks, and worth stating precisely.** A
section that is *deleted* or *renamed* is caught, because the pointer stops resolving. What is
not caught is a section that survives and changes meaning — and in that case the decision's
terms and the document disagree, which is a divergence between the document and the log rather
than one this state set introduced. The mechanism does not create the exposure; it gives it an
address.

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
the corpus — a property of the granularity choice rather than of any locking. Splitting the
retired halves into a companion narrows it further, since a retirement and an active edit to
the same unit no longer touch the same file.

Five orderings do matter, and none of them is enforced by a lock:

- **Regenerate before checking.** Otherwise every projection reports stale and the report
  becomes noise.
- **Regeneration must be idempotent and order-independent.** Regenerating twice must produce
  the same bytes, and regenerating region A must not change what region B renders to. Without
  both, "regenerate then compare" gives different answers on different runs, and the check
  stops being a check. This is a constraint on the projector, and it is the one place the
  design forbids something a plausible implementation would otherwise do.
- **A site is named in the same commit that writes the section it points at, never before.**
  Naming it first leaves a pointer resolving against a heading that does not exist yet, which
  the checker correctly blocks on; naming it later is merely deferred and costs only closure.
  The failure is one-directional, which is why nothing enforces the ordering beyond the check
  itself.
- **A half moves in the same commit its referent's status changes.** Superseding a decision
  and moving the id to `Archival` are one edit, not two, and the half/status table is what
  makes a half-done one visible on the next run rather than at the next reconstruction.
- **Authority transfers before criteria are cited.** A slice's criteria are the issue's from
  the moment the issue exists; a session reading the proposal after that point is reading a
  mirror. Nothing enforces this but the sequencing of `/slices` then `/track`.

The one genuine external race is the tracker moving while a mirror is being written. It is
**not** detected, and detection is not worth buying: the mirror is stale by construction,
`MirroredAt` says so, and GitHub is authoritative for anyone who can reach it.

## Alternatives considered

**Retired halves: a companion file per unit.** The decision that makes the ceiling a bound
rather than a countdown, forced by the observation that moving a half within one file removes
the referenced record from the closure and leaves the reference bytes inside it — twenty-two
decision ids already occupy 1,334 bytes of `unit/document/agents-md`, and that arithmetic does
not stop. Rejected: **keeping one file and counting only its active prefix**, which needs no
new file and is the smaller change, and which the design's own measurement rule forbids — a
reader opens the file, so a metric that counts part of it understates the load, which is the
identical objection that already rejected grouping records into one document per kind.
**Deleting the retired edge**, cheapest of all and the thing *retirement is relocation* exists
to forbid, leaving every id it named unresolvable. **Capping the number of retired entries**, a
number nothing derives and everything must obey, which converts an accounting problem into an
arbitrary refusal to record history. **Accepting the growth as slow enough**, which is
defensible on today's figures — roughly 160 retired edges before a unit breaches — and is
foreclosed by the brief twice over: the ceiling "does not rise as the corpus grows", and the
lifespan is "maintained for years", which is the same interval.

**Absorption recorded on the decision, not on the unit.** Rejected: **`Unit.Absorbed`, a list
of decision ids each qualified by a heading**, which is what the 2026-08-29 entry decided and
is correct about everything except where the bytes land — it accumulates one entry per executed
decision inside the one file the ceiling counts, so the mechanism introduced to stop the
countdown restarts it in another field. **A third `Status` value on `Decision`**, which is a
smaller change and the wrong shape, because absorption is true of a (unit, decision) pair and a
status would force every unit binding that decision to inherit one unit's answer. **Reusing
`Archival`**, which needs no new field at all and would make the state set assert a
supersession that never happened. **A derived `States` list projected into the unit record**,
which keeps the unit-side view without a written second copy and puts generated text inside the
file the reader parses and the meter counts, which is the one place a projection must not go.

**The artifact's bytes: excluded from the ceiling, reported beside it.** The fork that reaches
the brief, and the only one in this document decided twice. It was first closed the other way —
counted in full — against this document's own recommendation, on the reading that a criterion
saying "the design state loaded to begin work" means the bytes loaded, without a qualification
the brief does not make. **That closure is superseded, on the evidence its own declined
recommendation predicted.** The cost recorded against it then was that a large document unit
fails a 16,384-byte ceiling for existing; `design/cost.md` now measures sixteen units over the
ceiling, fifteen of them on their artifact alone and unreachable by any lever the mechanism
has, with the one genuinely actionable breach — a unit over budget on its records — invisible
underneath them. A budget every reading fails for a reason none of them can act on is not a
budget, so what the criterion counts was re-scoped and what it allows was not. Rejected:
**counting the artifact in full**, the previous decision, whose literal reading is faithful to
the brief's old sentence and whose consequence is a de facto file-size cap on the whole tree
that the design-state mechanism has no standing to impose. **Excluding it silently**, the
original defect `/redteam` raised — the meter certifies a number that is true and unhelpful,
with nothing in the report saying so; this is what keeping the artifact in the *report* exists
to prevent, and it is the half of the previous decision that survives intact. **Counting only
the sections a decision was absorbed into**, an intermediate worse than either end: it inverts
the mechanism, because a section is almost always larger than the one decision record it first
replaces, so absorbing would *raise* the closure until several decisions had accumulated in the
same section.

**Half/status agreement: one total table, both directions.** Rejected: **the four
one-directional checks the previous revision named** — an absorbed decision that is superseded,
a `Questions` entry that is answered, and so on — which catch the cases someone thought of and
pass silently on `Live → superseded`, `Archival → accepted` and `Answered → open`, all of which
resolve cleanly and all of which mislead a reader. **A class per pair**, which is more precise
in a report and widens the closed list by ten ids for one rule, exactly the split the contract
document already refused twice. **Leaving it to the projector to filter on status**, which
leaves the record self-contradictory and makes an offline read of a record and a read of its
rendered region answer the same question differently.

**An empty `Affects` is a finding.** Rejected: **permitting it**, which cannot distinguish an
interrupted write from a deliberate zero-unit decision and therefore cannot be tightened later
without adjudicating every case that accumulated meanwhile. **Reporting it**, which is the
softer option and wrong here, because the failure it describes — an accepted decision reachable
only from the log — is precisely the state the brief's first done criterion forbids. The rule
is deliberately **not** extended to questions, where blocking nothing yet is a real state.

**Supersession: an explicit acyclicity walk.** Rejected: **relying on `EnforcementUnevidenced`**,
which catches a superseded decision with no `SupersededBy` and is blind to a cycle, where every
field is present. **A depth cap**, cheaper to implement and it reports the wrong thing — a long
legitimate chain and a two-element cycle are indistinguishable to it. **Nothing**, on the
argument that no cycle has been written: true today, and the reason to add the check now rather
than after one exists and needs a human to reconstruct which claim was meant to stand.

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
own budget.

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

**All five are closed.** The first four by `design/90-decisions.md`, *2026-08-19 — The four
open questions in `design/10-design.md` are closed; the unit set is 59, not 49*; the fifth on
2026-08-29, at sign-off, against this document's recommendation. They are kept rather
than deleted because one was decided against its recommendation and one narrowed the brief, and
a question that disappears is one the next session asks again. The answers are recorded here;
the reasoning and the rejected alternatives stay in the log entry.

1. **Is the standing corpus outside `design/` made of document units?** **Closed: yes.**
   `AGENTS.md`, `agent.md`, `.claude/COMPANIONS.md`, `INSTALL.md` and `README.md` are `document`
   units, on the argument that an invariant whose owner is not a unit is a dangling edge in a
   system whose central promise is that nothing dangles. The unit set widened again afterwards,
   to shipped payload — `design/20-contract.md` § *Artifacts of a unit kind* carries the glob and
   its exclusions, and no number is written down anywhere, because the project kept invalidating
   the ones that were.

2. **Does the closed class list live in `design/20-contract.md` or in `AGENTS.md`?** **Closed:
   the contract document**, carrying the class ids and each one's blocking status, with
   `tools/Test-DesignState.ps1` declaring the detection and a blocking class comparing the two —
   the `Test-WriteSurface.ps1` pattern.

3. **Which workflow is the cost baseline?** **Closed: `/slice` on a real slice**, over
   `/reconcile`, because a benchmark chosen to flatter the change is the reporting failure
   *Verification* is about. Both halves are measured in `design/cost.md`.

4. **Do `templates/design/*.md` get records?** **Closed: yes — against the recommendation**,
   which was to treat the seed as payload. They are `document` units, so a change to the seed has
   a design-state address. Retained as a declined recommendation rather than dropped: the cost it
   named was the opposite one, that records for shipped payload put product surface inside this
   repository's design state, and that cost is now paid rather than avoided.

5. **Does "the design state loaded to begin work on any one named unit" include the unit's own
   artifact?** **Closed: no — reopened and re-closed on 2026-09-01**, adopting the
   recommendation that was declined when this question was first put. It was closed *yes* on a
   literal reading of the brief's then-wording; the cost recorded against that closure was that
   a large document unit fails a 16,384-byte ceiling for existing. That cost came due and was
   measured (`design/cost.md`), the brief's criterion was amended to bound the records and
   report the artifact, and this question follows it. **The number did not move**: what changed
   is what it counts. *Whether the ceiling can be met* carries the reasoning, and the rejected
   alternatives — including the previous closure — are retained above rather than dropped.

**The fifth was closed, reopened once, and closed the other way.** The rule that this section
only shrinks holds for questions the brief has answered; this one the brief has now answered
twice, and a criterion the human amended is the one thing entitled to reopen a closed question
here. It is not evidence the rule is soft — nothing else has reopened, and the reopening was
the brief's, not this document's. The two questions the earlier revision closed — how a closure
shrinks, and whether a question edge gets a retired half — are decisions now and do not
reappear.
