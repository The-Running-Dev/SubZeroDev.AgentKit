# decision/2026-08-19-contract-owner-stays-written-other-edges-derived
Date: 2026-08-19
Anchor: 2026-08-19 — Two reverse edges become derived; `Contract.Owner` stays written and is checked
Status: accepted

## Claim
`Decision.Affects` and `Question.Affects` become derived, matching every other reverse edge; `Contract.Owner` stays written, being the one reverse edge a contract record must state about itself to be read alone, and becomes the checked kind via a new blocking class, `OwnerMismatch`, firing when a contract's `Owner` is not the unique active unit whose `Exposes` names it. I31 records the check and I17 widens to name all four derived fields; `decision-affects` and `question-affects` join the projection set so the dropped edges stay readable.
