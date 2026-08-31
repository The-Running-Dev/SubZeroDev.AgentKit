# decision/2026-08-31-self-check-asserts-adjudicated-findings
Date: 2026-08-31
Anchor: 2026-08-31 — The repository's own design-state self-check asserts its adjudicated finding set, not exit 0
Status: accepted
StatedIn: 

## Claim
`tools/Test-DesignState.Tests.ps1` S12.5 asserts that `CouldNotEvaluate` is empty, that `ClosureOverBudget` is the only finding class, that the exit code is 1, and that every breach names the unit's own artifact as its largest contributor — never that this repository exits 0, which `design/10-design.md` § *Whether the ceiling can be met* says is not true and is not going to be. S18.6 stops asserting a clean exit and keeps its `EnforcementUnevidenced` assertions. A unit breaching on its records rather than its artifact is not the adjudicated case and turns S12.5 red. This does not turn CI green: `ClosureOverBudget` blocks, the workflow step exits non-zero, and the build stays red until the brief's *Abandonment* clause is adjudicated by the user.
