# AgentKit repository review: work plan

Reviewed `main` at `d4c57c4` on 2026-09-14. `design/FROZEN.md` is absent.

The work is three decisions and three PRs. Implementation is sonnet/medium, and each PR is its own branch off `main`. Each PR goes through `/pr`, which runs the gates: Pester, `Update-DesignProjection` then `Test-DesignState`, `Test-DesignDrift`, and `git diff --check`. Where a decision changes policy, its PR writes the decision-log entry and the design-state record in the same commit (`AGENTS.md`, *Writing a design-state record*).

There is no staging PR and no `/track` pass: this plan is the work queue. Existing issues are reused where they already own something; #211 is referenced from PR 1 and stays open. New issues are opened only if something needs tracking beyond these PRs.

## Decisions

| | Question | Choice |
|---|---|---|
| D1 | How the launcher makes Codex load all of `AGENTS.md` | **Settled:** the launcher sets the document budget per invocation. It doesn't refuse, and it doesn't change user config. |
| D2 | Whether `/unfreeze` may run as two sessions on a tool that can't switch tier mid-session | **Settled (2026-09-14):** yes. `unfreeze.md` owns where it splits, and the commit is the handoff. |
| D4 | Output semantics | **Settled:** add the plain-language sentence to *Output discipline*, and keep the Changed / Tests / Risk/Blocker labels. |

The `00-brief.md` count stays: it's a dated measurement in your document.

## PR 1: Codex correctness (W1 + W2 + W3)

These three items all touch `tools/Invoke-CodexCommand.ps1`, its tests and `codex/PROFILES.md`.

**W1: document budget.**
- **Problem:** `AGENTS.md` is 49,761 bytes, and Codex 0.153.4's default `project_doc_max_bytes` is 32,768. Codex truncates past that limit and only logs a warning, so everything from partway through *Git and delivery* onward is never loaded.
- **Change:** the launcher passes `-c project_doc_max_bytes=<required budget>` on every invocation, including both `/unfreeze` processes.
- **How the budget is derived:** from Codex's actual discovery and accounting, read from its source at the installed CLI version, not assumed. Check:
  - which filenames it loads, including overrides and fallbacks;
  - whether the limit is shared across files or applies to each file;
  - whether separators are counted.

  Cite those source lines in the PR.
- **`codex/PROFILES.md`:** the row moves out of the "recommended, not enforced" table into a correctness note. Running plain `codex` without the launcher still needs the key in base config.
- **Design state:** add the decision record and put it in `Live` for `invoke-codexcommand`. Fix that unit's *Owns*, which is missing `author`. Decide in the implementation whether the 2026-09-14 decision's "not launcher-enforced" claim gets narrowed or superseded.
- **Acceptance:**
  - Tests fail when the flag is removed.
  - A live nested-file case works: from a nested directory whose combined rules files exceed the default, a launched session quotes a marker string at the end of the last file loaded, and plain `codex` can't.

**W2: `/unfreeze` split and removing the duplicate prompts.**
- **`unfreeze.md`:** gains one section saying where the run splits: session 1 covers refuse, Phases 1–2 and Commit; session 2 covers Phase 3 and Report.
  - *Commit* always commits the marker deletion, which is the handoff.
  - The current text only commits "if reconciliation touched `design/`".
- **`AGENTS.md` § *The design freeze*:** allows the split and cites `unfreeze.md`.
- **Launcher:** both prompts shrink to citations. The current track prompt asks for a restated report, which contradicts `unfreeze.md`'s own Report section.
- **Tests:** every heading a prompt cites must exist.
- **Design state:** a decision record, stated in the two sections it amends.

**W3: correspondence tests.**
- **Routing table:** the tests parse `AGENTS.md` § *Command routing* and assert:
  - each `.claude/commands/*.md` file appears in exactly one row;
  - its stamped `AGENTKIT_TIER` matches that row.

  `/unfreeze` and rows with no command file are named skips.
- **Profiles:** the tests parse the 0.134+ profile blocks in `codex/PROFILES.md` and assert model, effort, approval and sandbox match the launcher.
- **Comment fixes:** correct the misleading test comment at `Invoke-CodexCommand.Tests.ps1:76-78` and the script header's "nothing enforces that".
- **Target repos:** if `*.Tests.ps1` ships to target repos, tolerate a locally edited `AGENTS.md`.
- **Negative fixtures:** a wrong tier, a wrong model, and a command with no routing row are each rejected.

## PR 2: Human-readable output (W4 + W5)

**W4.** Add this sentence to `AGENTS.md` § *Output discipline*, plus its decision record:
> Say what happened before what it is called — a reader should not have to translate field names, enums, booleans or exit codes; keep the exact identifier beside the meaning where it is needed to audit or act.

**W5.** Each script produces the wording next to the structured result it owns.
- **`Get-NextOrientation.ps1`:**
  - capture gate result objects instead of `*>&1 | Out-String`, which today dumps `@{Class=…}`;
  - return a plain-language `Summary`, e.g. "Design state: 3 non-blocking findings" or "GitHub CLI unavailable: pull requests not checked";
  - keep every existing property.
- **`RepoAliases.ps1`:** prints `Summary` instead of `Dirty: True` and `exit code: N`.
- **`Invoke-Housekeeping.ps1`:** its printed lines become sentences. The returned object is unchanged.
- **Command files:** `clean.md` and `next.md` § *Report* stop asking for raw field names and cite the rule.
- **Tests:** the summary wording is checked for a clean tree, a dirty tree, missing `gh`, and gate exit codes 0, 1 and 2. No rendered line contains a bare `True`, `False` or "exit code", and existing properties are unchanged.
- **Design state:** fix *Owns* drift in the three script units. If `20-contract.md` names either returned object as a public surface, stop.

## PR 3: Descriptive cleanup (W6)

- `INSTALL.md:166`: change "nineteen command files" to "every command file that names `design/`".
- `.claude/commands/freeze.md:51`: cite `AGENTS.md` § *The design freeze* instead of repeating the list of five commands.
- Include any other purely descriptive drift found during PRs 1–2 that those PRs didn't fix.
- Leave as they are, because they're dated measurements or still true:
  - `00-brief.md` counts;
  - "sixteen units";
  - "eighteen repositories";
  - "six orientation reads";
  - "five classes".

## Not doing

- **Splitting `Test-DesignState.ps1`.** A split would take it outside the `tools/*.ps1` glob or need a decision on units spanning several files. It isn't what's pushing any closure over budget, and work is sequential. No active proposal exists, so nothing is recorded.
- **A machine-readable routing source.** W3's tests cover the drift without moving policy out of the table people read.
