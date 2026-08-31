# Slices

> **Three paths appear here.** The **defect-to-merge path** landed as S1–S3; its bodies are
> retired to the index under `## Landed` and its design body to
> `git show dfd1cab:design/10-design.md`. The **explicit design-state mechanism**, designed in
> the current `design/10-design.md` and contracted in `design/20-contract.md`, landed as
> S4–S18; its bodies are retired to the same index. The **2026-08-29 revision to that
> mechanism** — the retired companion, absorption, the half/status table, and the
> artifact-inclusive ceiling — landed as S19–S22, retired to the same index. Nothing
> remains under `## Outstanding`.

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

**Nothing.** The third set — S19–S22, implementing the 2026-08-29 revision the contract already
carried — has landed in full, and every slice this document has proposed is retired to
`## Landed` below. `ClassListDisagreement` is silent: the checker's declared class ids and this
document's contract list agree in both directions, which is what S22 closed.

`/slices` appends the next set here. The two notes below outlive any one set and are kept for
whatever is appended.

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
