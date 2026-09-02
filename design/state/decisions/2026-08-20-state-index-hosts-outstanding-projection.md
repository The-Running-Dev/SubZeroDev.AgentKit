# decision/2026-08-20-state-index-hosts-outstanding-projection
Date: 2026-08-20
Anchor: 2026-08-20 — `outstanding` renders into `design/state-index.md`, superseding the state-index decision
Status: accepted
StatedIn: unit/document/design-20-contract § `tools/Update-DesignProjection.ps1`

## Claim
`design/state-index.md` holds six projections as separate marked regions — `units`, `bound-by`, `consumers`, `decision-affects`, `question-affects` and `outstanding` — beside `design/state/` rather than inside it, so `Read-DesignState.ps1`'s recursive scan does not trip over it. `outstanding` renders the outstanding work, its order and each item's criteria from the `WorkRef` mirrors; `design/30-slices.md` § *Outstanding* stays hand-authored and carries proposals, which authority transfer makes a different thing from criteria.
