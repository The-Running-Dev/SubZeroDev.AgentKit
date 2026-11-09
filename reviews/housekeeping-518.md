# Housekeeping merged-work evidence — issue 518

Deliverable: Conservative classification of local tips against every merged PR using a branch name
Risk: HIGH — classifications feed the existing opt-in force-deletion path
Authorized: one further review and correction — Ben, 2026-11-09: "validate the PR and apply fixes as needed"
Authorized: one targeted re-review of C2 — Ben, 2026-11-09: "Yes, re-review it"

## Verification
Syntax: passed — npm run typecheck; npm run check:no-runtime-dependencies
Unit: passed — 39/39 focused housekeeping tests; four original false-positive regressions failed against the original implementation and passed after correction; two default-branch regressions failed with the C2 change reverted and passed with it
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

## R3
Kind: review
Revision: 94a0a069c8469af2c0a8f819e6b415977b4748bc
Scope: User-requested validation of PR 525 against issue 518: false-positive classes left after R2, and deletion safety
Outcome: One demonstrated blocking finding, F3

## F3
Severity: BLOCKING
Raised in: R3
Where: tools/lib/merged-pr-evidence.ts unique-commit range
Claim: Commits already on the default branch are reported as work no merged PR accounts for
Evidence: Real-Git probes — a feature rebased locally onto newer main, then squash-merged from its pre-rebase head, was TipAheadOfMergedPr naming the main commit; main merged into a feature after its squash named every main commit, the squash commit included
Consequence: The issue-518 false-positive escalation persists for locally rebased or main-merged branches, with a reason that is untrue
Correction: Exclude commits reachable from the default branch from the commits a merged PR must account for; merge commits and genuinely extra commits stay unaccounted
Status: resolved

## C2
Revision: 94a0a069c8469af2c0a8f819e6b415977b4748bc plus the F3 correction
Changes: compareMergedPr takes the default branch as settled history for the classification and the pre-deletion recheck; two regressions cover the rebase case and that main commits are never named while a real extra commit stays protected
Verification: Both regressions fail with the change reverted and pass with it; typecheck and dependency check passed; full suite result in the PR

## R4
Kind: re-review
Revision: baf48af3f024761504a48a21f19eff79e3fde37d
Scope: F3 and the C2 correction only
Outcome: F3 resolved; the reviewer reverted the C2 change and saw both new tests fail; real-Git probes (main merged in with and without extra content, rebased plus extra or empty commits, indentation-only difference, missing default ref, tag shadowing main, unpushed commit on local main) found no path to a contained result that loses work; one non-blocking finding, F4

## F4
Severity: NON-BLOCKING
Raised in: R4
Where: tools/invoke-done-housekeeping.test.ts, coverage of the pre-deletion recheck call in tools/invoke-done-housekeeping.ts
Claim: No test fails if the default branch is dropped from the force-deletion recheck
Evidence: Removing that argument from the recheck call alone left the file at pass 32, fail 0
Consequence: Fails safe (the recheck then refuses the delete), but a later edit could silently stop rebased branches from being force-deleted
Correction: Request force deletion in the rebase regression and assert the branch is deleted
Status: open
