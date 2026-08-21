# decision/2026-08-21-install-code-review-agent-writes-the-workflow-file-only
Date: 2026-08-21
Anchor: 2026-08-21 — `/install-code-review-agent` writes the workflow file only, and stops before committing
Status: accepted

## Claim
`.claude/commands/install-code-review-agent.md` writes `.github/workflows/claude-code-review.yml` for Anthropic's `claude-code-action` and nothing else — it never installs the Claude GitHub App (a browser consent flow this session cannot drive) and never enters an `ANTHROPIC_API_KEY` or OAuth token value (prohibited at the session's top level regardless of per-repo delegation). It stops at a report for sign-off rather than committing, pushing, or opening a pull request — on its own reason, not a shared one: the App install and the secret are the user's own actions, so landing the workflow before they exist ships a workflow that cannot run. `/install` and `/kit-sync` no longer stop there (decision/2026-08-21-install-delivers-on-a-feature-branch).
