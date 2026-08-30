# unit/script/update-workmirror
Kind: script
Status: active
Anchor: tools/Update-WorkMirror.ps1
Consumes:
Exposes: contract/update-workmirror
Binds:
Live: decision/2026-08-26-workmirror-writes-only-on-change
Questions:
Work:
Evidence: tools/Update-WorkMirror.Tests.ps1

## Owns
The mirror generator: refreshes `WorkRef` records from the tracker. `/track`'s alone (I28).
