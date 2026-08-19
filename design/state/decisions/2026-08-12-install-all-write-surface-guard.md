# decision/2026-08-12-install-all-write-surface-guard
Date: 2026-08-12
Anchor: 2026-08-12 — `/install-all` gets a mechanically enforced write surface, `tools/Test-WriteSurface.ps1`
Status: accepted

## Claim
`tools/Test-WriteSurface.ps1` reads `git status --porcelain=v1 -uall` in a target immediately after that target's phase-2 writes, comparing what changed against an allowed-prefix list matching `INSTALL.md` phase 1's artifact table. `install-all.md` phase 2 treats exit 1 or 2 as an abort for that target, offering `-Revert` to restore or delete the offending path, gated behind the flag rather than run by default.
