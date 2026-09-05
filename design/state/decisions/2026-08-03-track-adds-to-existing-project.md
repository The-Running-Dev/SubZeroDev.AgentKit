# decision/2026-08-03-track-adds-to-existing-project
Date: 2026-08-03
Anchor: 2026-08-03 — `/track` adds issues to an existing project, and never creates one
Status: accepted
StatedIn: unit/command/track § Projects

## Claim
`/track` matches a GitHub Project by repository name and adds every issue it opens to it. A
project step that cannot run — the `project` scope is absent — skips only that step, not the
whole sync.
