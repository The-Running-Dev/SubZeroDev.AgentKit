# unit/script/test-gatescache
Kind: script
Status: active
Anchor: tools/Test-GatesCache.ps1
Consumes:
Exposes:
Binds:
Live:
Archival:
Questions:
Work:
Evidence:

## Owns
Reads or writes `.claude/gates.json`, a cache of a repository's discovered gates keyed to a
hash of the files whose presence or content determines what the gate list is.
