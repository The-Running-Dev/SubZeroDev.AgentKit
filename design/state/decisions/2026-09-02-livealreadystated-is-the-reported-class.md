# decision/2026-09-02-livealreadystated-is-the-reported-class
Date: 2026-09-02
Anchor: 2026-09-02 — `LiveAlreadyStated` is the reported class the 2026-08-31 entry commissioned; a reading raises it and the script only declares it
Status: accepted
StatedIn: unit/document/design-20-contract § The divergence classes, contract/test-designstate § Semantics, unit/command/reconcile § LiveAlreadyStated

## Claim
The reported, never-blocking class the 2026-08-31 entry commissioned is `LiveAlreadyStated`: a decision in a unit's `Live` whose terms already stand somewhere that unit's reader reaches, with no site naming that place. It is raised by a reading — the reconciliation pass that compares a unit's `Live` against the artifact it is live on — and `tools/Test-DesignState.ps1` declares the id so `ClassListDisagreement` sees one list, and never raises it, the standing `SemanticDisagreement` already has. Its payload is the unit, the decision, and the candidate site in `StatedIn`'s own `<id> § <heading>` form, so acting on it is copying the payload into the record and dropping the id, or stating in the pull request why the terms do not stand there. The row opens a `ClassListDisagreement` window until a slice adds the id to the checker's declared reported list.
