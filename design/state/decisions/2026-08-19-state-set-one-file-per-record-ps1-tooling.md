# decision/2026-08-19-state-set-one-file-per-record-ps1-tooling
Date: 2026-08-19
Anchor: 2026-08-19 — The state set is one Markdown file per record under `design/state/`, and the tooling is `.ps1` scripts, not a module
Status: accepted

## Claim
The state set is `design/state/`, one Markdown file per record, sitting inside `design/` for one reason: `INSTALL.md` phase 1 never ships `design/`, so a state set is designedly absent in every installed target rather than accidentally so. The grammar has no permissive fallback for an unrecognised line, and the tooling is four `.ps1` scripts invoked directly, not a module, matching `Sync-Kit.ps1`'s existing call into `Test-Companion.ps1`.
