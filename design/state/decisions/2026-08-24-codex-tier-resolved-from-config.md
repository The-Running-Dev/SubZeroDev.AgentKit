# decision/2026-08-24-codex-tier-resolved-from-config
Date: 2026-08-24
Anchor: 2026-08-24 — Codex's tier is resolved from the session's configuration, and the bare `GPT-5` prefix maps to no tier at all
Status: accepted
StatedIn: unit/document/agents-md § Vendor model aliases

## Claim
The gate in `AGENTS.md` § *Model, effort, and review budget* resolves a Codex session's tier from the session's configuration rather than its self-report: the configured `model` and `model_reasoning_effort`, with the `--profile` overlay layered over the base config, and the family segment of the model id looked up in § *Vendor model aliases* — `gpt-5.6-sol` through the `Sol` row to Deep reasoning. `codex/PROFILES.md` keeps ownership of where those files live per CLI version. The `GPT-5` row stays in the table carrying no tier, because a bare family prefix is what every model in the family answers when asked to identify itself and no tier can be read off it. `model_reasoning_effort` states effort outright, so `xhigh` has no Codex alias by reason rather than for want of a confirmed mapping. Where the configuration cannot be read the self-report is all there is, and the gate stops — on an unrecognised name or on a bare family prefix, saying which.
