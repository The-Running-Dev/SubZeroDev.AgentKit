# decision/2026-09-17-global-front-door-both-codex-modes
Date: 2026-09-17
Anchor: 2026-09-17 — The global front door offers both native and routed Codex modes
Status: accepted
StatedIn: "unit/document/agents-md § Model, effort, and review budget"

## Claim
`setup.ps1` is the stable global front door: it delegates to the installer from the checked-out
canonical source, defaults only to the newest valid date-shaped stable tag, and requires an
explicit `main` request. Any selected tag, branch, or SHA without `setup.ps1` is refused before
checkout. Codex gets two generated adapters per command: the native `$<command>` adapter uses the
current session under the shared contract's narrow model-gate exception, and the routed
`$<command>-routed` adapter invokes `Start-AgentKitCodex.ps1` with a JSON arguments file and
`-NewWindow` while retaining normal routing, approvals, and sandboxing.
