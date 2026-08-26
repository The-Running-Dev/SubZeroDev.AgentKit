# contract/update-workmirror
Status: active
Owner: unit/script/update-workmirror
Declaration: tools/Update-WorkMirror.ps1

## Semantics
Writes `WorkRef` records and nothing else — never an issue, never a label, never a milestone,
never git. One record per currently-open issue. A record is written **only when a mirrored field
changed** — `Title`, `State`, `Criteria`, `Rank` — and `MirroredAt` is stamped with the current
commit on every write that does happen. `MirroredAt` is not itself a mirrored field and never
triggers a write, so a run over an unmoved tracker leaves every record byte-identical.
`MirroredAt` dates the content, not the last consultation. `Rank` degrades rather than
failing: the issue's position in the per-repository GitHub Project when one places it, otherwise
its milestone number, otherwise the issue number — falling through is not a finding, and an
emitted record never lacks a `Rank`. `gh` missing or unauthenticated is could-not-evaluate and
writes no mirror, never an empty one. Never runs while `design/FROZEN.md` exists.
