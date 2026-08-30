# decision/2026-08-30-derived-state-commits-to-default-branch
Date: 2026-08-30
Anchor: 2026-08-30 — Derived design-state records commit straight to the default branch, and `/clean` hands off to `/next` rather than `/track`
Status: accepted

## Claim
A commit whose every path is a work-mirror record or the design-state projection, written by `Update-WorkMirror.ps1` or `Update-DesignProjection.ps1` in that same run, with nothing else modified and `Test-DesignState.ps1` reporting no blocking finding, is committed and pushed straight to the default branch and opens no pull request. Any other path on the diff voids the exception for the whole commit. `/clean` hands off to `/next` rather than naming `/track` unconditionally. Together these break a cycle in which `/track`'s own mirror refresh needed a merge, the merge put a merge on the table, `/clean` fired on it, and `/clean` handed back to `/track`. `I28` is unchanged: `/track` remains the sole writer of a `WorkRef`; only how that write reaches the default branch differs.
