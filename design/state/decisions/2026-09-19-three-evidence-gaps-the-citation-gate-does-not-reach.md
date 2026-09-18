# decision/2026-09-19-three-evidence-gaps-the-citation-gate-does-not-reach
Date: 2026-09-19
Anchor: 2026-09-19 — Three evidence gaps the finding-citation gate does not reach
Status: accepted
StatedIn: "unit/document/agents-md § Verification", "unit/command/redteam § Write the findings to a file"

## Claim
`AGENTS.shared.md` § *Verification* gains three rules after the citation gate, each closing a
surface adjacent to it where evidence appears present and is not. An empty search result is
evidence only once the search is confirmed to have run — by matching a case it must match or by
reading an exit status — because an uninstalled tool, a malformed pattern and a genuinely empty
corpus return identical output, and unlike a gate a search that does not run raises nothing. A
dismissal resting on the thing being handled elsewhere cites the `path:line` that handles it, read
that session, since the citation gate binds emissions and a concern dropped as "probably handled
upstream" is never emitted. A findings report opens by naming its coverage as **complete**,
**partial** or **not assessed**, with what was left out and why for anything short of complete,
and never infers a clean result from absent output. `skills/redteam/SKILL.md` carries the third as
a `Coverage:` field in its findings-file header, without which the rule has nowhere to be executed;
its existing "none at this level" bullet is unchanged, being about padding rather than coverage.
