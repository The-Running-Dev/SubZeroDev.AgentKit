# decision/2026-09-05-track-creates-a-project-when-none-exists
Date: 2026-09-05
Anchor: 2026-09-05 — `/track` creates a project when none exists; the 2026-08-03 entry is amended to say so
Status: accepted
StatedIn: unit/command/track § Projects, unit/document/agents-md § Tracking work

## Claim
`/track` creates a project named after the repository when none matches, adds every issue it
opened to it, and says that it did. The board is bare, because column and field structure is a
design choice a command gets generically wrong. Creating and adding stay the only project
writes; removing an issue, changing a status field, reordering a board and deleting a project
all stay out. `Rank`'s degradation is unchanged, and its reason is the cases that actually
produce a projectless repository — one the account does not own, one where the `project` scope
was never granted, and one `/track` has not run in yet — rather than a rule against creating one.
