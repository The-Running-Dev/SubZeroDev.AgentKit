# decision/2026-08-03-track-adds-to-existing-project
Date: 2026-08-03
Anchor: 2026-08-03 — `/track` adds issues to an existing project, and never creates one
Status: accepted

## Claim
`/track` matches a GitHub Project by repository name and adds every issue it opens to it. It
never creates a project, and a missing board skips only the project step, not the whole sync.
