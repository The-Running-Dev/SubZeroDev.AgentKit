# decision/2026-08-20-globdisagreement-checks-the-glob-table
Date: 2026-08-20
Anchor: 2026-08-20 — `GlobDisagreement` checks the glob table by resolved file set, leaving one unchecked restatement
Status: accepted
StatedIn: unit/document/design-20-contract § Documents that carry surface

## Claim
`GlobDisagreement` is a blocking class. It expands § *Artifacts of a unit kind*'s patterns against the checkout and compares the resolved file sets — never the pattern text — with what the `Get-*GlobFiles` enumerations return, per globbed kind and in both directions. **The parsed patterns only compare and never feed `UnrecordedArtifact`**: the script stays the enumerator. Both cells of that table therefore carry patterns and nothing else, every reason moved beneath it, and the `invariant` row falls out for having no pattern in either. **One** restatement in the document is compared by no class: § *Public surface* against the `Contract` records.
