# contract/test-designstate
Status: active
Owner: unit/script/test-designstate
Declaration: tools/Test-DesignState.ps1

## Semantics
Emits three lists — findings, reports, and what could not be evaluated — always all three,
including when one is empty. Exit codes: 0 clean, 1 findings, 2 could not evaluate, and 2 takes
precedence over 1 (I20). `closure(U)` excludes the unit's own artifact (I23); that artifact is
measured separately, is never bounded, and is named beside the bounded figure on every run.
Always names the largest closure, the unit it belongs to, its largest contributor and that
unit's artifact size, on a clean run as well as a failing one, as a report line rather than a
finding. Never clean on an absent or
empty state set (I19). Regenerates before comparing, by invoking the projector with `-DryRun`.
Normalises line endings before comparing and normalises nothing else. Writes nothing (I18) — not
`design/`, not a record, not an issue, not git. `-Path` is optional and defaults to the
repository root; no `-Fix`, no `-Force`, and no flag that resolves anything.

Declares `LiveAlreadyStated` in its reported class list and never raises it: whether a decision's
terms already stand at a site is a model reading prose, the ground `SemanticDisagreement` already
stands on, not a comparison this script performs. Declaring the id without raising it is what
lets `ClassListDisagreement` see one list against `design/20-contract.md`'s copy.
