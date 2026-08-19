# unit/script/test-designstate
Kind: script
Status: active
Anchor: tools/Test-DesignState.ps1
Consumes:
Exposes:
Binds: I15, I16, I18, I19, I20, I21, I23, I30, I31
Live: decision/2026-08-19-anchormissing-widens-to-every-tree-pointer, decision/2026-08-19-invariant-set-is-the-contract-table
Archival:
Questions:
Work:
Evidence: tools/Test-DesignState.Tests.ps1

## Owns
The design-state divergence checker: validator, projection checker, budget meter, freeze gate,
and the three-list report.
