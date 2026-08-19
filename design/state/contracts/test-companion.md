# contract/test-companion
Status: active
Owner: unit/script/test-companion
Declaration: tools/Test-Companion.ps1

## Semantics
The category vocabulary is read out of `.claude/COMPANIONS.md`'s own table, never duplicated
here — a second list in this script would be the copy that rots invisibly, since both would
still parse. A companion that is missing, empty, or frontmatter-only is absent — counted, never
a finding. Exit codes: 0 `Valid`, 1 `Invalid`, 2 `NotEvaluated` — a target with no
`.claude/commands/` or no `.claude/COMPANIONS.md` is could-not-evaluate, never a pass.
`-TargetRepo` defaults to the current directory; `-Quiet` suppresses the printed report only,
and the result object and exit code are unchanged either way.
