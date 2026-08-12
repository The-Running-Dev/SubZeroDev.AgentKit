---
description: Install or upgrade the agent kit in a repository. Usage - /install D:\Projects\Some.Repo
argument-hint: <other repo path>
---

Install the agent kit. **$1** is the other end — the target if you are running this from the kit, the kit if you are running this from a target.

Work out which is which before anything else: the kit is the tree containing `INSTALL.md` and `.claude/commands/design.md`. If both ends look like kits, or neither does, stop and ask.

Read `INSTALL.md` from the kit and follow it exactly. It is the procedure; this command only locates it.

Do not summarise `INSTALL.md` back to me. Execute it, and stop at its phase 3 report as instructed.

## Re-run

Every run reclassifies each artifact from scratch against `INSTALL.md` phase 1 — nothing from
a prior run is remembered. An artifact already reconciled reports identical and is skipped; an
occupied fork resolved on a prior run is only skipped once the target's own tree reflects that
resolution, not because this command remembers asking before. Re-running after a fork was
answered must not ask the same fork again.
