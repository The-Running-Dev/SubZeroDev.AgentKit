# contract/test-designstate
Status: active
Owner: unit/script/test-designstate
Declaration: tools/Test-DesignState.ps1

## Semantics
Emits three lists — findings, reports, and what could not be evaluated — always all three,
including when one is empty. Exit codes: 0 clean, 1 findings, 2 could not evaluate, and 2 takes
precedence over 1 (I20). Always names the largest closure and the unit it belongs to, on a clean
run as well as a failing one, as a report line rather than a finding. Never clean on an absent or
empty state set (I19). Regenerates before comparing, by invoking the projector with `-DryRun`.
Normalises line endings before comparing and normalises nothing else. Writes nothing (I18) — not
`design/`, not a record, not an issue, not git. `-Path` is optional and defaults to the
repository root; no `-Fix`, no `-Force`, and no flag that resolves anything.
