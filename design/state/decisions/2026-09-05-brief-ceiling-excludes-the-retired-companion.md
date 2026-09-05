# decision/2026-09-05-brief-ceiling-excludes-the-retired-companion
Date: 2026-09-05
Anchor: 2026-09-05 — The brief's ceiling excludes the retired companion, matching the mechanism it was always describing
Status: accepted
StatedIn: unit/document/design-00-brief § Definition of done

## Claim
`closure(U)` is bounded at 16,384 bytes over the active record and its one hop, excluding both
the unit's own artifact and its retired companion. `design/00-brief.md` § *Definition of done*
was the sole source counting the companion; `design/10-design.md`, `design/20-contract.md` and
`Get-DesignClosure` have always excluded it, so the brief is corrected to match rather than the
mechanism changed to match the brief. The companion is excluded because retirement is what moves
bytes out of the bound — counting it would make retiring a record move bytes between two counted
files and save nothing, which is what the two-file split exists to buy. § *Abandonment* names
this as the only exclusion added since 2026-09-01 so its "quietly widens what is excluded" test
stays checkable. No measured number moves, and no code, contract, invariant or record changes.
