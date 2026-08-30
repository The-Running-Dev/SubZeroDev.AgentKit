# unit/command/install-code-review-agent
Kind: command
Status: active
Anchor: .claude/commands/install-code-review-agent.md
Consumes:
Exposes:
Binds:
Live: decision/2026-08-21-install-code-review-agent-writes-the-workflow-file-only
Questions:
Work:
Evidence:

## Owns
Writes Anthropic's `claude-code-action` GitHub Actions workflow file into a target repository so pull requests get automated Claude review — the GitHub App install and the API-key/OAuth-token secret stay the user's own action.
