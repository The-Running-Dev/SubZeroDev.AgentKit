# decision/2026-09-18-a-finding-cites-its-evidence-or-it-is-demoted
Date: 2026-09-18
Anchor: 2026-09-18 — A finding cites its evidence, or it is demoted
Status: accepted
StatedIn: "unit/document/agents-md § Verification"

## Claim
`AGENTS.shared.md` § *Verification* gains a sixth rule, binding the one output the other five do
not reach: a finding, which a reader acts on without re-deriving it. A finding about the tree
names the `path:line` it rests on, read in that session rather than recalled; a finding about a
document names the file and section; a finding asserting something is absent names where the
thing would be and the search that came back empty, because absence has no line of its own. A
finding that can carry none of these is demoted rather than dropped — reported below the cited
ones, under a heading saying it is uncited — so the rule ranks by evidence instead of losing
findings a session could not cite. It binds every finding-producing command at once,
`/code-review`, `/redteam`, `/align` and `/resolve`'s classification, and changes nothing about
what any of them may recommend, leaving `/redteam`'s prohibition on naming fixes intact.
