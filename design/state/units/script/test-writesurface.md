# unit/script/test-writesurface
Kind: script
Status: active
Anchor: tools/Test-WriteSurface.ps1
Consumes:
Exposes:
Binds:
Live: decision/2026-08-12-install-all-write-surface-guard
Archival:
Questions:
Work:
Evidence: tools/Test-WriteSurface.Tests.ps1

## Owns
Checks that a target repository's working-tree changes fall within an allowed-prefix list, and
reports the offending paths if not.
