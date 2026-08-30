# unit/script/read-designstate
Kind: script
Status: active
Anchor: tools/Read-DesignState.ps1
Consumes:
Exposes: contract/read-designstate
Binds: I17, I24
Live:
Questions:
Work:
Evidence: tools/Read-DesignState.Tests.ps1

## Owns
Reads `design/state/` into a graph. Never throws, never writes, and never silently skips a
line the record grammar does not recognise.
