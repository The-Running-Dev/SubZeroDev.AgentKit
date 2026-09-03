# unit/script/invoke-donehousekeeping
Kind: script
Status: active
Anchor: tools/Invoke-DoneHousekeeping.ps1
Consumes:
Exposes: contract/invoke-donehousekeeping
Binds:
Live:
Questions:
Work:
Evidence:

## Owns
The mechanical half of `/done`: switch to the default branch, prune stale remote-tracking
refs, and report which local branches are safe to delete.
