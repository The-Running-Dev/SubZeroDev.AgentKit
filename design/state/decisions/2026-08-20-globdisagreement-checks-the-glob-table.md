# decision/2026-08-20-globdisagreement-checks-the-glob-table
Date: 2026-08-20
Anchor: 2026-08-20 — `GlobDisagreement` checks the glob table by resolved file set, leaving one unchecked restatement
Status: accepted

## Claim
`GlobDisagreement` is a blocking class. It expands § *Artifacts of a unit kind*'s patterns against the checkout and compares the resolved file sets — never the pattern text — with what the `Get-*GlobFiles` enumerations return, per globbed kind and in both directions. **The parsed patterns only compare and never feed `UnrecordedArtifact`**: the script stays the enumerator, so a mis-parse can report a disagreement or `ContractListUnreadable` but can never narrow the checked world. Both cells of that table therefore carry patterns and nothing else, every reason moved beneath it, and the `invariant` row falls out for having no pattern in either. § *Invariants* still enumerates no invariant ids in prose — which rows are `code`, and what evidences each, is the generated region's own columns, and a summary beside it is a restatement `ProjectionStale` cannot reach. **One** restatement in the document is now compared by no class: § *Public surface* against the `Contract` records.
