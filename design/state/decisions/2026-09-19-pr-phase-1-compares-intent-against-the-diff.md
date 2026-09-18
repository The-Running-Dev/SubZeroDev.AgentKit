# decision/2026-09-19-pr-phase-1-compares-intent-against-the-diff
Date: 2026-09-19
Anchor: 2026-09-19 — `/pr` phase 1 compares stated intent against the diff, against ids rather than against prose
Status: accepted
StatedIn: "unit/command/pr § Phase 1 — the pull request and its description"

## Claim
`/pr` phase 1 gains an intent-versus-delivered comparison, run before the description is written so
its result goes into the body as it is composed rather than as a later edit. It reports two
directions — a path on the diff no stated criterion, `Touches` entry, or named cause reaches, and a
criterion about to be reported met with nothing on the diff behind it — and it is informational,
editing neither the statement nor the diff to make them agree. The mechanism is adapted from
`gstack`'s "Scope Drift Detection", which infers intent from commit messages and a plan file because
that is all it has; here the comparison is made against criteria ids and `Touches` paths, which are
already authoritative and already checkable, so the result is a check rather than a judgement about
whether a prose summary covers a diff. Three front doors supply intent, not two: `/slice` gives ids
and `Touches`; `/fix` gives an issue agent block, the cause stated before the patch, and the
reproduction that cause had to clear, with no ids, so the second direction has no left-hand side and
the report says so rather than reporting it clean; `/pr` standalone gives the issue the branch closes
plus the commit messages. Where no intent can be established the verdict is `not assessed` naming
why, because inferring it from the diff would make the check agree with itself every time while
reading as a clean result. Three kinds of path are accounted for without a criterion of their own —
descriptive drift corrected in the same commit, the decision-log entry and design-state records a
decision obliges, and `.claude/verify-report.json` where phase 2 wrote it into the branch — and
naming one is a false positive. The verdict lives in the agent block beside the two statements it is
derived from; a verdict other than clean also states one sentence in the human-first paragraph,
because the reviewer who reads only the top of the body is the reader the check exists to reach,
while a clean verdict there would be noise.
