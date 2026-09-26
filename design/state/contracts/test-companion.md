# contract/test-companion
Status: active
Owner: unit/script/test-companion
Declaration: tools/Test-Companion.ps1

## Semantics
The category vocabulary is read out of `.claude/COMPANIONS.md`'s own table, never duplicated
here — a second list in this script would be the copy that rots invisibly, since both would
still parse. A companion that is missing, empty, or frontmatter-only is absent — counted, never
a finding. Exit codes: 0 `Valid`, 1 `Invalid`, 2 `NotEvaluated` — a target with no
`skills/` or no `.claude/COMPANIONS.md` is could-not-evaluate, never a pass.
`-TargetRepo` defaults to the current directory; `-Quiet` suppresses the printed report only,
and the result object and exit code are unchanged either way.
A companion's `tightened-authorization` override is a grammar, not prose: every non-blank line
under the heading is exactly one `ask-before` entry naming one action id, with no qualifier or
trailing reason, and the entries must be a subset of the authorization set its core's block lists
— the actions the core performs without asking, each an id from `.claude/COMPANIONS.md`'s action
table. `ask-before` is the only verb because it adds an ask and removes none, so a widening has no
form in which to be written (I33). A blank-only heading stays `EmptyCategory`; the authorization
rules do not run under a heading its core does not allow. The category and action tables are each
read scoped to their own section, since both open rows with a backticked id; a missing or empty
action table is `NotEvaluated` for the whole run. Existing prose overrides are migrated by hand
in the target that owns them; the check never rewrites a companion.
