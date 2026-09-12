# decision/2026-09-12-component-row-enumerates
Date: 2026-09-12
Anchor: 2026-09-12 — The `component` row enumerates, and `GlobDisagreement` has nothing to compare for that kind
Status: accepted
StatedIn: unit/document/design-20-contract § Documents that carry surface

## Claim
`component` is the one unit kind the checker does not enumerate, so § *Artifacts of a unit kind*'s
patterns for that kind feed `UnrecordedArtifact` directly and `GlobDisagreement` is not evaluated
for it — a fact about the kind, not an exemption the checker carries. The compare-only rule holds
unchanged for every kind that has a `Get-*GlobFiles` enumeration. The failure direction is
unchanged either way: an unreadable component row is `ContractListUnreadable` and leaves that half
uncomputed, never clean. What is forfeited is the second source, so a component row that parses
cleanly and names the wrong directory narrows that kind's checked world with no class to see it.
