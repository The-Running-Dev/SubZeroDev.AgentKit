# decision/2026-09-12-277-amendment-stands-unimplemented
Date: 2026-09-12
Anchor: 2026-09-12 — The #277 amendment stands unimplemented, and the `component` row's interval hazard is named rather than hedged
Status: accepted
StatedIn:

## Claim
`design/10-design.md` and `design/20-contract.md` describe three behaviours the tree does not yet
have — an invariant with no `Owner`, § *Invariants*' `Held by` column, and a `component` glob cell
a target can fill without consequence. Neither document is wrong: the amendment leads the
implementation deliberately and the work is #277's. Nothing is hedged with a not-yet clause, because
a contract states what is contracted rather than what has shipped, and the one such clause worth
writing would name a status that rots on the commit that lands the slice. The hazard in the interval
is real and specific: a repository that fills the `component` cell as the contract instructs earns a
blocking `GlobDisagreement` from the shipped checker, which enumerates no such kind. It is recorded
on #277 rather than written into the document it would misdate.
