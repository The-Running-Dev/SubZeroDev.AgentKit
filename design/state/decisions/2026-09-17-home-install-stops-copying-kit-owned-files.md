# decision/2026-09-17-home-install-stops-copying-kit-owned-files
Date: 2026-09-17
Anchor: 2026-09-17 — Home install stops copying kit-owned files into target repositories
Status: accepted
StatedIn: "unit/document/install-md § Phase 1 — Classify", "unit/command/install-all § Phase 1 — Per target, classify the copies"

## Claim
`INSTALL.md`/`/install` handle only per-repo files; `skills/`, `tools/*.ps1`,
`.claude/COMPANIONS.md`, and `AGENTS.shared.md` are never copied into a target repository. A
target's `AGENTS.md`/`CLAUDE.md` instead carries a pointer section naming the concrete resolved
path to the installed kit's `AGENTS.shared.md`. `tools/Sync-Kit.ps1` is retired — nothing is left
to diff once nothing is copied — and `/install-all` becomes a one-time migration that deletes each
previously-copied kit file only if it matches a released kit version, keeps companions, ensures
the pointer section, and opens a pull request per repository.
