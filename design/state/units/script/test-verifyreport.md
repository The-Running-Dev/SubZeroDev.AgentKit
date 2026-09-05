# unit/script/test-verifyreport
Kind: script
Status: active
Anchor: tools/Test-VerifyReport.ps1
Consumes:
Exposes: contract/test-verifyreport
Binds:
Live:
Questions:
Work:
Evidence: tools/Test-VerifyReport.Tests.ps1

## Owns
Validates `.claude/verify-report.json` — the structured artifact `/verify` writes — before its
contents are trusted to become a pull request's `Verified` section.
