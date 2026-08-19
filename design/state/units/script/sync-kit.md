# unit/script/sync-kit
Kind: script
Status: active
Anchor: tools/Sync-Kit.ps1
Consumes: contract/test-companion
Exposes:
Binds:
Live: decision/2026-08-05-sync-kit-mechanism-recorded, decision/2026-08-08-sync-kit-built
Archival:
Questions:
Work:
Evidence: tools/Sync-Kit.Tests.ps1

## Owns
Syncs the kit-owned files (`.claude/commands/*.md`, `tools/*.ps1`) into a target repository by
diffing against the sha the target was installed from, without reading any of them.
