# unit/command/install-all
Kind: command
Status: active
Anchor: skills/install-all/SKILL.md
Consumes: contract/test-companion, contract/test-writesurface
Exposes:
Binds:
Live:
Questions:
Work:
Evidence:

## Owns
One-time migration: per SubZeroDev.* repository, on a branch, deletes each previously-copied
kit-owned file that matches a released kit version, reports and leaves any that don't, keeps
companions, ensures the pointer section, and opens a pull request for the user to merge.
