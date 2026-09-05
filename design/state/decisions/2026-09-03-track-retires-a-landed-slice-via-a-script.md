# decision/2026-09-03-track-retires-a-landed-slice-via-a-script
Date: 2026-09-03
Anchor: 2026-09-03 — `/track` retires a landed slice's body, via a new mechanical script
Status: accepted
StatedIn: unit/command/track § Landed slices → retired, contract/update-slicesdocument § Semantics

## Claim
`/track` carries a phase, *Landed slices → retired*, run immediately after the slice-to-issue sync, which invokes `tools/Update-SlicesDocument.ps1`. A slice under `design/30-slices.md` § *Outstanding* whose matching issue is closed has its full section removed and a row naming its number, name, issue, `Acceptance:` id range and last touching commit appended to § *Landed*. The script is read-only against the tracker and never touches that document's hand-authored prose, which is not derivable from the tracker; the session running the retirement corrects any prose it made stale, by hand, in the same commit. `/track` owns the phase because it already knows which issues are closed and already writes to `design/` on this document's behalf, and `/reconcile` cannot, being barred from that document. The retirement is outside the mirror-refresh direct-to-default-branch carve-out, which is scoped to `design/state/work/` and `design/state-index.md`, so it goes on a branch with a pull request like any other work.
