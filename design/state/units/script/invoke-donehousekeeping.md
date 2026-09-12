# unit/script/invoke-donehousekeeping
Kind: script
Status: active
Anchor: tools/Invoke-DoneHousekeeping.ps1
Consumes:
Exposes: contract/invoke-donehousekeeping
Binds:
Live: decision/2026-09-12-unhandlederror-is-a-fourth-stop
Questions:
Work:
Evidence:

## Owns
The mechanical half of `/clean`: switch to the default branch, prune stale remote-tracking
refs, and report which local branches are safe to delete.
