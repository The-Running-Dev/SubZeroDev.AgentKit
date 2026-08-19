# contract/fix
Status: active
Owner: unit/command/fix
Declaration: prose

## Semantics
Invocation: `/fix <issue number>`, `/fix <description>`, or `/fix` with a failing test in
context. Reads the defect source, the bug issue's agent block, the repository's gates via
`/verify`, and `AGENTS.md`. Writes one branch, one or more commits, one pull request, and — only
on the description path, only after reproducing — one bug issue. Must output the reproduction
evidence, the issue number it is implementing against, `/verify`'s three lists, the batch
request, the pushed SHA, and the `WaitResult`. Must not edit `design/`, open a draft pull
request, resolve a thread, merge, or open an issue for a defect it did not reproduce. Stop
conditions are owned by the `<!-- agent:start -->` block in `.github/ISSUE_TEMPLATE/bug.md`,
not restated here. Never writes a record (I6): `design/state/` is inside `design/`.
