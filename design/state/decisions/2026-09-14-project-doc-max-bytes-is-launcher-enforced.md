# decision/2026-09-14-project-doc-max-bytes-is-launcher-enforced
Date: 2026-09-14
Anchor: 2026-09-14 — `project_doc_max_bytes` is passed by the launcher, computed fresh per invocation, not left to base config
Status: accepted
StatedIn: unit/document/codex-profiles § Output and context budget

## Claim
`tools/Invoke-CodexCommand.ps1` passes `-c project_doc_max_bytes=<n>` on every `codex`
invocation it starts, `<n>` computed fresh per launch by `Get-ProjectDocByteBudget` as the
sum of whichever project-doc file (`AGENTS.override.md` first, else `AGENTS.md`) is present
per directory from the discovered project root down to the launch directory — mirroring
Codex 0.153.4's own discovery order and shared, cumulative budget accounting
(`codex-rs/core/src/agents_md.rs`, tag `rust-v0.153.4`) rather than a fixed number. Codex's
default (32,768 bytes) truncates this repository's own `AGENTS.md` (49,761 bytes) silently;
a live nested-fixture test (combined 44,041 bytes, a canary marker at the end of the nested
file) confirms both the truncation without the override and the fix with it. Plain `codex`
or `codex --profile` outside this launcher is unaffected and still needs the value set by
hand. `project_doc_max_bytes` is narrowed out of the 2026-09-14 Output-discipline decision's
blanket "recommended, not enforced" claim — it alone is launcher-enforced, because it is a
correctness question rather than a machine-wide preference.
