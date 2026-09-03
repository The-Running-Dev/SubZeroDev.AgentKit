# decision/2026-08-05-fix-is-a-new-command-files-own-bug-issue
Date: 2026-08-05
Anchor: 2026-08-05 — `/fix` is a new command, and files its own bug issue after reproducing
Status: accepted
StatedIn: unit/command/fix § Get to an issue

## Claim
`.claude/commands/fix.md` takes an issue number, a description, or a failing test already in context; it always reproduces before filing, branching, or editing, and on the description path files a bug issue from `.github/ISSUE_TEMPLATE/bug.md` only after reproducing. It hands off through `/verify` then `/pr` then `/resolve` in the same session, and implements against the bug issue's own agent block rather than carrying a second copy of its constraints.
