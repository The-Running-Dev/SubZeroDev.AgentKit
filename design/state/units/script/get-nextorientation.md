# unit/script/get-nextorientation
Kind: script
Status: active
Anchor: tools/Get-NextOrientation.ps1
Consumes:
Exposes:
Binds:
Live: decision/2026-09-06-clean-and-next-mechanical-halves-run-from-a-shell-alias
Questions:
Work:
Evidence:

## Owns
The no-model invocation path for `/next`'s orientation reads: runs the six reads `next.md` §
*Orient* lists and returns them as one object, deciding nothing about which row they match.
