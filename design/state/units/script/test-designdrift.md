# unit/script/test-designdrift
Kind: script
Status: active
Anchor: tools/Test-DesignDrift.ps1
Consumes:
Exposes: contract/test-designdrift
Binds: I12, I13
Live:
Questions:
Work:
Evidence: tools/Test-DesignDrift.Tests.ps1

## Owns
Reports drift between `design/30-slices.md` and the GitHub tracker, and changes neither side.
