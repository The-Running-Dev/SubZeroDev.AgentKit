# decision/2026-08-20-invariant-enforcement-not-enumerated-in-prose
Date: 2026-08-20
Anchor: 2026-08-20 — § *Invariants*' prose enumeration of the `code` rows is deleted rather than checked or assigned a keeper
Status: accepted

## Claim
`design/20-contract.md` § *Invariants* enumerates no invariant ids in prose. Which rows are `code`, and against which test each is evidenced, is the generated region's own `Enforcement` and `Evidence` columns; a prose list beside it is a restatement `ProjectionStale` cannot reach, because that class compares the region and stops at the closing marker. The document's count of exactly two restatements no class compares — § *Public surface* against the `Contract` records, and the glob table against the checker's three glob functions — is therefore correct as written, and a summary of the region is not a third.
