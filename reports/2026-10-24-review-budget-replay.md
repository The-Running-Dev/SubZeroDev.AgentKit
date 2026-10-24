# Review budget — verification cycle — 2026-10-24

One bounded verification cycle for the review-budget change on `bounded-review-and-learning`,
against the handoff's acceptance criteria. This change edits the rules it would be judged by,
so it is judged by the contract on `main` before it (`AGENTS.shared.md` § *Reporting*): the
ordinary gates, CI and the pull request's own threads. No extra review process was added for it.

## REA replay

`tools/fixtures/rea-installer/` rebuilds the defect in miniature: `helpers.ts` (the unit-tested
argument builders), `install-defective.ts` (the three malformed calls, the npm path glued to its
arguments as in `$NpmCli@NpmCiArgs`, `$NpmClirebuild`, `$NpmCliaudit`) and `install-fixed.ts`.

- The helpers' unit tests pass against both installers — green units, as in the original.
- Running each installer's entry point against a recording runner (a mock, no npm runs): the
  defective one's first call is `…npm-cli.jsci --no-audit --no-fund` as a single argument, the
  runner rejects it and the install stops with exit 1; the fixed one issues three well-formed
  calls and exits 0.
- `review.md` records the run under the new rules: risk `HIGH`, the entry-point failure raised
  in verification and fixed before review (not counted), one review, one `NON-BLOCKING` finding
  tracked, one `SPECULATIVE` finding not sustained. `test-review-ledger.ts` gives
  `READY_FOR_EXECUTION`, reviews 1 of 2, corrections 0 of 1, next review `none` — the real
  install waits for the user, and no second round is due.

Under the old flow the same deliverable took four review rounds and was still unexecuted.

## Risk cases

One test (`risk cases: …` in `tools/test-review-ledger.test.ts`) evaluates five records:

| Case | Risk | Review spent | End state |
|---|---|---|---|
| Trivial fix | LOW | none | COMPLETE |
| Medium subsystem | MEDIUM | review, one correction, re-review | COMPLETE |
| High-risk installer | HIGH | one review, risk check passed, real install not run | READY_FOR_EXECUTION |
| Large low-risk change (60 files renamed) | LOW | none | COMPLETE |
| Small security fix, risk check missing | HIGH | one review | VERIFYING |

Size does not raise the level and a small change does not lower it.

## Scenarios

| | Scenario | Covered by |
|---|---|---|
| A | REA review loop | Deterministic: the three REA tests, the budget tests (third pass over budget, BLOCKED after the budget is spent, re-review scope) |
| B | Repeated questioning | Rule text: risk is inferred and never asked; no new questions or approvals added anywhere |
| C | Context reconstruction | Deterministic for review (one record shared by two sessions, two vendors and two models keeps one count). Rule text for `/fix` (`Fix attempt` issue comments read first) |
| D | Repeated integration regression | Deterministic: an unassessed entry point holds the state at VERIFYING ahead of review. Rule text: the `agent.md` lesson and `Improvement:` |
| E | Successful optimization | Rule text: `Improvement:`, at most three, evidenced, after a duplicate check |
| F | Self-improvement recursion | Rule text: an improvement is never applied in the run that found it, and a rule change is judged by the contract before it — as this change is |
| G | No learning | Rule text: no `Improvement:` when nothing is material, the usual case |

Rule text is pinned by `tools/test-shared-contract.test.ts`, which proves the rules are written,
not that an agent follows them. **No agent-behaviour evaluation ran**: no model was put through
scenarios B, E, F or G and observed.

## Not done

- Real end-to-end execution of the REA installer — it is a fixture; the real installer is in
  another repository and was not touched.
- SkyNetHR was not changed; nothing in this change needed an orchestration capability AgentKit lacks.
- Consuming repositories pick this up only when the machine-wide checkout is updated to a
  release that contains it.
