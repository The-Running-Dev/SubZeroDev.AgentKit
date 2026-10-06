# Contract — the agent kit

> Rewritten 2026-10-04 (#436). The earlier contract, which specified the design-state reader,
> drift checker, projections and the removed commands, is
> `git show c3a9577:design/20-contract.md`.

This is the public surface: what a user types, what the scripts accept, and what files the kit
reads and writes. Anything not listed here is internal.

## Commands (`skills/<name>/SKILL.md`)

Under Claude Code each is typed `/agentkit:<name>`; Codex and Copilot use the bare name.

| Command | Does | Writes |
|---|---|---|
| `interview` | Interrogates the idea | `design/00-brief.md` |
| `brief` | Challenges an existing brief | `design/00-brief.md` |
| `design` | Produces the design and contract from the brief | `design/10-design.md`, `design/20-contract.md` |
| `plan` | Breaks the contract into vertical slices | `design/30-slices.md` |
| `redteam` | Optional adversarial review of the design | a report; never a gate |
| `next` | Builds every unfinished slice through merge and cleanup | code, tests, PRs, `Status: done` |
| `fix` | Reproduces and fixes a defect outside the plan | code, tests, a PR |
| `align` | On request, reconciles `design/` with the tree | `design/` |
| `install` | Installs or upgrades the kit in a repository | `design/` seed, `AGENTS.md`, `.claude/kit.json` |
| `install-all` | Migrates repositories off pre-home-install copies | one PR per repository |
| `install-review` | Installs the Claude Code GitHub review action | a workflow file |
| `sync` | Updates the machine-wide checkout, then reconciles this repository | the checkout |

`/next` argument: a slice id to start from, or `one` to stop after one slice.

## Slice format (`design/30-slices.md`)

```
## S<n> — <name>
Status: todo | done
Delivers: ...
Touches: ...
Depends on: <slice numbers, or none>
Acceptance:
  - S<n>.1 <observable criterion>
Out of scope: ...
```

Only `## S<n>` headings are slices. `Status:` absent means not done. Ids and criterion ids are
never reused or renumbered. A slice named only in a `## Landed` table or in prose is done and is
never rebuilt; `Depends on:` pointing at one is satisfied.

## Pull request description (`/next`, `/fix`)

Sections `What`, `Criteria` (per criterion id: met, with the test or check), `Differs from
design` (omitted when empty), `Verified` (each gate: passed, failed with output, or not run and
why). No AI attribution anywhere.

## Scripts (`tools/`)

Node >= 22.18, TypeScript run directly (`node tools/<name>.ts`), no runtime dependencies, no
PowerShell. Options are `--kebab-case`; the parser is strict, so an unknown option is an error.
Scripts never prompt and write JSON to stdout. Rewritten 2026-10-06 (#444–#456); the PowerShell
surface is `git show v2026.09.24:design/20-contract.md`.

| Script | Options | Result |
|---|---|---|
| `wait-pull-request-check.ts` | `--pull-request`, `--head-sha`, `[--repository --timeout-seconds --poll-seconds --quiet]` | `State` Passed / Failed / TimedOut / HeadMoved, with the checks bucketed |
| `merge-pull-request.ts` | `--pull-request`, `--head-sha`, `[--repository --method --timeout-seconds --poll-seconds --delete-branch --dry-run]` | `State` Merged or Refused with `Refusal`; never merges unless every check on the head passed and no thread is unresolved |
| `invoke-housekeeping.ts` | `[--repo-root --default-branch --skip-pull]` | Switches to the default branch, pulls, deletes confirmed-merged branches; `Escalate` is true when a judgement case remains. Never stashes |
| `invoke-done-housekeeping.ts` | `[--repo-root --default-branch --skip-pull --delete-branches --force-delete-branches --auto-stash --keep-dirty]`, each branch passed as its own flag value | Discovery and (when given a list) deletion; `--keep-dirty` proceeds on a dirty tree without touching it; `--auto-stash` stashes and reports the ref |
| `test-gates-cache.ts` | `[--repo-root --write --gates-json]` | Reads or writes `.claude/gates.json`, keyed to a hash of the files that decide the gate list |
| `test-verify-report.ts` | `[--path --quiet]` | Validates `.claude/verify-report.json` |
| `test-no-attribution.ts` | `--base-sha`, `--head-sha` | `RESULT=PASSED` or `FAILED` naming the commits |
| `new-design-docs.ts` | `[--target-repo --kit-root --force --quiet]` | Seeds `design/` from `templates/design/` |
| `install-agentkit.ts` | `[--version --source --hosts --prefix --dry-run --uninstall --force --verify --register-only --previous-commit --requested-version]` | Installs, verifies or removes the home checkout and registrations; `State` Installed / DryRun / OK. Default version is the newest stable `vYYYY.MM.DD[.N]` tag, never `main`. A failed install is not rolled back |
| `setup.ts` | the same options | The front door: refuses an old Node before loading TypeScript, then runs `install-agentkit.ts`. A checkout that is not a current AgentKit one is refused ("not an AgentKit checkout") |
| `get-agentkit-skill.ts`, `invoke-codex-command.ts`, `start-agentkit-codex.ts` | see the script | Skill reading and update check, Codex profile routing, Codex launch |
| `get-next-slice.ts` | `[--repo-root --default-branch --slice --pull-requests-json --quiet]` | `State` Resume / Start / Finished / Blocked with `Slice`, `Branch`, `PullRequest`, `Base`, `DirtyFiles`, `Reason`; reads the plan from `origin/<default>` after a fetch; read-only otherwise; exit 0 / 1 (Blocked) |
| `test-design.ts` | `[--repo-root --quiet]` | `State` Passed / Failed / NotEvaluated with `Findings` (`Check`, `File`, `Line`, `Message`); read-only; exit 0 / 1 / 2 |
| `measure-session.ts` | `[--project --transcript-path --session-id --idle-threshold-minutes --detail --human --hook]` | Per-session cost report; `--hook` appends a row on `SessionEnd` |

`RepoAliases.ps1` is gone; there is no by-hand wrapper.

## Files the kit reads and writes in a repository

`design/` (the five documents above plus `90-decisions.md`), `AGENTS.md`, `.claude/kit.json`,
`.claude/gates.json`, `.claude/verify-report.json`, `.claude/session-costs.tsv`. Nothing else.

## Invariants

- No command ends by asking the user to run another command or open a new session.
- A merge happens only through `tools/merge-pull-request.ts`.
- Housekeeping never stashes, resets or cleans a working tree.
- The default branch is never committed to directly.
- `design/` is never edited to match the code outside `/align`; `/next` edits only a slice's
  `Status:` line.
