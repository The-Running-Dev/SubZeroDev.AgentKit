# decision/2026-08-30-redteam-writes-findings-to-a-file
Date: 2026-08-30
Anchor: 2026-08-30 — `/redteam` writes its findings to `design/redteam/`, so the cross-vendor handoff is the repository rather than a copy-paste
Status: accepted

## Claim
`/redteam` writes one file per pass at `design/redteam/<YYYY-MM-DD>-<target>.md`, carrying each finding verbatim under a stable id, with `Target:` pinned to a sha and `Status: unadjudicated`. The adjudicating session edits `Status` in place to `defect`, `accepted risk`, `brief conflict` or `not sustained`. This command never changes it and still proposes no fix. The file exists because the command runs on a different vendor from the design author while adjudication happens back on the author's vendor, and a finding that lives only in one session's stdout crosses that gap by hand — the step at which a severity is softened or a finding is dropped without anyone deciding to drop it.
