# decision/2026-09-05-failure-modes-gets-the-missing-rows
Date: 2026-09-05
Anchor: 2026-09-05 — § *Failure modes* gets the eight missing rows rather than becoming a pointer
Status: accepted
StatedIn: unit/document/design-10-design § Failure modes

## Claim
`design/10-design.md` § *Failure modes* carries a row for every divergence class `design/20-contract.md` declares, stating the design's response and what a user sees rather than the class's blocking status, which the contract owns. The two documents both enumerate the class set and nothing compares them: this table is not a parsed source and `ClassListDisagreement` does not reach it, so its staleness costs a reader's understanding rather than a gate result.
