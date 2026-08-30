# unit/command/install-all
Kind: command
Status: active
Anchor: .claude/commands/install-all.md
Consumes: contract/test-companion
Exposes:
Binds:
Live: decision/2026-08-04-install-all-runs-unattended-never-resolves-fork, decision/2026-08-12-install-all-write-surface-guard, decision/2026-08-20-install-initializes-an-absent-repository
Questions:
Work:
Evidence:

## Owns
Reconciles the kit into every SubZeroDev.* repository, unattended.
