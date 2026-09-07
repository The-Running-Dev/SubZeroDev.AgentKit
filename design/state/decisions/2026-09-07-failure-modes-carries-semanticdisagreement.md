# decision/2026-09-07-failure-modes-carries-semanticdisagreement
Date: 2026-09-07
Anchor: 2026-09-07 — `design/10-design.md` § *Failure modes* carries `SemanticDisagreement`, and the residual narrows to one row
Status: accepted
StatedIn: unit/document/design-10-design § Failure modes

## Claim
`design/10-design.md` § *Failure modes* carries a row for every class the checker declares,
reported as well as blocking. The untrue-claim row names `SemanticDisagreement`'s disposition —
raised by a reading rather than by the script, reported and never blocking — rather than
recording the shape as undetected, and the residual-risk paragraph beneath it covers the
reworded-site row alone. § *Failure modes* is a third copy of the class list that
`ClassListDisagreement` does not reach, which compares only the checker's declared ids against
`design/20-contract.md`'s; a row there goes stale silently and by narrowing rather than by
absence.
