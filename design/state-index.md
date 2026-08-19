# Design state — index

The corpus-wide facts a single record cannot state alone: the unit table of contents, and the
four reverse edges `design/10-design.md` § *Derived* forbids writing onto a record
(`Invariant.BoundBy`, `Contract.Consumers`, `Decision.Affects`, `Question.Affects`). Every
table below is a **projected** marked region (`AGENTS.md` § *Marked regions*) — rendered by
`tools/Update-DesignProjection.ps1` from `design/state/`, and overwritten on every
regeneration. Nothing here is written by hand.

This is the brief's *Offline and unaided* table of contents (`design/00-brief.md`; the `units`
row of the minimum projection set names this document, `design/20-contract.md` §
`tools/Update-DesignProjection.ps1`). Coverage grows as more records are written — see
`design/30-slices.md` for which slice writes which unit's record next; an empty table here
means no record exists yet, not that nothing is true.

## Units

<!-- units:start -->
| Id | Kind | Anchor |
|---|---|---|
| `unit/command/brief-check` | command | `.claude/commands/brief-check.md` |
| `unit/command/contract` | command | `.claude/commands/contract.md` |
| `unit/command/design` | command | `.claude/commands/design.md` |
| `unit/command/done` | command | `.claude/commands/done.md` |
| `unit/command/fix` | command | `.claude/commands/fix.md` |
| `unit/command/freeze` | command | `.claude/commands/freeze.md` |
| `unit/command/install` | command | `.claude/commands/install.md` |
| `unit/command/install-all` | command | `.claude/commands/install-all.md` |
| `unit/command/kit-help` | command | `.claude/commands/kit-help.md` |
| `unit/command/kit-sync` | command | `.claude/commands/kit-sync.md` |
| `unit/command/make-human-docs` | command | `.claude/commands/make-human-docs.md` |
| `unit/command/pr` | command | `.claude/commands/pr.md` |
| `unit/command/reconcile` | command | `.claude/commands/reconcile.md` |
| `unit/command/redteam` | command | `.claude/commands/redteam.md` |
| `unit/command/refine` | command | `.claude/commands/refine.md` |
| `unit/command/resolve` | command | `.claude/commands/resolve.md` |
| `unit/command/slice` | command | `.claude/commands/slice.md` |
| `unit/command/slices` | command | `.claude/commands/slices.md` |
| `unit/command/track` | command | `.claude/commands/track.md` |
| `unit/command/unfreeze` | command | `.claude/commands/unfreeze.md` |
| `unit/command/verify` | command | `.claude/commands/verify.md` |
| `unit/document/agents-md` | document | `AGENTS.md` |
<!-- units:end -->

## Invariants — bound by

<!-- bound-by:start -->
| Invariant | Bound by |
|---|---|
| I3 | `unit/document/agents-md` |
| I4 | `unit/document/agents-md` |
| I9 | `unit/document/agents-md` |
| I28 | `unit/command/track` |
<!-- bound-by:end -->

## Contracts — consumers

<!-- consumers:start -->
| Contract | Consumers |
|---|---|
| _(no contract records yet)_ | |
<!-- consumers:end -->

## Decisions — in force for

<!-- decision-affects:start -->
| Decision | In force for |
|---|---|
| decision/2026-08-03-track-adds-to-existing-project | `unit/command/track` |
| decision/2026-08-10-frozen-md-marker | `unit/document/agents-md` |
<!-- decision-affects:end -->

## Questions — blocks

<!-- question-affects:start -->
| Question | Blocks |
|---|---|
| _(no question records yet)_ | |
<!-- question-affects:end -->
