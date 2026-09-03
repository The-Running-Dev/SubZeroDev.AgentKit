# decision/2026-08-03-kits-commit-is-its-version
Date: 2026-08-03
Anchor: 2026-08-03 — The kit's commit is its version, recorded in the target as `.claude/kit.json`
Status: accepted
StatedIn: unit/document/install-md § Phase 1 — Classify, unit/document/install-md § Phase 4 — Apply, unit/document/install-md § Re-running

## Claim
`/install` writes `.claude/kit.json` holding the kit's HEAD sha and the date, only in phase 4 after the install succeeds. A re-install reads it first and reports the gap as `git log <recorded>..HEAD`, stated as commits rather than a version number.
