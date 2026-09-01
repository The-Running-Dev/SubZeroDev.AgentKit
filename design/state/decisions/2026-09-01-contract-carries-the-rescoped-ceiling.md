# decision/2026-09-01-contract-carries-the-rescoped-ceiling
Date: 2026-09-01
Anchor: 2026-09-01 — The contract carries the re-scoped ceiling, and `ClosureOverBudget` names the excluded term
Status: accepted
StatedIn: unit/document/design-20-contract § The divergence classes

## Claim
`ClosureOverBudget` names four things rather than three — the unit, its bounded size, its largest contributor, and that unit's own artifact size, named separately and never folded into the bounded one — because the report line names the artifact only for the largest closure, so a second breaching unit would otherwise have its bounded number acted on with the excluded term nowhere in sight. The reach rule's justification is restated on what a reading covers rather than on what the budget counts: since the artifact left the bound the two are different sets, and a site in the unit's own artifact is out of the closure and in reach. I23 is amended to the records-only closure and therefore demotes from `code` to `instruction` with no `Evidence`, because the meter still counts the artifact and the named test still asserts that it does; S20.9 is left failing until the fix that re-scopes `Test-ClosureBudget` flips the row back.
