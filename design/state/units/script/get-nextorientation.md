# unit/script/get-nextorientation
Kind: script
Status: active
Anchor: tools/Get-NextOrientation.ps1
Consumes:
Exposes: contract/get-nextorientation
Binds:
Live:
Questions:
Work:
Evidence:

## Owns
The no-model invocation path for `/next`'s orientation reads: runs the six reads `next.md` §
*Orient* lists and returns them as one object, deciding nothing about which row they match. Each
gate result and PR list carries a plain-language `Summary` next to its structured fields, so a
reader is not left to translate `ExitCode`, `Available`, or a bare boolean themselves
([[decision/2026-09-14-output-discipline-states-plain-language-first]]).
