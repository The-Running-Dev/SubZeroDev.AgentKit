# Red-team findings

One file per `/redteam` pass, named `<YYYY-MM-DD>-<target>.md`. The format, and the rule that
`Status:` starts as `unadjudicated` and is edited in place as each finding is ruled on, live in
[`.claude/commands/redteam.md`](../../.claude/commands/redteam.md) — not here.

These files exist because `/redteam` runs on a different vendor from the design author and
adjudication happens back on the author's vendor. Committing the findings makes the repository
the handoff, instead of a copy-paste between two sessions that cannot see each other.

A file here is evidence, not a decision. Nothing in `design/` changes because of one until I rule
on it; what survives adjudication becomes a decision-log entry or a GitHub issue, and the finding
keeps its id (`F1`, `F2`) so the two can be matched up later.
