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
| `unit/document/agent-md` | document | `agent.md` |
| `unit/document/agents-md` | document | `AGENTS.md` |
| `unit/document/codex-profiles` | document | `codex/PROFILES.md` |
| `unit/document/companions-md` | document | `.claude/COMPANIONS.md` |
| `unit/document/design-00-brief` | document | `design/00-brief.md` |
| `unit/document/design-10-design` | document | `design/10-design.md` |
| `unit/document/design-20-contract` | document | `design/20-contract.md` |
| `unit/document/design-30-slices` | document | `design/30-slices.md` |
| `unit/document/design-90-decisions` | document | `design/90-decisions.md` |
| `unit/document/design-cost` | document | `design/cost.md` |
| `unit/document/design-state-index` | document | `design/state-index.md` |
| `unit/document/install-md` | document | `INSTALL.md` |
| `unit/document/issue-template-bug` | document | `.github/ISSUE_TEMPLATE/bug.md` |
| `unit/document/issue-template-story` | document | `.github/ISSUE_TEMPLATE/story.md` |
| `unit/document/readme-md` | document | `README.md` |
| `unit/document/template-00-brief` | document | `templates/design/00-brief.md` |
| `unit/document/template-10-design` | document | `templates/design/10-design.md` |
| `unit/document/template-20-contract` | document | `templates/design/20-contract.md` |
| `unit/document/template-30-slices` | document | `templates/design/30-slices.md` |
| `unit/document/template-90-decisions` | document | `templates/design/90-decisions.md` |
| `unit/script/invoke-donehousekeeping` | script | `tools/Invoke-DoneHousekeeping.ps1` |
| `unit/script/measure-session` | script | `tools/Measure-Session.ps1` |
| `unit/script/new-designdocs` | script | `tools/New-DesignDocs.ps1` |
| `unit/script/read-designstate` | script | `tools/Read-DesignState.ps1` |
| `unit/script/sync-kit` | script | `tools/Sync-Kit.ps1` |
| `unit/script/test-companion` | script | `tools/Test-Companion.ps1` |
| `unit/script/test-designdrift` | script | `tools/Test-DesignDrift.ps1` |
| `unit/script/test-designstate` | script | `tools/Test-DesignState.ps1` |
| `unit/script/test-gatescache` | script | `tools/Test-GatesCache.ps1` |
| `unit/script/test-verifyreport` | script | `tools/Test-VerifyReport.ps1` |
| `unit/script/test-writesurface` | script | `tools/Test-WriteSurface.ps1` |
| `unit/script/update-designprojection` | script | `tools/Update-DesignProjection.ps1` |
| `unit/script/wait-pullrequestcheck` | script | `tools/Wait-PullRequestCheck.ps1` |
<!-- units:end -->

## Invariants — bound by

<!-- bound-by:start -->
| Invariant | Bound by |
|---|---|
| I3 | `unit/document/agents-md` |
| I4 | `unit/document/agents-md` |
| I6 | `unit/command/fix` |
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
| decision/2026-08-02-design-dir-relocatable-at-install | `unit/document/install-md` |
| decision/2026-08-02-design-docs-default-to-design-dir | `unit/document/install-md` |
| decision/2026-08-02-house-convention-path-corrected | `unit/document/agents-md` |
| decision/2026-08-02-import-only-project-independent-conventions | `unit/document/agents-md` |
| decision/2026-08-02-installing-is-agent-executed-reconciliation | `unit/command/install`, `unit/document/install-md` |
| decision/2026-08-02-lesson-capture-is-reconcile-output | `unit/command/reconcile` |
| decision/2026-08-02-lessons-file-never-merged-into | `unit/document/install-md` |
| decision/2026-08-02-lessons-live-in-agent-md | `unit/document/agent-md`, `unit/document/agents-md` |
| decision/2026-08-02-target-wins-every-divergence | `unit/document/install-md` |
| decision/2026-08-03-acceptance-criteria-copied-into-issue | `unit/command/track` |
| decision/2026-08-03-agent-block-points-where-doc-governs-and-is-fenced | `unit/document/agents-md` |
| decision/2026-08-03-install-decisions-get-a-home | `unit/document/install-md` |
| decision/2026-08-03-issues-read-human-first-agent-detail-collapsed | `unit/document/agents-md`, `unit/document/issue-template-bug`, `unit/document/issue-template-story` |
| decision/2026-08-03-kits-commit-is-its-version | `unit/document/install-md` |
| decision/2026-08-03-make-human-docs-generated-drift-checked | `unit/command/make-human-docs` |
| decision/2026-08-03-model-routing-names-families-lives-in-agents-md | `unit/document/agents-md` |
| decision/2026-08-03-pr-defers-to-repository-merge-convention | `unit/command/pr` |
| decision/2026-08-03-reconciliation-ends-in-decision-not-report | `unit/document/agents-md` |
| decision/2026-08-03-redteam-pass-is-phase-gate-stopping-rule-in-command | `unit/command/redteam`, `unit/document/agents-md` |
| decision/2026-08-03-resolve-classifies-in-bulk-asks-on-ambiguous | `unit/command/resolve` |
| decision/2026-08-03-ticking-checkbox-is-the-users | — |
| decision/2026-08-03-track-adds-to-existing-project | `unit/command/track` |
| decision/2026-08-03-verify-discovers-gates-reports-what-did-not-run | `unit/command/verify` |
| decision/2026-08-03-work-defers-to-github-track-owns-github-writes | `unit/command/track`, `unit/document/agents-md` |
| decision/2026-08-04-cost-measured-by-script-taxonomy-is-policy | `unit/document/agents-md`, `unit/script/measure-session` |
| decision/2026-08-04-github-writes-widely-carved-out | `unit/command/slice`, `unit/command/track`, `unit/document/agents-md` |
| decision/2026-08-04-install-all-runs-unattended-never-resolves-fork | `unit/command/install-all` |
| decision/2026-08-04-kit-help-holds-walkthrough-orients-before-reciting | `unit/command/kit-help` |
| decision/2026-08-04-measure-session-claude-code-only-errors-not-zero | `unit/script/measure-session` |
| decision/2026-08-04-pester-tests-and-ci-gate-for-measure-session | `unit/script/measure-session` |
| decision/2026-08-04-refine-is-a-front-door-between-stages | `unit/command/refine` |
| decision/2026-08-04-session-boundaries-are-policy-in-agents-md | `unit/document/agents-md` |
| decision/2026-08-04-sessionend-hook-writes-cost-log | `unit/document/install-md`, `unit/script/measure-session` |
| decision/2026-08-04-slice-creates-own-branch-and-pushes | `unit/command/slice` |
| decision/2026-08-04-slice-takes-no-argument-reads-doneness-from-tracker | `unit/command/slice` |
| decision/2026-08-04-userpromptsubmit-hook-warns-on-session-size | `unit/document/install-md`, `unit/script/measure-session` |
| decision/2026-08-05-design-filled-for-one-path-scoped-brief-unwritten | `unit/document/design-10-design` |
| decision/2026-08-05-fix-is-a-new-command-files-own-bug-issue | `unit/command/fix` |
| decision/2026-08-05-resolve-asks-once-over-completed-classification | `unit/command/resolve`, `unit/document/agents-md` |
| decision/2026-08-05-seed-moves-to-templates-design | `unit/document/install-md` |
| decision/2026-08-05-sync-kit-mechanism-recorded | `unit/script/sync-kit` |
| decision/2026-08-08-done-housekeeping-scripts-everything-before-ask | `unit/command/done`, `unit/script/invoke-donehousekeeping` |
| decision/2026-08-08-kit-sync-new-command | `unit/command/kit-sync` |
| decision/2026-08-08-pr-absorbs-gates-drafts-abolished | `unit/command/fix`, `unit/command/pr`, `unit/command/slice`, `unit/document/agents-md` |
| decision/2026-08-08-sync-kit-built | `unit/document/install-md`, `unit/script/sync-kit` |
| decision/2026-08-08-tier-mismatch-gates-symmetrically | `unit/document/agents-md` |
| decision/2026-08-10-frozen-md-marker | `unit/document/agents-md` |
| decision/2026-08-11-documents-state-only-what-tree-cannot | `unit/command/reconcile`, `unit/document/agents-md`, `unit/document/design-20-contract`, `unit/document/design-30-slices` |
| decision/2026-08-12-codex-aliases-luna-and-codex-spark | `unit/document/agents-md` |
| decision/2026-08-12-codex-vendor-alias-list-for-sol-terra | `unit/document/agents-md` |
| decision/2026-08-12-commands-split-core-and-companion | `unit/document/companions-md`, `unit/script/test-companion` |
| decision/2026-08-12-install-all-write-surface-guard | `unit/command/install-all`, `unit/script/test-writesurface` |
| decision/2026-08-13-codex-alias-gpt-5-added | `unit/document/agents-md` |
| decision/2026-08-13-gate-check-comparison-by-tier-not-literal-name | `unit/document/agents-md` |
| decision/2026-08-19-anchormissing-widens-to-every-tree-pointer | `unit/document/design-20-contract`, `unit/script/test-designstate` |
| decision/2026-08-19-brief-written-kit-owned-mechanism-proven-here-only | `unit/document/design-00-brief` |
| decision/2026-08-19-contract-becomes-repository-scoped | `unit/command/contract`, `unit/document/design-20-contract` |
| decision/2026-08-19-contract-owner-stays-written-other-edges-derived | `unit/document/design-10-design`, `unit/document/design-20-contract` |
| decision/2026-08-19-design-state-becomes-addressable-records | `unit/document/design-10-design` |
| decision/2026-08-19-document-kind-reaches-shipped-payload | `unit/document/codex-profiles`, `unit/document/design-20-contract`, `unit/document/issue-template-bug` |
| decision/2026-08-19-enforcement-states-tree-as-it-stands | `unit/document/design-20-contract` |
| decision/2026-08-19-four-open-questions-closed-unit-set-widens | `unit/document/design-00-brief`, `unit/document/design-10-design`, `unit/document/design-20-contract` |
| decision/2026-08-19-invariant-set-is-the-contract-table | `unit/document/design-20-contract`, `unit/script/test-designstate` |
| decision/2026-08-19-marked-region-marker-declares-its-own-kind | `unit/document/agents-md`, `unit/document/design-20-contract` |
| decision/2026-08-19-pr-real-description-at-open | `unit/command/fix`, `unit/command/pr`, `unit/command/slice` |
| decision/2026-08-19-record-ids-kind-prefixed-slugs | `unit/document/design-10-design`, `unit/document/design-20-contract` |
| decision/2026-08-19-retirement-is-status-field | `unit/document/design-10-design`, `unit/document/design-20-contract` |
| decision/2026-08-19-state-index-md-added | `unit/document/design-20-contract`, `unit/document/design-state-index` |
| decision/2026-08-19-state-set-one-file-per-record-ps1-tooling | `unit/document/design-10-design`, `unit/document/design-20-contract` |
<!-- decision-affects:end -->

## Questions — blocks

<!-- question-affects:start -->
| Question | Blocks |
|---|---|
| question/slices-authority-home | `unit/document/design-30-slices`, `unit/script/update-designprojection` |
<!-- question-affects:end -->
