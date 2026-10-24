# Review — REA installer

The REA installer incident replayed under the review budget. Before the budget, it took four
review rounds, with 99/99 and then 96/96 unit tests green, while three npm calls on the top-level
path were malformed — and end-to-end was still not run. Here the entry point runs first and
fails at once, the fix comes before any review, and one review is spent.

Deliverable: rea-installer
Artifact: tools/fixtures/rea-installer/install-fixed.ts
Goal: Install REA's Node dependencies with the bundled npm.
Risk: HIGH — an installer: runs npm against the user's machine
Acceptance:
- A1 every npm call runs npm-cli.js with its arguments as separate argv entries
- A2 a failing step stops the install with its exit code

## Verification
Syntax: passed — tsc --noEmit, no errors
Unit: passed — helpers: npmCliPath, ciArgs, rebuildArgs, auditArgs (they also pass on install-defective.ts)
Integration: not applicable — no second component; the entry point drives the only one
Entry point: passed — install() with a recording runner: three calls, each [npm-cli.js, verb, ...]; on install-defective.ts it fails with argv[0] '...npm-cli.jsrebuild'
End to end: not run — a real install writes node_modules on the user's machine; needs their go-ahead
Risk check: passed — the recording runner refuses any argv[0] that is not an existing npm-cli.js path

## F1
Severity: BLOCKING
Status: resolved
Raised in: verification
Where: install-defective.ts:8
Claim: npm script path and verb are concatenated into one argv entry
Evidence: recording runner: argv[0] '/x/node_modules/npm/bin/npm-cli.jsrebuild'
Consequence: every install fails before npm starts
Correction: pass [npmCli, ...args]

## C1
Revision: install-fixed.ts
Fixes: F1

## R1
Kind: review
Revision: install-fixed.ts
Vendor: another vendor
Model: any
Date: 2026-10-24

## F2
Severity: NON-BLOCKING
Status: tracked
Raised in: R1
Where: install-fixed.ts:6
Claim: audit runs after rebuild, so a vulnerable package is rebuilt before it is reported
Evidence: step order in install-fixed.ts
Consequence: a slower failure, not a wrong install
Correction: one follow-up issue

## F3
Severity: SPECULATIVE
Status: not sustained
Raised in: R1
Where: helpers.ts:8
Claim: npm may move npm-cli.js in a future release
Evidence:
Consequence: the path would need updating
Correction: none
