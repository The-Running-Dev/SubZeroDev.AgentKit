# Merged branch containment — issue 518

Deliverable: Conservative merged-history verification for housekeeping
Risk: HIGH — positive verification authorizes local branch deletion

## Verification
Syntax: passed — npm run typecheck; npm run check:no-runtime-dependencies
Unit: passed — 39 focused housekeeping tests; four original regressions fail against the original implementation in an isolated copy
Integration: passed — real temporary Git histories cover ancestry, reused names, patch equivalence, missing-object fetch, unmerged changes, incomplete checks, shallow history, worktree refusals, dirt and stash identity
Entry point: passed — both CLI scripts run through their real parser and main in temporary repositories, with only gh mocked at the process boundary
End to end: passed — sandbox discovery, two-pass automatic deletion of a contained fixture branch, and refusal to delete unmerged fixture work; no existing user branches cleaned up
Risk check: passed — whitespace-sensitive patch verification and fail-closed checks protect distinct string values, empty commits, local merges, failed Git commands and incomplete history

## R1
Kind: review
Revision: Working diff atop 3fa8abb94e55ef2d8c8bad57e281c2c637e76f2d before C1
Scope: Independent deletion safety, patch equivalence, missing objects, multiple PRs, caller compatibility, worktree, dirty-tree and stash safeguards
Outcome: One blocking finding, F1 (review ID R518-1); 37 focused tests independently passed

## F1
Severity: BLOCKING
Raised in: R1
Where: tools/invoke-done-housekeeping.ts patch equivalence verification
Claim: git cherry alone normalizes whitespace and can authorize deletion of distinct runtime content
Evidence: A local commit adding export const value = "a b" and a divergent merged head adding export const value = "ab" produced a negative cherry marker and the local fixture branch was force-deleted
Consequence: Local work with different string values could be lost
Correction: Require git patch-id --verbatim confirmation for every nonempty local-only commit, after ancestry and cherry checks; missing or incomplete verification remains protected
Status: resolved

## C1
Revision: Working diff with verbatim patch verification and two additional safety tests
Changes: Resolve F1 with whitespace-preserving patch IDs and explicit local-commit coverage checks; retain conservative treatment of empty and merge commits
Verification: Removing verbatim verification in an isolated copy makes the whitespace regression fail; all 39 focused tests pass with the correction

## R2
Kind: re-review
Revision: Same working diff after C1
Scope: F1 correction and its regression tests only
Outcome: F1 resolved; original unsafe-deletion reproduction now keeps the branch; three targeted tests independently passed; no new blocking finding; git diff --check passed
