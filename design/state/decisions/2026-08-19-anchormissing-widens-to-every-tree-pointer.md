# decision/2026-08-19-anchormissing-widens-to-every-tree-pointer
Date: 2026-08-19
Anchor: 2026-08-19 — `AnchorMissing` widens to every tree pointer a record carries, rather than a second class being added
Status: accepted
StatedIn: unit/document/design-20-contract § The divergence classes

## Claim
`AnchorMissing` fires on any tree-pointer field an active record carries — a unit's `Anchor`, a contract's `Declaration`, any `Evidence` entry — not only on a unit's `Anchor`. The `Status: active` exemption I30 requires is kept, an invariant record's `Anchor` stays exempt because it is the invariant number rather than a path, and a contract `Declaration` of the literal `prose` is exempt because that is the field's documented second value. One class rather than two, so the closed list keeps its size; the cost is that the name reads narrower than what it checks.
