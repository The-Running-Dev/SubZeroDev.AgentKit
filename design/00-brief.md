# Brief — the agent kit

> Rewritten 2026-10-04 to match the workflow redesign (#436). The earlier brief — explicit
> design state, closure ceilings, drift detection — is `git show c3a9577:design/00-brief.md`.
> Those goals were met and then retired: the machinery cost more attention than the drift it
> caught.

## Problem

The user spends their effort on the design. Everything after it is execution, and execution was
costing them more than it saved: running `/next` and two bookkeeping commands in rotation across fresh
sessions, arguing with the model about boundaries, and reconciling documents that had drifted
from the code. The tooling had become the work.

## Goal

**The user designs; the agent builds.** After `/plan`, one `/next` builds the whole plan —
code, tests, pull request, CI, review comments, merge, branch cleanup, then the next slice — in
one session, and stops only when the plan is finished or on a genuine blocker.

## Who it is for

One developer working across several repositories on a Windows host, with Claude Code, Codex or
Copilot as the agent. The kit installs once, machine-wide (`setup.ps1`), and each repository
gets only its own `design/` and `AGENTS.md`.

## Done when

- A plan of N slices reaches merged, cleaned up and marked `done` from one `/next`, with no
  further prompt from the user.
- No command ends by telling the user to start a new session or run another command.
- `design/` is written during design and then left alone; where building departs from it, the
  pull request says so in a *Differs from design* section and nothing stops.
- Merging happens only through `tools/Merge-PullRequest.ps1`, which fails closed.

## Non-goals

- **No drift or design-state machinery.** No unit records, projections, closures, ceilings or
  per-slice issues. `/align` reconciles `design/` with the tree, on request only.
- **No mandatory gate on the design's freshness.** A stale design is a fact to report, not a
  reason to stop.
- **No model-tier or session-length gating.** Model choice is guidance; session length is not a
  stopping condition, because Claude Code compacts context automatically.
- **No scheduled or unattended housekeeping.** Cleanup runs inside `/next` or by hand.

## Environment

Windows host, PowerShell Core, projects under `D:\Dropbox\Projects\`. Concurrency is
sequential by policy, not by lock: one build session per repository at a time.
