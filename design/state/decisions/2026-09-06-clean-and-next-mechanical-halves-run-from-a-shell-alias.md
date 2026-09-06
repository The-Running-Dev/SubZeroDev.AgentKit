# decision/2026-09-06-clean-and-next-mechanical-halves-run-from-a-shell-alias
Date: 2026-09-06
Anchor: 2026-09-06 — `/clean` and `/next`'s mechanical halves run from a shell alias, and escalation stays a human's call
Status: accepted
StatedIn: unit/command/clean § No model needed for the ordinary case, unit/command/next § Orient

## Claim
`tools/Invoke-Housekeeping.ps1` and `tools/Get-NextOrientation.ps1` run `/clean`'s branch-deletion
decision and `/next`'s orientation reads with no model call in the ordinary case, invoked as a
shell alias (`tools/RepoAliases.ps1`, dot-sourced from a PowerShell profile) rather than a
scheduled task, because this repository's concurrency is sequential-by-policy and not by lock. A
judgement case — `Stopped`, a `TipAheadOfMergedPr` entry, or a `Refused` deletion — is reported and
left for a human to read and decide whether to open a session; neither script launches one itself.
