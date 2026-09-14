# AgentKit home install: work plan

Re-planned against `main` at `f704bda` on 2026-09-14. `design/FROZEN.md` is absent. This replaces the
handoff `agentkit-home-install.md` of the same date; everything in it that still holds is carried here,
and every place this plan departs from it says why.

**Goal, unchanged.** Stop copying the kit into every repository. Install it once per machine at
`~/.agent-kit`, at a version chosen deliberately, and let each AI tool use it from there. Each repository
keeps only what is its own: its project rules, `agent.md`, `design/`, its `-local.md` companions, its
issue templates, and `.claude/kit.json`.

## What changed since the handoff was written

Checked on this machine, not recalled:

| Fact | Evidence | Effect on the plan |
|---|---|---|
| The output-language work is **not** on `main` yet | PR 1 of `reports/2026-09-14-repo-review-plan.md` merged (#300, #301, #302). PR 2 (W4, W5) and PR 3 (W6) have no commit and no open PR: `AGENTS.md` lacks W4's sentence and `Get-NextOrientation.ps1` has no `Summary` | Hard gate before phase 1 — see *Dependency on the output-language work* |
| The kit's own brief puts this work out of scope | `design/00-brief.md` *Non-goals*: no target repository is migrated, and `/install`, `/install-all`, `/kit-sync` and `tools/Sync-Kit.ps1` are not in scope for change | **Decided by Ben (2026-09-14): separate project, no brief amendment, no contract session.** The brief's non-goal and the contract's unit globs are known-and-retained; this project does not stop on them |
| The contract checks the exact paths the handoff moves | `design/20-contract.md` § *Artifacts of a unit kind*: command = `.claude/commands/*.md`, script = `tools/*.ps1`, document includes `.claude/COMPANIONS.md`. 26 decision records cite `AGENTS.md` sections as sites. W3's tests parse `AGENTS.md` § *Command routing* against `.claude/commands/*.md` | Moving commands to `skills/` breaks the design-state checks and W3's tests. Decision 2 |
| `~/.agent-kit` already exists | A `/kit-sync` clone on `main` at `797f538`, clean, 23 commits behind `origin/main`. `Sync-Kit.ps1` and `New-DesignDocs.ps1` already default to it | The installer adopts it. Old repo copies of `/kit-sync` would move a pinned install back to a branch head — phase 2 handles it |
| References to kit files are about twice the handoff's count | Across 23 command files: 107 references to kit files, 160 to project files, 104 to `AGENTS.md`, 16 argument placeholders | Sorting is scripted, not done by eye |
| Three scripts default to the kit's directory, not the project's | `Split-Path -Parent $PSScriptRoot` in `Test-DesignDrift.ps1:351`, `Update-SlicesDocument.ps1:368`, `Test-VerifyReport.ps1:211` | Added to phase 1 |
| The cost log follows the script, not the project | `Measure-Session.ps1` `Get-CostLogPath` resolves from the script's own git directory | Run from the install, every session's row would land in `~/.agent-kit/.claude/session-costs.tsv` (git-ignored, so silently). Added to phase 1 |
| The Codex launcher's rules budget counts project files only | `Get-ProjectDocByteBudget` walks from the launch directory to `.git` | Whether Codex charges `~/.codex/AGENTS.md` to the same budget decides whether W1's fix survives the split. Phase 0 checks the source |
| Copilot CLI is not installed | No `copilot` on `PATH`; `~/.copilot/` holds only IDE data and an `instructions/` folder. Claude Code is 2.1.270, Codex CLI 0.153.4 | The handoff's Copilot CLI tests cannot run. Decision 3 |
| 23 repositories carry the kit, on different versions | 21–24 command files and 10–23 scripts each, all with `.claude/kit.json`; companions in GameEngine (14), Platform.UI.LandingPage (1), SkyNetHR (1); the session hook in 18. Also a stray `SubZeroDev.Blog-kit-sync-2026-09-07` copy and a `SubZeroDev.PSGenerator;C` folder | Migration cannot assume one released version. Phase 4 matches each file against *any* released version |

## Dependency on the output-language work

This project starts from the AgentKit behavior on `main` after the current human-facing output/reporting
changes have landed — PR 2 (W4, W5) and PR 3 (W6) of `reports/2026-09-14-repo-review-plan.md`. Treat those
rules and report semantics as canonical inputs to the migration.

- **Phase 0 may run before they land.** It changes nothing in the kit.
- **Phase 1 does not start until both have merged.** PR 2 fixes the wording of `/next`, `/clean`,
  `RepoAliases.ps1` and `Get-NextOrientation.ps1`, which phase 1 also edits; PR 3 edits `INSTALL.md`, which
  phase 4 rewrites.

When converting commands to skills, preserve their resulting human-facing behavior; do not resurrect older
report wording from history or redesign the output policy as part of the home-install work. *Output
discipline* moves into the shared rules file **verbatim**, as one section, under *Single ownership*'s
"move, never copy".

If portability forces a change in report semantics rather than merely syntax or host adaptation, stop and
surface that as a separate policy decision instead of folding it into the migration. Known in advance:

| Where | Why the report would change | Kind |
|---|---|---|
| `INSTALL.md` phase 3 report (`/install`) | *Cores taken outright* and *Unmigrated cores* stop meaning anything once cores are not installed into repositories | Scope change, not portability. Decided at the start of phase 4, before editing |
| `/kit-sync` | Retired; `/kit-update` has a new report | New command. Its report follows *Output discipline* as it stands; it needs a *Command routing* row, which W3's tests enforce |
| `/install-all` | Becomes a one-time migration report | Scope change. Decided at the start of phase 4 |
| Any command taking an argument (16 placeholders) | Only if a host cannot deliver the argument at all, as opposed to delivering it differently | Portability. Phase 0 finds out; if it happens, stop |

Frontmatter, placeholder syntax, and the path a command uses to reach a kit file are host adaptation, and
are not a stop.

## Decisions for Ben

One at a time, recommendation first.

**Decision 1 — settled.** Separate project, as the handoff said. No brief amendment, no contract session.

**Decision 2 — Keep command files where they are; build the skill folders during install.**
The handoff moves each `.claude/commands/<name>.md` to `skills/<name>/SKILL.md` and links those folders into
each tool with Windows junctions.
*Recommended:* leave the source files where they are. The install script writes a `SKILL.md` folder per
command, adding `name` and `disable-model-invocation: true` (commands are only ever run by you today, so this
keeps that), directly into each tool's personal skills folder, and records every folder it wrote.
- The design checks, W3's routing tests, `Test-Companion.ps1`, the Codex launcher, and the README's Codex
  recipes keep working unchanged.
- No junctions, so the phase 0 junction test stops being a blocker. The folders cannot go stale, because the
  checkout only moves when the same script runs and rewrites them.
- The optional name prefix is a rename at write time.
- The deferred vendor-neutral path idea (#33) stays deferred and unaffected.

*Alternative:* move the files as the handoff says. Cost: rewrite W3's routing tests, `Test-Companion.ps1`, the
Codex launcher and the README's Codex recipes for the new paths, and keep the kit repository's own commands working during the move.
Reversing either way later is a mechanical move.

**Decision 3 — Which Copilot does the kit need to work in?**
The brief says the kit runs under Claude Code, Codex and Copilot, but Copilot CLI is not installed here.
*Recommended:* test whichever Copilot you actually use with the kit (the `~/.copilot/` folder suggests the
editor extension), and don't install Copilot CLI for this.
*Alternative:* install Copilot CLI and test that. Cost: a tool nothing here uses today becomes part of the
trial.

**Carried from the handoff and adopted unless you say otherwise** (all cheap to reverse):

- Command names stay as they are through the trial; rename once, with phase 0's clash list in hand.
- Releases are date tags, `v2026.09.14`.
- `.claude/kit.json` stays. It already exists, written by `/install` and `/kit-sync`; only its writer changes.
- No per-model Codex skill variants, unless phase 0 shows Codex needs them.

## The work

Each phase ends runnable. Implementation is `sonnet`/`medium` unless stated; each kit PR is its own branch
off `main` and goes through `/pr`, which runs Pester, `Update-DesignProjection` then `Test-DesignState`,
`Test-DesignDrift`, and `git diff --check`. A decision that changes policy writes its decision-log entry and
design-state record in the same commit (`AGENTS.md`, *Writing a design-state record*). No staging PR and no
`/track` pass: this plan is the queue.

### Phase 0 — Confirm how the tools behave (one session, no kit changes; can start now)

Test with one throwaway skill, on this machine, and write the answers to
`reports/<date>-home-install-phase0.md`.

| Question | Claude Code 2.1.270 | Codex CLI 0.153.4 | Copilot (per decision 3) |
|---|---|---|---|
| Personal skills folder that is actually read | `~/.claude/skills/` | `~/.agents/skills/` or `~/.codex/skills/` | to find |
| Personal rules file, and whether it can point at `~/.agent-kit/...` | `~/.claude/CLAUDE.md` importing an absolute path | `~/.codex/AGENTS.md` | to find |
| Does a command's argument reach the skill? | | | |
| Does `disable-model-invocation: true` stop the model running it unasked? | | | |
| Personal `slice` skill vs a repository's `.claude/commands/slice.md`: which runs? | | | |
| Can a skill run `$HOME/.agent-kit/tools/<script>.ps1` from inside another repository? | | | |
| Only if decision 2 goes the handoff's way: is a junctioned skill folder found? | | | |

Plus, for Codex only: **does `~/.codex/AGENTS.md` count against `project_doc_max_bytes`?** Read it from the
`openai/codex` source at tag `rust-v0.153.4`, as W1 did, and cite the lines.

Plus the name-clash list: every current command name checked against each tool's built-ins and the skills
already installed (`/code-review`, `/review`, `/init`, `/clean`, …).

**Stop and report** if a personal skill does **not** win over a repository's copy in any tool. The migration
and the `/kit-sync` shim below both rely on it, and the fallback is Ben's call.

**Done when:** the note answers every cell from a real run, cites the Codex source lines, and holds the clash list.

### Phase 1 — Make the kit installable (after the output-language gate)

**PR A — paths and hooks** (independent of the rules split):

1. **Sort every reference in the command files** into kit-file or project-file with a script that lists each
   one with its bucket; a person judges only what the script cannot classify. Kit files resolve from
   `$env:AGENTKIT_HOME`, falling back to `$HOME/.agent-kit`. Project files (`design/`, `.claude/kit.json`,
   `*-local.md`, `.claude/gates.json`, `.claude/verify-report.json`, `agent.md`) stay relative to the
   repository. The companion block's `../COMPANIONS.md` link is a kit-file reference.
2. **Scripts that assume the kit is the project:** the three `Split-Path -Parent $PSScriptRoot` defaults above
   resolve from the current repository instead; review `New-ReducedPrompt.ps1`, `New-DesignDocs.ps1`,
   `Sync-Kit.ps1` and `Test-Companion.ps1` for the same. `RepoAliases.ps1` finds its sibling scripts from its
   own folder already; how it is loaded into the PowerShell profile is checked and documented.
3. **Session-cost hook:** the log path comes from the session's project (`CLAUDE_PROJECT_DIR` or the hook
   input's working directory), not from the script's location. Registered once in `~/.claude/settings.json`
   it runs in every project on the machine, so it writes only in a repository carrying `.claude/kit.json`
   (or the kit itself), and does nothing where the repository's own `settings.json` still registers the old
   hook, so a half-migrated repository does not log each session twice. `-Watch` still never exits non-zero.
4. **Codex launcher:** if phase 0 found that `~/.codex/AGENTS.md` shares the budget, add its size.
5. Pester covers each change, including a regression test verified by reverting its fix.

**PR B — the rules split** (Ben signs off the list of sections that move before any text moves):

1. Move the shared sections verbatim into the shared rules file. The kit repository's `AGENTS.md` keeps only
   what is specific to the kit (for example the `videos/` convention and the Videowright block).
2. Rewrite the citations mechanically: 104 in command files, the design-state records citing `AGENTS.md`,
   W3's routing-table parser, `New-ReducedPrompt.ps1`. Regenerate projections, then run the checker.
3. Confirm nothing was lost: every non-blank line removed from `AGENTS.md` appears in the shared file.

**Done when:** full Pester passes; a search finds no kit-file reference that assumes the current directory is
the kit; `Test-DesignState` reports no blocking finding.

### Phase 2 — The install / update script (one PR, `sonnet`/`high`)

```text
tools/Install-AgentKit.ps1
  -Version  <tag | branch | sha>   # default: latest tag, else main
  -Source   <url | local path>     # default: ~/.agent-kit's origin; a local path tests unreleased work
  -Hosts    claude,codex,copilot   # default: detect; Copilot per decision 3
  -Prefix   <text>                 # optional: /ak-slice instead of /slice
  -DryRun
  -Uninstall                       # removes only what the manifest lists
```

1. **Adopt or clone `~/.agent-kit`.** An existing checkout must have the expected `origin`; refuse if it is
   dirty. Check out the requested version.
2. **Write skills** per decision 2 into the folders phase 0 confirmed, and record each in
   `~/.agent-kit-state/installed.json`. A same-named folder not in the manifest is skipped with a warning.
3. **Hooks** in `~/.claude/settings.json`: only the kit's two entries, file backed up first.
4. **Pointer blocks** in each tool's personal rules file, as a marked region, so the shared rules load everywhere.
5. **`/kit-update`**, a thin command that runs the script, with its *Command routing* row.
6. **`kit-sync` shim.** Installed as a personal skill so that a repository still carrying the old
   `/kit-sync` runs this instead, which says to use `/kit-update`. Without it, an old copy would check out a
   branch head in `~/.agent-kit` and move every repository off the pinned version.
7. Print the installed version and what changed, per *Output discipline*.

**Done when:** Pester covers a fresh install, a no-change re-run, a version change, a rollback, adopting an
existing clone, refusing a dirty one, skipping a foreign folder, and uninstall removing only its own entries;
a second run in a row changes nothing.

### Phase 3 — Trial on one repository (one session, a PR in that repository)

Trial repository: **SubZeroDev.Platform.UI.LandingPage** — small, and it has a companion, so "companions are
still read" is actually tested. It has no session hook of its own, so the double-logging guard is tested
separately, in any repository that still has one, before phase 5.

1. Tag a release and install it here.
2. On a branch there: delete the copied commands, scripts and `COMPANIONS.md`, remove the kit's half of its
   rules, keep the companion, add the pointer section.
3. Run `/next`, `/verify` and a small `/fix` in Claude Code; at least one command through the Codex launcher;
   at least one in Copilot per decision 3.
4. Release a trivial kit change, update, confirm the repository sees it; roll back, confirm again.

**Done when:** every tool ran kit skills there with no copies present; the companion was read; the session
cost row landed in that repository's log; update and rollback both took effect with no change to the repository.

### Phase 4 — Replace the copy tooling (one kit PR)

Starts with the report decisions listed under *Dependency on the output-language work*.

1. `INSTALL.md` and `/install` handle only per-repository files: project rules, `agent.md`, the `design/` seed,
   issue templates, the pointer section, `.claude/kit.json`.
2. `/kit-sync` and `Sync-Kit.ps1` are retired; `/kit-update` replaces them.
3. `/install-all` becomes the one-time migration. Per repository, on a branch: delete a copied kit file only if
   it is byte-identical to that file at **some** released kit commit (23 repositories on different versions),
   otherwise report it and leave it; keep companions; strip the kit's rules only where they match the shared
   file, and report the rest; add the pointer; remove the repository's own session-hook entry; open a PR.

**Done when:** a dry run lists, per repository, exactly what it would delete and what it refuses to.

### Phase 5 — Migrate and clean up

1. Run the migration across the 23 repositories, one PR each. The stray `SubZeroDev.Blog-kit-sync-2026-09-07`
   copy and the `SubZeroDev.PSGenerator;C` folder are reported, not migrated.
2. For each refused file, decide with Ben: move the edit into a companion, or drop it.
3. Update `README.md`; remove the old copy machinery.
4. Run the install on any other PC Ben uses.

**Done when:** no `SubZeroDev.*` repository holds a copied kit command, kit script, or `COMPANIONS.md`; a kit
release reaches every repository by running one command, with no PRs.

## Gotchas

- **A bad release hits every project at once.** Rollback stays one command; tags give "last good" a name.
- **In the kit repository itself, the installed version runs, not the working tree** (if phase 0 confirms
  personal wins). Test unreleased work by installing from the working branch.
- **Two kinds of path look alike.** A mix-up breaks other repositories, never the kit, so the kit's own
  tests will not catch it. The phase 3 trial is where it shows.
- **Not everywhere has the kit.** Claude Code on the web, cloud sessions, and the GitHub Action reviewer lose
  the shared rules once a repository is migrated. Accepted for now.
- **Name clashes.** Phase 0's list and the optional prefix cover them.

## Reference

- Handoff superseded: `agentkit-home-install.md` (2026-09-14).
- [gstack](https://github.com/garrytan/gstack): multi-tool skill writing, prefix, ownership manifest, hook registration.
- [Claude Code skills](https://code.claude.com/docs/en/skills.md), [Copilot skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills), Codex source at `rust-v0.153.4` — all to be confirmed in phase 0, not relied on from these pages.
- Copy machinery replaced in phase 4: `INSTALL.md`, `.claude/commands/install.md`, `install-all.md`, `kit-sync.md`, `tools/Sync-Kit.ps1`.
