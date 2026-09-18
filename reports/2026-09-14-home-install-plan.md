# AgentKit Home Install

*SubZeroDev.AgentKit · implementation plan · 2026-09-14*

Ben's handoff plan (`agentkit-home-install.md`, 2026-09-14) merged with the output-language dependency and
brought up to date with `main` at `c295a0f`. **The design, the decided items and the phases are the handoff's.**
What this revision adds is only what the repository now says: facts that changed, and the work items they create,
folded into the phase they belong to.

Stop copying the kit into every repo. Install it once per machine at `~/.agent-kit`, at a version you chose, and
let Claude Code, Codex and Copilot use it from there in every project.

- **Source repo:** `D:\Dropbox\Projects\SubZeroDev.AgentKit`
- **Modelled on:** [garrytan/gstack](https://github.com/garrytan/gstack)
- **Status:** phases 0–4 have their historical evidence below; the consumer front door and dual Codex skills are implemented on the global-install feature branch. Phase 5 repository migration remains incomplete. See [consumer-install verification](2026-09-17-global-install-verification.md) for current evidence and release gates.

---

## Goal

Today every project carries its own copy of the kit's commands, scripts and shared rules. Every kit change means
syncing 23 repos, the copies drift apart, and each repo is cluttered with files it doesn't own.

After this work, each repo holds only what is truly its own. Everything shared lives in one installed copy on the
machine, and you control exactly when that copy moves to a new version.

**Separate project.** This is not part of the current design-state work in `design/`. Don't route it through that
brief or its non-goals.

## Dependency on the output-language work

This project starts from the AgentKit behavior on `main` after the current human-facing output/reporting changes
have landed. Treat those rules and report semantics as canonical inputs to the migration.

When converting commands to skills, preserve their resulting human-facing behavior; do not resurrect older report
wording from history or redesign the output policy as part of the home-install work.

If portability forces a change in report semantics rather than merely syntax or host adaptation, stop and surface
that as a separate policy decision instead of folding it into the migration.

**Met.** PR 2 and PR 3 of `reports/2026-09-14-repo-review-plan.md` have landed: W4 and W5 (#303), W6 (#304),
and the housekeeping headings follow-up (#305). Phase 1 starts from `main` at or after `dbff89a`, and treats the
wording those PRs produced as canonical. *Output discipline* moves into the shared `AGENTS.md` unchanged.

**Report changes the handoff's own scope already implies** — not portability, so not a stop, but worth knowing
before phase 4: the `INSTALL.md` phase 3 report's *Cores taken outright* and *Unmigrated cores* rows lose their
meaning; `/kit-sync`'s report is replaced by `/kit-update`'s. A report change forced by a host (for example an
argument that cannot reach a skill at all) is a stop.

## How it will work

1. **Change the kit** (source repo). Edit, commit and push as today. Unfinished edits affect nothing else.
2. **Release** (git). Push to main, optionally tag a version like `v2026.09.14`.
3. **Update the install** (one command). Moves `~/.agent-kit` to that version and links skills into each AI tool.
4. **Use it** (every repo). The next session in any project sees the new version. No repo changes.

Rollback is the same command with an older version. Testing unreleased work is the same command pointed at your
working branch.

## Where things live

### Installed once per machine: `~/.agent-kit` (a git checkout at one version)

| Item | What it is |
|---|---|
| `skills/<name>/SKILL.md` | The command bodies, resolved from the canonical checkout by ownership-tracked generated host adapters |
| `tools/*.ps1` | Scripts the skills call |
| `AGENTS.md` (shared part) | Rules that apply to every project |
| `.claude/COMPANIONS.md`, `INSTALL.md`, `templates/` | Rules for per-repo tweaks, repo setup procedure, seed design docs |
| Session-cost hooks | Registered once in personal Claude settings, pointing here |

### Stays in each repo

| Item | What it is |
|---|---|
| `AGENTS.md` (project part) | Project-specific rules only, plus a short pointer section to the kit |
| `agent.md` | That repo's lessons |
| `design/` | That repo's design docs |
| `.claude/commands/<name>-local.md` | Per-repo command tweaks (companions), unchanged mechanism |
| `.github/ISSUE_TEMPLATE/` | Unchanged |

**Removed from every repo:** the copied `.claude/commands/*.md` cores, `.claude/COMPANIONS.md`, the kit's
`tools/*.ps1`, the shared half of `AGENTS.md`, and the kit hooks in `.claude/settings.json`.

## Already decided

- The source stays in the current repo. Changes reach projects only after a deliberate push and update, never automatically.
- Install location is `~/.agent-kit`, a git checkout, so the version is simply the commit or tag it sits on.
- Plain skills, not a Claude Code plugin. Same format works in all three tools, and names stay short (`/slice`, not `/devkit:slice`).
- On Windows, skills are linked with folder junctions, not copied, so nothing goes stale between updates.
- Copy gstack's good ideas: one setup/update script, auto-detect installed tools, optional name prefix, ownership tracking so it never deletes a skill it didn't create, hooks written by the script.
- No hourly auto-update from GitHub. At most a "newer version available" notice.
- Only this machine (and any PC where the update is run) has the kit. Cloud sessions and GitHub Actions without it are accepted for now.

## What `main` says now (checked 2026-09-14)

| Fact | Where it lands |
|---|---|
| `~/.agent-kit` already exists: a `/kit-sync` clone on `main` at `6b32b0b`, clean, 23 commits behind `origin/main` | Phase 2 adopts it rather than cloning |
| 23 repos carry the kit (plus a stray `SubZeroDev.Blog-kit-sync-2026-09-07` copy and a `SubZeroDev.PSGenerator;C` folder), on different versions: 21–24 command files, 10–23 scripts. All have `.claude/kit.json`; 18 register the session hook; companions in GameEngine (14), Platform.UI.LandingPage (1), SkyNetHR (1) | Phases 4–5 |
| Command files hold 107 references to kit files (the handoff counted 54), 160 to project files, 104 to `AGENTS.md`, 16 argument placeholders | Phase 1 step 2 |
| `Test-DesignDrift.ps1:351`, `Update-SlicesDocument.ps1:368`, `Test-VerifyReport.ps1:211` default their root to the kit's own folder (`Split-Path -Parent $PSScriptRoot`) | Phase 1 step 3 |
| `Measure-Session.ps1` resolves the cost log from the script's location, so run from the install it would write every session into `~/.agent-kit/.claude/session-costs.tsv` (git-ignored, so silently) | Phase 1 step 5 |
| The Codex launcher now sets `project_doc_max_bytes` per run (#300), counting project rules files only; its `/unfreeze` prompts cite `.claude/commands/unfreeze.md` (#301) | Phase 0 and phase 1 step 3 |
| W3's tests (#302) parse `AGENTS.md` § *Command routing* against `.claude/commands/*.md` | Phase 1 step 1 |
| `design/20-contract.md` § *Artifacts of a unit kind* names `.claude/commands/*.md` as the command path, and design-state records cite `AGENTS.md` sections | Phase 1 steps 1 and 4 — path corrections only |
| Claude Code 2.1.270, Codex CLI 0.153.4 and Copilot CLI 1.0.83 are installed; Copilot is not signed in | `copilot login` (Ben) before phase 3 |
| Copilot already reads a repo's `.claude/commands/*.md` as project skills; the 8 files it rejected for `argument-hint` frontmatter were fixed in #307 | Phase 3 and 5: a repo's old copies are visible to Copilot until migrated |

## The work, in order

Each phase ends in a working state. Don't start the next one until the current one's checklist is true.

### Phase 0 — Confirm the tools behave as expected — **done**

Findings: [`2026-09-14-home-install-phase0.md`](2026-09-14-home-install-phase0.md).

- **Junctions work** in all three tools, including across drives (`C:` → `D:`). No copy fallback.
- **Personal skills folders:** Claude `~/.claude/skills/`, Codex `~/.codex/skills/`, Copilot `~/.copilot/skills/` or `~/.agents/skills/`.
- **No name clashes** in this account's current skill list. `-Prefix` stays as the hedge.
- **Codex has both modes:** a thin native skill in its personal skills folder resolves the canonical command body in the current session; a thin `-routed` skill calls `Start-AgentKitCodex.ps1`, which preserves `Invoke-CodexCommand.ps1`'s model, effort, approval, and sandbox routing. Both adapters read the installed checkout (phase 1 step 3, phase 2 step 2).

Not answered by a real run, so checked in the phase 3 trial: a fresh Claude session lists a junctioned skill;
a personal skill wins over a repo's copy in Claude and Copilot; `disable-model-invocation`; arguments arrive;
Copilot's personal rules file. Not answered at all, so read in phase 1: whether `~/.codex/AGENTS.md` counts against
`project_doc_max_bytes`.

### Phase 1 — Restructure the kit source (a few days; after the output-language work merges)

Make the repo installable. Work on a branch in the source repo. Existing repos keep working from their copies throughout.

1. **Commands become skills.** Move each `.claude/commands/<name>.md` to `skills/<name>/SKILL.md`. Keep `description` and `argument-hint`, add `name` and `disable-model-invocation: true`, and keep the companion block unchanged. Report sections move unchanged. Update the paths that name command files: W3's routing tests, the `20-contract.md` command glob, and the README's Codex recipes.
2. **Fix paths in two directions.** The command files have 107 references to kit files (`tools/*.ps1`, `COMPANIONS.md`). Those must point at the install root. Resolve the root as `$env:AGENTKIT_HOME`, falling back to `$HOME/.agent-kit`. References to the *project's* files must stay relative to the repo: `design/`, `.claude/kit.json`, `*-local.md`, `.claude/gates.json`, `.claude/verify-report.json`. Sort every reference into one bucket or the other with a script that lists each with its bucket; don't find-and-replace.
3. **Scripts that assume they run inside the kit repo.** Check and fix at least `tools/Invoke-CodexCommand.ps1` (reads `.claude/commands/…`, and its `/unfreeze` prompts cite that path), `Test-Companion.ps1`, `Sync-Kit.ps1`, `RepoAliases.ps1` and `Get-NextOrientation.ps1`, plus `Test-DesignDrift.ps1`, `Update-SlicesDocument.ps1` and `Test-VerifyReport.ps1` (root defaults to the kit folder), and `New-ReducedPrompt.ps1`. The Codex launcher reads `skills/<name>/SKILL.md` from the install root. Read from the Codex source at `rust-v0.153.4`, as #300 did, whether `~/.codex/AGENTS.md` counts against `project_doc_max_bytes`; if it does, the launcher adds its size. Update their Pester tests.
4. **Split `AGENTS.md`.** Shared rules go into the installed copy. Each repo's file keeps only its project rules and a pointer. The kit repo is also a project and keeps its own project part (for example the `videos/` convention and the Videowright block). Update the design-state citations that point at moved sections. This step needs judgement about which rules are universal, so Ben reviews the split before it merges.
5. **Hooks.** `Measure-Session.ps1` hooks currently use `${CLAUDE_PROJECT_DIR}/tools/…`. Point them at the install root instead. The cost log path then comes from the session's project, not the script's folder. A global hook runs in every project, so it writes only where `.claude/kit.json` exists, and skips repos whose own `settings.json` still registers the old hook (18 do), so no session is logged twice during migration.
6. **Kit repo's own use.** Keep the kit repo usable while developing. It runs the installed version like everything else, and you test unreleased changes by updating from the working branch (phase 2).

**Done when**

- [x] Full Pester suite passes, including updated tests. Verified 2026-09-17: `Invoke-Pester -Path tools -CI` — 444 passed, 0 failed, 3 skipped.
- [x] A search finds no kit-file references that assume the current directory is the kit repo. Verified 2026-09-17: `Test-DesignDrift.ps1`, `Update-SlicesDocument.ps1` and `Test-VerifyReport.ps1` no longer default root to `Split-Path -Parent $PSScriptRoot`; 7 scripts (including `Install-AgentKit.ps1`, `Invoke-CodexCommand.ps1`) resolve the install root via `AGENTKIT_HOME`.
- [ ] Ben has approved the `AGENTS.md` shared/project split.

### Phase 2 — Build the install / update script (a few days)

One PowerShell script does install, update, rollback, testing unreleased work, and uninstall. It runs without prompts; destructive steps need `-Force`.

```text
tools/Install-AgentKit.ps1
  -Version  <tag | branch | sha>   # default: newest valid stable vYYYY.MM.DD[.N] tag
  -Source   <url | local path>     # default: recorded source; a local path tests unreleased work
  -Hosts    claude,codex,copilot   # default: auto-detect what's installed
  -Prefix                          # optional: install as /ak-slice instead of /slice
  -DryRun                          # show what would change
  -Uninstall                       # remove only what this script created
```

1. Clone or fetch `~/.agent-kit`. The existing `/kit-sync` clone is adopted: check its `origin`, refuse if it has uncommitted changes. Check out the requested version.
2. For each detected tool, create ownership-tracked generated adapters in that tool's personal skills folder using the paths confirmed in phase 0. Each adapter resolves the canonical skill body without copying it. Codex receives a thin native adapter and a thin `-routed` adapter per command: the native mode keeps the current session, while routed mode calls `Start-AgentKitCodex.ps1` with the command, a JSON arguments file, and `-NewWindow` to open a visible Windows terminal.
3. Record every generated adapter it made in a manifest outside the checkout (for example `~/.agent-kit-state/installed.json`). Only ever remove an adapter listed there after validating its ownership marker and content hashes. If a folder with the same name exists and isn't in the manifest, skip it with a warning, the way gstack protects your own skills.
4. Add or refresh the kit's hooks in `~/.claude/settings.json`. Touch only its own entries and back the file up first.
5. Add or refresh a marked pointer block in each tool's personal rules file so the shared `AGENTS.md` loads everywhere.
6. Print the installed version and what changed. Add a thin `/kit-update` skill that just runs the script.
7. Ship a `kit-sync` skill that only says to use `/kit-update`. A repo still carrying the old `/kit-sync` would otherwise check out `main` in `~/.agent-kit` and move every project off the pinned version. Relies on personal skills winning (phase 0).
8. Ship root `setup.ps1` as the stable global front door. It accepts the installer's `-Version`, `-Source`, `-Hosts`, `-Prefix`, `-DryRun`, `-Uninstall`, and `-Force` surface and delegates from disk to `tools/Install-AgentKit.ps1`. On first use, clone the canonical public GitHub source into `AGENTKIT_HOME` or `$HOME/.agent-kit`; an existing checkout's `origin` must match first. With no version, select only the newest valid stable `vYYYY.MM.DD` or `vYYYY.MM.DD.N` tag. Do not fall back to `main`; selecting `main` is explicit. A requested historical release that lacks `setup.ps1` fails with a post-front-door-release requirement rather than claiming it is already installed.

**Done when**

- [x] Pester tests cover a fresh install, re-running with no changes, a version change, rollback, adopting the existing clone, skipping a foreign folder, and uninstall removing only its own links. Verified 2026-09-17: `tools/Install-AgentKit.Tests.ps1` has one `It` per scenario, all passing in the full suite run.
- [x] Running it twice in a row changes nothing the second time. Verified 2026-09-17: `tools/Install-AgentKit.Tests.ps1` — "reruns with identical registration bytes and no backup churn", passing; this now compares the manifest byte-for-byte too.

### Phase 3 — Trial on one repo (about a day)

Prove it end-to-end on a small real project before touching the rest.

1. Install at a release tag on this machine.
2. On a branch in one small repo, delete the copied commands, tools, `COMPANIONS.md`, the shared half of `AGENTS.md`, and the kit hooks. Add the pointer section.
3. Run `/next`, `/verify` and a small `/fix` or `/slice` in Claude Code. Run at least one command in Codex (through the launcher) and one in Copilot (after `copilot login`). Along the way, check what phase 0 could not: a fresh Claude session lists the junctioned skills; with an old copy still in a repo, the personal skill runs in Claude and Copilot (the `kit-sync` stand-in depends on it); `disable-model-invocation` holds; arguments arrive.
4. Release a trivial kit change, update, and confirm the repo sees it. Then roll back and confirm again.

**Done when**

- [x] All three tools ran kit skills in that repo with no copies present. Codex: `/next` ran for real through `Invoke-CodexCommand.ps1` (`builder` profile), correctly oriented on repo state, no file changes. Claude and Copilot: skill *discovery* confirmed (Claude's `--debug-file` log shows 24 skills loaded from `~/.claude/skills/`, `project: 0`; Copilot's `skill list` shows all 23 as Personal skills, no collisions), but actual dispatch via slash syntax couldn't be driven headlessly — both tools' non-interactive modes (`claude -p`, `copilot -p`) treat a leading `/` as literal text/path rather than invoking the skill. Ben accepted the discovery-log evidence as sufficient for these two legs (2026-09-16) rather than requiring a manual interactive run.
- [x] The repo's companions are still read. HotCorners has none to exercise, so `SubZeroDev.GameEngine`'s fourteen pre-restructure `.claude/commands/<old-name>-local.md` companions were migrated to `skills/<new-name>/SKILL-local.md` (old→new per the 2026-09-15 rename decision: `contract`→`spec`, `freeze`→`hold`, `kit-help`→`help`, `reconcile`→`align`, `refine`→`tune`, `slices`→`plan`, `unfreeze`→`resume`, `verify`→`check`; `design`, `pr`, `redteam`, `resolve`, `slice`, `track` unchanged), content unaltered — they were already in the categorized declared-region format. Confirmed for all fourteen that the installed global core (`~/.claude/skills/<name>` → `~/.agent-kit/skills/<name>/SKILL.md`) names its companion at exactly that repo-relative path and it resolves from GameEngine's working directory. Old `.claude/commands/` files were left in place — retiring them is Phase 4/5's migration, not this check's.
- [x] Session-cost logging still records the session, in that repo's log. A genuine (non-`<synthetic>`) row landed in HotCorners' `.claude/session-costs.tsv` on 2026-09-17T05:17:17 (`claude-sonnet-5`, real duration and token counts) from a real interactive session Ben ran, closing out the one leg `claude -p` couldn't exercise.
- [x] Update and rollback both took effect without any change to the repo. Released `v2026.09.17` with a one-line marker in `AGENTS.shared.md` ([#319](https://github.com/The-Running-Dev/SubZeroDev.AgentKit/pull/319)), ran `Install-AgentKit.ps1 -Version v2026.09.17`, confirmed the marker visible through HotCorners' `@`-import pointer, rolled back to `v2026.09.16`, confirmed it gone — `git status` in HotCorners showed no change either time.

### Phase 4 — Replace the copy-into-repo tooling (a few days)

1. **`/install` / `INSTALL.md`** handle only the per-repo files: project `AGENTS.md`, `agent.md`, `design/` seed, issue templates, pointer section.
2. **`/kit-sync`** is replaced by `/kit-update`. **`Sync-Kit.ps1`** is retired.
3. **`/install-all`** becomes a one-time migration. For each repo, on a branch: delete each copied kit file only if it matches a released kit version — any of them, since the 23 repos are on different versions — (otherwise report it and leave it), keep companions, remove the repo's kit hooks, add the pointer, open a PR. Ben merges.

**Done when**

- [x] The migration dry-run lists, per repo, exactly what it would delete and anything it refuses to delete. Verified 2026-09-17 from `skills/install-all/SKILL.md` (#323, merged): bare `/install-all` is the documented dry run — reports what it would delete and what it refuses, per repository, writing nothing; `--apply` is required to act.

### Phase 5 — Migrate every repo, then clean up (mostly waiting on merges)

1. Run the migration across all `SubZeroDev.*` repos. One PR each. The stray `Blog-kit-sync-2026-09-07` copy and the `PSGenerator;C` folder are reported, not migrated.
2. For each refused file (edited locally), decide with Ben: move the edit into a companion, or drop it.
3. Update `README.md` with the new install and update steps. Remove the old copy machinery from the kit.
4. Run the install on any other PC Ben uses.

**Done when**

- [ ] No `SubZeroDev.*` repo contains a copied kit command, kit script, or `COMPANIONS.md`.
- [ ] A kit release reaches every repo by running one command, with no PRs.

## Gotchas

- **A bad release hits every project at once.** That's the price of one copy. Keep rollback a single command, and tag releases so "last good" has a name.
- **Personal skills beat repo copies.** During migration, a repo still carrying old copies runs the installed skill, not its copy. That's desirable, but the trial should confirm it. In the kit repo, test changes by updating from the working branch.
- **Two kinds of path look alike.** "The kit's `tools/`" and "the project's `design/`" are both written as relative paths today. Mixing them up breaks silently in other repos, not in the kit repo.
- **Not everywhere has the kit.** Claude Code on the web, cloud sessions, and the GitHub Action PR reviewer won't see it. Accepted for now. Revisit only if one of those becomes a daily need.
- **Name clashes.** A plain `/review` or `/clean` can collide with a built-in or someone else's skill. The phase 0 clash list and the optional prefix cover this.
- **Old `/kit-sync` copies.** Until a repo is migrated, its `/kit-sync` can move `~/.agent-kit`. Phase 2 step 7 covers it.

## Still to decide (Ben)

Unchanged from the handoff.

- **Command names:** rename during phase 1, or keep current names until the trial works? *Recommended:* keep names through the trial, then rename once with the clash list in hand.
- **Version labels:** date tags (`v2026.09.14`), numbered tags, or just commits? *Recommended:* date tags. They're easy to roll back to and need no numbering rules.
- **Record the version in each repo?** Keep a small `.claude/kit.json` noting the kit version a repo was last set up with, or drop it? *Recommended:* keep it, written only by `/install`, for troubleshooting.
- **Codex model-specific variants** (gstack generates skill variants per Codex model): needed? *Recommended:* no, unless phase 0 shows Codex behaving differently.

## Reference

- [gstack](https://github.com/garrytan/gstack) and its [setup script](https://raw.githubusercontent.com/garrytan/gstack/main/setup): multi-tool skill linking, prefix option, ownership tracking, hook registration.
- [Claude Code skills](https://code.claude.com/docs/en/skills.md): folder locations, precedence, `disable-model-invocation`, arguments.
- [Copilot CLI skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills): personal skills folders.
- [Where Codex skills live](https://knightli.com/en/2026/04/29/difference-between-global-and-project-codex-skills/): `~/.agents/skills` vs the older `~/.codex/skills`. Confirm in phase 0.
- Current copy machinery to replace: `INSTALL.md`, `.claude/commands/install.md`, `install-all.md`, `kit-sync.md`, `tools/Sync-Kit.ps1`.
- Output-language work this depends on: `reports/2026-09-14-repo-review-plan.md`, PR 2 and PR 3.

---

*Phases 0–4 are implementation work. The `AGENTS.md` split in phase 1 and the refused-file decisions in phase 5 need Ben's sign-off.*
