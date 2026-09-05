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
| `unit/command/clean` | command | `.claude/commands/clean.md` |
| `unit/command/contract` | command | `.claude/commands/contract.md` |
| `unit/command/design` | command | `.claude/commands/design.md` |
| `unit/command/fix` | command | `.claude/commands/fix.md` |
| `unit/command/freeze` | command | `.claude/commands/freeze.md` |
| `unit/command/install` | command | `.claude/commands/install.md` |
| `unit/command/install-all` | command | `.claude/commands/install-all.md` |
| `unit/command/install-code-review-agent` | command | `.claude/commands/install-code-review-agent.md` |
| `unit/command/kit-help` | command | `.claude/commands/kit-help.md` |
| `unit/command/kit-sync` | command | `.claude/commands/kit-sync.md` |
| `unit/command/make-human-docs` | command | `.claude/commands/make-human-docs.md` |
| `unit/command/next` | command | `.claude/commands/next.md` |
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
| `unit/script/invoke-codexcommand` | script | `tools/Invoke-CodexCommand.ps1` |
| `unit/script/invoke-donehousekeeping` | script | `tools/Invoke-DoneHousekeeping.ps1` |
| `unit/script/measure-session` | script | `tools/Measure-Session.ps1` |
| `unit/script/new-designdocs` | script | `tools/New-DesignDocs.ps1` |
| `unit/script/new-reducedprompt` | script | `tools/New-ReducedPrompt.ps1` |
| `unit/script/read-designstate` | script | `tools/Read-DesignState.ps1` |
| `unit/script/sync-kit` | script | `tools/Sync-Kit.ps1` |
| `unit/script/test-companion` | script | `tools/Test-Companion.ps1` |
| `unit/script/test-designdrift` | script | `tools/Test-DesignDrift.ps1` |
| `unit/script/test-designstate` | script | `tools/Test-DesignState.ps1` |
| `unit/script/test-gatescache` | script | `tools/Test-GatesCache.ps1` |
| `unit/script/test-verifyreport` | script | `tools/Test-VerifyReport.ps1` |
| `unit/script/test-writesurface` | script | `tools/Test-WriteSurface.ps1` |
| `unit/script/update-designprojection` | script | `tools/Update-DesignProjection.ps1` |
| `unit/script/update-slicesdocument` | script | `tools/Update-SlicesDocument.ps1` |
| `unit/script/update-workmirror` | script | `tools/Update-WorkMirror.ps1` |
| `unit/script/wait-pullrequestcheck` | script | `tools/Wait-PullRequestCheck.ps1` |
<!-- units:end -->

## Invariants — bound by

<!-- bound-by:start -->
| Invariant | Bound by |
|---|---|
| I1 | `unit/command/resolve` |
| I2 | `unit/script/wait-pullrequestcheck` |
| I5 | `unit/command/resolve` |
| I6 | `unit/command/fix` |
| I7 | `unit/script/wait-pullrequestcheck` |
| I8 | `unit/script/wait-pullrequestcheck` |
| I9 | `unit/document/agents-md` |
| I10 | `unit/command/fix` |
| I11 | `unit/command/fix` |
| I12 | `unit/script/test-designdrift` |
| I13 | `unit/script/test-designdrift` |
| I14 | `unit/script/update-designprojection` |
| I15 | `unit/script/test-designstate` |
| I16 | `unit/script/test-designstate` |
| I17 | `unit/script/read-designstate` |
| I18 | `unit/script/test-designstate` |
| I19 | `unit/script/test-designstate` |
| I20 | `unit/script/test-designstate` |
| I21 | `unit/script/test-designstate` |
| I22 | `unit/document/design-20-contract` |
| I23 | `unit/script/test-designstate` |
| I24 | `unit/script/read-designstate` |
| I25 | `unit/script/update-designprojection` |
| I26 | `unit/document/design-90-decisions` |
| I27 | `unit/document/design-10-design` |
| I28 | `unit/command/track` |
| I29 | `unit/script/update-designprojection` |
| I30 | `unit/script/test-designstate` |
| I31 | `unit/script/test-designstate` |
<!-- bound-by:end -->

## Contracts — consumers

<!-- consumers:start -->
| Contract | Consumers |
|---|---|
| contract/fix | — |
| contract/invoke-donehousekeeping | — |
| contract/read-designstate | `unit/script/test-designstate`, `unit/script/update-designprojection` |
| contract/resolve | `unit/command/pr` |
| contract/test-companion | `unit/command/install-all`, `unit/command/verify`, `unit/script/sync-kit` |
| contract/test-designdrift | `unit/command/track` |
| contract/test-designstate | `unit/command/verify` |
| contract/update-designprojection | `unit/script/test-designstate` |
| contract/update-workmirror | `unit/command/track` |
| contract/wait-pullrequestcheck | `unit/command/pr`, `unit/command/resolve` |
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
| decision/2026-08-03-ticking-checkbox-is-the-users | `unit/command/slice` |
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
| decision/2026-08-08-done-housekeeping-scripts-everything-before-ask | `unit/command/clean`, `unit/script/invoke-donehousekeeping` |
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
| decision/2026-08-19-contract-picks-up-three-derived-terms | `unit/document/design-20-contract`, `unit/script/test-designstate` |
| decision/2026-08-19-design-state-becomes-addressable-records | `unit/document/design-10-design` |
| decision/2026-08-19-document-kind-reaches-shipped-payload | `unit/document/codex-profiles`, `unit/document/design-20-contract`, `unit/document/issue-template-bug` |
| decision/2026-08-19-enforcement-states-tree-as-it-stands | `unit/document/design-20-contract` |
| decision/2026-08-19-enforcementunevidenced-widens-to-conditional-fields | `unit/document/design-20-contract`, `unit/script/test-designstate` |
| decision/2026-08-19-four-open-questions-closed-unit-set-widens | `unit/document/design-00-brief`, `unit/document/design-10-design`, `unit/document/design-20-contract` |
| decision/2026-08-19-invariant-set-is-the-contract-table | `unit/document/design-20-contract`, `unit/script/test-designstate` |
| decision/2026-08-19-marked-region-marker-declares-its-own-kind | `unit/document/agents-md`, `unit/document/design-20-contract` |
| decision/2026-08-19-pr-real-description-at-open | `unit/command/fix`, `unit/command/pr`, `unit/command/slice` |
| decision/2026-08-19-record-ids-kind-prefixed-slugs | `unit/document/design-10-design`, `unit/document/design-20-contract` |
| decision/2026-08-19-resolution-batch-replaced-by-standing-delegation | `unit/command/resolve`, `unit/document/agents-md` |
| decision/2026-08-19-retirement-is-status-field | `unit/document/design-10-design`, `unit/document/design-20-contract` |
| decision/2026-08-19-state-index-md-added | `unit/document/design-20-contract`, `unit/document/design-state-index` |
| decision/2026-08-19-state-set-one-file-per-record-ps1-tooling | `unit/document/design-10-design`, `unit/document/design-20-contract` |
| decision/2026-08-20-claim-excludes-rejections-question-writer-open | `unit/document/design-20-contract`, `unit/document/design-90-decisions` |
| decision/2026-08-20-fix-picks-its-own-bug-when-given-nothing | `unit/command/fix` |
| decision/2026-08-20-globdisagreement-checks-the-glob-table | `unit/document/design-20-contract`, `unit/script/test-designstate` |
| decision/2026-08-20-install-initializes-an-absent-repository | `unit/command/install-all`, `unit/document/install-md` |
| decision/2026-08-20-invariant-enforcement-not-enumerated-in-prose | `unit/document/design-20-contract` |
| decision/2026-08-20-state-index-hosts-outstanding-projection | `unit/document/design-20-contract`, `unit/document/design-state-index` |
| decision/2026-08-21-install-code-review-agent-writes-the-workflow-file-only | `unit/command/install-code-review-agent` |
| decision/2026-08-21-install-delivers-on-a-feature-branch | `unit/document/agents-md`, `unit/document/install-md` |
| decision/2026-08-22-done-always-hands-off-to-track | `unit/command/clean`, `unit/command/kit-help` |
| decision/2026-08-24-codex-tier-resolved-from-config | `unit/document/agents-md` |
| decision/2026-08-25-branch-commit-push-pr-delegated-for-all-work | `unit/document/agents-md` |
| decision/2026-08-25-code-review-defaults-high-effort-fix-push | `unit/document/agents-md` |
| decision/2026-08-25-high-volume-tier-retired-haiku-luna-removed | `unit/document/agents-md` |
| decision/2026-08-26-workmirror-writes-only-on-change | `unit/script/update-workmirror` |
| decision/2026-08-29-ceiling-counts-the-units-own-artifact | `unit/document/design-00-brief`, `unit/document/design-10-design` |
| decision/2026-08-29-claims-trimmed-to-standing-terms | `unit/document/design-10-design` |
| decision/2026-08-29-closures-shrink-by-absorption | `unit/document/design-10-design` |
| decision/2026-08-29-retired-halves-to-companion-absorption-to-decision | `unit/document/design-10-design` |
| decision/2026-08-30-contract-carries-companion-halves-and-artifact-closure | `unit/document/design-20-contract` |
| decision/2026-08-30-derived-state-commits-to-default-branch | `unit/command/clean`, `unit/command/track`, `unit/document/agents-md` |
| decision/2026-08-30-force-delete-delegated-on-tip-comparison | `unit/command/clean`, `unit/document/agents-md`, `unit/script/invoke-donehousekeeping` |
| decision/2026-08-30-next-command-orients-and-acts | `unit/command/kit-help`, `unit/command/next`, `unit/document/agents-md` |
| decision/2026-08-30-redteam-writes-findings-to-a-file | `unit/command/redteam` |
| decision/2026-08-30-tier-gate-reads-environment-stamp-first | `unit/document/agents-md`, `unit/script/invoke-codexcommand` |
| decision/2026-08-31-agents-md-owns-record-writing-sequence | `unit/document/design-10-design`, `unit/document/design-20-contract` |
| decision/2026-08-31-cost-keeps-both-closure-readings | `unit/document/design-cost` |
| decision/2026-08-31-invoke-donehousekeeping-gets-a-contract | `unit/document/design-20-contract`, `unit/script/invoke-donehousekeeping` |
| decision/2026-08-31-live-absorbed-as-a-pass-and-a-reported-class | `unit/document/design-10-design`, `unit/document/design-20-contract` |
| decision/2026-08-31-self-check-asserts-adjudicated-findings | `unit/script/test-designstate` |
| decision/2026-09-01-ceiling-bounds-the-records-and-reports-the-artifact | `unit/document/design-00-brief`, `unit/document/design-10-design`, `unit/document/design-20-contract`, `unit/script/test-designstate` |
| decision/2026-09-01-contract-carries-the-rescoped-ceiling | `unit/document/design-20-contract`, `unit/script/test-designstate` |
| decision/2026-09-02-list-entries-may-be-quoted | `unit/document/design-20-contract`, `unit/script/read-designstate` |
| decision/2026-09-02-livealreadystated-is-the-reported-class | `unit/command/reconcile`, `unit/document/design-20-contract`, `unit/script/test-designstate` |
| decision/2026-09-05-routing-non-goal-bars-the-edit-not-the-topic | `unit/document/design-00-brief` |
| decision/2026-09-05-track-creates-a-project-when-none-exists | `unit/command/track`, `unit/document/agents-md` |
<!-- decision-affects:end -->

## Questions — blocks and answered

<!-- question-affects:start -->
| Question | Blocks | Answered |
|---|---|---|
| question/answered-question-unit-edge | — | `unit/script/update-designprojection` |
| question/question-record-writer | `unit/command/slice`, `unit/command/track` | — |
| question/slices-authority-home | — | `unit/document/design-30-slices`, `unit/script/update-designprojection` |
<!-- question-affects:end -->

## Outstanding

From a checkout with no network: the outstanding work, its order, and each item's criteria,
mirrored from GitHub by `tools/Update-WorkMirror.ps1` into `WorkRef` records
(`design/10-design.md` § *WorkRef*). **GitHub stays the authority** — this table is a mirror,
stale by default, and never cited as the reason work is or is not done (I28). `Mirrored at`
names the commit the mirror was taken at; check it against `git log` before trusting an entry
that looks old.

<!-- outstanding:start -->
| Rank | Issue | Title | Criteria | Mirrored at |
|---|---|---|---|---|
| 29 | #140 | The absorbed edge is decided and not implemented | — | `5c4534e7e41773cfb17d44e042c73e0519be287d` |
| 151 | #151 | Five decision records exist with no unit naming them, and a new rule would flag each as a finding | — | `34440ed6c5da92717d61318f22eb60a36fca3681` |
| 152 | #152 | question/answered-question-unit-edge is recorded open despite being answered on 2026-08-29 | — | `34440ed6c5da92717d61318f22eb60a36fca3681` |
| 153 | #153 | ClosureOverBudget is green for a reason now known to be wrong | — | `34440ed6c5da92717d61318f22eb60a36fca3681` |
| 183 | #183 | Housekeeping commands (/clean, /next) run as full model sessions for work that is already scripted | — | `17c678ac80b8fbb9c6fa3b7f2567a62e7369ce08` |
| 184 | #184 | The -Watch context-size warning fires with no consequence | — | `a7c07d98a25663facc862f4cc2d88e36dd6003bf` |
| 211 | #211 | A script unit that exposes no contract has nowhere to absorb a decision into | — | `c63cae8f19298c5dc92a01883153c0f699c7b0c0` |
| 219 | #219 | tools/Test-DesignState.ps1 does not yet declare LiveAlreadyStated | — | `c63cae8f19298c5dc92a01883153c0f699c7b0c0` |
| 227 | #227 | The 2026-09-03 retirement-script decision has no record, and the checker is red for it | — | `17c678ac80b8fbb9c6fa3b7f2567a62e7369ce08` |
| milestone/3 | #33 | Move commands to a vendor-neutral path | — | `e77a5ff3bf63e4b2b4fea755fd8720f11dcc0171` |
<!-- outstanding:end -->
