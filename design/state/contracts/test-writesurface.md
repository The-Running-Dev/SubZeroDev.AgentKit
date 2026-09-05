# contract/test-writesurface
Status: active
Owner: unit/script/test-writesurface
Declaration: tools/Test-WriteSurface.ps1

## Semantics
Reads `git status --porcelain=v1 -uall` in `-TargetRepo` (defaults to the current directory) and
compares every changed path against an allowed-prefix list, reporting the offending paths rather
than gating on a commit range — `/install-all` never commits or pushes, so there is nothing to
diff a range against, and this runs once per target immediately after that target's writes are
applied. The default prefix list is the canonical, checkable enumeration of what `/install-all`
may write, kept in step with `INSTALL.md` phase 1's artifact table and `.claude/kit.json`'s
`syncedCommit`; `.claude/settings.json` is deliberately absent from it, because `INSTALL.md`
requires proposing its two hook keys and waiting on sign-off unconditionally, which the
unattended pass always skips — a write there must be caught, never allowed through. Exit codes:
0 `InSurface`, 1 `OutOfSurface`, 2 `NotEvaluated` — not a git repository, or `git status` itself
failed — and `NotEvaluated` is never a clean pass; "no changes" and "could not ask" are different
results. `-Revert` reverts every offending path after reporting it — `git checkout --` for a
tracked change, delete for an untracked one — and is off by default: destructive operations gate
on an explicit flag, never a prompt, and never run silently either. `-Quiet` suppresses the
human-readable report only; the result object is always emitted.
