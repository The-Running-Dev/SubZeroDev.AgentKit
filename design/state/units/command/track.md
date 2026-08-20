# unit/command/track
Kind: command
Status: active
Anchor: .claude/commands/track.md
Consumes: contract/test-designdrift, contract/update-workmirror
Exposes:
Binds: I28
Live: decision/2026-08-03-track-adds-to-existing-project, decision/2026-08-03-acceptance-criteria-copied-into-issue, decision/2026-08-03-work-defers-to-github-track-owns-github-writes, decision/2026-08-04-github-writes-widely-carved-out
Archival:
Questions: question/question-record-writer
Work:
Evidence:

## Owns
Syncs `design/` into GitHub issues, milestones, and `WorkRef` mirrors — idempotent, safe to
re-run, and the sole writer of a `WorkRef` (I28).
