# contract/fix
Status: active
Owner: unit/command/fix
Declaration: prose

## Semantics
Invocation: `/fix <issue number>`, `/fix <description>`, or `/fix` with a failing test in
context. Reads the defect source, the bug issue's agent block, that unit's closure rather than
the corpus where `design/state/` exists (I27), and `AGENTS.md`. Writes one branch, one or more
commits, one pull request carrying its real description from the moment it is opened, and — only
on the description path, only after reproducing — one bug issue. Must output the reproduction
evidence, the issue number it is implementing against, and the branch and pull request it
opened; the gates and the review threads are `/pr`'s, so `/verify`'s three lists, the pushed SHA
and the `WaitResult` are output there and not here. Must not edit `design/`, open a draft pull
request, resolve a thread, merge, open an issue for a defect it did not reproduce, or widen the
change to an adjacent defect noticed along the way. Stop conditions are owned by the
`<!-- agent:start -->` block in `.github/ISSUE_TEMPLATE/bug.md`, not restated here. Never writes
a record (I6): `design/state/` is inside `design/`.
