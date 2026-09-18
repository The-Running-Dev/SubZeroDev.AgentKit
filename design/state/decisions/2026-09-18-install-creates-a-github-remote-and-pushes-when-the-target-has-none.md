# decision/2026-09-18-install-creates-a-github-remote-and-pushes-when-the-target-has-none
Date: 2026-09-18
Anchor: 2026-09-18 — Install creates a GitHub remote and pushes when the target has none
Status: accepted
StatedIn: unit/document/install-md § Phase 4 — Apply

## Claim
`INSTALL.md` phase 4 step 8's "no remote configured" case no longer stops at a local commit. It now runs `gh repo create <folder-name> --private --source=. --remote=origin`, using the resolved target root's own directory name and never an invented name, org, or visibility, then pushes and opens the pull request as usual. If `gh` is missing or unauthenticated, it falls back to the prior behavior: commit only, and report that the push and pull request did not run, rather than guessing at a remote URL. This is `AGENTS.shared.md` § *Git and delivery*'s "creating a remote repository" authorization, granted once as this procedure's own documented default rather than asked per install.
