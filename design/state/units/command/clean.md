# unit/command/clean
Kind: command
Status: active
Anchor: .claude/commands/clean.md
Consumes:
Exposes:
Binds:
Live: decision/2026-08-08-done-housekeeping-scripts-everything-before-ask, decision/2026-08-30-derived-state-commits-to-default-branch, decision/2026-08-30-force-delete-delegated-on-tip-comparison
Questions:
Work:
Evidence:

## Owns
Switches back to the default branch, deletes local branches already merged into it, prunes stale remote-tracking refs, and hands off to `/track`.
