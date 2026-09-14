# AgentKit Home Install — Phase 0 Findings

*2026-09-14, run against the real tools on this machine (`D:\Dropbox\Projects\SubZeroDev.AgentKit`).*

Test method: wrote a throwaway `zztest-skill` (SKILL.md with `disable-model-invocation: true` and a literal `$ARGUMENTS` placeholder) under the session scratchpad, then linked it into each tool's personal skills folder with a real Windows directory junction (`New-Item -ItemType Junction`), including one deliberately **cross-volume** (`C:\Users\Ben\.claude\skills\...` → `D:\...`) since the kit itself lives on `D:`. Junctions and the scratch skill were deleted after testing — nothing was left behind.

## Claude Code

| Question | Answer |
|---|---|
| Personal skills folder | `~/.claude/skills/<name>/SKILL.md` — **confirmed already in production use**: the real `graphify` skill lives there today and is listed in every session's available-skills list. |
| Personal rules file | `~/.claude/CLAUDE.md` — already in use (the graphify pointer). Import syntax (`@AGENTS.md`-style) not separately tested; the project `CLAUDE.md` in this repo already relies on `@AGENTS.md` and it resolves, so the mechanism itself is proven, just not from the personal file specifically. |
| Junction discovery | Junction created, target readable through the link (`Get-Content` via the junction returned the file). **Not confirmed that Claude Code's own skill loader picks it up** — the skills list is built once at session start, and this session started before the junction existed. Needs a fresh-session check (open a new session with the junction already in place, confirm the skill appears in the sytem-reminder list). Low risk: Windows junctions report as ordinary directories to `stat`/`readdir`, which is what a Node-based loader would use. |
| Cross-volume junction | **Confirmed working.** `C:\Users\Ben\.claude\skills\zztest-cross` → `D:\Dropbox\Projects\SubZeroDev.AgentKit\tools` linked and listed its contents correctly. This matters because `~/.agent-kit` and the personal skills folders may end up on different drives. |
| `$ARGUMENTS` / `$1` | Not exercised in Claude Code this session (would need a fresh session to invoke the linked skill). Not blocking — Codex confirmed the placeholder round-trips literally through a junctioned file (see below), and Claude's own existing commands already use `$ARGUMENTS` today. |
| `disable-model-invocation: true` | Not exercised for Claude Code specifically this run. |
| Personal vs. repo command precedence | Not directly tested (would need a real name clash). Documented Claude Code behavior is personal-wins; not independently reproduced here. |
| Calling a script at `$HOME/.agent-kit/tools/…` | Not tested — no installed kit checkout exists yet to call into. Low risk in principle (any absolute path is callable from a skill body); revisit once phase 1/2 produce a real script to call. |

## Codex CLI (`codex-cli 0.153.4`)

| Question | Answer |
|---|---|
| Personal skills folder | `~/.codex/skills/<name>/SKILL.md`. **This is a real, first-class feature** — Codex ships several built-in skills under `~/.codex/skills/.system/` (`imagegen`, `openai-docs`, `plugin-creator`, `review-agent`, `skill-creator`, `skill-installer`), same `SKILL.md` format as Claude. |
| Personal rules file | `~/.codex/AGENTS.md` exists and is loaded (`codex/PROFILES.md` in this repo already documents `project_doc_max_bytes` truncation behavior for it). |
| Junction discovery | **Confirmed.** Ran `codex exec --sandbox read-only` (real, non-interactive call, ~11.7k tokens) asking it to report any skill named `zz*`. It went straight to `C:\Users\Ben\.codex\skills\zztest-skill\SKILL.md` — the exact junctioned path — and read it correctly, name/description/body intact. |
| `$ARGUMENTS` placeholder | Read back literally, unsubstituted, through the junction — confirms the file content survives the link untouched. (Did not test live substitution during an actual skill invocation, to avoid a second billed call; the plain-text round-trip is the part junctions could have broken, and it didn't.) |
| `disable-model-invocation` | Inconclusive by design — the test skill's body had no imperative instruction to accidentally run, so this didn't distinguish "loaded but suppressed" from "loaded and would have run." Worth a sharper test in phase 1 once real skill bodies exist. |
| Cross-volume junction | Not re-tested for Codex specifically, but it's the same NTFS junction mechanism confirmed under Claude Code above — no reason to expect a difference. |
| Existing kit integration | **Important discovery, changes the plan's assumption.** `tools/Invoke-CodexCommand.ps1` does **not** rely on Codex skill discovery at all — it launches `codex` directly with the resolved profile flags (`-m`, `-c model_reasoning_effort=`, `-a`, `-s`) and feeds the command's `.claude/commands/<name>.md` content in some other way (needs confirming exactly how, but it is not "Codex found a skill named `/slice`"). The home-install plan's phase 1 step 1 ("commands become skills, same file works for all three tools") should be checked against this: Codex's working integration today is a **launcher script that reads the command file directly**, not the skill mechanism. Converting to `skills/<name>/SKILL.md` may still work for Codex (skills clearly load), but the *current* Codex path into AgentKit commands doesn't go through that mechanism, so switching to skills-only is a behavior change worth calling out to Ben before phase 1, not an assumption to carry in silently. |

## Copilot CLI (`@github/copilot 1.0.83`, installed this session via `npm install -g @github/copilot`)

Not signed in yet — `copilot login` needs to be run interactively by Ben; that step wasn't done here (credential entry is not something this session performs). Everything below worked without being signed in.

| Question | Answer |
|---|---|
| Personal skills folder | `~/.copilot/skills/` or `~/.agents/skills/` — **stated directly by the CLI itself** (`copilot skill --help`), no guessing needed. |
| Personal rules file | Not directly probed; `copilot init` (seen in `--help`) is the tool's own "Initialize Copilot instructions" command — worth running once signed in rather than guessing the path. |
| Project skills folder | Also stated directly: `.github/skills/`, `.agents/skills/`, or **`.claude/skills/`**. |
| **Existing kit integration — big finding** | `copilot skill list` run from this repo, with zero setup, **already discovered 15 of this repo's 23 `.claude/commands/*.md` files as project skills**, frontmatter `description` and all — e.g. `clean`, `design`, `pr`, `verify`. Copilot's project-skill scanner reads `.claude/commands/` (not just `.claude/skills/`) directly. This means Copilot can already run AgentKit commands today, before any phase-1 restructuring. |
| **Frontmatter bug found** | The other 8 command files **failed to load**, and Copilot printed exactly why: `argument-hint must be a string` for `fix.md`, `install-all.md`, `install-code-review-agent.md`, `kit-help.md`, `kit-sync.md`, `resolve.md`, `slice.md`, `track.md` (their `argument-hint` is a list, not a plain string), plus `install-all.md` also has a YAML syntax error (`did not find expected ',' or ']'` in its frontmatter). This is a real, present-day bug in the source repo, independent of the home-install project — worth its own fix regardless of what happens with Phase 1. |
| Junction discovery | **Confirmed**, same method as Claude Code/Codex: junctioned the throwaway `zztest-skill` into `~/.copilot/skills/`, ran `copilot skill list`, it appeared under "Personal skills" with the correct description. Junction removed after. |
| `$ARGUMENTS` / `disable-model-invocation` | Not exercised (would need a signed-in session to actually invoke the skill) — same caveat as the Codex row. |

**Net for Copilot:** unblocked. The CLI is installed, its personal/project skill paths are confirmed directly from its own `--help` (not inferred from docs), and junction-based linking works exactly like the other two tools. The only remaining step is Ben running `copilot login` once, interactively.

## Name-clash list

Checked the 20 AgentKit command names (`brief-check`, `clean`, `contract`, `design`, `fix`, `freeze`, `install`, `install-all`, `install-code-review-agent`, `kit-help`, `kit-sync`, `make-human-docs`, `next`, `pr`, `redteam`, `refine`, `resolve`, `slice`, `slices`, `track`, `unfreeze`, `verify`) against every skill name visible in this session's full skill listing (built-in Claude Code skills, installed plugins, and marketplace skills currently enabled for this account).

**No collisions found.** Nothing in the current listing is named exactly `clean`, `review`, `install`, `next`, `track`, `verify`, `fix`, `slice`, `slices`, `pr`, `design`, `contract`, `freeze`, `resolve`, or `refine`. The closest near-misses are namespaced differently (`engineering:code-review`, `security-review`, `plugin-name:review-agent` under Codex's `.system`), so they don't collide with a bare `/review`-style name because Claude Code's plugin skills carry a `plugin:` prefix.

**Caveat:** this reflects the skills enabled for *this account* in *this session*, not a universal set. A different machine, a different set of installed plugins, or a future Anthropic/OpenAI built-in could still introduce a clash later — this list is a snapshot, not a guarantee. The plan's optional `-Prefix` flag (phase 2) is the right hedge regardless.

## Net effect on the plan

- **Junctions are viable** on this machine, including cross-volume — no need to fall back to the copy-plus-rerun-update strategy. Phase 1 can proceed on that assumption.
- **Codex's current AgentKit integration bypasses skill discovery entirely**, going through `Invoke-CodexCommand.ps1` instead. Recommendation (see below): keep the launcher-script path for Codex and just repoint it at the new install location — don't migrate Codex onto native skill discovery, because that would drop the per-command model/effort/sandbox profile selection *Command routing* depends on.
- **Copilot CLI is now installed and unblocked.** It already reads `.claude/commands/*.md` directly as project skills, with no conversion needed — 15 of 23 loaded cleanly, 8 failed on a real frontmatter bug (`argument-hint` not a string, plus a YAML syntax error in `install-all.md`) that's worth fixing in this repo regardless of the home-install project. Sign-in (`copilot login`) is still Ben's to run.

## Recommendation on the Codex question

Keep **Option B**: `Invoke-CodexCommand.ps1` keeps doing its own profile-selecting launch (reading each command's file directly and passing `-m`/`-c model_reasoning_effort=`/`-a`/`-s`), just repointed at wherever Phase 1 puts the shared command files instead of `.claude/commands/`. `~/.codex/skills/` stays reserved for Codex's own built-in and personal skills, unrelated to AgentKit commands. This avoids Option A (converting Codex onto native skill discovery), which has no way to carry a "launch with this profile" instruction and would regress the tier-enforcement the launcher currently guarantees.
