# decision/2026-08-03-resolve-classifies-in-bulk-asks-on-ambiguous
Date: 2026-08-03
Anchor: 2026-08-03 — `/resolve` classifies review comments in bulk and asks only on the ambiguous
Status: accepted

## Claim
`/resolve` classifies every review thread in one table across five classes — defect, out of scope, not sustained, already decided, ambiguous — acts on the four clear classes without asking, and brings only ambiguous findings for individual sign-off. The fixed order is fix, push, confirm checks on the new head, then resolve, because resolving is the one action that cannot be noticed afterwards.
