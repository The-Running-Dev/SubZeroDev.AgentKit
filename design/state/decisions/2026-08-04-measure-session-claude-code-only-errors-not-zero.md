# decision/2026-08-04-measure-session-claude-code-only-errors-not-zero
Date: 2026-08-04
Anchor: 2026-08-04 — `Measure-Session.ps1` is Claude Code only, and errors rather than reporting zero
Status: accepted

## Claim
`Measure-Session.ps1` shape-checks every transcript before summing it via `Get-TranscriptVendor`, classifying by record shape rather than path. Anything not Claude-shaped is a hard error naming the vendor rather than a silent zero, and Copilot is named separately by `Assert-NotCopilotStore` because its gap is that the usage data does not exist at all rather than being unsupported.
