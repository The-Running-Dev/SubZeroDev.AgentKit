# decision/2026-08-03-redteam-pass-is-phase-gate-stopping-rule-in-command
Date: 2026-08-03
Anchor: 2026-08-03 — A red-team pass is a phase gate, with its stopping rule in the command
Status: accepted
StatedIn: unit/command/redteam § Stopping rule

## Claim
`.claude/commands/redteam.md` owns a `## Stopping rule`: one invocation is one pass, at most one pass per materially changed revision, the command never self-recommends another, and findings are adjudicated one at a time and classified as defect, accepted risk, brief conflict, or not sustained. `AGENTS.md` carries one cross-cutting line — never recommend re-running a phase gate — for when `redteam.md` itself is not loaded.
