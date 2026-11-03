# Offline workflow comparison A2

Deliverable: Pinned baseline/candidate assessment comparison and minimal experiment lineage
Risk: MEDIUM — new evidence comparison contract, read-only and offline

## Verification
Syntax: passed — npm run typecheck and npm run check:no-runtime-dependencies
Unit: passed — final focused comparison, suite reporter and assessment suites 28/28; all three correction regressions also passed independently
Integration: passed — six-slot selections, original verifier, sealed attachments, multiple evaluators and shared-session usage exercised together
Entry point: passed — real JSON and Markdown CLI runs, sanitized rejection, no host CLI on PATH and empty provider credentials
End to end: passed — synthetic private capture-to-attachment-to-comparison flow preserves all evidence bytes; no live candidate or model execution is part of A2

## R1
Kind: review
Revision: Base ff3b18319dc1c875dd3031609b78ee58343a4dee plus A2 working changes before C1
Scope: Independent comparison schema, evidence binding, cohort isolation, human status separation, reuse, deterministic output, tests and documentation
Outcome: Two demonstrated blocking findings, F1 and F2

## F1
Severity: BLOCKING
Raised in: R1
Where: tools/compare-workflow.ts pinned attachment reading
Claim: Hashing one file read and parsing another permits replacement bytes to contribute grades
Evidence: Deterministic second-read swap produced comparable with invalid 0 and fail 1 from bytes not matching the selected digest; regression failed before correction with actual fail 1 versus expected 0
Consequence: A pinned evidence reference did not guarantee which assessment was counted
Correction: Hash the same bounded buffer that each assessment and selection reader parses; pass expected digests directly through the shared readers
Status: resolved

## F2
Severity: BLOCKING
Raised in: R1
Where: tools/compare-workflow.ts authorRole and evaluator origin validation
Claim: String coercion accepts arrays where enum strings are required
Evidence: authorRole array containing human produced comparable with an array role; regression failed before correction with missing expected exception
Consequence: The advertised strict experiment schema accepted malformed metadata
Correction: Require actual string types before enum membership, with arrays, null, booleans, numbers and objects tested
Status: resolved

## C1
Revision: A2 working changes with pinned shared readers and strict enum validation
Changes: Resolve F1 and F2 together, cover analogous selection read hazard, document same-buffer pinning
Verification: Both original regressions observed red before fix; focused suites 27/27 and all three correction regressions 3/3 passed afterward; typecheck and dependency check passed

## R2
Kind: re-review
Revision: Same A2 working changes after C1
Scope: F1 and F2 corrections, regression tests and corresponding documentation only
Outcome: Both findings resolved; independent targeted regressions 3/3 and diff check passed; no further findings within the targeted scope
