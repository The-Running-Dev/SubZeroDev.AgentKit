# decision/2026-08-19-enforcement-states-tree-as-it-stands
Date: 2026-08-19
Anchor: 2026-08-19 — `Enforcement` states the tree as it stands, not as designed
Status: accepted

## Claim
`design/20-contract.md`'s `Enforcement` column states current state, not designed intent: a row claiming `code` is required to carry an `Evidence` pointer, and its absence is a finding under `EnforcementUnevidenced`. The eleven rows not yet evidenced by a written test stay `instruction`, each naming the test that would evidence it, and the slice that writes that test flips its own row in the same commit.
