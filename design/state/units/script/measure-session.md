# unit/script/measure-session
Kind: script
Status: active
Anchor: tools/Measure-Session.ps1
Consumes:
Exposes:
Binds:
Live: decision/2026-08-04-userpromptsubmit-hook-warns-on-session-size, decision/2026-08-04-sessionend-hook-writes-cost-log, decision/2026-08-04-cost-measured-by-script-taxonomy-is-policy, decision/2026-08-04-pester-tests-and-ci-gate-for-measure-session, decision/2026-08-04-measure-session-claude-code-only-errors-not-zero
Archival:
Questions:
Work:
Evidence: tools/Measure-Session.Tests.ps1

## Owns
Reports what a Claude Code session actually cost, read from the transcript's own per-call
usage rather than estimated.
