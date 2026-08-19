# unit/script/invoke-donehousekeeping
Kind: script
Status: active
Anchor: tools/Invoke-DoneHousekeeping.ps1
Consumes:
Exposes:
Binds:
Live: decision/2026-08-08-done-housekeeping-scripts-everything-before-ask
Archival:
Questions:
Work:
Evidence:

## Owns
The mechanical half of `/done`: switch to the default branch, prune stale remote-tracking
refs, and report which local branches are safe to delete.
