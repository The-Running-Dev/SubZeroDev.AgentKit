# unit/script/test-designstate
Kind: script
Status: active
Anchor: tools/Test-DesignState.ps1
Consumes: contract/read-designstate, contract/update-designprojection
Exposes: contract/test-designstate
Binds: I15, I16, I18, I19, I20, I21, I23, I30, I31
Live: decision/2026-08-20-globdisagreement-checks-the-glob-table, decision/2026-08-19-anchormissing-widens-to-every-tree-pointer, decision/2026-08-19-invariant-set-is-the-contract-table, decision/2026-08-19-enforcementunevidenced-widens-to-conditional-fields, decision/2026-08-19-contract-picks-up-three-derived-terms, decision/2026-09-05-self-check-asserts-a-clean-run, decision/2026-09-05-public-surface-check-asserts-correspondence-not-count
Questions:
Work:
Evidence: tools/Test-DesignState.Tests.ps1

## Owns
The design-state divergence checker: validator, projection checker, budget meter, freeze gate,
and the three-list report.
