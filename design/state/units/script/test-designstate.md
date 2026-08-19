# unit/script/test-designstate
Kind: script
Status: active
Anchor: tools/Test-DesignState.ps1
Consumes: contract/read-designstate, contract/update-designprojection
Exposes: contract/test-designstate
Binds:
Live: decision/2026-08-19-anchormissing-widens-to-every-tree-pointer, decision/2026-08-19-invariant-set-is-the-contract-table
Archival:
Questions:
Work:
Evidence: tools/Test-DesignState.Tests.ps1

## Owns
The design-state divergence checker: validator, projection checker, budget meter, freeze gate,
and the three-list report.
