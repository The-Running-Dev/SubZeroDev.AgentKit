# decision/2026-09-15-install-agentkit-built
Date: 2026-09-15
Anchor: 2026-09-15 — `tools/Install-AgentKit.ps1` is built: home-install phase 2
Status: accepted

## Claim
`tools/Install-AgentKit.ps1` installs, updates, rolls back, and uninstalls the machine-wide `~/.agent-kit` checkout for `reports/2026-09-14-home-install-plan.md` phase 2. It tracks every link, hook entry, and pointer block it creates in `$HOME/.agent-kit-state/installed.json`, kept outside the checkout, so `-Uninstall` and a version change only ever touch state this script itself owns.
