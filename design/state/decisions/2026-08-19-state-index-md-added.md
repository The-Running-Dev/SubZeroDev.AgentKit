# decision/2026-08-19-state-index-md-added
Date: 2026-08-19
Anchor: 2026-08-19 — `design/state-index.md` is added as the home for five projections; the invariants table splits into a generated head and a hand-authored tail
Status: accepted

## Claim
`design/state-index.md` holds the `units`, `bound-by`, `consumers`, `decision-affects` and `question-affects` projections as separate marked regions, sitting beside `design/state/` rather than inside it so `Read-DesignState.ps1`'s recursive scan does not trip over it. `design/20-contract.md`'s own `## Invariants` table splits: rows with a written record move into a generated region at the top, and rows with none stay below as the canonical copy until a record exists for each.
