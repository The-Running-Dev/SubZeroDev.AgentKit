# decision/2026-08-19-contract-becomes-repository-scoped
Date: 2026-08-19
Anchor: 2026-08-19 — `design/20-contract.md` becomes repository-scoped; the landed path's contract stands rather than being rewritten away
Status: accepted
StatedIn: unit/command/contract § Re-run

## Claim
`design/20-contract.md` widens to cover two paths at once — the landed defect-to-merge contract, unchanged, and the design-state mechanism contracted alongside it — because `design/00-brief.md` enumerates the landed path's thirteen invariants among the units whose design state must stay obtainable, and deleting them on a future `/contract` run would make that line unsatisfiable by construction. `.claude/commands/contract.md` § *Re-run* is corrected in the same commit to state the repository-scoped rule.
