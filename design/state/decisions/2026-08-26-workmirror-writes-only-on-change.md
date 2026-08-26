# decision/2026-08-26-workmirror-writes-only-on-change
Date: 2026-08-26
Anchor: 2026-08-26 — `Update-WorkMirror.ps1` writes a `WorkRef` only when a mirrored field changed
Status: accepted

## Claim
`Update-WorkMirror.ps1` writes a `WorkRef` only when a mirrored field changed — `Title`,
`State`, `Criteria`, `Rank` — and stamps `MirroredAt` on every write it does make.
`MirroredAt` is not a mirrored field and never triggers a write by itself, so a run over an
unmoved tracker leaves every record byte-identical and produces no commit. `MirroredAt`
therefore dates the mirror's content, not the tracker's last consultation. `MirrorStale`'s
comparison is unchanged.
