# decision/2026-08-30-contract-carries-companion-halves-and-artifact-closure
Date: 2026-08-30
Anchor: 2026-08-30 — The contract carries the 2026-08-29 revision: a `retired/` companion directory, eight class ids, and two invariants demoted to `instruction`
Status: accepted

## Claim
A unit's retired companion lives at `design/state/units/<kind>/retired/<slug>.md`, so its non-membership of the record set is a fact about where it lives rather than a filter every consumer reapplies. Both files parse under the one `Unit` vocabulary and which file a field may sit in is a pairing rule, not a second field table. The design's eight new failure modes take eight blocking class ids — `RecordPairMalformed`, `HalfStatusMismatch`, `HalfOverlap`, `SiteAmbiguous`, `SiteOutOfReach`, `SiteContradictsLive`, `DecisionUnplaced`, `SupersessionCycle` — with one class for the whole half/status table, and site resolution kept apart from site reach. I23 and I30 fall to `Enforcement: instruction` with no `Evidence`, because an amended statement demotes its own row until the slice that lands the mechanism flips it back.
