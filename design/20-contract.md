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
- **`Status` is retirement, and a retired record is still resolvable.** A live record may name a
  retired one and that is not a finding — keeping the id resolvable is the entire reason
  retirement exists rather than deletion (I16). What retirement changes is two things and only
  two: the record leaves every closure, and its `Anchor` stops being checked against the tree
  (I30), and a retired *invariant* additionally leaves § *Invariants* below, because that table is
  the invariant unit set rather than a history — a retired row would keep the id in
  `UnrecordedArtifact`'s difference and make the table grow monotonically. A retired unit's
  artifact is gone by definition, so an `Anchor` check against it would block on every run
  forever.
- **`Archival` is excluded from the closure and from nothing else.** It is read when history
  is wanted; it is not read when orienting. A reader that folds it into `Live` makes the
  ceiling a countdown against a monotonic log (I23).
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
  reported territory.
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
| `unit/<kind>/<slug>` | `design/state/units/<kind>/<slug>.md` |
| `I<n>` | `design/state/invariants/I<n>.md` |
| `contract/<slug>` | `design/state/contracts/<slug>.md` |
| `decision/<date>-<slug>` | `design/state/decisions/<date>-<slug>.md` |
| `question/<slug>` | `design/state/questions/<slug>.md` |
| `work/<issue>` | `design/state/work/<issue>.md` |

Keys, and what the mapping cannot state:

- **The file path is the primary key and the `Id` line inside it must agree.** Disagreement is
  an `IdCollision` finding. Two records claiming one id is the failure this key exists to make
  impossible, and a filesystem gives it for nothing.
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

That population **advances by slice and is not finished.** `units/`, `invariants/`, `decisions/`,
`questions/` and `contracts/` carry records; no `work/…` record has been written, so `work/` does
not exist yet. A kind with no records is zero records of that kind and nothing
more — `StateSetAbsent` is taken over `design/state/` as a whole, not per kind, so an absent
subdirectory is neither a finding nor a could-not-evaluate.

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
`tools/Update-WorkMirror.ps1` is the one surface deliberately without a record (S16.6), because a
`Declaration` pointing at an absent file is the shape `AnchorMissing` exists to reject.

**No class compares the two, and this is the second such gap in this document** — § *Artifacts of
a unit kind* names the first. `OwnerMismatch` checks a record's `Owner` against the units and
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
- **Measures a closure as the sum of whole record files** (I23), never as the bytes of the fields
  a reader actually consulted. A meter that counted only what it looked at would satisfy the
  ceiling while understating the load, which is the single property one-file-per-record was chosen
  over a grouped document to make impossible.
- **Always names the largest closure and the unit it belongs to, on a clean run as well as a
  failing one.** `ClosureOverBudget` fires only once the ceiling is passed; the brief requires
  the largest unit named in the report regardless. Headroom nobody is shown is a ceiling nobody
  can see being approached, and the first anyone would learn of it is the run that blocks. It
  is a report line, never a finding.
- **Never clean on an absent or empty state set** (I19). Zero records is I8's shape: absence of
  a finding is not a finding of absence, and a target must never be told its design state
  agrees with anything.
- **Regenerates before comparing**, by invoking the projector with `-DryRun`. Comparing without
  regenerating reports every projection as stale, which trains the reader to ignore the report.
- **Normalises line endings before comparing and normalises nothing else.** `agent.md` records
  `prettier --check` failing every file on a Windows working tree for exactly this reason, and
  Windows is the house platform. Any other normalisation would hide a real difference.
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

**`units`, `bound-by`, `consumers`, `decision-affects` and `question-affects` render into
`design/state-index.md`** (S7) — no other document owned any of the five before this, and this
one exists to hold them. `invariants` renders into this document's own § *Invariants*, below.
`agent` has no document region: GitHub is where an issue's agent block lives, and no module of
this mechanism writes there (S7.10). `outstanding` is not delivered — see § *Unresolved*.

### `tools/Update-WorkMirror.ps1`

The mirror generator. **Not written yet** — contracted ahead of the slice that writes it, which is
what makes it safe to implement with a cheaper model. It is the only surface in this section with
no file behind it.

- **`/track`'s alone.** No other command invokes it, and no other command writes a `WorkRef`.
  Two writers of a mirror is two answers to "when was this current".
- **Writes `WorkRef` records and nothing else.** Never an issue, never a label, never a
  milestone — those are `/track`'s own carved-out writes and stay in the command.
- **Stamps `MirroredAt` on every write**, including a write that changed nothing.
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

| Kind | Glob | Excluded, and why |
|---|---|---|
| command | `.claude/commands/*.md` | `*-local.md` — a companion is the target's, and this repository ships none |
| script | `tools/*.ps1` | `*.Tests.ps1` — a test is `Evidence`, not a unit |
| document | `design/*.md`, `templates/design/*.md`, `*.md` at the repository root, `.claude/COMPANIONS.md`, `.github/ISSUE_TEMPLATE/*.md`, `codex/PROFILES.md` | `design/FROZEN.md` — transient by design; `CLAUDE.md` — a loader that imports `AGENTS.md` and states nothing of its own |
| invariant | not a tree path | The set is **every `I<n>` row in § *Invariants* below**. Nothing is excluded: a rule the kit binds itself to is a unit whether or not any document quotes it |

**The invariant kind has no glob because it has no artifact, and § *Invariants* is what stands
in for one.** Every row there is a rule the kit binds itself to, and a rule is a unit whether or
not any document happens to quote its number — a set taken against citations picks out the two
ids `AGENTS.md` currently needs to point at, which would make the kind nearly empty and leave
§ *Invariants* split into a generated head and a hand-kept tail permanently. The section is
therefore a **parsed source**, the second one this document carries after the class list below,
and `ContractListUnreadable` covers both: a section that cannot be read leaves
`UnrecordedArtifact`'s invariant half uncomputed rather than empty, because an empty difference
read off an unreadable table is the I8 shape one level up.

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

**It is also one of the two restatements in this document that no class compares**, the other
being § *Public surface* against the `Contract` records. The divergence-class
list has `ClassListDisagreement`; the id-to-path mapping has `IdCollision`; the projections have
`ProjectionStale`. A glob widened in the script and not here, or here and not in the script,
diverges silently and `UnrecordedArtifact` goes on agreeing with whichever side the run read. The
gap is stated rather than left to be discovered, and closing it is a class this list does not yet
carry.

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
| `ClassListDisagreement` | The checker's declared class ids differ from this document's list | Both sets, and the difference in each direction |

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
rule and two intentions. It is the same silent divergence § *Artifacts of a unit kind* names for
its glob table, and nothing on the closed list closes it.

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
| **I23** | The orientation closure is exactly one hop, excludes `Archival`, and its ceiling is 16,384 bytes and never rises. It is measured as the sum of whole record files, never as the bytes of the fields a reader consulted. | `unit/script/test-designstate` | code | tools/Test-DesignState.Tests.ps1 |
| **I24** | A line the record grammar does not recognise is reported verbatim and never skipped. | `unit/script/read-designstate` | code | tools/Read-DesignState.Tests.ps1 |
| **I25** | Regeneration is idempotent and order-independent: twice produces identical bytes, and one region's regeneration never changes another's output. | `unit/script/update-designprojection` | code | tools/Update-DesignProjection.Tests.ps1 |
| **I26** | No pre-existing entry in `design/90-decisions.md` is ever modified. Commits to that file are additions only. | `unit/document/design-90-decisions` | instruction | — |
| **I27** | Every command and script this design touches degrades to today's behaviour when the state set is absent. | `unit/document/design-10-design` | instruction | — |
| **I28** | GitHub is the authority for a slice's acceptance criteria, completion and order. A `WorkRef` is a mirror, is stale by default, and is never cited as authority. | `unit/command/track` | instruction | — |
| **I29** | The projector never writes inside a declared region, and no id is both projected and declared. | `unit/script/update-designprojection` | code | tools/Update-DesignProjection.Tests.ps1 |
| **I30** | A record with `Status: retired` keeps its id resolvable, is excluded from every closure, and has its `Anchor` exempt from the tree check. Nothing else about it changes, and a live record naming it is not a finding. | `unit/script/test-designstate` | code | tools/Test-DesignState.Tests.ps1 |
| **I31** | A contract's `Owner` is the unique active unit whose `Exposes` names that contract. It is the only reverse edge written to a record, and it is written only because it is checked. | `unit/script/test-designstate` | code | tools/Test-DesignState.Tests.ps1 |
<!-- invariants:end -->

**Enforcement is a claim about the tree as it stands, not about the tree as designed.** The
column states what is true today, so the `code` rows are the only ones a reader may trust
without checking and there is no caveat to read first. Every invariant this project added
arrived `instruction`, because **the slice that writes the evidencing test flips the row in the
same commit** and no test preceded its invariant. Writing `code` ahead of the test is the claim
`EnforcementUnevidenced` exists to reject, and a table that made it would be making it once for
every such row.

Only I2, I7, I8, I12, I13, I17, I18, I19, I20, I21, I23, I24, I25, I29, I30 and I31 are `code`
today, all against tests that exist. I17 and I24 are against `tools/Read-DesignState.Tests.ps1`;
I18 through I31 (excluding I24, just named, and I22, I26, I27, I28, which stay `instruction` for
the reasons stated at each row) are against `tools/Test-DesignState.Tests.ps1`, written at S5, or
`tools/Update-DesignProjection.Tests.ps1`, written at S7 — I25 and I29 flip to it there, since
they bind the projector rather than the checker. I18 binds both and cites both files. The
number this note names is one a later run should expect to see rise.

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

### Where a slice's criteria are rendered once GitHub is the authority

`design/30-slices.md` is the authority for acceptance criteria today. Under I28 it stops being
one, and `design/10-design.md` does not say what the document becomes.

Three things have to hold at once and the design determines only the first two: no file is the
authority (brief, *Work state*); a checkout with no network still yields the outstanding work,
its order, and each item's criteria (same); and `/slices` appends proposals to that document
before any issue exists, which is where authority transfers (`design/10-design.md`, *WorkRef*).

The readings that survive all three differ in what `## Outstanding` becomes — a marked region
projecting the `WorkRef` mirrors, a hand-authored proposal area that empties as issues are
created, or both in sequence — and they imply different changes to `/slices`, `/slice`, `/track`
and to the retirement convention `design/30-slices.md` § *How this document is kept* states.
Choosing between them here would be inventing a signature the design does not determine.

A slice that reaches this stops. It does not resolve it in the implementing session.

Anything else a slice discovers to be undetermined belongs here as a new item, under the same
rule.
