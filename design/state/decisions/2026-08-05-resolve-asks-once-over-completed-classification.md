# decision/2026-08-05-resolve-asks-once-over-completed-classification
Date: 2026-08-05
Anchor: 2026-08-05 — `/resolve` asks once, over a completed classification, not once per external action
Status: superseded
SupersededBy: decision/2026-08-19-resolution-batch-replaced-by-standing-delegation

## Claim
The resolution batch is requested once, only after classification is complete, and covers pushing, updating the pull request, and resolving exactly the thread ids named at the moment it was granted (I3); it does not outlive the response acting on it (I4) and is unavailable in a repository the user does not own (I9). `resolve.md`'s checks-confirmation step delegates to `Wait-PullRequestCheck.ps1` rather than reading `gh pr checks` by eye, and threads are re-queried after any wait so a batch never covers one it did not enumerate.
