---
name: unfreeze
description: Lift the design freeze — delete design/FROZEN.md, then run one reconciliation pass
disable-model-invocation: true
---

<!-- companion:declared:start -->
**Per-repo companion:** `skills/unfreeze/SKILL-local.md`. Read it now, if it exists — an absent,
empty, or frontmatter-only file is no companion, and this file then stands alone.
It may override: `vocabulary`, `document-map`, `extra-steps`. It may never override anything in
[`.claude/COMPANIONS.md`](../../.claude/COMPANIONS.md) § *Never*, which is also where these categories are defined.
<!-- companion:declared:end -->

Lift the freeze `/freeze` set. This command runs unattended, without a confirmation prompt — that is a deliberate policy in this repository (`AGENTS.shared.md`, *The design freeze*), not an oversight, so do not add one back.

**This command owns the sequence. It does not own the procedure of either phase.** Phase 2 is `skills/reconcile/SKILL.md` and phase 3 is `skills/track/SKILL.md`, run in full. Those files stay the single home for how drift is compared and how the tracker is resynced — this one never restates them (`AGENTS.shared.md`, *Single ownership*). Both remain invocable on their own.

## Split across sessions

The ordinary case is one session, start to finish (`AGENTS.shared.md`, *The design freeze*). Where the launching tool cannot change tier mid-session — Codex; `tools/Invoke-CodexCommand.ps1` chains two separate processes for exactly this reason, issue #253 — the run splits into two sessions instead, at this boundary:

- **Session 1** runs *Refuse if not frozen*, Phase 1, Phase 2, and *Commit*.
- **Session 2** runs Phase 3 and *Report*.

Session 1's commit is the handoff: session 2 reads that commit rather than being told what session 1 found. Nothing prompts the human between the two; the launching tool starts both.

## Refuse if not frozen

If `design/FROZEN.md` does not exist, stop and say there is nothing to lift.

## Phase 1 — read and delete the marker

Report `Frozen because` and `Lifts when` verbatim before touching anything — this is the last point they're readable, and the report is the record that the freeze actually ended here rather than just going stale.

Delete `design/FROZEN.md`. This command is the one exception to `/reconcile`'s own rule that it never deletes the marker itself — `/reconcile` still won't, because by the time phase 2 runs here the file is already gone.

## Phase 2 — reconcile

**Run `skills/reconcile/SKILL.md` in full** against the now-unfrozen tree. Deep-reasoning tier (`opus`, `high`) — deciding which side of a drift is correct is exactly the judgement call that tier exists for.

## Phase 3 — track

**Run `skills/track/SKILL.md` in full** once reconciliation has landed. `sonnet`, `medium` — mechanical sync against whatever `/reconcile` just wrote.

## Commit

Always commit the marker's own deletion — it is *Split across sessions*' handoff whether or not this run actually splits. If reconciliation touched `design/`, stage those files by name and commit them together with the deletion, per `AGENTS.shared.md`, *Git and delivery*, in one commit, not two. If reconciliation touched nothing, commit the deletion alone.

## Report

State the freeze is lifted, and point at the commit *Commit* produced and the issues `/track` touched rather than restating either phase's own report (`AGENTS.shared.md`, *Output discipline*). If `/reconcile` or `/track` surfaced something that needs a decision — a contested drift, a slice that turns out to need a contract amendment — stop there and ask, one item at a time, rather than resolving it inline.

## Re-run

**Refuses outright on a second run** — *Refuse if not frozen*, above — so there is nothing to
skip or refresh across repeated invocations; each successful run consumes the one marker
`/freeze` wrote, and a fresh freeze needs a fresh `/freeze` before this command has anything to
lift again.
