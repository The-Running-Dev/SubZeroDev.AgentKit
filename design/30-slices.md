# Slices

> **Five paths appear here.** The **defect-to-merge path** landed as S1–S3; its bodies are
> retired to the index under `## Landed` and its design body to
> `git show dfd1cab:design/10-design.md`. The **explicit design-state mechanism**, designed in
> the current `design/10-design.md` and contracted in `design/20-contract.md`, landed as
> S4–S18; its bodies are retired to the same index. The **2026-08-29 revision to that
> mechanism** — the retired companion, absorption, the half/status table, and the
> artifact-inclusive ceiling — landed as S19–S22, retired to the same index. The
> **2026-09-01 re-scoping of the ceiling**, which took the unit's own artifact back out of the
> bound and made the one remaining breach a thing absorption can move, landed as
> **S23–S25**; those three bodies are still below rather than in the index, because nothing
> retires a landed body and that gap is [#120](../../issues/120). The **remainder of the
> absorption pass the 2026-08-31 decision commissioned** — the units that pass never reached,
> which is every unit but the two it was scoped to — is **S26–S29** and is outstanding.

The riskiest assumption in the first path was that a check result can be tied to a named head
SHA reliably enough to gate an irreversible action on it — S1 did nothing else, so that was
proven before any policy changed.

The riskiest assumption in the second is the **16,384-byte closure ceiling**, because the brief
attaches an abandonment clause to it: if the ceiling cannot be met on this repository's own
corpus, the project stops and reports rather than relaxing it. S4 writes the records for the two
units most likely to blow it and completes their closures; S5 measures. The ceiling is therefore
exercised in the second slice of the set rather than at the end of the migration, and it is
re-measured at every migration slice after that.

The riskiest assumption in the third is that same ceiling under the definition the revision
gives it, and it is now a question about this repository rather than about the mechanism:
`design/10-design.md` § *Whether the ceiling can be met* already states that counting a unit's
own artifact puts several units several times over the limit. S19 does nothing but make the
checker say so, ahead of every structural change in the set, because the brief's *Abandonment*
clause is the user's to answer and answering it late would waste three slices.

The riskiest assumption in the fourth was that the re-scoped ceiling is **meetable at all** on
this repository's own corpus — the same bet as the third, asked again of a number that now
counts only what the mechanism has a lever on. The brief's *Abandonment* line was re-pointed at
this bound on 2026-09-01 and fires once every executed decision has been given its site, so a
pass that runs and still leaves a unit over the ceiling is the clause triggering rather than a
slice failing. S23 did nothing but make the meter say what the bound now is, because until it
did no absorption could be measured; S24 then absorbed the worst unit, which is where the bet
was actually settled. **It was met.** S25 finished the second-worst and the design-state gate
reports exit 0 with no `ClosureOverBudget` finding, so the clause did not fire.

The riskiest assumption in the fifth is not about the ceiling at all — it is that a decision
**can be absorbed out of a unit whose own artifact has no headings to absorb it into.** A site
resolves against a unit's artifact or against a contract record one hop away, and a PowerShell
script has no Markdown headings, so for a script unit the contract record is the only site there
is — and a script exposing no contract has none. That is why S26 is first and is the smallest
of the three: it is the unit closest to breaching again, and it is the only one of the three
whose route is not the route S24 and S25 already proved. S27 and S28 are that proved route
applied to the units it was never pointed at.

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

**What `## Outstanding` becomes under I28 is settled, and it is this.** `design/20-contract.md`
§ *Public surface* places the `outstanding` projection in `design/state-index.md`, not here, so
this document keeps its hand-authored body and acquires no marked region. The slices below are
**proposals** rather than criteria — authority transfers when `/track` creates each issue
(`design/10-design.md`, § *WorkRef*) — and after that the issue is the authority and the
mirrored criteria are read from the projection, never from here
(`design/90-decisions.md`, 2026-08-20).

## Contract questions

**One outstanding and two answered.** The outstanding one is already an item in
`design/20-contract.md` § *Unresolved*. The other two were found by a re-run of this document
and **answered in the same session**; both amendments and both log entries were `/contract`'s,
at `opus`/`high`, and **both have since landed** — `design/20-contract.md` and
`design/90-decisions.md` now say what the two sections below record. What is left of each is
the account of what was decided and why, which is why neither has been deleted.

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

The amendment and its log entry landed in one commit, so that no window existed in which the
log described a contract that did not say it. Two things moved together: the `invariant` row of
§ *Artifacts of a unit kind*, and the citation scan in `tools/Test-DesignState.ps1`, now
`Get-ContractInvariantIds`. **S17** below is what the answer obliges, and until it lands the
checker reports the 26 unwritten records rather than the three surplus ones it reported before
— the same interim state § *Interim findings are expected* describes, except that CI is wired
now and the build is red for the duration.

**Which class resolves a tree pointer that is not a unit's `Anchor` — answered.**
`AnchorMissing` was scoped to `Unit.Anchor` by both this contract and the checker, leaving
`Contract.Declaration` and the `Evidence` field on a unit or an invariant record as tree paths
nothing standing resolves — the unchecked restatement **I15** forbids, and already live, since
unit records carry `Evidence` today. **`AnchorMissing` widens** — decided 2026-08-19. Its stated
trigger becomes any tree-pointer field a record carries, keeping the `Status: active` exemption
I30 requires; the check, the remedy and the reason it is evaluable from the checkout alone are
the same in every case.

The closed list keeps its current size, so no `ClassListDisagreement` window opened between the
document and the checker. What is bought is that the class name reads narrower than what it
checks, and it is bought deliberately: renaming it later is expensive, because S12.2's tests and
the closed list both cite it by name. The amendment touched `design/20-contract.md`'s class
table and `Test-AnchorMissing` in `tools/Test-DesignState.ps1`, and it carried the real
divergence and near-miss S12.2 owed on each new field — `AnchorMissing`'s coverage is 3 fires
and 3 near-misses where it was 1 and 1.

A slice that discovers something *else* undetermined stops and adds it to § *Unresolved*. It
does not resolve it in the implementing session.

## Outstanding

**Four slices, S26–S29**, finishing the absorption pass the 2026-08-31 decision commissioned.
That decision says a slice walks **every** unit's `Live`. S24 and S25 walked two — the two that
were over the ceiling — and stopped there, correctly, because clearing the breach was their
criterion. Every other active unit that carries a `Live` set is undischarged. S26 takes the
script units, S27 the two large documents the pass never reached, S28 and S29 the commands,
split where one session's reading stops rather than at a threshold.

**Only S26 is about a unit near the bound.** After S25 the largest bounded closure is a script
unit at roughly five-sixths of the ceiling, and it is a script unit — the kind whose route is
unproven. Everything S27–S29 touches is comfortably inside the bound today and would stay there
for a while untouched. They are here because the commission is *every* unit and because a `Live`
set that is a history grows with every decision, not because any of them is about to breach; a
reader deciding how much of this set to schedule should decide on that basis.

**S23–S25 have landed** and their bodies are still below rather than in the `## Landed` index,
because no command performs the retirement § *How this document is kept* describes
([#120](../../issues/120)). This re-run appends and does not retire, so the state is unchanged
and is named here rather than left to be rediscovered.

**Only the pass is sliced here — still.** The 2026-08-31 decision has two halves, and the other
one — a divergence class, reported and never blocking, flagging a `Live` decision whose terms
appear to already stand in the unit it is live on — is `/contract`'s, at `opus`/`high`, and has
**not landed**: the class list in § *The divergence classes* does not carry it. No slice below
implements it, because no slice may introduce a signature the contract does not contain. Until it
lands nothing stops any emptied `Live` set from refilling, which is the standing half of the
defect and is the user's to schedule. Three passes now rest on it rather than one.

**What is deliberately left, and why, so the residue is a judgement rather than a remainder.**
Five script units — `invoke-codexcommand`, `invoke-donehousekeeping`, `measure-session`,
`sync-kit`, `test-writesurface` — expose no contract and have a `.ps1` for an artifact, so no
site in their reach resolves to a heading and their `Live` sets cannot be absorbed at all. That
is a limit of the mechanism rather than a slice's omission; it is in `design/90-decisions.md`
§ *Open* for `/track` to file. The residues S24 and S25 themselves adjudicated and left are not
revisited by anything below — they were decided with reasons on the record, and re-walking a
decided residue is relitigation, not a pass.

The two notes at the end of this section outlive any one set and are kept for whatever is
appended.

### S23 — The ceiling reports what can be shrunk, separately from what cannot
Delivers: anyone running the design-state check sees, for each part of the kit, how much of its
          reading load the project can actually do something about — stated separately from the
          size of the document or script itself, which nobody can shrink and which used to
          swamp the number. Sixteen parts currently look over budget for reasons no one could
          act on; afterwards the report names only the ones somebody can fix.
Touches: `tools/Test-DesignState.ps1` (`Get-DesignClosure`, `Test-ClosureBudget`, and the report
         line), `tools/Test-DesignState.Tests.ps1`, `design/state/invariants/I23.md`,
         `design/20-contract.md` § *Invariants* (the generated region, regenerated — never
         hand-edited), `design/cost.md`
Depends on: none
Acceptance:
  - S23.1 `Get-DesignClosure` returns records only: for a unit root whose `Anchor` is a tree
    path, the returned member set is identical to the set returned for the same root with the
    `Anchor` removed, and no member carries `Kind = 'Artifact'`.
  - S23.2 The unit's own artifact is measured separately from the closure, by byte length of the
    file its `Anchor` names. A unit whose `Anchor` names a path not in the tree yields `0` for
    that figure and raises no finding for it — S19.6's behaviour, preserved under the new
    arrangement rather than deleted with the case that asserted it.
  - S23.3 A `ClosureOverBudget` finding's detail carries four parts — the unit, its bounded
    size, its largest contributor, and that unit's own artifact size — with the artifact figure
    named separately and never added into the bounded one.
  - S23.4 The largest contributor named in a `ClosureOverBudget` finding is a record id. No
    finding names a tree path there, on this repository or on a fixture.
  - S23.5 The report line names the largest **bounded** closure, its unit, its largest
    contributor, and that unit's own artifact size, and renders on a clean run as well as on a
    failing one.
  - S23.6 Against this repository the check exits 1, `CouldNotEvaluate` is empty,
    `ClosureOverBudget` is the only class present in `Findings`, and **every** breach names a
    record rather than a tree path as its largest contributor — which is the property that makes
    each one absorption-remediable. The S12.5 and S18.6 cases assert this in place of the
    artifact-dominance they assert today.
  - S23.7 `design/state/invariants/I23.md` carries `Enforcement: code` with `Evidence` naming
    `tools/Test-DesignState.Tests.ps1`, § *Invariants* is regenerated from it rather than
    hand-edited, and `EnforcementUnevidenced` stays silent.
  - S23.8 `design/cost.md` § *Closure sizes under the records-bounded definition* carries a
    measured run of the amended meter, at a named commit, replacing the derived table that
    section marks as superseded by exactly this slice.
  - S23.9 Every S19 case asserting the artifact-inclusive definition either asserts the
    records-bounded one or is removed, and none is left asserting a rule the contract has
    dropped — the failure mode `design/20-contract.md` records against the 2026-08-29 amendment,
    not repeated here.
Out of scope: absorbing any decision or editing any unit's `Live` set (S24 and S25); changing
              16,384; the reported class the 2026-08-31 decision commissions from `/contract`;
              and `SiteOutOfReach`, which computes reach independently of `Get-DesignClosure`
              and must keep reaching the unit's own artifact after the bound stops counting it.

### S24 — The agent contract stops making every session read its own history
Delivers: someone — or something — starting work on the repository's agent contract loads the
          rules in force and not the twenty-five past decisions that produced them, because each
          decision whose terms are already written into the contract now points at the section
          that holds them instead of being carried alongside it.
Touches: `design/state/units/document/agents-md.md` and its retired companion,
         `design/state/decisions/*.md` (`StatedIn`), `design/state-index.md` (regenerated)
Depends on: S23
Acceptance:
  - S24.1 Every decision in `unit/document/agents-md`'s `Live` whose terms already stand in a
    named section of `AGENTS.md` carries a `StatedIn` site naming that section, and its id is
    absent from `Live`. Both edits are in the same commit — a site named without the id dropped
    saves nothing, and an id dropped without a site is `DecisionUnplaced`.
  - S24.2 A decision whose terms do **not** stand in `AGENTS.md` keeps its `Live` id and gains no
    site. The slice's pull request names each one it left and why, so the residue is a stated
    judgement rather than an unexplained remainder.
  - S24.3 `SiteAmbiguous`, `SiteOutOfReach`, and `SiteContradictsLive` are all silent: every site
    added resolves to exactly one heading in `AGENTS.md`, names a place that unit's reader
    already reaches, and belongs to no decision still live on that unit.
  - S24.4 `DecisionUnplaced` is silent after the pass — a decision removed from `Live` is placed
    by its site, which is the whole reason the two edits are one commit.
  - S24.5 The checker reports no `ClosureOverBudget` finding for `unit/document/agents-md`.
    Clearing it needs roughly 2,900 of the roughly 17,000 bytes its `Live` carries today, so the
    criterion is met well before every candidate is absorbed and does not depend on absorbing
    one whose terms are not really there.
  - S24.6 No sentence of `AGENTS.md` changes. Absorption names a section that already states the
    claim; writing the claim in to make a site resolve is the thing this pass must not do.
Out of scope: `unit/document/design-20-contract`'s `Live` set (S25); any edit to `AGENTS.md`
              itself; any change to the meter (S23); and the reported class.

### S25 — The interface contract stops making every session read its own history
Delivers: the same for the repository's interface contract, whose twenty live decisions took it
          over the reading budget for the first time on 2026-08-31 — and, with it, the first run
          in which the whole kit reports itself inside the budget it set.
Touches: `design/state/units/document/design-20-contract.md` and its retired companion,
         `design/state/decisions/*.md` (`StatedIn`), `design/state-index.md` (regenerated)
Depends on: S23, and S24 for the pattern rather than for anything it changes
Acceptance:
  - S25.1 Every decision in `unit/document/design-20-contract`'s `Live` whose terms already stand
    in a named section of `design/20-contract.md` carries a `StatedIn` site naming that section,
    and its id is absent from `Live` — both in one commit, as S24.1.
  - S25.2 A decision whose terms do not stand there keeps its `Live` id and gains no site, and
    the pull request names each one and why.
  - S25.3 `SiteAmbiguous`, `SiteOutOfReach`, `SiteContradictsLive`, and `DecisionUnplaced` are
    all silent.
  - S25.4 The checker reports **zero** `ClosureOverBudget` findings against this repository, and
    exits 0 with `CouldNotEvaluate` empty.
  - S25.5 `verify.yml`'s design-state step passes on this repository, and the pull request states
    the commit — the first green run of that gate since `4d06246`. The claim is made from a run
    that was watched, never from a merge.
  - S25.6 No sentence of `design/20-contract.md` changes, on S24.6's rule.
Out of scope: `unit/document/agents-md` (S24); relaxing 16,384 or widening the exclusion past
              the unit's own artifact, either of which the brief's *Abandonment* line names as
              the relaxation it forbids; and the reported class, whose absence is what leaves
              these `Live` sets free to refill.

### S26 — The checking scripts stop carrying the arguments that produced them
Delivers: someone opening the kit's own checking scripts to change one reads what that script
          guarantees today, instead of the run of past arguments that settled it — and the part
          of the kit that sits closest to its own reading budget gets some room back before it
          runs out again. It is also the first time this is done for a script at all, which is
          the part nobody has yet shown works.
Touches: `design/state/units/script/*.md` (`Live`), `design/state/decisions/*.md` (`StatedIn`),
         `design/state-index.md` (regenerated)
Depends on: none
Acceptance:
  - S26.1 For every active `script` unit that names a contract in `Exposes`: each decision in
    that unit's `Live` whose terms already stand under a named heading of that contract's record
    carries a `StatedIn` site of the form `contract/<slug> § <heading>`, and its id is absent
    from `Live`. Both edits are in the same commit, on S24.1's rule — a site named without the
    id dropped saves nothing, and an id dropped without a site is `DecisionUnplaced`.
  - S26.2 A decision whose terms do **not** stand in that contract record keeps its `Live` id and
    gains no site. The pull request names each one it left and why, so the residue is a stated
    judgement rather than an unexplained remainder.
  - S26.3 `SiteAmbiguous`, `SiteOutOfReach`, `SiteContradictsLive`, and `DecisionUnplaced` are
    all silent after the pass.
  - S26.4 No sentence of any contract record's `Semantics` changes, and no `tools/*.ps1` changes.
    Absorption names a place that already states the claim; writing the claim in to make a site
    resolve is the thing this pass must not do (S24.6's rule, applied to the site kind this slice
    uses).
  - S26.5 A script unit that exposes no contract is left exactly as found — same `Live` ids
    before and after, and no decision anywhere gains a site naming it. Such a unit has a `.ps1`
    for an artifact and no contract record within reach, so every site it could be given would
    resolve to zero headings; the tempting repair is to give it a contract, and that is
    `/contract`'s and not this slice's.
  - S26.6 The checker reports zero `ClosureOverBudget` findings and exits 0 with
    `CouldNotEvaluate` empty — the state S25 reached, preserved rather than merely approached.
  - S26.7 `unit/script/test-designstate`'s bounded closure is lower after the pass than before
    it, and the pull request states both figures with the commit each was taken at. **No target
    number is set here**, deliberately: a byte target is exactly what would buy an absorption of
    a decision whose terms are not really in the record, which S26.4 forbids.
Out of scope: the script units that expose no contract (S26.5); document and command units
              (S27–S29); the residues S24 and S25 adjudicated and left, which are decided and
              not this slice's to reopen; the reported class the 2026-08-31 decision commissions
              from `/contract`; the `StatedIn` comma-grammar limit
              ([#203](../../issues/203)), which is also `/contract`'s; and any edit to
              `design/20-contract.md`.

### S27 — The architecture document and the installation guide stop carrying theirs
Delivers: someone opening the kit's architecture document, or the guide that installs it into a
          repository, meets the design in force rather than the decisions that produced it — the
          same relief the agent contract and the interface contract already got, for the two
          remaining documents nobody has done it to.
Touches: `design/state/units/document/design-10-design.md`,
         `design/state/units/document/install-md.md`, `design/state/decisions/*.md`
         (`StatedIn`), `design/state-index.md` (regenerated)
Depends on: S26 for nothing it changes; the two are independent and may land in either order
Acceptance:
  - S27.1 Every decision in `unit/document/design-10-design`'s or `unit/document/install-md`'s
    `Live` whose terms already stand in a named section of `design/10-design.md` or `INSTALL.md`
    respectively carries a `StatedIn` site naming that section, and its id is absent from `Live`
    — both in one commit, as S24.1.
  - S27.2 A decision whose terms do not stand there keeps its `Live` id and gains no site, and
    the pull request names each one and why.
  - S27.3 `SiteAmbiguous`, `SiteOutOfReach`, `SiteContradictsLive`, and `DecisionUnplaced` are
    all silent.
  - S27.4 No sentence of `design/10-design.md` or `INSTALL.md` changes, on S24.6's rule.
  - S27.5 The checker reports zero `ClosureOverBudget` findings and exits 0 with
    `CouldNotEvaluate` empty.
  - S27.6 Both units' bounded closures are lower after than before, with all four figures and
    their commits in the pull request — S26.7's rule, and no target number for the same reason.
Out of scope: script units (S26) and command units (S28, S29); `unit/document/agents-md` and
              `unit/document/design-20-contract`, whose residues are adjudicated; every other
              `document` unit, none of which is near the bound and each of which carries one or
              two `Live` ids; the reported class; and [#203](../../issues/203).

### S28 — The six commands that carry the most history stop carrying it
Delivers: anyone opening the kit's busiest commands — the ones that track work, cut a slice, fix
          a defect, take a pull request to merge-ready, tidy branches, and install across every
          repository — reads what the command does now rather than the decisions that shaped it.
Touches: `design/state/units/command/track.md`, `.../slice.md`, `.../fix.md`, `.../pr.md`,
         `.../clean.md`, `.../install-all.md`, `design/state/decisions/*.md` (`StatedIn`),
         `design/state-index.md` (regenerated)
Depends on: none
Acceptance:
  - S28.1 For each of `unit/command/track`, `slice`, `fix`, `pr`, `clean`, and `install-all`:
    every decision in that unit's `Live` whose terms already stand in a named section of the
    command file its `Anchor` names carries a `StatedIn` site naming that section, and its id is
    absent from `Live` — both in one commit, as S24.1.
  - S28.2 A decision whose terms do not stand there keeps its `Live` id and gains no site, and
    the pull request names each one and why.
  - S28.3 `SiteAmbiguous`, `SiteOutOfReach`, `SiteContradictsLive`, and `DecisionUnplaced` are
    all silent.
  - S28.4 No sentence of any file under `.claude/commands/` changes, on S24.6's rule. A command
    file is executable instruction, so writing a claim into one to make a site resolve changes
    what the command does — which is why this slice touches records only.
  - S28.5 The checker reports zero `ClosureOverBudget` findings and exits 0 with
    `CouldNotEvaluate` empty.
  - S28.6 Each of the six units' bounded closures is lower after than before, with the figures
    and commits in the pull request — S26.7's rule, and no target number for the same reason.
Out of scope: the twelve remaining command units (S29); script and document units (S26, S27);
              any edit to a command file; the reported class; and [#203](../../issues/203).

### S29 — The rest of the commands stop carrying theirs, and the pass is discharged
Delivers: the same for every remaining command in the kit, after which no part of the kit is
          still asking a reader to work through its own history to find out what it currently
          does — except the handful the mechanism cannot reach at all, which this slice names
          rather than quietly skips.
Touches: the remaining `design/state/units/command/*.md` records, `design/state/decisions/*.md`
         (`StatedIn`), `design/state-index.md` (regenerated)
Depends on: S28 for the pattern rather than for anything it changes
Acceptance:
  - S29.1 Every active `command` unit not covered by S28 is walked on S28.1's rule: a decision in
    its `Live` whose terms stand in a named section of its command file gains a `StatedIn` site
    and loses its `Live` id, in one commit.
  - S29.2 A decision whose terms do not stand there keeps its `Live` id and gains no site, and
    the pull request names each one and why.
  - S29.3 `SiteAmbiguous`, `SiteOutOfReach`, `SiteContradictsLive`, and `DecisionUnplaced` are
    all silent.
  - S29.4 No sentence of any file under `.claude/commands/` changes, on S28.4's rule.
  - S29.5 The checker reports zero `ClosureOverBudget` findings and exits 0 with
    `CouldNotEvaluate` empty.
  - S29.6 The pull request states, as one list, every unit across S26–S29 whose `Live` set is
    non-empty at the end of the pass and the reason for each — terms not stated, no reachable
    site, or a residue S24 or S25 adjudicated. That list is what makes the commission's
    discharge checkable, and it is the last thing this set produces.
Out of scope: the six units S28 covers; script and document units; any edit to a command file;
              the reported class, whose absence is what leaves every set this pass empties free
              to refill; and [#203](../../issues/203).

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

## Landed

| Slice | Name | Issue | Criteria | Body complete at |
|---|---|---|---|---|
| **S1** | Wait for a pull request's checks against a named commit | [#9](../../issues/9), closed | S1.1–S1.10 | `af610a6` |
| **S2** | One approval covers push, pull request, and the threads it names | [#10](../../issues/10), closed | S2.1–S2.9 | `af610a6` |
| **S3** | A defect that is not a slice gets a front door | [#11](../../issues/11), closed | S3.1–S3.14 | `af610a6` |
| **S4** | The state set becomes readable, and today's cost goes on the record | [#47](../../issues/47), closed | S4.1–S4.11 | `45bd7c8` |
| **S5** | The checker, and the ceiling is either met or the project stops | [#48](../../issues/48), closed | S5.1–S5.13 | `45bd7c8` |
| **S6** | The marked-region rule is stated once, and `companion` says it is hand-written | [#49](../../issues/49), closed | S6.1–S6.7 | `45bd7c8` |
| **S7** | Prose regions that regenerate, and prove they both overwrite and preserve | [#50](../../issues/50), closed | S7.1–S7.12 | `45bd7c8` |
| **S8** | Every command in the kit has a record | [#51](../../issues/51), closed | S8.1–S8.6 | `45bd7c8` |
| **S9** | Every script and standing document has a record | [#52](../../issues/52), closed | S9.1–S9.6 | `45bd7c8` |
| **S10** | Every invariant has a record, and the contract's table is generated from them | [#53](../../issues/53), closed | S10.1–S10.6 | `45bd7c8` |
| **S11** | Every logged decision has a record, and open questions become addressable | [#54](../../issues/54), closed | S11.1–S11.8 | `45bd7c8` |
| **S12** | The check runs in CI, and has rejected one of every blocking class | [#55](../../issues/55), closed | S12.1–S12.6 | `45bd7c8` |
| **S13** | Commands orient from the record, and keep working where there is none | [#56](../../issues/56), closed | S13.1–S13.6 | `45bd7c8` |
| **S14** | Work state: a mirror that says when it was taken | [#57](../../issues/57), closed | S14.1–S14.8 | `45bd7c8` |
| **S15** | The installed repositories keep working, and the cost is settled | [#58](../../issues/58), closed | S15.1–S15.6 | `45bd7c8` |
| **S16** | Every part says what it offers and what it leans on | [#71](../../issues/71), closed | S16.1–S16.7 | `45bd7c8` |
| **S17** | Every rule the kit binds itself to becomes a file | [#72](../../issues/72), closed | S17.1–S17.7 | `45bd7c8` |
| **S18** | A record that says a claim was replaced has to say what replaced it | [#81](../../issues/81), closed | S18.1–S18.6 | `45bd7c8` |
| **S19** | The ceiling counts the file a session actually opens | [#171](../../issues/171), closed | S19.1–S19.6 | `7d27606` |
| **S20** | A unit's retired half moves to its own file | [#172](../../issues/172), closed | S20.1–S20.10 | `7d27606` |
| **S21** | A rule written into a document stops being carried twice | [#173](../../issues/173), closed | S21.1–S21.6 | `7d27606` |
| **S22** | Every decision says which parts of the kit it is in force for | [#174](../../issues/174), closed | S22.1–S22.7 | `c11f60c` |

What each delivered, in one line, because the index is the only place a reader now meets
them:

- **S1** — `tools/Wait-PullRequestCheck.ps1`, which watches a pull request's checks against a
  named head SHA and refuses to answer at all if someone pushed while it was watching.
- **S2** — one approval covering push, pull-request update, and the exact review threads it
  names, in `AGENTS.md` and `.claude/commands/resolve.md`.
- **S3** — `/fix`, the entry point for a defect that has no slice: reproduce, get to a bug
  issue, branch, fix, hand off to the same single approval.
- **S4** — `tools/Read-DesignState.ps1`, which parses `design/state/` into a graph and reports
  every unparseable line by file, line number, and byte-for-byte text, plus `design/cost.md`'s
  before-measurement baseline.
- **S5** — `tools/Test-DesignState.ps1`, the checker: three separate lists (findings, reports,
  could-not-evaluate), and the closure-size report that proved the 16,384-byte ceiling was met.
- **S6** — the marked-region rule stated once, in `AGENTS.md`; every command file's `companion`
  block converted to the declared form and `tools/Test-Companion.ps1` enforcing it.
- **S7** — `tools/Update-DesignProjection.ps1`, which regenerates projected regions in place,
  proven by test to overwrite inside a region and leave everything outside one untouched.
- **S8** — a `design/state/units/command/` record for every command in the kit.
- **S9** — `design/state/units/script/` and `units/document/` records for every script and
  standing document.
- **S10** — `design/state/units/invariant/` records for every invariant, with
  `design/20-contract.md` § *Invariants* rendered from them rather than kept by hand.
- **S11** — `design/state/decisions/` and `design/state/questions/` records for every logged
  decision and open question.
- **S12** — `tools/Test-DesignState.ps1` wired into `verify.yml`, failing the build on exit 1
  or 2, with every blocking class proven to fire on a real divergence and stay silent on a
  near-miss.
- **S13** — every command that establishes what is currently true about a part of the kit
  states that it reads that unit's closure, and behaves exactly as before wherever
  `design/state/` is absent.
- **S14** — `tools/Update-WorkMirror.ps1`, a `MirroredAt`-stamped mirror of outstanding work
  that only `/track` writes.
- **S15** — every installed target keeps working with the new scripts shipped and honestly
  reporting nothing there to check, and the before/after cost measurement is on the record in
  `design/cost.md`.
- **S16** — `design/state/contracts/` records for every public surface, with `Consumes`/
  `Exposes` edges recovered by set difference and rendered into `design/state-index.md`'s
  `consumers` region.
- **S17** — `design/state/invariants/` records for every row of `design/20-contract.md`
  § *Invariants*, which becomes a single generated region rather than half hand-kept.
- **S18** — `EnforcementUnevidenced` widened to catch a superseded decision or an answered
  question that names nothing as having replaced or answered it.
- **S19** — the closure meter counts a unit's own artifact bytes alongside its records,
  proving on this repository's own corpus that the artifact dominates the ceiling by roughly
  five to one, which the brief's *Abandonment* clause leaves for the user to adjudicate.
- **S20** — a `retired/` companion file beside each unit's active record, `RecordPairMalformed`,
  `HalfStatusMismatch`, and `HalfOverlap` policing the pairing, and the closure meter no longer
  filtering on `Status` or `Archival`.
- **S21** — `Decision.StatedIn`, resolving a rule written into a document back to where it
  stands, with `SiteAmbiguous`, `SiteOutOfReach`, and `SiteContradictsLive` policing it, and one
  real absorption landed against `AGENTS.md`.
- **S22** — `Decision.Affects` and `Question.Affects` derived from the unit edges and the
  `StatedIn` sites that reach them, with `DecisionUnplaced` reporting a decision no part of
  the kit claims as an interrupted write, and `SupersessionCycle` catching a chain that
  never terminates.
