# decision/2026-08-03-verify-discovers-gates-reports-what-did-not-run
Date: 2026-08-03
Anchor: 2026-08-03 — `/verify` discovers gates from CI, and reports what did not run
Status: accepted

## Claim
`/verify` discovers gates by reading `.github/workflows/*.yml` as authoritative rather than assuming what to run, and reports three lists — passed, failed with output quoted verbatim, and did not run with the reason. "All checks pass" may never be written while the third list is non-empty, and `/verify` fixes nothing.
