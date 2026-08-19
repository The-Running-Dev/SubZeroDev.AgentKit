# unit/script/sync-kit
Kind: script
Status: active
Anchor: tools/Sync-Kit.ps1
Consumes:
Exposes:
Binds:
Live:
Archival:
Questions:
Work:
Evidence: tools/Sync-Kit.Tests.ps1

## Owns
Syncs the kit-owned files (`.claude/commands/*.md`, `tools/*.ps1`) into a target repository by
diffing against the sha the target was installed from, without reading any of them.
