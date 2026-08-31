# decision/2026-08-25-code-review-defaults-high-effort-fix-push
Date: 2026-08-25
Anchor: 2026-08-25 — `/code-review` defaults to `high` effort, always runs `--fix`, and its fixes are committed and pushed
Status: accepted
StatedIn: unit/document/agents-md § Command routing

## Claim
`AGENTS.md` § *Command routing*'s `/code-review` row now states `high` as an unconditional effort floor rather than reusing whatever level was last typed, and states `--fix` is always passed rather than optional. A `--fix` run's changes are committed and pushed under § *Git and delivery*'s now-unconditional branch delegation rather than a rule restated here — a code-review fix is not a special case needing a separate ask. `--comment` is unaffected.
