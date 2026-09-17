# unit/script/sync-kit
Kind: script
Status: retired
Anchor: tools/Sync-Kit.ps1
Consumes: contract/test-companion
Exposes:
Binds:
Live:
Questions:
Work:
Evidence: tools/Sync-Kit.Tests.ps1

## Owns
Syncs the kit-owned files (`skills/<name>/SKILL.md`, `tools/*.ps1`) into a target repository by
diffing against the sha the target was installed from, without reading any of them. Retired:
home-install stopped copying kit-owned files into target repositories at all, so there was
nothing left to diff.
