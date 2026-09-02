# decision/2026-08-12-commands-split-core-and-companion
Date: 2026-08-12
Anchor: 2026-08-12 — Every command splits into a kit-owned core and an optional target-owned companion
Status: accepted
StatedIn: contract/test-companion § Semantics

## Claim
Every command splits into a kit-owned core and an optional target-owned companion, mechanised by `.claude/COMPANIONS.md`: five category ids, a universal never-list referenced rather than copied, and an absence rule. Each core carries a declared `companion` block naming only which categories apply to it, and `tools/Test-Companion.ps1` reads the category ids from `COMPANIONS.md`'s own table rather than duplicating them.
