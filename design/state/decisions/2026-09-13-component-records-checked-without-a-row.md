# decision/2026-09-13-component-records-checked-without-a-row
Date: 2026-09-13
Anchor: 2026-09-13 — A `component` record is checked against its kind's glob even when no glob is declared
Status: accepted
StatedIn: unit/document/design-20-contract § Documents that carry surface, contract/test-designstate § Semantics

## Claim
`UnrecordedArtifact`'s record-to-glob direction runs for `component` whether or not the row carries
a pattern. An empty or absent row is an empty artifact set, and a component record anchored outside
it is a finding, as a record outside any kind's glob is. Only an unreadable row leaves the half
uncomputed. The tree skips that direction when the row is empty, and S32.6 asserts the skip; that is
a defect in the tree, not a reading of the contract.
