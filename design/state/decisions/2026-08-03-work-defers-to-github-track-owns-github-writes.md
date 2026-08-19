# decision/2026-08-03-work-defers-to-github-track-owns-github-writes
Date: 2026-08-03
Anchor: 2026-08-03 — Work defers to GitHub issues, and `/track` owns every GitHub write
Status: accepted

## Claim
`/track` is the single command that writes to GitHub, and is idempotent so it can run often rather than being batched. `design/30-slices.md` stays authoritative for what a slice *is*; the issue tracks whether it is *done*. `## Open` is a staging area that `/track` drains into issues. Which GitHub writes need no prompt has since widened beyond this entry's original narrow carve-out — see `decision/2026-08-04-github-writes-widely-carved-out`.
