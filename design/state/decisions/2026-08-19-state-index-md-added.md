# decision/2026-08-19-state-index-md-added
Date: 2026-08-19
Anchor: 2026-08-19 — `design/state-index.md` is added as the home for five projections; the invariants table splits into a generated head and a hand-authored tail
Status: superseded
SupersededBy: decision/2026-08-20-state-index-hosts-outstanding-projection

## Claim
`design/state-index.md` holds the `units`, `bound-by`, `consumers`, `decision-affects` and `question-affects` projections as separate marked regions, sitting beside `design/state/` rather than inside it so `Read-DesignState.ps1`'s recursive scan does not trip over it. `design/20-contract.md`'s own § *Invariants* table is a single projected region with no hand-authored tail: the split this decision opened — a generated head above a canonical-copy area rows waited in — closed once every row had a record, and there is no area left for a row to wait in.
