# Offline workflow assessments A1

Deliverable: Versioned offline attachments to existing verified workflow captures
Risk: MEDIUM — new assessment consumer contract; existing receipts/reporting unchanged

## Verification
Syntax: passed — npm run typecheck
Unit: passed — node --test tools/assess-workflow.test.ts, 6/6 tests
Integration: passed — same suite revalidates packet, receipt, transcripts and sealed identity together
Entry point: passed — same suite invokes the real CLI for sealing, exclusive output, sanitized diagnostics and near-boundary roundtrip
End to end: passed — synthetic offline CLI capture-to-attachment roundtrip; no live model evaluation is part of A1

## R1
Kind: review
Revision: Base 2d9bf6db43f438e0095c9a324f7404e64241bbc7 plus A1 working changes before serialized-size correction
Scope: Independent review of schema, capture/evidence binding, verifier reuse, confinement, exclusive writes, status separation, tests and docs
Outcome: One demonstrated blocking finding, F1

## F1
Severity: BLOCKING
Raised in: R1
Where: tools/lib/workflow-assessment.ts bounds and tools/assess-workflow.ts serialization
Claim: Accepted compact drafts can seal to formatted files exceeding the reader's limit
Evidence: Valid scope-growth draft 259378 bytes sealed to 263245 bytes; reader rejected it. Added near-boundary CLI regression failed before correction with expected exit 1, actual 0.
Consequence: Successfully written attachments could not be read back
Correction: Bound the exact final formatted serialization including digest and newline before writing
Status: resolved

## C1
Revision: A1 working changes with serializeAssessment shared by sealing and CLI
Changes: Enforce final serialized 256 KiB limit, document it, and test oversized rejection plus readable nearby output above 250000 bytes
Verification: Focused suite 6/6, including regression observed red before fix and green after fix

## R2
Kind: re-review
Revision: Same A1 working changes after C1
Scope: F1 correction, regression and documentation only
Outcome: F1 resolved; no further findings in targeted scope
