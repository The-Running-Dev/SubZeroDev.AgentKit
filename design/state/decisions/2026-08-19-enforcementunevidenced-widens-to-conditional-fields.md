# decision/2026-08-19-enforcementunevidenced-widens-to-conditional-fields
Date: 2026-08-19
Anchor: 2026-08-19 — `EnforcementUnevidenced` widens to every conditionally-required field, rather than a second class being added
Status: accepted
StatedIn: unit/document/design-20-contract § The divergence classes

## Claim
`EnforcementUnevidenced` fires on any conditionally-required field absent on a record whose own `Status` or `Enforcement` requires it — an invariant with `Enforcement: code` and no `Evidence`, a decision with `Status: superseded` and no `SupersededBy`, a question with `Status: answered` and no `AnsweredBy` — not only on the invariant case. One class rather than three, so the closed list keeps its size; the cost is that the name reads narrower than what it checks, and that the widening is contract-ahead-of-code which `ClassListDisagreement` cannot report because it compares class ids only.
