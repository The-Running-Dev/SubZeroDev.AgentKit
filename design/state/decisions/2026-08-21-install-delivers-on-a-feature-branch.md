# decision/2026-08-21-install-delivers-on-a-feature-branch
Date: 2026-08-21
Anchor: 2026-08-21 — `/install` delivers on a feature branch and opens the pull request
Status: accepted

## Claim
`INSTALL.md` phase 4 step 8 delivers rather than stopping: branch from the target's default branch, stage by named path, commit, push, and open a pull request against the default branch, with the phase 3 report and step 4's recorded forks as the body. The default branch is never committed to and `git add -A` stays banned — named-path staging was always the protection, and a pull request is a reading surface where an unreviewed dirty worktree was not. A repository `git init`-ed in phase 4 step 1 has no default branch to protect and commits onto `main`; with no remote configured it commits only and reports that the push and the pull request did not run. `/kit-sync` inherits this by executing `INSTALL.md`. `/install-all` does not: it tightens the rule to no commit, push or pull request in any target, because an unattended pass over every sibling opens more pull requests than anyone can read, on repositories whose forks it has already declined to answer. `AGENTS.md` § *Git and delivery* names `/install` in the opening-a-pull-request carve-out alongside `/slice`, `/fix` and `/pr`, and names `/install-all` as deliberately outside it. Merging stays uncarved.
