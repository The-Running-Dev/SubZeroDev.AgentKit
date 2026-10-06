# Slices

> Rewritten 2026-10-04 (#436). Slices S1–S32 landed under the earlier design-state mechanism and
> are kept as the `## Landed` index at the end of this file, which is history, not a queue. Their
> full bodies are `git show c3a9577:design/30-slices.md`.

A slice is a `## S<n> — <name>` heading with a `Status: todo | done` line. `/next` takes the
first slice whose `Status:` is not `done` and whose `Depends on:` are all done, builds it through
merge, and sets `Status: done` in that slice's own pull request. Anything that is not a `## S<n>`
heading — this preamble, the `## Landed` table — is never a slice and is never rebuilt.
`/plan` appends new slices after the last one; ids are never reused or renumbered.

## S33 — A design check the agent runs and keeps passing itself
Status: done
Delivers: `tools/test-design.ts` (first written as `Test-Design.ps1`, ported in S34), a read-only check that the facts `design/`, the command files
and the agent contract state about the tree are true. CI runs it on every pull request, and
`/next` runs it before each pull request and once more when the plan is finished, so keeping it
green is part of the agent's normal work and never the user's.
Touches: `tools/test-design.ts`, `tools/test-design.test.ts`, `.github/workflows/verify.yml`,
`skills/next/SKILL.md`, `.claude/verify-report.json`
Depends on: none
Acceptance:
  - S33.1 A `tools/<path>` cited in `AGENTS.shared.md`, `AGENTS.md`, a `skills/*/SKILL.md`, or
    the live part of `design/00`–`30` (everything above `## Landed`) that exists neither in the
    repository nor in the kit is a `MissingTool` finding naming the file and line.
  - S33.2 A backticked `/<name>` or `/agentkit:<name>` that is neither a skill in the repository
    or the kit nor a host command on the script's own list is an `UnknownCommand` finding.
  - S33.3 Where `design/20-contract.md` has a `## Scripts` table: a script it lists that does not
    exist is `MissingScript`; a parameter it lists that the script does not declare is
    `UnknownParameter`; a parameter the script declares that its row does not list is
    `UnlistedParameter` (a row reading "see the script" is exempt from both parameter checks);
    a `tools/*.ps1` other than a `*.Tests.ps1` that no row lists is `UnlistedScript`.
  - S33.4 Where `design/20-contract.md` has a `## Commands` table: a `skills/<name>/SKILL.md` with
    no row is `UnlistedCommand`, and a row with no skill is `MissingCommand`.
  - S33.5 In `design/30-slices.md` above `## Landed`: a `## S<n>` heading without
    `Status: todo` or `Status: done` is `MissingStatus`; a slice id used twice is
    `DuplicateSlice`; a `Depends on:` naming a slice that is neither a heading nor in the
    Landed index is `UnknownDependency`.
  - S33.6 It never writes: `git status` is unchanged by a run. Exit 0 with no findings, 1 with
    findings, 2 when there is no `design/` to check.
  - S33.7 A `# verification: true` step in the `powershell` CI job runs it, and this repository
    passes it at merge.
  - S33.8 `/next` runs it in step 3. A finding the slice's own change caused is fixed in that
    pull request; a finding in design prose goes in *Differs from design* and does not stop the
    run; when the plan is finished, any findings still open are filed as one GitHub issue.
Out of scope: editing `design/` to clear a finding (that is `/align`); judging whether prose
describes behaviour correctly; restoring the design-state records, projections or per-slice
issues.

## S34 — The kit runs on Node and TypeScript, with no PowerShell
Status: done
Delivers: every script under `tools/` and the installer (`setup.ts`, `tools/install-agentkit.ts`)
ported from PowerShell to Node >= 22.18 running TypeScript directly, with no runtime
dependencies, verified on Windows, Linux and macOS. Recorded after the fact (#444–#456, released
as `v2026.10.06`); this slice was commissioned directly and not built through `/next`.
Touches: `tools/`, `setup.ts`, `.github/workflows/verify.yml`, `README.md`, `INSTALL.md`,
`skills/`, `design/`.
Depends on: S33
Acceptance:
  - S34.1 Every script in the contract's *Scripts* table is a `.ts` file under `tools/` (or
    `setup.ts`) with a test beside it, and no `.ps1` file remains in the tree.
  - S34.2 `verify.yml` runs typecheck, the no-runtime-dependency check, the Node tests and the
    no-attribution check on `node-windows`, `node-linux` and `node-macos`, and Windows and Linux
    on both Node 22.18 and 24. The `videos` job still runs.
  - S34.3 A fresh `node setup.ts` with no `--version` resolves the newest stable tag and its
    reported commit is the release commit (checked for `v2026.10.06`: Claude, Codex and Copilot,
    no collisions, `--verify` returns `OK`).
  - S34.4 An old Node is refused with the AgentKit message before any TypeScript loads.
  - S34.5 The installer no longer rolls a failed install back and carries no PowerShell bridge or
    legacy-upgrade path; an install whose root is not a current AgentKit checkout is refused
    ("not an AgentKit checkout").
Out of scope: changing what any script reports beyond the parity fixes in #454; the
`design/20-contract.md` text of S33's done criteria, which still names `Test-Design.ps1` and the
`powershell` CI job and is left as written.

## Landed

| Slice | Name | Issue | Criteria | Body complete at |
|---|---|---|---|---|
| **S1** | Wait for a pull request's checks against a named commit | [#9](../../issues/9), closed | S1.1–S1.10 | `6ea1296` |
| **S2** | One approval covers push, pull request, and the threads it names | [#10](../../issues/10), closed | S2.1–S2.9 | `6ea1296` |
| **S3** | A defect that is not a slice gets a front door | [#11](../../issues/11), closed | S3.1–S3.14 | `6ea1296` |
| **S4** | The state set becomes readable, and today's cost goes on the record | [#47](../../issues/47), closed | S4.1–S4.11 | `79509d1` |
| **S5** | The checker, and the ceiling is either met or the project stops | [#48](../../issues/48), closed | S5.1–S5.13 | `79509d1` |
| **S6** | The marked-region rule is stated once, and `companion` says it is hand-written | [#49](../../issues/49), closed | S6.1–S6.7 | `79509d1` |
| **S7** | Prose regions that regenerate, and prove they both overwrite and preserve | [#50](../../issues/50), closed | S7.1–S7.12 | `79509d1` |
| **S8** | Every command in the kit has a record | [#51](../../issues/51), closed | S8.1–S8.6 | `79509d1` |
| **S9** | Every script and standing document has a record | [#52](../../issues/52), closed | S9.1–S9.6 | `79509d1` |
| **S10** | Every invariant has a record, and the contract's table is generated from them | [#53](../../issues/53), closed | S10.1–S10.6 | `79509d1` |
| **S11** | Every logged decision has a record, and open questions become addressable | [#54](../../issues/54), closed | S11.1–S11.8 | `79509d1` |
| **S12** | The check runs in CI, and has rejected one of every blocking class | [#55](../../issues/55), closed | S12.1–S12.6 | `79509d1` |
| **S13** | Commands orient from the record, and keep working where there is none | [#56](../../issues/56), closed | S13.1–S13.6 | `79509d1` |
| **S14** | Work state: a mirror that says when it was taken | [#57](../../issues/57), closed | S14.1–S14.8 | `79509d1` |
| **S15** | The installed repositories keep working, and the cost is settled | [#58](../../issues/58), closed | S15.1–S15.6 | `79509d1` |
| **S16** | Every part says what it offers and what it leans on | [#71](../../issues/71), closed | S16.1–S16.7 | `79509d1` |
| **S17** | Every rule the kit binds itself to becomes a file | [#72](../../issues/72), closed | S17.1–S17.7 | `79509d1` |
| **S18** | A record that says a claim was replaced has to say what replaced it | [#81](../../issues/81), closed | S18.1–S18.6 | `79509d1` |
| **S19** | The ceiling counts the file a session actually opens | [#171](../../issues/171), closed | S19.1–S19.6 | `099c5e7` |
| **S20** | A unit's retired half moves to its own file | [#172](../../issues/172), closed | S20.1–S20.10 | `099c5e7` |
| **S21** | A rule written into a document stops being carried twice | [#173](../../issues/173), closed | S21.1–S21.6 | `099c5e7` |
| **S22** | Every decision says which parts of the kit it is in force for | [#174](../../issues/174), closed | S22.1–S22.7 | `1331713` |
| **S23** | The ceiling reports what can be shrunk, separately from what cannot | [#193](../../issues/193), closed | S23.1–S23.9 | `908d727` |
| **S24** | The agent contract stops making every session read its own history | [#194](../../issues/194), closed | S24.1–S24.6 | `908d727` |
| **S25** | The interface contract stops making every session read its own history | [#195](../../issues/195), closed | S25.1–S25.6 | `908d727` |
| **S26** | The checking scripts stop carrying the arguments that produced them | [#207](../../issues/207), closed | S26.1–S26.7 | `908d727` |
| **S27** | The architecture document and the installation guide stop carrying theirs | [#208](../../issues/208), closed | S27.1–S27.6 | `908d727` |
| **S28** | The six commands that carry the most history stop carrying it | [#209](../../issues/209), closed | S28.1–S28.6 | `908d727` |
| **S29** | The rest of the commands stop carrying theirs, and the pass is discharged | [#210](../../issues/210), closed | S29.1–S29.6 | `908d727` |
| **S30** | The check names the one thing that can quietly undo an absorption | [#222](../../issues/222), closed | S30.1–S30.7 | `c642571` |
| **S31** | An invariant stops naming one owner, and says who holds it however many do | [#285](../../issues/285), closed | S31.1–S31.8 | `e42c6c2` |
| **S32** | A project made of assemblies, modules or packages can record them as parts of its design | [#286](../../issues/286), closed | S32.1–S32.8 | `e42c6c2` |

What each delivered, in one line, because the index is the only place a reader now meets
them:

- **S1** — `tools/Wait-PullRequestCheck.ps1`, which watches a pull request's checks against a
  named head SHA and refuses to answer at all if someone pushed while it was watching.
- **S2** — one approval covering push, pull-request update, and the exact review threads it
  names, in `AGENTS.md` and `skills/resolve/SKILL.md`.
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
- **S23** — `Get-DesignClosure` stops counting a unit's own artifact, `Get-UnitArtifactBytes`
  measures it separately, and every `ClosureOverBudget` finding names a record — never a tree
  path — as its largest contributor, which is what makes a breach absorption-remediable.
- **S24** — eleven of `unit/document/agents-md`'s `Live` decisions gain a `StatedIn` site into
  `AGENTS.md` and leave `Live`, dropping its closure from 19,207 to 10,873 bytes and clearing
  `ClosureOverBudget` for it.
- **S25** — ten of `unit/document/design-20-contract`'s twenty `Live` decisions absorb into
  `design/20-contract.md`, and the design-state check reports zero findings and exits 0 against
  this repository for the first time since `da3da03`.
- **S26** — the first absorption pass against a script unit: `test-companion`,
  `update-workmirror`, and one of `test-designstate`'s seven `Live` decisions gain a
  `contract/<slug> § Semantics` site; the five script units with no contract are proven
  unreachable and left as found.
- **S27** — `unit/document/design-10-design` and `unit/document/install-md` absorb against
  `design/10-design.md` and `INSTALL.md`'s own headings; `install-md`'s `Live` set empties
  entirely.
- **S28** — `track`, `slice`, `fix`, `pr`, `clean`, and `install-all` absorb against their own
  command files' headings, each of the six units' bounded closure lower after than before.
- **S29** — the remaining twelve command units absorb on the same rule, discharging the
  2026-08-31 commission for every unit the mechanism can reach; the pull request states, unit
  by unit, every `Live` set still non-empty and why.
