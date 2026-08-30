# Contract

> **Two paths are under contract here.** The **defect-to-merge path** (`/fix`,
> `Wait-PullRequestCheck.ps1`, and the authorization batch S2 built and 2026-08-19 retired)
> landed as S1–S3; its design body is
> retired to `git show dfd1cab:design/10-design.md` and its contract stands below, unchanged.
> The **explicit design-state mechanism** is designed in the current `design/10-design.md` and
> is contracted below for the first time. Nothing in the first path is superseded by the
> second.

Three languages are under contract, and they are not carried the same way.

`tools/` is PowerShell Core, and its shape — parameter lists, result fields, the state and
failure vocabularies — **is declared in the scripts themselves and is not restated here**
(`AGENTS.md`, *Single ownership*). This document names where each declaration lives and
then states what a declaration cannot: when a field is meaningful, what may never be
normalised, which parameter must not acquire a default and what that would defeat.

`.claude/commands/` is Markdown loaded into a model. It has no separate declaration to
point at, so its surface is stated here in full — invocation, what it reads and writes,
what it must output, what it must not do — which is what gives `/reconcile` something to
compare a command file against.

**The state set is constrained Markdown with a line grammar, declared in
`tools/Read-DesignState.ps1`** (`AGENTS.md`, *Single ownership*), not restated here. What
survives that pointer is everything in this document a grammar cannot state.

## Types

### The defect-to-merge path

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

`AuthorizationBatch` is **retired.** There is no batch: `/resolve` resolves a `Defect`-class
thread its pushed fix satisfies without asking first, under `AGENTS.md`, *Git and delivery*.
I3 and I4 are retired with it and are absent from § *Invariants* below; their ids stay
resolvable, which is what retirement is for (`design/90-decisions.md`, 2026-08-19).

### The state set

**The six entity kinds and their fields are declared in `design/10-design.md` § Data model
and are not copied here**, and the reader's `$script:FieldTables` is that table as a closed
per-kind vocabulary, citing it. What neither can state:

- **Every list-valued field is present on every record, empty where it has no members.** An
  omitted line and an empty line are different facts and must never be read as the same one —
  omission is how "nobody filled this in" becomes indistinguishable from "there are none",
  which is the shape I12 exists to reject one level down.
- **`Consumers`, `BoundBy`, `Decision.Affects` and `Question.Affects` must never appear in a
  file.** All four are derived. A file carrying any of them is a parse finding, not a value to be
  believed (I17). The grammar has no production for them, which is what makes the check free
  rather than a rule someone remembers. **`Contract.Owner` is the one reverse edge that is
  written**, and `OwnerMismatch` is what makes it a binding rather than a second copy.
- **`Status` is retirement, and a retired record is still resolvable.** Keeping the id
  resolvable is the entire reason retirement exists rather than deletion (I16). What retirement
  changes is two things and only
  two: the record leaves every closure, and its `Anchor` stops being checked against the tree
  (I30), and a retired *invariant* additionally leaves § *Invariants* below, because that table is
  the invariant unit set rather than a history — a retired row would keep the id in
  `UnrecordedArtifact`'s difference and make the table grow monotonically. A retired unit's
  artifact is gone by definition, so an `Anchor` check against it would block on every run
  forever. **What retirement no longer changes is whether an active record may name it: it may
  not.** `design/10-design.md` § *Every reference sits in the half its referent's state requires*
  makes an active edge naming a retired referent a `HalfStatusMismatch` finding, and the
  reference relocates to the retired half rather than staying put and being skipped. The earlier
  reading — that such a reference was legal and merely filtered at measurement time — was the
  exclusion clause the meter has since dropped, and it is stated here as superseded rather than
  removed silently, because a reader who remembers the old rule needs to be told which way it
  went.
- **A unit is one record in two files, and the retired companion is not a second record.** It
  carries no `Id` line and has no id of its own; it is never enumerated as a record, is in no
  closure, and holds one half per active edge and nothing else. What follows and the grammar
  cannot say: **both files are parsed under the one `Unit` vocabulary, and which file a field
  may appear in is a pairing rule rather than a second field table.** A retired half in the
  active file and an active field in the companion are the same defect seen from either side,
  and a companion whose active record is absent is half a unit rather than an orphan to adopt.
  All three are `RecordPairMalformed`. Giving the companion its own closed vocabulary would have
  made a misfiled field an unparseable line — could-not-evaluate, under I24 — when it is a
  divergence the reader understood perfectly and should report as one.
- **Unqualified, *companion* in this document means a target's `*-local.md` command companion**
  (§ *Marked regions*, `.claude/COMPANIONS.md`). The retired half is always the **retired
  companion**, never the bare word. Two mechanisms arrived at the same English noun
  independently; naming the collision is cheaper than renaming either, and cheaper still than
  the first reader who resolves it the wrong way.
- **`StatedIn` is a decision's address list, and the reach rule is what makes it honest.** Each
  site is `<id> § <heading>`, must resolve to exactly one heading (`SiteAmbiguous`), and must
  name somewhere that unit's reader already reaches — the unit's own `Anchor`, or a record
  already one hop from it (`SiteOutOfReach`). Absent the reach rule a claim could move somewhere
  the closure does not count, which shrinks the measured number without shrinking what is read,
  and a metric improvable without improving its subject has stopped being one. **A decision is
  never both `Live` on a unit and stated in it** (`SiteContradictsLive`): the two say opposite
  things about where that unit's reader finds the terms, and a record asserting both is a
  finding rather than a merge to resolve by preferring one. **A script unit cannot be absorbed
  into directly** and no rule says so — a `.ps1` has no headings for the pointer to resolve
  against, so the site names that script's contract `§ Semantics`, one hop away. The restriction
  falls out of the check instead of being a second rule to remember.
- **`Decision.Affects` may never be empty; `Question.Affects` may.** An accepted decision must be
  named by some unit's `Live` or place at least one site, and a superseded one must be named by
  some `Archival`, or it is `DecisionUnplaced` — an interrupted write, indistinguishable from a
  deliberate zero-unit decision once one exists, which is why it is forbidden now while nothing
  has established the second meaning. The asymmetry is deliberate and is not an oversight to be
  tidied: an open question blocking nothing yet is a real state — it is what § *Unresolved* below
  holds — and requiring a unit would force the noticing session to invent an affected one in
  order to record the question at all.
- **`SupersededBy` chains terminate, and they terminate in an `accepted` decision.** A chain
  that revisits a decision leaves a history with no standing claim anywhere in it while every id
  in it resolves, so no other class sees it (`SupersessionCycle`). The walk carries a visited
  set, and it is cheap to add now precisely because no cycle has been written: a persisted one
  needs a human to reconstruct which claim was meant to stand, because the record no longer says.
- **A unit of kind `invariant` is one record, not two.** The `Invariant` fields specialise the
  `Unit` fields on the same record; `Anchor` is the invariant number itself, per the `Unit`
  table's own allowance, and is the one anchor whose resolution check is well-formedness and
  uniqueness rather than `Test-Path`. The load-bearing pointers on such a record are `Owner`
  and `Evidence`.
- **`Owns`, `Semantics`, `Statement`, `Claim` and `Text` carry no per-field *length* limit.**
  The closure ceiling is the only budget, and it is enforced at the closure, not the field. A
  per-field cap invented here would be a number nothing derived and everything had to obey. The
  *form* constraints the design's own table states — `Owns` is one sentence, `Claim` is a claim
  rather than a summary — stand unchanged and are enforced by nobody. No class reads them, and
  inventing one would be a model judging prose, which is `SemanticDisagreement`'s permanently
  reported territory. **One exclusion is named rather than left to that form rule: a decision's
  `Claim` never carries the rejected alternatives.** They stay in the log, which is what it
  exists for (`AGENTS.md`, *Decision logging*), and they are read when relitigating a choice
  rather than when orienting. This is the one content rule the length rule above does not
  already imply — a terse list of rejections is not a summary and would pass "a claim rather
  than a summary" — and it is the rule I23's ceiling rests on, because extracting the largest
  and least-consulted half of the corpus puts it back inside the per-unit budget the closure is
  measured against. Nothing checks it either.
- **`Evidence` is optional on a unit and required on an invariant whose `Enforcement` is
  `code`.** Absence in the second case is a finding, because an invariant claimed to be
  mechanically enforced with nothing pointing at the mechanism is a claim about the tree that
  the tree does not make. **Presence and resolution are two different checks**: absence is
  `EnforcementUnevidenced`, and every entry that is present must name a path that exists, which
  is `AnchorMissing`'s. A pointer to nothing satisfies the first and defeats what it is for.
- **A scalar field is omitted when it has no value, which is the opposite of the list rule
  above.** The asymmetry is the grammar's and is not restated here; what follows from it is that
  a *conditional* scalar's absence carries no signal at all. `SupersededBy` is required when a
  decision's `Status` is `superseded`, and `AnsweredBy` when a question's is `answered` — both
  conditional exactly as an invariant's `Evidence` is, and all three are
  `EnforcementUnevidenced`'s. `UnresolvedId` reaches such a field only once it is present, so
  without that class a superseded record naming nothing would parse, validate, and pass — the
  state set saying a claim was replaced and unable to say what replaced it, which is the dangling
  edge permanent ids and retirement exist to prevent. `design/30-slices.md` S11.2 asserted it
  once at migration; the class is what holds it after.
- **`MirroredAt` is the mirror's honesty and is never omitted.** A `WorkRef` with no
  `MirroredAt` asserts currency it cannot have.
- **`Rank` is never absent either.** Its source degrades rather than failing, and that rule binds
  the writer, so it is stated under `Update-WorkMirror.ps1` below. A `WorkRef` with no `Rank`
  asserts the outstanding work has no order, which is the brief's offline criterion silently
  unmet rather than reported.

### Ids

**Kind-prefixed slugs**, assigned once, never reused, never renumbered (I16).

| Kind | Form | Example |
|---|---|---|
| Unit | `unit/<kind>/<slug>` | `unit/command/track`, `unit/script/test-designdrift`, `unit/document/design-00-brief`, `unit/document/template-00-brief` |
| Invariant | `I<n>` | `I3` |
| Contract | `contract/<slug>` | `contract/wait-pullrequestcheck` |
| Decision | `decision/<YYYY-MM-DD>-<slug>` | `decision/2026-08-08-pr-absorbs-gates-drafts-abolished` |
| Question | `question/<slug>` | `question/slices-authority-home` |
| WorkRef | `work/<issue>` | `work/42` |

What the table cannot state:

- **The invariant form is the one exception and it is deliberate.** Invariants are cited by
  bare number throughout `design/90-decisions.md`, and in `AGENTS.md` wherever the prose needs
  to point at one. Prefixing them would be the corpus-wide rename that permanent ids exist to
  prevent, which is the same argument that makes every other id permanent. **A citation is not
  membership**: the invariant unit set is § *Invariants* below, not the ids some document
  happens to quote — see *Artifacts of a unit kind*.
- **A slug is a name, not a location.** `unit/command/track` keeps its id after `/track` is
  renamed; the `Anchor` moves and the id does not. An id that reads as historical after a
  rename is a permanent id working correctly, not drift.
- **The id determines the record's own file path, and only its own.** The mapping is stated
  under *Persisted schemas*, and it is not an unchecked restatement: `IdCollision` fires when a
  record's own id disagrees with the id its path implies, and a file outside the six named
  directories has no kind to be parsed under and is a parse failure rather than a guess.

### What the reader emits

`New-DesignRecord`, `New-DesignStateGraph` and `New-DesignStateFailure` are declared in
`tools/Read-DesignState.ps1`, not restated here (`AGENTS.md`, *Single ownership*). What those
signatures cannot state:

- **`New-DesignStateFailure` carries `Text` verbatim.** The offending line is reproduced, not
  described. A summarised parse failure is one nobody can locate (I24).
- **`Root` may be the empty string**, and that is the absent-state-set case rather than an
  error. It reaches the caller as a graph with zero records, which the checker turns into
  could-not-evaluate (I19).

### What the checker emits

`New-DesignFinding`, `New-CouldNotEvaluate` and `New-DesignStateResult` are declared in
`tools/Test-DesignState.ps1`, not restated here (`AGENTS.md`, *Single ownership*) — one factory per
list, and the result object that carries all three. What those signatures cannot state:

- **`Failures` is never folded into `Findings` and the two never substitute for each other.**
  This is I12's rule at a second site, and it is the whole difference between "the design
  disagrees with the tree" and "the design was not read".
- **`Blocking` is set from the class list in this document, never decided per finding.** A
  finding does not get to argue about its own severity; if the two disagree, that is the
  `ClassListDisagreement` finding, not a judgement call at the call site.

## Persisted schemas

### The defect-to-merge path

**None.** No file, no cache, no state directory. This is a deliberate constraint, not an
absence: a persisted classification or approval is one that can be reused after the fact
it rested on has changed.

Migration story: not applicable, and any future proposal to persist any of this needs its
own decision-log entry naming what stops a stale record being trusted.

### The state set

`design/state/`, one file per record, UTF-8, LF.

| Id | File |
|---|---|
| `unit/<kind>/<slug>` | `design/state/units/<kind>/<slug>.md`, and its retired companion at `design/state/units/<kind>/retired/<slug>.md` |
| `I<n>` | `design/state/invariants/I<n>.md` |
| `contract/<slug>` | `design/state/contracts/<slug>.md` |
| `decision/<date>-<slug>` | `design/state/decisions/<date>-<slug>.md` |
| `question/<slug>` | `design/state/questions/<slug>.md` |
| `work/<issue>` | `design/state/work/<issue>.md` |

Keys, and what the mapping cannot state:

- **The file path is the primary key and the `Id` line inside it must agree.** Disagreement is
  an `IdCollision` finding. Two records claiming one id is the failure this key exists to make
  impossible, and a filesystem gives it for nothing.
- **The retired companion is the one file the key rule does not reach, and it is a subdirectory
  rather than a suffix for exactly that reason.** It carries no `Id` line to agree with anything;
  its identity is entirely positional — the unit whose slug it shares, one directory up. A
  sibling `<slug>.retired.md` would have put a non-record inside the glob every consumer already
  walks, so each would have had to remember to exclude it and a forgotten exclusion would have
  produced a plausible-looking phantom id. `retired/` is one segment the path-to-kind mapping
  can name, which makes the companion's non-membership a fact about where it lives rather than a
  filter every reader reapplies (`design/90-decisions.md`, 2026-08-30). **The pair is what a
  unit is**, so a `retired/` file with no record beside its parent directory, and a field in the
  file its half does not belong to, are both `RecordPairMalformed` rather than a stray file to
  ignore.
- **A `retired/` directory is a location, never a kind.** The four unit kinds are the design's
  and this segment adds no fifth; a path naming a kind that is not one of the four is a parse
  failure, unchanged, and `retired` never resolves as one.
- **`design/state/` sits inside `design/` for one reason: the kit's own `design/` is never
  installed into a target.** `INSTALL.md`, phase 1, holds the artifact list and is not copied
  here; the load-bearing fact is that **nothing under the kit's `design/` is on it**, while
  `templates/design/*.md` is. A target's
  `design/` therefore *does* exist — seeded from `templates/design/*.md` — and what is absent
  there is this repository's state set, because nothing under the kit's `design/` is on that
  list. That is what makes the checker's shipping to eighteen repositories with no state set a
  designed case rather than an accident, and it is why the location is a contract term rather
  than a filing preference.
- **There is no index file, no manifest, and no `.json` beside it.** Enumeration is a directory
  walk. Anything caching the enumeration is the index the brief's *no round-trip* non-goal
  excludes, and it is also a second copy that can be current-looking and wrong.
- **There is no lock, no lease, and no coordination file either, and that is the same kind of
  deliberate absence.** Nothing here is concurrent, and **git is the whole of the arbitration**:
  two sessions writing state on divergent branches produce a merge conflict, which is the
  intended and sufficient behaviour, and per-record files are what keep that conflict localised
  to the units both sessions touched. A lock would be a second answer to a question the branch
  already answers, and one that can be held after the session holding it is gone.

**Grammar.** Declared in `tools/Read-DesignState.ps1`, not restated here (`AGENTS.md`, *Single
ownership*). What the declaration cannot say: the grammar has no permissive fallback for a line
matching neither production, and adding one would reintroduce the silently dropped id the I12
precedent exists for.

**Migration story.** Nothing preceded the state set, so there is no prior data to migrate from.
The one-time population is `design/10-design.md` § *Migrate*, and its constraint is I26: **every**
entry in `design/90-decisions.md` is read and **not touched** — every entry as the log then
stands, not a count fixed here, because the log is append-only and any number written down is
wrong by the next commit. Records are written for artifacts that already exist;
no artifact is created to give a record something to point at. This runs on this repository and
never in a target.

That population **advances by slice.** A kind with no records is zero records of that kind and
nothing more — `StateSetAbsent` is taken over `design/state/` as a whole, not per kind, so an
absent subdirectory is neither a finding nor a could-not-evaluate. **Which kinds are populated
is the directory listing's to state and is not written here**, on the same ground the migration
paragraph above refuses a log-entry count: a per-kind roster fixed in this document is wrong by
the next slice, and it is a restatement of the tree that no class checks.

### Marked regions

**Two kinds, and the marker says which.** A **projected** region is rendered from records and
is overwritten on every regeneration. A **declared** region is hand-authored, is fenced so that
something else can check it is present and well-formed, and is **never written by the
projector**. The distinction is carried in the marker rather than in a registry the projector
holds, because a registry makes a mistyped id silently unchecked — the dropped-line failure I24
exists to forbid, one level up.

| Kind | Form | Identity |
|---|---|---|
| Projected | `<!-- <id>:start -->` … `<!-- <id>:end -->` | (document, id), unique within the document |
| Declared | `<!-- <id>:declared:start -->` … `<!-- <id>:declared:end -->` | as above |

- **The bare form means projected, and that asymmetry is bought rather than aesthetic.**
  `<!-- agent:start -->` blocks live in issue bodies across eighteen repositories and cannot be
  migrated in bulk — an issue `/track` has not touched since is unreachable. Companion blocks
  live in kit-owned command files, which `INSTALL.md` phase 1 installs outright with no
  reconciliation, so they migrate by being shipped. The form that changes is therefore the one
  with a migration path. Reading the plain marker as "nobody regenerates this" is the better
  English and the worse contract.
- **`<!-- agent:start -->` is already conforming**, unchanged, as a projected region with `agent`
  as its id. That is not a coincidence to be preserved by care — it is why the marker carries the
  id and a fixed keyword and nothing else. Requiring a `source=` attribute would make every
  existing issue block non-conforming on the day the rule generalises.
- **`companion` is the only declared region today**, and its migration to the declared form has
  landed: every core under `.claude/commands/` carries the declared marker, and
  `tools/Test-Companion.ps1` matches that form and no other — a core carrying the bare form is
  nonconforming there. `.claude/COMPANIONS.md` states the rule without naming the literal marker
  and needed no edit for the form itself. That the set was closed is why it could move in one
  commit, which is the property the issue blocks do not have and the reason the bare form means
  projected.
- **The marker does not name its source.** The id determines the source; the projector holds
  that mapping. Repeating the source in every marker is the second copy *Single ownership*
  forbids, at the one site where there are hundreds of copies.
- **A projected id and a declared id share one namespace.** The same id in both forms is an
  `IdCollision`, not two regions — otherwise a rename that dropped `:declared:` would read as a
  new region rather than as a region that changed kind.
- **Nested and unbalanced markers are findings, not parse failures to route around.** A
  projector that recovers from an unbalanced region writes into a span nobody delimited. This
  holds for both kinds; a declared region is checked for well-formedness exactly as a projected
  one is, and only writing distinguishes them.

## Public surface

**This section is the canonical copy for every `Contract` record.** `design/30-slices.md` S16.1
fixed the correspondence in both directions — a record exists for every surface named below and
for nothing else, each carrying `Owner`, `Declaration` and `Semantics` — so a record's
`Semantics` is a restatement of the prose here, and this is the copy that governs.
`tools/Update-WorkMirror.ps1` went without a record at S16 (`design/30-slices.md` S16.6), on the
ground that a `Declaration` pointing at an absent file is the shape `AnchorMissing` exists to
reject; S14 writes the file and `contract/update-workmirror` with it, so that ground no longer
applies.

**No class compares the two, and this is now the only such gap in this document** — § *Artifacts
of a unit kind* carried the other until `GlobDisagreement` closed it.
`OwnerMismatch` checks a record's `Owner` against the units and
`AnchorMissing` checks its `Declaration` against the tree, but nothing checks that the *set* of
records matches the set of surfaces here, and the exemption above means the difference is not
even a clean one to take. The `Semantics` half is further out of reach: prose against prose is a
model judging a claim, which is `SemanticDisagreement`'s permanently reported territory. S16.1
asserted the correspondence once at the slice; nothing holds it after, and closing the set half
is a class this list does not yet carry.

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

### `tools/Test-Companion.ps1`

**The parameter list is the script's own `param` block and is not copied here.** What it
cannot state:

- **The category vocabulary is read out of `.claude/COMPANIONS.md`'s own table, never
  duplicated here.** A second list in this script would be the copy that rots invisibly,
  since both would still parse.
- **A companion that is missing, empty, or frontmatter-only is *absent* — counted, never a
  finding.** Treating any of the three as an override of nothing is the bug
  `.claude/COMPANIONS.md`'s *Absence* rule exists to prevent.
- Exit codes: 0 `Valid`, 1 `Invalid`, 2 `NotEvaluated` — a target with no
  `.claude/commands/` or no `.claude/COMPANIONS.md` is could-not-evaluate, never a pass.
- **`-TargetRepo` defaults to the current directory.** `-Quiet` suppresses the printed
  report only; the result object and exit code are unchanged either way.

### `tools/Read-DesignState.ps1`

The record reader. **Its `param` block and its per-kind field vocabulary (`$script:FieldTables`)
are declared there and are not copied here** (`AGENTS.md`, *Single ownership*); `Get-DesignPathInfo`
implements the id-to-path mapping this document fixes under *Persisted schemas*. What those
declarations cannot state:

- **Emits the graph on the success stream and never throws for a malformed state set.** A
  parse failure is data (`Failures`), not an exception. A caller that gets an exception loses
  every record that did parse, which is the part a report is made of.
- **Never skips a line.** Every line of every file is either matched by a production or
  reported (I24). "Skipped as noise" is not an outcome this script has.
- **Reads. Writes nothing, ever** (I18).
- **An absent `design/state/` is a graph with `Root` empty and zero records, not an error.**
  Deciding what absence means is the checker's, not the reader's; a reader that decided would
  make every caller inherit that decision.
- **A unit's two files reach the caller as one record.** The reader pairs them and emits a
  single record per unit; nothing downstream sees a companion, and no consumer reassembles the
  pair for itself. A reader that emitted two would make every consumer — validator, projector,
  meter — invent the same join, and one of them would eventually get it wrong in a direction
  nothing checks. **Which file each field arrived in is retained**, because
  `RecordPairMalformed` is a finding about placement and a join that forgot placement could not
  raise it.
- **An absent companion is a unit with every retired half empty, not a missing file.** Most
  units have retired nothing, so requiring the file would make the common case carry an empty
  one and put its bytes in the state set for nothing. The reverse — a companion with no active
  record — is the finding, because that direction is a unit that has lost its live half.
- **It is invoked as a script, not imported as a module.** `INSTALL.md` and
  `tools/Sync-Kit.ps1` both treat `tools/*.ps1` as the kit-owned glob, so a `.psm1` would not
  ship and the checker would arrive broken in eighteen repositories. `Sync-Kit.ps1`'s call into
  `Test-Companion.ps1` is the established shape and this follows it, including the throw-if-missing
  guard that names why both ship together.

### `tools/Test-DesignState.ps1`

The divergence checker. Validator, projection checker, budget meter, freeze gate, and the
three-list report.

- **Emits three lists — findings, reports, and what could not be evaluated — and always all
  three**, including when one is empty. An omitted empty list reads as an absent category
  rather than an empty one, which is the substitution `/verify` exists to prevent.
- Exit codes: 0 clean, 1 findings, 2 could not evaluate, and **2 takes precedence over 1**
  (I20). **A caller running it as a gate treats 1 and 2 alike as failure.** A gate that fails
  only on 1 turns *could not evaluate* into a pass at the call site, which is I19 and I20
  defeated by the consumer rather than by the script — and the brief's *fail CI* line is about
  what the build does, not about what the exit code was.
- **Measures a closure as the sum of whole files, and the unit's own artifact is one of them**
  (I23) — never as the bytes of the fields a reader actually consulted. A meter that counted
  only what it looked at would satisfy the ceiling while understating the load, which is the
  single property one-file-per-record was chosen over a grouped document to make impossible;
  **excluding the artifact is the same failure at a larger scale**, because a session beginning
  work on a unit opens that unit's file, and a number that omits the one file it is certain to
  open is true and unhelpful. The artifact is what makes absorption a strict saving rather than
  an accounting move: its bytes are counted whether or not a decision's terms have been written
  into it, so executing a decision into a site removes a record from the sum and adds nothing.
  **This is the one term in the sum no field bounds**, and the consequence is not softened here
  — see the report rule below.
- **Filters nothing at measurement time.** The closure has no exclusion clause: retired halves
  are in the companion, which is not a closure member, and `HalfStatusMismatch` is what keeps a
  retired record out of an active edge in the first place. A rule enforced by a filter is one
  every consumer must reapply; a rule enforced by where the bytes live is one nobody can forget.
- **Always names the largest closure, the unit it belongs to, and its largest contributor, on a
  clean run as well as a failing one.** `ClosureOverBudget` fires only once the ceiling is
  passed; the brief requires the largest unit named in the report regardless. Headroom nobody is
  shown is a ceiling nobody can see being approached, and the first anyone would learn of it is
  the run that blocks. It is a report line, never a finding. **Under the artifact-inclusive
  definition the largest contributor is usually the artifact**, and saying so on every run is
  what keeps the gap between the ceiling and this repository from being rediscovered as a
  surprise — `design/10-design.md` § *Whether the ceiling can be met* is where that gap is
  confronted, and whether the project proceeds, re-scopes, or stops under the brief's
  *Abandonment* line is reserved to the user and is not this script's to soften.
- **Never clean on an absent or empty state set** (I19). Zero records is I8's shape: absence of
  a finding is not a finding of absence, and a target must never be told its design state
  agrees with anything.
- **Regenerates before comparing**, by invoking the projector with `-DryRun`. Comparing without
  regenerating reports every projection as stale, which trains the reader to ignore the report.
- **Normalises line endings before comparing and normalises nothing else.** `agent.md` records
  `prettier --check` failing every file on a Windows working tree for exactly this reason, and
  Windows is the house platform. Any other normalisation would hide a real difference.
- **Parses this document's glob table only to compare, never to enumerate.** The three
  `Get-*GlobFiles` functions stay the authority for which artifacts `UnrecordedArtifact` checks;
  `GlobDisagreement` expands the parsed patterns separately and compares the two file sets. That
  ordering is the whole safety argument — a mis-parse can report a disagreement or report
  `ContractListUnreadable`, and can never narrow the world being checked.
- **Writes nothing** (I18) — not `design/`, not a record, not an issue, not git. Which side of
  a divergence is wrong is the user's call, and a checker that resolved one would be making it.
- **`-Path` is optional and defaults to the current directory**, the same default `Test-Companion.ps1`'s
  `-TargetRepo` carries. It has no `-Fix`, no `-Force`,
  and no flag that resolves anything; adding one is the change this contract exists to refuse.

### `tools/Update-DesignProjection.ps1`

The projector.

- **`-DryRun` renders to the success stream and writes nothing.** This is the checker's entry
  point, and it is the same `-DryRun` vocabulary `Sync-Kit.ps1` already established.
- **Writes only between the markers of a projected region.** Never a byte outside a region,
  never a new region, never a file that has no region in it, and **never inside a declared
  region** (I18, I29). A projector that could create a region could create one around
  hand-written prose; a projector that could write a declared one would overwrite a target's own
  companion declaration on the next sync.
- **Idempotent and order-independent** (I25). Regenerating twice produces identical bytes, and
  regenerating region A never changes what region B renders to. Without both, "regenerate then
  compare" answers differently on different runs and stops being a check.
- **Never reads a rendered region** (I14). Input is records; output is regions; there is no
  path back. This is the acyclicity the whole design rests on and it is the property most
  easily lost to a convenience.
- **Refuses an unbalanced or nested region rather than repairing it**, and reports which
  document and which marker.

**The minimum projection set**, each traceable to a stated done criterion — the registry lives
in the projector and may grow, but may not shrink below this:

| Projection | Renders | Required by |
|---|---|---|
| `agent` | An issue's agent block | `AGENTS.md`, *Tracking work* — the existing instance |
| `units` | The unit index: id, kind, anchor | *Offline and unaided* — the id scheme is readable, the corpus still needs a table of contents |
| `bound-by` | Per invariant, the units that bind it | *Explicit current state* — a derived edge with no other legal home |
| `consumers` | Per contract, the units that consume it | as above |
| `decision-affects` | Per decision, the units it is in force for | as above |
| `question-affects` | Per question, the units it blocks | as above |
| `outstanding` | The outstanding work list, its order, and each item's criteria, from the `WorkRef` mirrors | *Work state* — "from a checkout with no network" |
| `invariants` | This document's § Invariants, from the invariant records | *Single ownership* — otherwise the statements live here and in the records both |

**`units`, `bound-by`, `consumers`, `decision-affects`, `question-affects` and `outstanding`
render into `design/state-index.md`** — the first five at S7, on the test that no other document
owned any of them and this one exists to hold them. **`outstanding` joins them on the same
test.** `design/30-slices.md` § *Outstanding* owns hand-authored **proposals**, and authority
transfer makes a proposal a different thing from criteria (§ *Cross-cutting obligations on
commands*), so no document owned the mirrors either. Placing it here also keeps generated content
out of the one document `/reconcile` is barred from, leaves that document's retirement convention
untouched, and makes the proposal/criteria boundary a document boundary — the same boundary the
transfer draws.

`invariants` renders into this document's own § *Invariants*, below. `agent` has no document
region: GitHub is where an issue's agent block lives, and no module of this mechanism writes
there (S7.10).

### `tools/Update-WorkMirror.ps1`

**The parameter list is the script's own `param` block and is not copied here.** The mirror
generator. What that block cannot state:

- **`/track`'s alone.** No other command invokes it, and no other command writes a `WorkRef`.
  Two writers of a mirror is two answers to "when was this current".
- **Writes `WorkRef` records and nothing else.** Never an issue, never a label, never a
  milestone — those are `/track`'s own carved-out writes and stay in the command.
- **Writes a `WorkRef` only when a mirrored field changed, and stamps `MirroredAt` on every write
  it does make.** The mirrored fields are `Title`, `State`, `Criteria` and `Rank`; **`MirroredAt`
  is not one of them and never triggers a write by itself.** A run that finds the tracker unmoved
  leaves every record byte-identical and reports that it changed nothing. That is what stops a
  `/track` run manufacturing a diff — and with it a branch, a pull request, and a `/clean` pass —
  out of the commit sha alone, on a repository where no work may land on the default branch
  (`AGENTS.md`, *Git and delivery*). The unconditional-write rule this replaces made the mirror's
  content a function of repository history rather than of tracker state, so every `/track` run
  produced a commit whose entire content was a stamp and whose merge guaranteed the next run
  would do it again.
- **`MirroredAt` therefore dates the mirror's *content*, not the tracker's last consultation.**
  It is the commit at which a mirrored field was last established, and a checkout can no longer
  say when `/track` last looked. That is this clause's price and it is paid deliberately:
  `MirrorStale` has never blocked, and GitHub is authoritative for anyone who can reach it
  (I28). **`MirrorStale`'s own comparison is unchanged** — it still fires for every record the
  current commit did not write, so a mirror is still stale by default and still says so.
- **`Rank` degrades rather than failing: a project field where a project exists, otherwise
  milestone, otherwise issue number.** `/track` "adds issues to an existing project, and never
  creates one" (`design/90-decisions.md`, 2026-08-03), so a repository with no project is the
  ordinary case rather than the broken one. Every step of the degradation is silent by design and
  **falling through to issue number is not a finding** — but an emitted `WorkRef` never lacks a
  `Rank`, because an order that quietly disappeared would fail the brief's offline criterion
  without anything saying so.
- **`gh` absent or unauthenticated is could-not-evaluate, not an empty mirror.** An empty
  mirror written on an unreachable tracker asserts there is no outstanding work.
- **Never runs while `design/FROZEN.md` exists**, because `/track` does not (`AGENTS.md`,
  *The design freeze*). The mirror going stale during a freeze is the freeze working.

### `.claude/commands/fix.md`

| | |
|---|---|
| Invocation | `/fix <issue number>`, `/fix <description>`, `/fix` with a failing test in context, or `/fix` with none of those — which picks the highest-value open bug itself, by an explicit priority signal where one exists and the oldest open `bug` issue where none does |
| Reads | the defect source; **the bug issue's agent block**; where `design/state/` exists, that unit's closure rather than the corpus (I27); `AGENTS.md` |
| Writes | one branch, one or more commits, one pull request, and — only on the description path, only after reproducing — **one bug issue** |
| Must output | the reproduction evidence; the issue number it is implementing against; the branch and the pull request it opened, the latter carrying its real description from the moment it is opened. **The gates and the review threads are `/pr`'s** (`design/90-decisions.md`, 2026-08-08), so `/verify`'s three lists, the pushed SHA and the `WaitResult` are output there and not here |
| Must not | edit `design/`, open a draft pull request, resolve a thread, merge, open an issue for a defect it did not reproduce, or widen the change to an adjacent defect noticed along the way |

**The fourth form is the one path that reaches the tracker before it has a defect.** The other
three are handed their subject; this one ranks the open issues to choose it, so an unreachable
`gh` stops it where the others are unaffected until they file or push. It is not exempt from
reproducing first, and **it does not fall through**: an issue it picked and could not reproduce
is reported as picked-and-unreproducible, never silently replaced by the next-ranked one, which
would make the command's choice of subject unobservable.

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

`/fix` **never writes a record** (I6, unchanged and now wider in consequence): `design/state/`
is inside `design/`.

### `.claude/commands/resolve.md` — amended, not replaced

The existing contract stands. Three changes:

| | |
|---|---|
| Ordering | Classification completes over the full thread table **before** any thread is acted on |
| Delegation | "Confirm the checks are green on the new head SHA" is discharged by `Wait-PullRequestCheck.ps1`, not by reading `gh pr checks` by eye |
| Authorization | Cites `AGENTS.md`, *Git and delivery* — a `Defect`-class thread the pushed fix satisfies is resolved without asking first; `Ambiguous` threads are still brought individually, and in a repository the account does not own every action reverts to an individual ask (I9) |

Everything else — the GraphQL query, the five classes, the fixed order, the report shape,
the `Never` list — is unchanged and stays owned by that file.

### Cross-cutting obligations on commands

Stated once here rather than enumerated per command, because the obligation is the same one and
`/slices` decides which files carry it.

- **Degrade to today's behaviour when the state set is absent** (I27). This, not a version
  check, is what makes the brief's zero-hard-stops promise mechanical. A command that requires
  `design/state/` has broken eighteen repositories.
- **A decision writes a record.** `design/10-design.md` § *Record* is the sequence: append the
  log entry unchanged, write the decision record, update the affected units, regenerate, check.
  Steps 4 and 5 in that order, never the reverse.
- **An `## Open` item and a question record are different things, and becoming an issue does
  not discharge a question.** `AGENTS.md`, *Tracking work*, owns `## Open` as a staging area
  bound for the tracker; a *question* is the other thing that section currently absorbs —
  something undecided that blocks reasoning about a unit (`design/10-design.md` § *Question*).
  Separating them is what makes "unresolved questions affecting this unit" answerable at all,
  and a question filed as a to-do is answerable only by whoever remembers the issue. **What
  is settled is the distinction; who writes the record is not** — that is the second item in
  § *Unresolved* and a slice reaching it stops.

- **Never cite a `WorkRef` as authority** (I28). A mirror is quoted as a mirror, with its
  `MirroredAt`, or the tracker is read.
- **A slice has no acceptance criteria until it has an issue**, and authority transfers at the
  moment the issue is created (`design/10-design.md` § *WorkRef*). Before that point
  `design/30-slices.md` carries a *proposal* and is cited as one; after it, the issue is the
  authority and the document is a mirror of it (I28). Nothing enforces the sequencing but
  `/slices` running before `/track`. **This is settled and is not the § *Unresolved* item** —
  what stays undetermined there is where criteria are rendered once the transfer has happened,
  not when it happens.
- **Never read a generated region as an input** (I14).
- **Orienting on a unit reads its closure, and `design/90-decisions.md` is not opened**
  (`design/10-design.md` § *Orient*, step 3). The log is opened when relitigating a choice —
  which is what its rejected alternatives are for (`AGENTS.md`, *Decision logging*) — never to
  establish what is currently true. Nothing enforces this and nothing can: no artifact records
  what a session read. It is stated because the brief's first done criterion is otherwise
  defeated by habit rather than by any decision anyone made.

### Documents that carry surface

| Document | Owns | What it may not do |
|---|---|---|
| `AGENTS.md` | The marked-region rule — both kinds — generalised from the agent-fence rule it states today; the freeze rule; the review-thread delegation; I9 | State the rule twice, or leave the agent-fence wording behind as a second copy. **Exactly one document states it**, and `.claude/COMPANIONS.md` names `companion` as declared without restating what declared means |
| `design/20-contract.md` | The closed divergence-class list and each class's blocking status (below) | Decide blocking-ness per finding at the call site, or carry a class the checker does not declare |
| `.claude/COMPANIONS.md` | The companion mechanism, and that `companion` is a **declared** region | Acquire a projection, or restate the marker form this document fixes |
| `.claude/commands/resolve.md` | `ThreadClass` and its five values | — |
| `.github/ISSUE_TEMPLATE/bug.md` | `/fix`'s stop conditions | — |

**Artifacts of a unit kind**, for the `UnrecordedArtifact` set difference. A glob with a named
exclusion list, not an enumeration: an enumeration cannot notice a new document, and a bare
glob sweeps up files that are not units.

**The `document` kind reaches shipped payload, not only this repository's standing corpus.**
`.github/ISSUE_TEMPLATE/bug.md` owns `/fix`'s stop conditions in the table above and I10 binds
`/fix` to its agent block, so a glob that did not reach it would leave a named owner with no
record, no id, and no closure — and `UnrecordedArtifact` would never say so, because the
difference is taken against the glob. That is the dangling edge this system exists to make
impossible, and the same argument that made `AGENTS.md` a unit. `codex/PROFILES.md` is added on
the narrower ground that it is a standing document `INSTALL.md` installs; it owns no surface
today, and the glob is a rule a reader can check rather than one they have to know.

| Kind | Glob | Excluded |
|---|---|---|
| command | `.claude/commands/*.md` | `*-local.md` |
| script | `tools/*.ps1` | `*.Tests.ps1` |
| document | `design/*.md`, `templates/design/*.md`, `*.md`, `.claude/COMPANIONS.md`, `.github/ISSUE_TEMPLATE/*.md`, `codex/PROFILES.md` | `design/FROZEN.md`, `CLAUDE.md` |
| invariant | not a tree path | — |

**Both cells carry patterns and nothing else, because `GlobDisagreement` reads them.** A pattern
is repository-relative and wildcards only the final segment, so `*.md` is the repository root and
needs no phrase saying so; an exclusion is either a repository-relative path or a bare filename
pattern matched against the basename. Every reason a cell used to carry is below, where prose
cannot cost a check its input:

- **`*-local.md`** — a companion is the target's, and this repository ships none.
- **`*.Tests.ps1`** — a test is `Evidence`, not a unit.
- **`design/FROZEN.md`** — transient by design.
- **`CLAUDE.md`** — a loader that imports `AGENTS.md` and states nothing of its own.
- **The `invariant` row has no pattern in either cell**, which is what excludes it from the
  comparison. Its set is **every `I<n>` row in § *Invariants* below**, and nothing is excluded from
  it: a rule the kit binds itself to is a unit whether or not any document quotes it.

**The invariant kind has no glob because it has no artifact, and § *Invariants* is what stands
in for one.** Every row there is a rule the kit binds itself to, and a rule is a unit whether or
not any document happens to quote its number — a set taken against citations picks out the two
ids `AGENTS.md` currently needs to point at, which would make the kind nearly empty and leave
§ *Invariants* split into a generated head and a hand-kept tail permanently. The section is
therefore a **parsed source**, one of three this document carries — the class list below, this
one, and the glob table above — and `ContractListUnreadable` covers all three: a section that
cannot be read leaves the half that depends on it uncomputed rather than empty, because an empty
difference read off an unreadable table is the I8 shape one level up. **A parsed source is the
one place prose costs something**, which is why the glob table's reasons sit under it rather than
in its cells.

**What that costs is stated rather than left to be found.** § *Invariants* has no hand-authored
tail — it is a single projected region, and both sides of the difference render from the same
records — so the invariant half of `UnrecordedArtifact` is a self-consistency check that
`ProjectionStale` already covers rather than an independent one. That is not an I14 violation —
comparing a region is what the checker does, and no record derives a field from one — but the
independent teeth this half once had end there, and nothing replaces them. Adding an invariant
is adding a record; the row follows.

**This table is the canonical copy and `tools/Test-DesignState.ps1` implements it** —
`Get-DocumentGlobFiles`, `Get-CommandGlobFiles`, `Get-ScriptGlobFiles`, and
`Get-ContractInvariantIds` for the invariant kind — citing this section by name. That is the
exception *Single ownership* allows for a repeated fact: the canonical copy is named, and named
from both ends.

**`GlobDisagreement` is what makes this table's canonical claim true rather than asserted.** A
glob widened in the script and not here, or here and not in the script, would otherwise diverge
silently while `UnrecordedArtifact` went on agreeing with whichever side the run read — a clean
run over a smaller world, which is the I8 shape one level up and the reason this restatement
could not stay merely written down. **The comparison is of resolved file sets, never of pattern
text**: the parsed patterns are expanded against the checkout and compared with what the three
`Get-*GlobFiles` functions return, so an exclusion applied at the wrong level or a directory
quietly skipped is caught even where the tokens match.

**The parsed patterns only ever compare. They never feed `UnrecordedArtifact`.** The script stays
the enumerator and this document stays the policy — the same division § *The divergence classes*
draws for the class list, and the reason a mis-parse cannot narrow the checked world. Its worst
outcome is a spurious disagreement or an honest `ContractListUnreadable`, and never a clean run.

**That leaves one restatement in this document that no class compares** — § *Public surface*
against the `Contract` records. The divergence-class list has `ClassListDisagreement`; the
id-to-path mapping has `IdCollision`; the projections have `ProjectionStale`.

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

### The divergence classes

**This is the closed list.** `Test-DesignState.ps1` declares the same ids and one blocking class
compares the two; the script is the detection and this document is the policy. A class not on
this list does not exist, and adding one is a contract amendment.

**Blocking.** Every one is evaluable from the checkout alone — no network, no tracker, no
running service (I22). That rule is what decides membership; it is not a coincidence of the
list.

| Class | Raised when | Caller sees |
|---|---|---|
| `UnresolvedId` | A record names an id with no record | The referring record and the missing id |
| `AnchorMissing` | An **active** record carries a tree-pointer field naming a path not in the tree — a unit's `Anchor`, a contract's `Declaration`, or any entry of an `Evidence` list | The record, the field, and the path. **Which of the two sides is wrong is the user's call** |
| `OwnerMismatch` | A contract's `Owner` is not the unique active unit whose `Exposes` names that contract — nobody exposes it, or two units do | The contract, its `Owner`, and every unit exposing it |
| `UnrecordedArtifact` | A tree artifact of a unit kind has no record | The unrecorded artifact |
| `ProjectionStale` | A region differs from its regeneration, after line-ending normalisation | A diff of the region |
| `RegionMalformed` | A marked region of either kind is unbalanced or nested | The document and the marker |
| `IdCollision` | An id is duplicated, renumbered, disagrees with its file path, or appears in both the projected and the declared marker form | Every file claiming it |
| `DecisionAnchorAmbiguous` | A decision anchor resolves to zero or two log headings | The anchor and the count |
| `LogEntryUnrecorded` | A log heading has no decision record | The entry's heading |
| `EnforcementUnevidenced` | A conditionally-required field is absent on a record whose own `Status` or `Enforcement` requires it — an invariant with `Enforcement: code` and no `Evidence`, a decision with `Status: superseded` and no `SupersededBy`, or a question with `Status: answered` and no `AnsweredBy` | The record, the absent field, and the value that required it |
| `ClosureOverBudget` | A closure exceeds 16,384 bytes | The unit, its size, and its largest contributor |
| `RecordPairMalformed` | A unit's retired companion exists with no active record, or a field sits in the file its half does not belong to — a retired half in the active record, or an active field in the companion | Both files, the field, and which side it belongs on |
| `HalfStatusMismatch` | A reference sits in a half its referent's status does not allow, in **either** direction — an active edge naming a retired referent, or a retired half naming an active one | The record, the half, the referent, and the status that contradicts it |
| `HalfOverlap` | An id appears in both halves of one edge | The unit, the edge, and the id |
| `SiteAmbiguous` | A `StatedIn` site resolves to zero or two headings in the file it names | The decision, the site, and the count |
| `SiteOutOfReach` | A `StatedIn` site names a place the unit's reader does not already reach — neither the unit's own `Anchor` nor a record one hop from it | The decision, the site, and the unit |
| `SiteContradictsLive` | A decision is both named by a unit's `Live` and stated in that same unit | The unit and the decision |
| `DecisionUnplaced` | `Decision.Affects` derives empty — an accepted decision no `Live` names and no site places, or a superseded one no `Archival` names | The decision, its status, and that it is an interrupted write |
| `SupersessionCycle` | A `SupersededBy` chain revisits a decision, or a decision names itself | The cycle, in order |
| `ClassListDisagreement` | The checker's declared class ids differ from this document's list | Both sets, and the difference in each direction |
| `GlobDisagreement` | For a globbed unit kind, the file set § *Artifacts of a unit kind*'s patterns resolve to differs from the set the checker's enumeration returns | The kind, the direction, and the paths |

**`GlobDisagreement` compares file sets, not tokens, and only in that direction.** Comparing the
patterns as text would be a third id-level check in a document that already knows id-level checks
miss definition drift — the very complaint two paragraphs below. Resolving both sides against the
checkout instead means the table is checked for what it *means*, and it is what qualifies the
class as blocking under I22 on the rule's own terms: expansion needs the checkout and nothing
else. The `invariant` kind is outside the comparison because it has no pattern in either cell,
which is a fact about the table rather than an exemption the checker carries.

**What a set comparison cannot see, stated rather than left to be found: an exclusion that
excludes nothing in this checkout.** `*-local.md` is the standing example — the cell's own reason
is that this repository ships no companion — so removing it from the table changes no resolved
set here and the class stays silent. That is the comparison working as specified, not a hole in
it, and the exposure is bounded by the same fact that causes it: a divergence invisible here is
invisible because it has no artifact here to be wrong about. It becomes visible in the first
checkout that has one.

**The eight classes above `ClassListDisagreement` are new, and their granularity is derived
rather than chosen.** `design/10-design.md` § *Failure modes* lists each as its own row with its
own *User sees* column; one class per row is what makes a finding say which check fired. Two
places that grouping might have gone differently are worth naming, because both were argued and
neither is arbitrary:

- **`HalfStatusMismatch` is one class for the whole table, not one per half.** The design's
  half/status table is *total* — every half has a required status and every status has a half —
  and its totality is the property, not its rows. Eleven ids for one rule is the split this
  document has already refused twice, and it would make adding a half a contract amendment in
  two places rather than one.
- **`SiteAmbiguous` and `SiteOutOfReach` stay apart, though both are about a site.** They are
  two rules with two remedies: a heading that does not resolve is a pointer to fix, and a
  heading in a place the reader never opens is a claim that has moved somewhere the ceiling
  cannot see. Merging them would report the second as a typo. This is the same test
  `EnforcementUnevidenced` passes in the other direction — that class merges three fields
  because one rule governs all three, not because they look alike.

**All eight are blocking, and each qualifies on I22's own terms rather than by resemblance.**
File pairing, status agreement, half intersection and chain-walking need only the parsed graph.
Heading resolution and the reach check need the checkout, which the validator already reads —
`design/10-design.md` § *Module boundaries* names that widening rather than absorbing it. None
needs the network, the tracker, or a running service.

**`SiteContradictsLive` and `DecisionUnplaced` are the two that check a derived value, and that
is not a projection being read back** (I14). Both are computed from records in memory during the
same pass; nothing renders, and nothing reads a rendered region. The distinction matters because
`Decision.Affects` is a *derived edge*, and I14's prohibition is on generated **text** becoming
an input — a rule about files, not about arithmetic.

**`AnchorMissing` is named for a unit's `Anchor` and checks every tree pointer a record
carries.** `Contract.Declaration` and the `Evidence` list on a unit or an invariant record are
restatements of a tree path exactly as `Anchor` is, so leaving them unresolved is the unchecked
restatement I15 forbids — and it was already live, because unit records carry `Evidence` today.
One class covers all three because the check, the remedy, and the reason each is evaluable from
the checkout alone (I22) are the same in every case; a second class would have split one rule
across two ids and widened the closed list for nothing. **The name reading narrower than what
it checks is the price, and it is paid deliberately** — renaming it costs the closed list, the
checker's declared ids, and the tests that cite it by name.

Three exemptions, each of which would otherwise block forever:

- **A retired record is exempt entirely** (I30). Its artifact is gone by definition, which is
  why it was retired.
- **An invariant record's `Anchor` is the invariant number, not a path.** Its resolution check
  is well-formedness and uniqueness, and it is `IdCollision`'s, never `Test-Path`'s.
- **A contract's `Declaration` of the literal `prose` resolves to nothing on purpose.** A
  Markdown command surface has no declaration to point at, and that is the field's documented
  second value rather than an absent path.

**`EnforcementUnevidenced` is named for the invariant case and covers all three conditional
requirements**, on the reasoning that widened `AnchorMissing` rather than splitting it. A scalar
is omitted when it has no value, so a conditional scalar's absence is indistinguishable from a
field nobody filled in; the check, the remedy, and the reason each is evaluable from the checkout
alone (I22) are identical in all three cases, and a second class would have split one rule across
two ids for nothing. **The name reading narrower than what it checks is the price, paid
deliberately and for the second time in this list.**

**A widened class definition is invisible to `ClassListDisagreement`, and that gap outlives the
widening that exposed it.** That class compares class *ids*, and an id does not change when what
it detects does, so a contract widened ahead of its detection stays green until the slice lands —
as this one did at S18, which is why the three cases above read as one rule rather than as one
rule and two intentions. **`GlobDisagreement` is the counter-example that fixes the shape of the
remedy rather than an exception to it**: the glob table used to be named here as the same silent
divergence, and what closed it was resolving both sides against the checkout instead of comparing
their names. A definition has no checkout to resolve against, so that remedy does not carry, and
nothing on the closed list closes this one.

**Reported, never blocking.** Each fails in exactly the environment where the failure means
nothing, which is why none of them is on the list above.

| Class | Raised when | Why it never blocks |
|---|---|---|
| `MirrorStale` | A `WorkRef`'s `MirroredAt` is not the current commit | The mirror is stale by construction; that is its documented state, not a divergence |
| `WorkStateDivergence` | A `WorkRef` disagrees with the tracker | Needs `gh`. A build that fails on an unauthenticated CLI reports an absent comparison as a divergence |
| `PinAncestry` | A cited commit is not an ancestor of the default branch | A shallow CI checkout has no history to answer with, and "could not check" must not read as "checked and failed" |
| `SemanticDisagreement` | A model judges a record's claim untrue | Permanently reported. The brief's *no formal specification of behaviour* non-goal puts it out of reach, and a build that fails on a model's opinion is a build nobody trusts |

**Could not evaluate.** Exit 2, and **never** a pass (I19, I20).

| `DesignStateFailure` | Raised when | Caller does |
|---|---|---|
| `StateSetAbsent` | `design/state/` missing, or present with zero records | Report that nothing was checked. The expected state in every installed target |
| `RecordUnparseable` | A line matches no production | Report the file, the line number, and the line **verbatim**. Never drop it |
| `TrackerUnavailable` | `gh` missing or unauthenticated | Report the tracker classes as not compared; the rest of the run completes |
| `ShallowCheckout` | No history for `merge-base` | Report that ancestry was not checked, and why. Never a pass |
| `ProjectorFailed` | `Update-DesignProjection.ps1 -DryRun` non-zero or absent | Report `ProjectionStale` as uncomputed, not as clean |
| `ContractListUnreadable` | A list this document is canonical for cannot be read or parsed — the divergence classes above, or § *Invariants* | Report the class it feeds as uncomputed: `ClassListDisagreement` for the first, `UnrecordedArtifact`'s invariant half for the second. **Read-and-disagrees is a finding; cannot-read is not** |

### The freeze

While `design/FROZEN.md` exists: every blocking class is **downgraded to reported**, the count
downgraded is stated, and the marker's `Frozen because` and `Lifts when` are reproduced
**verbatim**. Exit 2 still stands (I21).

A freeze permits known staleness. It does not permit a checker that could not run, and treating
those the same would make writing one file a way to switch the gate off — including for a
broken checker, which has nothing to do with the staleness a freeze is meant to permit.

### Commands

A command's error semantics are its stop conditions. Every command above must stop and report
rather than route around; none may substitute an adjacent action for a blocked one.

## Invariants

**This table is the invariant unit set** — every row is a unit, per § *Artifacts of a unit
kind*, and the checker parses the section to take that difference. A row with no record is an
`UnrecordedArtifact` finding rather than a row awaiting attention.

**Every row is generated** from `design/state/invariants/*.md` (S7) — the table below is the
whole section, a single projected region, and it is regenerated, never hand-edited. Adding an
invariant means writing its record first; there is no canonical-copy area left for a row to
wait in.

<!-- invariants:start -->
| | Statement | Owner | Enforcement | Evidence |
|---|---|---|---|---|
| **I1** | No thread is resolved unless its class is `Defect`, its fix is in a commit reachable from `HeadSha`, and the `WaitResult` for that SHA has `State = Passed`. | `unit/command/resolve` | instruction | — |
| **I2** | `Wait-PullRequestCheck.ps1` never reports `Passed` or `Failed` for a SHA that was not the pull request's head at the moment it read the checks. | `unit/script/wait-pullrequestcheck` | code | tools/Wait-PullRequestCheck.Tests.ps1 |
| **I5** | Every `reviewThreads` query paginates to exhaustion before any thread is classified. | `unit/command/resolve` | instruction | — |
| **I6** | `/fix` never writes to `design/`. | `unit/command/fix` | instruction | — |
| **I7** | An unrecognised check bucket yields `NotEvaluated`, never `Passed` — the script fails closed. | `unit/script/wait-pullrequestcheck` | code | tools/Wait-PullRequestCheck.Tests.ps1 |
| **I8** | A pull request with zero checks configured yields `NotEvaluated`, never `Passed`. | `unit/script/wait-pullrequestcheck` | code | tools/Wait-PullRequestCheck.Tests.ps1 |
| **I9** | The delegation is unavailable in a repository the user does not own. Every action it covers is requested individually there, as today. | `unit/document/agents-md` | instruction | — |
| **I10** | `/fix` always implements against a bug issue's agent block — the one it was given, or the one it filed after reproducing. It never carries its own copy of those constraints. | `unit/command/fix` | instruction | — |
| **I11** | `/fix` never opens an issue for a defect it could not reproduce. That is a diagnosis report to the user, not a bug. | `unit/command/fix` | instruction | — |
| **I12** | `Test-DesignDrift.ps1` never reports a clean run for a comparison it could not complete — an unreadable tracker, an unparseable criterion id, or an unresolvable pin yields *could not evaluate*, never *no drift*. | `unit/script/test-designdrift` | code | tools/Test-DesignDrift.Tests.ps1 |
| **I13** | `Test-DesignDrift.ps1` writes nothing: not `design/`, not an issue, not git. It establishes that two sides disagree and stops there. | `unit/script/test-designdrift` | code | tools/Test-DesignDrift.Tests.ps1 |
| **I14** | No generated region is ever an input. Nothing reads a rendered projection back, and no record derives a field from one. | `unit/script/update-designprojection` | instruction | — |
| **I15** | Every restatement a record carries of a tree or log fact is mechanically resolvable, and a blocking class checks it. A restatement with no check is forbidden. | `unit/script/test-designstate` | instruction | — |
| **I16** | An id is assigned once, never reused and never renumbered. A record is retired, never deleted. | `unit/script/test-designstate` | instruction | — |
| **I17** | A derived edge is never written to a record. `Consumers`, `BoundBy`, `Decision.Affects` and `Question.Affects` appear only as projections; `Contract.Owner` is the sole written reverse edge and `OwnerMismatch` checks it. | `unit/script/read-designstate` | code | tools/Read-DesignState.Tests.ps1 |
| **I18** | No module of this mechanism writes outside a marked region: no source generated, no code edited, no divergence resolved, nothing written to git or the tracker. | `unit/script/test-designstate` | code | tools/Test-DesignState.Tests.ps1, tools/Update-DesignProjection.Tests.ps1 |
| **I19** | An absent or empty state set yields *could not evaluate*, never *clean*. | `unit/script/test-designstate` | code | tools/Test-DesignState.Tests.ps1 |
| **I20** | Findings and *could not evaluate* never collapse into each other, and exit 2 takes precedence over exit 1. | `unit/script/test-designstate` | code | tools/Test-DesignState.Tests.ps1 |
| **I21** | While `design/FROZEN.md` exists, no blocking class fails the build, and exit 2 still stands. | `unit/script/test-designstate` | code | tools/Test-DesignState.Tests.ps1 |
| **I22** | Every class on the blocking list is evaluable from the checkout alone — no network, no tracker, no running service. | `unit/document/design-20-contract` | instruction | — |
| **I23** | The orientation closure is exactly one hop and counts the unit's own artifact in full, and its ceiling is 16,384 bytes and never rises. It is measured as the sum of whole files, never as the bytes of the fields a reader consulted, and nothing is filtered at measurement time. | `unit/script/test-designstate` | instruction | — |
| **I24** | A line the record grammar does not recognise is reported verbatim and never skipped. | `unit/script/read-designstate` | code | tools/Read-DesignState.Tests.ps1 |
| **I25** | Regeneration is idempotent and order-independent: twice produces identical bytes, and one region's regeneration never changes another's output. | `unit/script/update-designprojection` | code | tools/Update-DesignProjection.Tests.ps1 |
| **I26** | No pre-existing entry in `design/90-decisions.md` is ever modified. Commits to that file are additions only. | `unit/document/design-90-decisions` | instruction | — |
| **I27** | Every command and script this design touches degrades to today's behaviour when the state set is absent. | `unit/document/design-10-design` | instruction | — |
| **I28** | GitHub is the authority for a slice's acceptance criteria, completion and order. A `WorkRef` is a mirror, is stale by default, and is never cited as authority. | `unit/command/track` | instruction | — |
| **I29** | The projector never writes inside a declared region, and no id is both projected and declared. | `unit/script/update-designprojection` | code | tools/Update-DesignProjection.Tests.ps1 |
| **I30** | A record with `Status: retired` keeps its id resolvable, is in no closure, and has its `Anchor` exempt from the tree check. Nothing else about it changes, and an active record naming it is a `HalfStatusMismatch` finding rather than the permitted reference it once was. | `unit/script/test-designstate` | instruction | — |
| **I31** | A contract's `Owner` is the unique active unit whose `Exposes` names that contract. It is the only reverse edge written to a record, and it is written only because it is checked. | `unit/script/test-designstate` | code | tools/Test-DesignState.Tests.ps1 |
<!-- invariants:end -->

**Enforcement is a claim about the tree as it stands, not about the tree as designed.** The
column states what is true today, so the `code` rows are the only ones a reader may trust
without checking and there is no caveat to read first. Every invariant this project added
arrived `instruction`, because **the slice that writes the evidencing test flips the row in the
same commit** and no test preceded its invariant. Writing `code` ahead of the test is the claim
`EnforcementUnevidenced` exists to reject, and a table that made it would be making it once for
every such row.

**Two rows have just moved the other way, and that direction needs stating because nothing else
in this document has used it.** I23 and I30 were `code` against
`tools/Test-DesignState.Tests.ps1`, and this amendment changed what both of them claim: I23 now
counts the unit's own artifact, and I30 now says an active record naming a retired one is a
finding. The named test evidences neither, and one of its cases asserts the closure rule I23
has just dropped. So both fall to `instruction` with no `Evidence` until the slice that amends
the meter and lands `HalfStatusMismatch` flips them back — **an amended statement demotes its
own row**, because `Enforcement` is a claim about the tree as it stands and the tree has not
moved yet. Leaving them `code` would have been the one thing this column exists to prevent: a
row a reader is entitled to trust without checking, evidencing a sentence it does not test.

**Which rows are `code`, and against which test, is the region's own `Enforcement` and
`Evidence` columns and is not enumerated here.** The set rises as slices land, and a prose list
beside a generated table is the copy that rots — with nothing to notice when it does, because
`ProjectionStale` stops at the closing marker. The region is the canonical copy and the only
one.

**I15 and I16 name no test, and they are not waiting for one.** I15 is a rule about which classes
may exist at all — it is discharged by every blocking class being a resolution check, and a test
of it would be asserting the class list is complete, which nothing in a checkout can. I16's
checkable half is already `IdCollision`'s: an id duplicated, or disagreeing with its file path,
within one checkout. Its other half — never reused and never renumbered *across time* — is a
property of the repository's history, and `PinAncestry` is already this document's record of what
history-dependent checking costs on a shallow clone. Both therefore stay `instruction` against no
named file, which is a different and weaker claim than a test not yet written.

I1 and I2 are the pair that matter for the first path. I14 is the pair's equivalent for the
second: it is the acyclicity everything else rests on, it is the property most easily lost to a
convenience, and it is the one on this list with no mechanical enforcement available.

**I26 deserves its `instruction` row named rather than passed over.** The brief states the check
— commits to `design/90-decisions.md` show additions only — and nothing standing runs it. It is
a one-time verification at migration, not a gate, and that gap is knowingly taken because the
alternative is a CI check on a git diff that a rebase can defeat.

**I12 and I13 stay with `Test-DesignDrift.ps1`.** They were contracted here as knowing scope
creep when this document covered one path; a second path now exists and the document is
repository-scoped, so the note that said they would move has nowhere left to move them to.

## Unresolved

**One item.** `/slice`'s "the contract does not contain a signature you need" stop condition
should fire on nothing else.

Whether a unit's `Questions` edge survives the question being answered was an item and is
**resolved**, by the design rather than by preference: `Questions` gains a retired half,
`Answered`, in the companion — the third of the three readings this section listed, and the one
it correctly identified as `design/10-design.md`'s to make rather than this document's
(`design/90-decisions.md`, 2026-08-29, "Retired halves move to a companion file"). It is not a
special case: **every** active edge gained exactly one companion half in the same decision, so
the question edge is answered by the general rule instead of a mechanism of its own. The two
readings it rejected were rejected for the reasons stated there — dropping the id destroys the
resolvable edge, and filtering in the projector leaves the record self-contradictory and makes
an offline read and a rendered read disagree. `question/answered-question-unit-edge` stays
`open` until the `Answered` grammar lands, because a record answered by a decision with nowhere
to move its edge is the self-contradiction the sequencing exists to avoid
([#152](../../issues/152)).

Where a slice's criteria are rendered was an item and is **resolved**: `outstanding`
renders into `design/state-index.md`, § *Outstanding* stays hand-authored proposals, and
§ *Public surface* above carries the term. Two of the three readings it listed were eliminated by
derivation rather than by preference — a projected § *Outstanding* has no record kind to render a
proposal from and erases one on the next regeneration, and a proposal area that empties at issue
creation leaves a checkout with criteria for none of the outstanding work — which left a
placement rather than a mechanism to choose (`design/90-decisions.md`, 2026-08-20).

### Which command writes a question record, and when

§ *Cross-cutting obligations on commands* states the half the design settles: an `## Open` item
and a question record are different things. `design/10-design.md` does not say who separates
them.

§ *Record* gives a five-step flow for a decision — append the entry, write the decision record,
update the affected units, regenerate, check — and there is no question equivalent anywhere in
the design. The one question record this repository has was written by hand at S11, during a
migration that runs once and never in a target, so nothing about the steady state can be read
off it.

The candidates each imply a different command's surface. `/track` already reads `## Open` and
already distinguishes a question from a task (`.claude/commands/track.md`), which makes it the
obvious writer — and it is also the one command `AGENTS.md` says owns every GitHub write it can
make idempotent, so giving it a `design/state/` write crosses a boundary that was drawn
deliberately. The session that *notices* the question is the other candidate, on the same
argument that makes a decision's record the writing session's; that has no single command to
name and therefore no surface to contract. A third reading is that a question record is written
only where a unit's `Questions` field needs a referent, which makes it `/slice`'s and leaves
questions nobody is blocked on unrecorded.

Choosing between them here would be inventing a signature the design does not determine, and
each choice changes a different command file.

Anything else a slice discovers to be undetermined belongs here as a new item, under the same
rule.
