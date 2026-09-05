# decision/2026-09-05-self-check-asserts-a-clean-run
Date: 2026-09-05
Anchor: 2026-09-05 — The self-check asserts a clean run; the 2026-08-31 adjudicated-finding-set entry is superseded
Status: accepted

## Claim
`tools/Test-DesignState.Tests.ps1` S12.5/S25.4 asserts that this repository's own check reports an empty `CouldNotEvaluate`, no findings, and exit 0, and that `LargestClosure` names a unit and a positive size. S18.6 keeps its `EnforcementUnevidenced` assertions and filters only `ClosureOverBudget`. The adjudicated finding set the 2026-08-31 entry named — `ClosureOverBudget` alone, exit 1, every breach naming the unit's own artifact as its largest contributor — stopped existing at S23, which re-scoped the ceiling to exclude a unit's own artifact, and at S24 and S25, which absorbed the remaining record-dominated breaches. A breach of any class is now a real finding rather than a designed state.
