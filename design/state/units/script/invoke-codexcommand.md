# unit/script/invoke-codexcommand
Kind: script
Status: active
Anchor: tools/Invoke-CodexCommand.ps1
Consumes:
Exposes:
Binds:
Live: decision/2026-08-30-tier-gate-reads-environment-stamp-first, decision/2026-09-14-project-doc-max-bytes-is-launcher-enforced
Questions:
Work:
Evidence:

## Owns
Maps a command name to the Codex profile (`architect`/`author`/`builder`/`quick`) that
`AGENTS.md`'s *Command routing* table requires, and execs `codex` with that profile's
model, reasoning effort, approval policy, and sandbox mode passed directly as `-m`, `-c
model_reasoning_effort=<x>`, `-a`, and `-s` flags (not `--profile`, per issue #117) so
profile selection is not left to memory. Also computes and passes `-c
project_doc_max_bytes=<n>` on every invocation, `<n>` derived from the actual project-doc
files Codex would load for the launch directory, so the default cap does not silently
truncate a project doc larger than it.
