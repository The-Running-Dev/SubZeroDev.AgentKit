# Housekeeping merged-work evidence — issue 518

Deliverable: Conservative classification of local tips against every merged PR using a branch name
Risk: HIGH — classifications feed the existing opt-in force-deletion path

## Verification
Syntax: passed — npm run typecheck; npm run check:no-runtime-dependencies
Unit: passed — 39/39 focused housekeeping tests; four original false-positive regressions failed against the original implementation and passed after correction
Integration: passed — real Git histories cover ancestry, rewritten patches, multi-commit squashes, reused PR names, SHA-only object fetches, unavailable evidence, whitespace and submodule differences, worktrees and concurrent branch changes
Entry point: passed — actual invoke-housekeeping.ts CLI exercised with real Git and mocked GitHub in disposable repositories; contained ancestor deleted only in a fixture while extra work and unavailable evidence were retained
End to end: not run — live housekeeping/deletion on existing user branches requires explicit user approval; no existing user branches were deleted
Risk check: passed — dirty-tree and worktree protections retained; unknown evidence never supplies a force-delete candidate; containment checked again immediately before force deletion

## R1
Kind: review
Revision: Base 16d076c31efdce815d332dbf292b005838393032 plus initial issue-518 worktree changes
Scope: Independent review of containment, ancestry and patch equivalence, missing objects, reused names and deletion protections
Outcome: Two demonstrated blocking findings, F1 and F2

## F1
Severity: BLOCKING
Raised in: R1
Where: tools/lib/merged-pr-evidence.ts per-commit and aggregate patch matching
Claim: Whitespace-insensitive patch IDs can identify semantically different local code as contained
Evidence: Python cleanup() indented inside a conditional locally but outside it in the PR produced git cherry '-' and initial contained classification
Consequence: A genuinely different local patch could become eligible for force deletion
Correction: Confirm cherry matches with whitespace-preserving patch streams and git patch-id --verbatim; use --verbatim for aggregate squash patches too
Status: resolved

## F2
Severity: BLOCKING
Raised in: R1
Where: tools/lib/merged-pr-evidence.ts generated comparison patches
Claim: User diff configuration can omit differing submodule gitlinks
Evidence: Different local and PR gitlink SHAs initially classified contained with diff.ignoreSubmodules=all and independently with diff.submodule=log
Consequence: Unmerged submodule changes could become eligible for force deletion
Correction: Force --ignore-submodules=none and --submodule=short on comparison patch generation; regressions exercise each setting and both together
Status: resolved

## C1
Revision: Issue-518 worktree after consolidated whitespace and submodule corrections
Changes: Resolve F1 and F2 in individual and aggregate paths; add semantic indentation, string-whitespace and gitlink regression coverage
Verification: Focused suite 39/39; typecheck and dependency check passed; real CLI fixtures passed

## R2
Kind: re-review
Revision: Same issue-518 worktree after C1
Scope: F1 and F2 corrections and their regression coverage only
Outcome: Both resolved; reviewer reran the new tests and both original reproduction histories, which now return unaccounted rather than contained; no unresolved review findings
