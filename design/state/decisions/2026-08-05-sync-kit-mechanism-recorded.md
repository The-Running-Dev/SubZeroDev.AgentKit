# decision/2026-08-05-sync-kit-mechanism-recorded
Date: 2026-08-05
Anchor: 2026-08-05 — Kit-owned files sync by git diff against the recorded install sha; everything else stays `/install`'s
Status: accepted

## Claim
Kit-owned files sync by treating git as a diff engine rather than transport: `.claude/kit.json`'s recorded sha is a merge base, so `git diff <recorded>..HEAD` gives what changed upstream and comparing each target file against the kit at that sha says whether the target edited it. Unmodified files take the update; modified ones are reported and skipped, never merged, and the scope is the kit-owned files only.
