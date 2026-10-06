---
name: plan
description: Break the contract into vertical slices with acceptance criteria
disable-model-invocation: true
---

Read `design/10-design.md` and `design/20-contract.md`. Write `design/30-slices.md`, after `node tools/ensure-project-files.ts --repo-root . --design 30-slices.md --pointer --hook` has put the template in place where it is missing.

Slices are **vertical**: each one goes from entry point to persistence and leaves the system runnable. A slice that only adds a layer ("build the data access layer") is wrong — it cannot be run, so it cannot be verified, so it accumulates undetected error.

Per slice:

```
## S<n> — <name>
Status: todo
Delivers: <one or two sentences, written as a user story: who this is for and what they
          can do afterwards that they could not before — no pixel values, breakpoints,
          file paths, or type names.>
Touches: <files or modules, from the contract>
Depends on: <slice numbers, or none>
Acceptance:
  - S<n>.1 <criterion, stated as an observable behaviour with concrete inputs and outputs>
  - S<n>.2 <...>
Out of scope: <the adjacent thing an agent will be tempted to also do>
```

Rules:
- Acceptance criteria must be checkable without judgement. "Handles errors gracefully" is not a criterion. "Returns `NotFound` and leaves the record untouched when the id does not exist" is. This is where precise, technical detail belongs — measurements, thresholds, exact values — not in `Delivers:`.
- **Every criterion carries a stable id** — `S3.1`, `S3.2` — so a pull request can report each one by id.
- **Ids are never reused and never renumbered.** Removing `S3.2` leaves a gap; the next criterion is `S3.4`.
- **`Status:` is how `/next` tracks progress.** Every new slice starts `todo`; `/next` sets it to `done` in that slice's own pull request. There is no separate tracker.
- `Delivers:` is the only line written for a non-implementer: a sentence about a person, not a spec summary.
- Every slice needs an explicit `Out of scope` line. This is the single most effective constraint on an implementing agent.
- Order slices so the riskiest assumption in the design gets exercised earliest. If the design bets on something working, slice 1 or 2 should prove it.
- Size a slice as one pull request a reviewer can read in one sitting. If it needs more, split it.
- No slice may introduce a signature absent from the contract.

Write the document only. Report in the `AGENTS.shared.md` § *Reporting* shape; `Next:` is `/next`, which builds every slice in order through to merge.

## Re-run

A re-run only appends new slices. It never rewrites a slice whose `Status:` is `done`, and never renumbers or reuses an id. A slice not yet started may be resized or split; give the new slices fresh ids.
