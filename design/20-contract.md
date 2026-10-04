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

| Script | Parameters | Result |
|---|---|---|
| `Wait-PullRequestCheck.ps1` | `-PullRequest`, `-HeadSha`, `[-Repository -TimeoutSeconds -PollSeconds -Quiet]` | `State` Passed / Failed / TimedOut / HeadMoved, with the checks bucketed |
| `Merge-PullRequest.ps1` | `-PullRequest`, `-HeadSha`, `[-Repository -Method -TimeoutSeconds -PollSeconds -DeleteBranch -DryRun]` | `State` Merged or Refused with `Refusal`; never merges unless every check on the head passed and no thread is unresolved |
| `Invoke-Housekeeping.ps1` | `[-RepoRoot -DefaultBranch -SkipPull]` | Switches to the default branch, pulls, deletes confirmed-merged branches; `Escalate` is true when a judgement case remains. Never stashes |
| `Invoke-DoneHousekeeping.ps1` | `[-RepoRoot -DefaultBranch -SkipPull -DeleteBranches -ForceDeleteBranches -AutoStash -KeepDirty]` | Discovery and (when given a list) deletion; `-KeepDirty` proceeds on a dirty tree without touching it; `-AutoStash` stashes and reports the ref |
| `Test-GatesCache.ps1` | `[-RepoRoot -Write -GatesJson]` | Reads or writes `.claude/gates.json`, keyed to a hash of the files that decide the gate list |
| `Test-VerifyReport.ps1` | `[-Path -Quiet]` | Validates `.claude/verify-report.json` |
| `Test-NoAttribution.ps1` | `-BaseSha`, `-HeadSha` | `RESULT=PASSED` or `FAILED` naming the commits |
| `New-DesignDocs.ps1` | `[-TargetRepo -KitRoot -Force -Quiet]` | Seeds `design/` from `templates/design/` |
| `Install-AgentKit.ps1` / `setup.ps1` | see the script | Installs, verifies (`-Verify`) or removes the home checkout and registrations |
| `Get-AgentKitSkill.ps1`, `Invoke-CodexCommand.ps1`, `Start-AgentKitCodex.ps1` | see the script | Skill reading, Codex profile routing, Codex launch |
| `Get-NextSlice.ps1` | `[-RepoRoot -DefaultBranch -Slice -PullRequestsJson -Quiet]` | `State` Resume / Start / Finished / Blocked with `Slice`, `Branch`, `PullRequest`, `Base`, `DirtyFiles`, `Reason`; reads the plan from `origin/<default>` after a fetch; read-only otherwise; exit 0 / 1 (Blocked) |
| `Test-Design.ps1` | `[-RepoRoot -Quiet]` | `State` Passed / Failed / NotEvaluated with `Findings` (`Check`, `File`, `Line`, `Message`); read-only; exit 0 / 1 / 2 |
| `RepoAliases.ps1` | see the script | Dot-sourced from a profile; a by-hand wrapper over `Invoke-Housekeeping.ps1` |
| `Measure-Session.ps1` | `[-Project -TranscriptPath -SessionId -IdleThresholdMinutes -Detail -Human -Hook]` | Per-session cost report; `-Hook` appends a row on `SessionEnd` |

## Files the kit reads and writes in a repository

`design/` (the five documents above plus `90-decisions.md`), `AGENTS.md`, `.claude/kit.json`,
`.claude/gates.json`, `.claude/verify-report.json`, `.claude/session-costs.tsv`. Nothing else.

## Invariants

- No command ends by asking the user to run another command or open a new session.
- A merge happens only through `Merge-PullRequest.ps1`.
- Housekeeping never stashes, resets or cleans a working tree.
- The default branch is never committed to directly.
- `design/` is never edited to match the code outside `/align`; `/next` edits only a slice's
  `Status:` line.
