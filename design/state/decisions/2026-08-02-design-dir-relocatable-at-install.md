# decision/2026-08-02-design-dir-relocatable-at-install
Date: 2026-08-02
Anchor: 2026-08-02 — `design/` is relocatable at install time
Status: accepted
StatedIn: unit/document/install-md § `design/` — check the path before anything else

## Claim
`INSTALL.md` checks the design path first and offers resolutions, preferring a repository-root `design/` with the path rewritten consistently across the commands and `AGENTS.md`. Relocating it is logged in the target, because moving the directory later breaks every cross-reference into it.
