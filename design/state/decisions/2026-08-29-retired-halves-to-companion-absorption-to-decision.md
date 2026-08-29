# decision/2026-08-29-retired-halves-to-companion-absorption-to-decision
Date: 2026-08-29
Anchor: 2026-08-29 — Retired halves move to a companion file, absorption is recorded on the decision, and five more checks close `/redteam`'s findings
Status: accepted

## Claim
A unit is one record in two files — an active record and a retired companion — and retirement relocates across that boundary, so every active edge has exactly one companion half (`Consumed`, `Exposed`, `Bound`, `Archival`, `Answered`, `Worked`) and a retirement removes both the referenced record and its reference bytes from the orientation closure. Absorption is recorded on the decision as `StatedIn`, a list of `<id> § <heading>` sites, each resolving to exactly one heading somewhere the named unit's reader already reaches — that unit's own `Anchor`, or a record one hop from it. `Decision.Affects` derives from `Live` ∪ `Archival` ∪ its sites and may never be empty. Every reference must sit in the half its referent's status requires, checked in both directions by one total table, which is why the closure needs no exclusion clause. `SupersededBy` chains are acyclic and terminate in an accepted decision. The ceiling counts records and not artifacts, and closure-plus-artifact is reported for every unit on every run.
