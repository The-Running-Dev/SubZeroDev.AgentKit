# decision/2026-08-04-refine-is-a-front-door-between-stages
Date: 2026-08-04
Anchor: 2026-08-04 — A front door for asks between the stages, and the rest of the compiler proposal declined
Status: accepted
StatedIn: unit/command/refine § Route away first, unit/command/refine § Emit, unit/command/refine § Emit; do not execute

## Claim
`.claude/commands/refine.md` is a front door for an ask that is not a brief, a contract, or a slice: it routes away first to the owning command where one exists, and otherwise refines the ask into a fixed six-field template. It emits and does not execute, runs at `sonnet`/`medium`, and every constraint in `Binding` must cite a file it was read from.
