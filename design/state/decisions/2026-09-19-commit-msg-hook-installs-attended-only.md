# decision/2026-09-19-commit-msg-hook-installs-attended-only
Date: 2026-09-19
Anchor: 2026-09-19 — The commit-msg hook installs into each target, attended only
Status: accepted
StatedIn: "unit/document/install-md § Phase 1 — Classify", "unit/command/install-all § What must not happen, in any target", "contract/test-writesurface § Semantics"

## Claim
`/install` writes a copy of `tools/git-hooks/commit-msg` into the target's `.git/hooks/commit-msg`,
as a row in `INSTALL.md` phase 1's artifact table taking the existing four states unchanged —
Occupied, meaning a `commit-msg` hook the kit did not write, stops that one artifact and is
reported rather than appended to, merged into, or moved aside. It is written in phase 4 step 3 and
deliberately not staged in step 8, because `.git/` is not in the working tree; `core.hooksPath` is
checked first, and the hook is skipped where it names anywhere but `.git/hooks`. `/install-all`
never writes it and reports it skipped: `tools/Test-WriteSurface.ps1` reads `git status`, which
does not report writes inside `.git/` at all, so this is the one artifact whose install that
command's guard cannot check — and adding a `.git/` prefix to the guard's list would match nothing
however the hook got there, making it dead configuration that reads as coverage.
