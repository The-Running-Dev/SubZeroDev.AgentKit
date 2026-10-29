# Behavioral pilot usage evidence review

Deliverable: Optional native Codex usage evidence in behavioral pilot receipts
Risk: MEDIUM

## R1

Kind: review
Revision: Working-tree implementation against 13983c616f9291a06efaf07db843654f39d95ac7, 2026-10-29
Scope: Verifier, focused regression tests, reused native reader/scanner, and documentation; source integrity, confinement, identity checks, accounting preservation, privacy and human-grade independence.
Outcome: No findings from the independent reviewer. No code changes requested or made after review. The final sanitized live-capture table and this ledger record the completed validation.
Evidence: Reviewer inspected strict four-field references, source digest/session/version/model checks, existing counter and coverage preservation, output privacy, and regression coverage. Reported focused tests and reversal proof aligned with inspected implementation; the reviewer did not duplicate the full suite.

## Verification

Syntax: passed - npm run typecheck; git diff --check.
Unit: passed - Focused verifier and native reader suite: 45 passed, zero failures or skips.
Integration: passed - All six C2 packet/receipt combinations with optional usage; source integrity/identity/confinement failures, unavailable/partial/zero coverage, human-grade independence, and unchanged native report accounting. Temporarily restoring main's verifier made the six-case usage regression fail; implementation restored afterwards.
Entry point: passed - Real measure-session.ts and evaluate-workflow.ts CLI calls; fresh native Codex smoke capture, plus all six live C2 result references. Ungraded receipts exited 1 as required.
End to end: passed - Six isolated native Codex 0.158.0 two-phase captures through standalone meter and receipt verification; original-byte digests and all available final CLI counters matched, with no tool items observed. This verifies the usage-evidence path only; all semantic grades remain unverified. Full npm test: 553 passed, 22 skipped, zero failures.
