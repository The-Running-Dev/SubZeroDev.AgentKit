# decision/2026-08-31-live-absorbed-as-a-pass-and-a-reported-class
Date: 2026-08-31
Anchor: 2026-08-31 — A unit's `Live` set is absorbed as a pass, and a reported class watches for the ones that stop being in flight
Status: accepted
StatedIn: unit/document/design-10-design § Whether the ceiling can be met, unit/document/design-20-contract § The divergence classes

## Claim
A unit's `Live` is an in-flight set only while step 4 of the record-writing sequence is actually taken, and nothing on the closed list detects it being skipped. Two remedies, and neither substitutes for the other: a slice walks every unit's `Live` and gives each already-executed decision its `StatedIn` site, and `/contract` adds a **reported, never blocking** class flagging a `Live` decision whose terms appear to stand in the unit it is live on. The class cannot block, because judging whether a section states a claim is `SemanticDisagreement`'s territory and I22 admits nothing that needs it. Measured at `15990d9`: `unit/document/agents-md` breaches the ceiling on records alone at 19,207 bytes, 17,073 of it 25 decisions in `Live`; 84 of 89 accepted decisions sit in some `Live` and 5 of 96 records carry a site.
