# Contract

> **Two paths are under contract here.** The **defect-to-merge path** (`/fix`,
> `Wait-PullRequestCheck.ps1`, the authorization batch) landed as S1–S3; its design body is
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

**The state set is constrained Markdown with a line grammar, and no code declares it yet.**
Its grammar is therefore written here as a scaffold, in full. The slice that materialises
the reader **replaces the grammar block below with a pointer to the reader in the same
commit** — descriptive drift corrected where it is found (`AGENTS.md`, *Hard rules*), not a
contract amendment, and it needs no approval. What survives that replacement is everything
in this document that a grammar cannot state.

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

`AuthorizationBatch` has no code representation. It is a conversational structure, and its
invariants are I3 and I4 below.

### The state set

**The six entity kinds and their fields are declared in `design/10-design.md` § Data model
and are not copied here.** What that table cannot state:

- **Every list-valued field is present on every record, empty where it has no members.** An
  omitted line and an empty line are different facts and must never be read as the same one —
  omission is how "nobody filled this in" becomes indistinguishable from "there are none",
  which is the shape I12 exists to reject one level down.
- **`Consumers` and `BoundBy` must never appear in a file.** They are derived. A file
  carrying either is a parse finding, not a value to be believed (I17). The grammar has no
  production for them, which is what makes the check free rather than a rule someone remembers.
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
  the tree does not make.
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
| Unit | `unit/<kind>/<slug>` | `unit/command/track`, `unit/script/test-design-drift`, `unit/document/design-00-brief`, `unit/document/template-00-brief` |
| Invariant | `I<n>` | `I3` |
| Contract | `contract/<slug>` | `contract/wait-result` |
| Decision | `decision/<YYYY-MM-DD>-<slug>` | `decision/2026-08-08-pr-absorbs-gates` |
| Question | `question/<slug>` | `question/slices-authority-home` |
| WorkRef | `work/<issue>` | `work/42` |

What the table cannot state:

- **The invariant form is the one exception and it is deliberate.** `I1`–`I13` are cited by
  bare number in `AGENTS.md`, in six command files and throughout the log. Prefixing them would
  be the corpus-wide rename that permanent ids exist to prevent, which is the same argument
  that makes every other id permanent.
- **A slug is a name, not a location.** `unit/command/track` keeps its id after `/track` is
  renamed; the `Anchor` moves and the id does not. An id that reads as historical after a
  rename is a permanent id working correctly, not drift.
- **The id determines the record's own file path, and only its own.** The mapping is stated
  under *Persisted schemas*. This is the one restatement in the system checked by construction
  rather than by a class: a record in the wrong file cannot be addressed at all.

### What the reader emits

No code declares these yet. Scaffold, in the repository's established shape — `[pscustomobject]`
from a factory function, because a PowerShell `class` does not cross a script boundary and this
repository already answered that question with `New-WaitResult`, `New-CheckRunResult` and
`New-DriftResult`.

```powershell
# tools/Read-DesignState.ps1
function New-DesignRecord {
    param(
        [Parameter(Mandatory)][string]   $Id,
        [Parameter(Mandatory)][string]   $Kind,
        [Parameter(Mandatory)][string]   $Path,
        [Parameter(Mandatory)][hashtable] $Scalars,
        [Parameter(Mandatory)][hashtable] $Lists,
        [Parameter(Mandatory)][hashtable] $Prose
    )
}

function New-DesignStateGraph {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string]     $Root,
        [Parameter(Mandatory)][AllowEmptyCollection()][object[]] $Records,
        [Parameter(Mandatory)][AllowEmptyCollection()][object[]] $Failures
    )
}

function New-DesignStateFailure {
    param(
        [Parameter(Mandatory)][string] $Reason,
        [Parameter(Mandatory)][string] $Path,
        [int]    $Line,
        [string] $Text
    )
}

function New-DesignFinding {
    param(
        [Parameter(Mandatory)][string] $Class,
        [Parameter(Mandatory)][string] $Subject,
        [Parameter(Mandatory)][string] $Detail,
        [Parameter(Mandatory)][bool]   $Blocking
    )
}
```

What those signatures cannot state:

- **`Failures` is never folded into `Findings` and the two never substitute for each other.**
  This is I12's rule at a second site, and it is the whole difference between "the design
  disagrees with the tree" and "the design was not read".
- **`New-DesignStateFailure` carries `Text` verbatim.** The offending line is reproduced, not
  described. A summarised parse failure is one nobody can locate (I24).
- **`Blocking` is set from the class list in this document, never decided per finding.** A
  finding does not get to argue about its own severity; if the two disagree, that is the
  `ClassListDisagreement` finding, not a judgement call at the call site.
- **`Root` may be the empty string**, and that is the absent-state-set case rather than an
  error. It reaches the caller as a graph with zero records, which the checker turns into
  could-not-evaluate (I19).

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

**Grammar.** Scaffold — replaced by a pointer to `tools/Read-DesignState.ps1` when it exists.

```
# <id>                          ← H1, exactly one, first non-blank line, must equal the id the path implies
<Field>: <value>                ← scalar; one per line; value may be empty
<Field>: <id>, <id>, <id>       ← list; comma-separated; may be empty after the colon
                                ← blank lines permitted between field lines
## <Field>                      ← prose field; body runs to the next `##` or EOF
<free Markdown>
```

- Field lines precede the first `##`. A field line after one is unparseable, not a late field.
- A field name appears at most once per record.
- Anything matching neither production is **unparseable and reported verbatim** (I24). The
  grammar has no permissive fallback, and adding one would reintroduce the silently dropped id
  the I12 precedent exists for.

**Migration story.** The state set does not exist, so there is no existing data to migrate to.
The one-time population is `design/10-design.md` § *Migrate*, and its constraint is I26: **every**
entry in `design/90-decisions.md` is read and **not touched** — every entry as the log then
stands, not a count fixed here, because the log is append-only and any number written down is
wrong by the next commit. Records are written for artifacts that already exist;
no artifact is created to give a record something to point at. This runs on this repository and
never in a target.

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
- **`companion` is the only declared region today**, and migrating it is a closed set:
  twenty-one files under `.claude/commands/`, the single regex in `tools/Test-Companion.ps1`,
  its `MissingBlock` message and doc comment, and `tools/Test-Companion.Tests.ps1`.
  `.claude/COMPANIONS.md` states the rule without naming the literal marker and needs no edit
  for the form itself.
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

### `tools/Read-DesignState.ps1`

Does not exist. Contracted before it is written, which is what makes it safe to implement
with a cheaper model.

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
- **`-Path` is optional and defaults to the repository root.** It has no `-Fix`, no `-Force`,
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
| `outstanding` | The outstanding work list, its order, and each item's criteria, from the `WorkRef` mirrors | *Work state* — "from a checkout with no network" |
| `invariants` | This document's § Invariants, from the invariant records | *Single ownership* — otherwise the statements live here and in the records both |

### `tools/Update-WorkMirror.ps1`

The mirror generator.

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
| Invocation | `/fix <issue number>`, `/fix <description>`, or `/fix` with a failing test in context |
| Reads | the defect source; **the bug issue's agent block**; the repository's gates via `/verify`; `AGENTS.md` |
| Writes | one branch, one or more commits, one pull request, and — only on the description path, only after reproducing — **one bug issue** |
| Must output | the reproduction evidence; the issue number it is implementing against; `/verify`'s three lists; the batch request; the pushed SHA; the `WaitResult` |
| Must not | edit `design/`, open a draft pull request, resolve a thread, merge, or open an issue for a defect it did not reproduce |

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
| Ordering | Classification completes **before** the batch is requested |
| Delegation | "Confirm the checks are green on the new head SHA" is discharged by `Wait-PullRequestCheck.ps1`, not by reading `gh pr checks` by eye |
| Authorization | Cites the `AGENTS.md` batch rule rather than asking per action |

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
| `AGENTS.md` | The marked-region rule — both kinds — generalised from the agent-fence rule it states today; the freeze rule; I3, I4, I9 | State the rule twice, or leave the agent-fence wording behind as a second copy. **Exactly one document states it**, and `.claude/COMPANIONS.md` names `companion` as declared without restating what declared means |
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
| invariant | not a tree path | The set is the `I<n>` records themselves; the difference is taken against citations in `AGENTS.md` and the command files |

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
| `AnchorMissing` | A record's anchor names a path not in the tree | Both. **Which of the two is wrong is the user's call** |
| `UnrecordedArtifact` | A tree artifact of a unit kind has no record | The unrecorded artifact |
| `ProjectionStale` | A region differs from its regeneration, after line-ending normalisation | A diff of the region |
| `RegionMalformed` | A marked region of either kind is unbalanced or nested | The document and the marker |
| `IdCollision` | An id is duplicated, renumbered, disagrees with its file path, or appears in both the projected and the declared marker form | Every file claiming it |
| `DecisionAnchorAmbiguous` | A decision anchor resolves to zero or two log headings | The anchor and the count |
| `LogEntryUnrecorded` | A log heading has no decision record | The entry's heading |
| `EnforcementUnevidenced` | An invariant with `Enforcement: code` has no `Evidence` | The invariant id |
| `ClosureOverBudget` | A closure exceeds 16,384 bytes | The unit, its size, and its largest contributor |
| `ClassListDisagreement` | The checker's declared class ids differ from this document's list | Both sets, and the difference in each direction |

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
| `ContractListUnreadable` | This document's class list cannot be read or parsed | Report `ClassListDisagreement` as uncomputed. **Read-and-disagrees is a finding; cannot-read is not** |

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

> When the state set exists, this section becomes the `invariants` projection of the invariant
> records and is regenerated, not edited. Until then it is the canonical copy.

| | Statement | Owner | Enforcement | Evidence |
|---|---|---|---|---|
| **I1** | No thread is resolved unless its class is `Defect`, its fix is in a commit reachable from `HeadSha`, and the `WaitResult` for that SHA has `State = Passed` | `resolve.md` | instruction | — |
| **I2** | `Wait-PullRequestCheck.ps1` never reports `Passed` or `Failed` for a SHA that was not the pull request's head at the moment it read the checks | the script | code | `tools/Wait-PullRequestCheck.Tests.ps1` |
| **I3** | A batch authorizes exactly the thread ids enumerated when it was granted, and no others | `AGENTS.md` | instruction | — |
| **I4** | A batch does not outlive the response that acts on it | `AGENTS.md` | instruction | — |
| **I5** | Every `reviewThreads` query paginates to exhaustion before any thread is classified | `resolve.md` | instruction | — |
| **I6** | `/fix` never writes to `design/` | `fix.md` | instruction | — |
| **I7** | An unrecognised check bucket yields `NotEvaluated`, never `Passed` — the script fails closed | the script | code | `tools/Wait-PullRequestCheck.Tests.ps1` |
| **I8** | A pull request with zero checks configured yields `NotEvaluated`, never `Passed` | the script | code | `tools/Wait-PullRequestCheck.Tests.ps1` |
| **I9** | The batch is **unavailable** in a repository the user does not own. Every action in it is requested individually there, as today | `AGENTS.md` | instruction | — |
| **I10** | `/fix` always implements against a bug issue's agent block — the one it was given, or the one it filed after reproducing. It never carries its own copy of those constraints | `fix.md` | instruction | — |
| **I11** | `/fix` never opens an issue for a defect it could not reproduce. That is a diagnosis report to the user, not a bug | `fix.md` | instruction | — |
| **I12** | `Test-DesignDrift.ps1` never reports a clean run for a comparison it could not complete — an unreadable tracker, an unparseable criterion id, or an unresolvable pin yields *could not evaluate*, never *no drift* | the script | code | `tools/Test-DesignDrift.Tests.ps1` |
| **I13** | `Test-DesignDrift.ps1` writes nothing: not `design/`, not an issue, not git. It establishes that two sides disagree and stops there | the script | code | `tools/Test-DesignDrift.Tests.ps1` |
| **I14** | No generated region is ever an input. Nothing reads a rendered projection back, and no record derives a field from one | the projector | instruction | — |
| **I15** | Every restatement a record carries of a tree or log fact is mechanically resolvable, and a blocking class checks it. A restatement with no check is forbidden | the validator | instruction | — (`tools/Test-DesignState.Tests.ps1` when written) |
| **I16** | An id is assigned once, never reused and never renumbered. A record is retired, never deleted | the validator | instruction | — (`tools/Test-DesignState.Tests.ps1` when written) |
| **I17** | A derived edge is never written to a record. Reverse edges appear only as projections | the reader | instruction | — (`tools/Read-DesignState.Tests.ps1` when written) |
| **I18** | No module of this mechanism writes outside a marked region: no source generated, no code edited, no divergence resolved, nothing written to git or the tracker | the checker, the projector | instruction | — (`tools/Test-DesignState.Tests.ps1`, `tools/Update-DesignProjection.Tests.ps1` when written) |
| **I19** | An absent or empty state set yields *could not evaluate*, never *clean* | the checker | instruction | — (`tools/Test-DesignState.Tests.ps1` when written) |
| **I20** | Findings and *could not evaluate* never collapse into each other, and exit 2 takes precedence over exit 1 | the checker | instruction | — (`tools/Test-DesignState.Tests.ps1` when written) |
| **I21** | While `design/FROZEN.md` exists, no blocking class fails the build, and exit 2 still stands | the checker | instruction | — (`tools/Test-DesignState.Tests.ps1` when written) |
| **I22** | Every class on the blocking list is evaluable from the checkout alone — no network, no tracker, no running service | `design/20-contract.md` | instruction | — |
| **I23** | The orientation closure is exactly one hop, excludes `Archival`, and its ceiling is 16,384 bytes and never rises | the budget meter | instruction | — (`tools/Test-DesignState.Tests.ps1` when written) |
| **I24** | A line the record grammar does not recognise is reported verbatim and never skipped | the reader | instruction | — (`tools/Read-DesignState.Tests.ps1` when written) |
| **I25** | Regeneration is idempotent and order-independent: twice produces identical bytes, and one region's regeneration never changes another's output | the projector | instruction | — (`tools/Update-DesignProjection.Tests.ps1` when written) |
| **I26** | No pre-existing entry in `design/90-decisions.md` is ever modified. Commits to that file are additions only | every command that writes the log | instruction | — |
| **I27** | Every command and script this design touches degrades to today's behaviour when the state set is absent | each command | instruction | — |
| **I28** | GitHub is the authority for a slice's acceptance criteria, completion and order. A `WorkRef` is a mirror, is stale by default, and is never cited as authority | `/track` | instruction | — |
| **I29** | The projector never writes inside a declared region, and no id is both projected and declared | the projector | instruction | — (`tools/Update-DesignProjection.Tests.ps1` when written) |

**Enforcement is a claim about the tree as it stands, not about the tree as designed.** The
column states what is true today, so the `code` rows are the only ones a reader may trust
without checking and there is no caveat to read first. Every invariant this project adds is
`instruction`, with the test that would evidence it named in parentheses: those files do not
exist, and **the slice that writes one flips its row in the same commit**. Writing `code` ahead
of the test is the claim `EnforcementUnevidenced` exists to reject, and a table that made it
would be making it eleven times.

Only I2, I7, I8, I12 and I13 are `code` today, all against tests that exist. That the second
path contributes none of them is the honest reading of where this project is, and it is the
number a later run should expect to see rise.

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

**Three items.** `/slice`'s "the contract does not contain a signature you need" stop condition
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

### How a unit or contract record is retired

`design/10-design.md` § *Unit* requires a record to be **retired, never deleted**, and says
retirement "keeps the id resolvable and marks it inactive". **No field carries that mark.**
`Status` exists on `Decision` (`accepted | superseded`) and on `Question` (`open | answered`);
`Unit` and `Contract` have neither a status field nor any other representation of inactivity, and
the grammar has no production for one.

The consequence is not cosmetic. A unit is retired *because its artifact was deleted*, so its
`Anchor` then names a path that is not in the tree — which is `AnchorMissing`, blocking, on every
run from that day on. Retirement as designed therefore cannot be performed without either adding a
field or accepting a permanent blocking finding, and I16 requires that it be performable.

Two shapes are available and the design determines neither: a `Status` field on `Unit` and
`Contract`, mirroring the one `Decision` already carries; or a `Retired` date field, which records
when as well as whether. They differ in what `AnchorMissing` and `UnrecordedArtifact` must then
exclude, and in whether a retired unit still counts toward another unit's closure — both of which
are terms this document would have to carry.

A slice that reaches this stops. Resolving it is `/design`'s, at deep-reasoning tier.

### Which end of a two-ended edge is written, and what checks the two agree

`design/10-design.md` § *Derived* states the rule — reverse edges are "derived and never written"
— and names three: which units an invariant binds, which units consume a contract, and "which
units a decision affects in the other direction". The first two have field names, and both tables
mark them **Derived. Never written**: `Invariant.BoundBy` and `Contract.Consumers`. The third does
not, and § *Data model* lists `Decision.Affects` as an ordinary written field.

Three edges are consequently written from both ends, with nothing on the closed class list
comparing the two copies:

| Edge | Written on the unit | Written on the other record |
|---|---|---|
| the unit exposes a contract | `Exposes` | `Contract.Owner` |
| a decision is in force here | `Live`, `Archival` | `Decision.Affects` |
| a question affects this unit | `Questions` | `Question.Affects` |

Both readings survive the document. Under **the field tables**, all three are written — and the
design's own argument against reverse edges, that "writing them would create the second copy that
rots", then applies to three edges it did not exclude. Under **§ *Derived***, `Decision.Affects`
is the reverse of `Live`/`Archival` and is not written at all, which makes the `Decision` table
wrong and changes what a decision record contains.

The unit's end is not in question either way: the closure is one hop from the unit record, so
`Exposes`, `Live`, `Archival` and `Questions` must be written for the brief's first done criterion
to hold at all. What is undetermined is the far end — and, for whichever edges keep both ends,
which class checks that the two agree. A class does not exist unless this document lists it, so
adding one is a contract amendment rather than something this run may settle on its own.

A slice that reaches this stops. Resolving it is `/design`'s, at deep-reasoning tier.

Anything else a slice discovers to be undetermined belongs here as a new item, under the same
rule.
