# decision/2026-08-30-tier-gate-reads-environment-stamp-first
Date: 2026-08-30
Anchor: 2026-08-30 — The tier gate reads an environment stamp first, because the configuration it was told to read is outside the sandbox
Status: accepted
StatedIn: unit/document/agents-md § Vendor model aliases

## Claim
`AGENTKIT_TIER`, where set, **is** the session's tier and nothing further is looked up; the configuration read is second and the self-report last. `tools/Invoke-CodexCommand.ps1` sets it, with `AGENTKIT_MODEL`, `AGENTKIT_EFFORT`, `AGENTKIT_COMMAND` and `AGENTKIT_PROFILE`, from the same table that picks the profile. The configuration read alone cannot work in the sessions that need it most: the `architect` profile is `sandbox_mode = "read-only"` scoped to the workspace and `~/.codex/` is outside it, so a `/redteam` session cannot open the file the rule names and falls to the self-report, which stops — every time, on the one command whose routing already required the strongest model. Environment variables cross that boundary; configuration files do not. A stamp naming a tier no alias row carries is treated as unreadable and falls through.
