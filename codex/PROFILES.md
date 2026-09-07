# Codex profiles

Two formats exist depending on your CLI version. Check with `codex --version`, and confirm what actually loaded with `/status` inside a session rather than trusting the file.

## Codex 0.134.0 and later — one file per profile

`--profile` no longer reads `[profiles.<name>]` from `config.toml`, and the top-level `profile = "..."` selector is gone. Each profile is its own file in `~/.codex/`, layered above your base config, so it only needs the keys that differ.

**`~/.codex/architect.config.toml`**
```toml
model = "gpt-5.6-sol"
model_reasoning_effort = "high"
approval_policy = "on-request"
sandbox_mode = "read-only"
```

**`~/.codex/author.config.toml`**
```toml
model = "gpt-5.6-sol"
model_reasoning_effort = "high"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

**`~/.codex/builder.config.toml`**
```toml
model = "gpt-5.6-terra"
model_reasoning_effort = "medium"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

**`~/.codex/quick.config.toml`**
```toml
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

## Before 0.134.0 — sections in `~/.codex/config.toml`

```toml
model = "gpt-5.6-terra"
model_reasoning_effort = "medium"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[profiles.architect]
model = "gpt-5.6-sol"
model_reasoning_effort = "high"
sandbox_mode = "read-only"

[profiles.author]
model = "gpt-5.6-sol"
model_reasoning_effort = "high"
sandbox_mode = "workspace-write"

[profiles.builder]
model = "gpt-5.6-terra"
model_reasoning_effort = "medium"

[profiles.quick]
model = "gpt-5.3-codex-spark"
model_reasoning_effort = "medium"
```

## Notes

- `architect` is deliberately `read-only`. It backs `/redteam` (and `/brief-check`, which also writes nothing) — stages that have no business touching the working tree, where the sandbox is a cheaper guarantee than an instruction.
- `author` is the same model and effort as `architect`, but `workspace-write`. It backs `/design`, `/contract`, `/slices`, and `/reconcile` — deep-reasoning-tier commands whose normal work is writing to `design/`. Splitting it from `architect` keeps the read-only guarantee meaningful for `/redteam` instead of blocking every other deep-reasoning command from doing its job.
- `xhigh` is expensive and is not either profile's default — see `AGENTS.md`, *Model, effort, and review budget*: "`xhigh` is for one question, not one pipeline." Reach for it with `-Effort xhigh` on a single ambiguous question, not as a phase-wide default. `max` is Sol-only and worth reserving for a design you have already failed to get right twice.
- Alt+`,` and Alt+`.` adjust effort mid-session. Profiles cannot be switched mid-session.
- Model IDs churn. Verify against current Codex model docs before committing these to a repo.

## Project-level config

`.codex/config.toml` at the repo root is committed and overrides user config. Use it to pin the sandbox and approval policy for a given project, not the model — model choice is per-stage, not per-repo.

```toml
# .codex/config.toml
sandbox_mode = "workspace-write"
approval_policy = "on-request"

[sandbox_workspace_write]
network_access = false
```
