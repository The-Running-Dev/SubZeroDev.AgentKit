# decision/2026-08-20-install-initializes-an-absent-repository
Date: 2026-08-20
Anchor: 2026-08-20 — `/install` initializes a target that is not a git repository, and `/install-all` still refuses to
Status: accepted
StatedIn: unit/document/install-md § Phase 0 — Orient, unit/document/install-md § Phase 4 — Apply, unit/command/install-all § Phase 0 — Discover

## Claim
`INSTALL.md` phase 0 records an absent repository and keeps classifying instead of stopping; phase 4 creates it with `git init -b main` at the resolved root as its first step, under phase 3's existing sign-off rather than a second prompt, and commits nothing. Two conditions still stop the run outright: a path that does not exist, and a parent that already resolves to a git root. `.claude/commands/install-all.md` overrides this and still skips a non-repository candidate, because the sign-off phase 4 relies on is one an unattended run never collects.
