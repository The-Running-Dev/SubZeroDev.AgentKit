---
name: install
description: Install or upgrade the agent kit in a repository. Usage - /install D:\Projects\Some.Repo
argument-hint: <other repo path>
disable-model-invocation: true
---

<!-- companion:declared:start -->
**Per-repo companion:** `skills/install/SKILL-local.md`. Read it now, if it exists — an absent,
empty, or frontmatter-only file is no companion, and this file then stands alone.
It may override: `extra-steps`, `tightened-authorization`. It may never override anything in
[`.claude/COMPANIONS.md`](../../.claude/COMPANIONS.md) § *Never*, which is also where these categories are defined.
<!-- companion:declared:end -->

Install the project-owned part of AgentKit. In a global skill invocation the adapter names the
canonical kit root; otherwise resolve `$env:AGENTKIT_HOME`, then `$HOME/.agent-kit`. Read that
runtime's `INSTALL.md`. The kit itself is not the target repository.

**$1** is the target repository path. When invoked from a target with the canonical kit path as
`$1` (the legacy reverse invocation), keep the current repository as the target. If the target is
omitted, use the current repository. If both ends are kits, stop and ask. If no runtime exists,
follow README.md's public clone-and-setup instructions; never require a developer checkout or
copy kit-owned cores and scripts into the target.

Read `INSTALL.md` from the kit and follow it exactly. It is the procedure; this command only locates it.

Do not summarise `INSTALL.md` back to me. Execute it, and stop at its phase 3 report as instructed.

## Re-run

Every run reclassifies each artifact from scratch against `INSTALL.md` phase 1 — nothing from
a prior run is remembered. An artifact already reconciled reports identical and is skipped; an
occupied fork resolved on a prior run is only skipped once the target's own tree reflects that
resolution, not because this command remembers asking before. Re-running after a fork was
answered must not ask the same fork again.

Kit-owned command cores do not reclassify or copy into a target. The target's own per-command
content lives in a companion this command never reads or writes; adapters and owned links resolve
the core from the canonical installed checkout.
