# decision/2026-08-19-enforcement-states-tree-as-it-stands
Date: 2026-08-19
Anchor: 2026-08-19 — `Enforcement` states the tree as it stands, not as designed
Status: accepted

## Claim
`design/20-contract.md`'s `Enforcement` column states current state, not designed intent: a row claiming `code` is required to carry an `Evidence` pointer, and its absence is a finding under `EnforcementUnevidenced`. Rows not yet evidenced by a written test stay `instruction`, and the slice that writes an evidencing test flips its own row in the same commit; how many such rows there are is the region's `Enforcement` column, not a number recorded here.
