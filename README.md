# Design pipeline — agent kit

Nine stages, all nine now with a command — but stage 0's asks the questions rather than answering them: `/interview` types the brief from what you say and may not originate what goes in it, so the brief is still yours. Most end in a committed artifact; the two review gates deliberately keep a verdict out of the design doc — `/brief` writes nothing at all, `/redteam` writes only a findings file under `design/redteam/`, never back into `design/10-design.md` itself. The artifact is the handoff, not the conversation.

## Layout

```
AGENTS.shared.md              binding contract every repo using the kit shares
AGENTS.md                     this repo's project rules on top of it, read by Codex
CLAUDE.md                     imports both, read by Claude Code
agent.md                      lessons learned the hard way
setup.ps1                     global front door — bootstrap, update, roll back the shared checkout
INSTALL.md                    how the kit installs into a repo
skills/<name>/SKILL.md        slash commands. Cores — the kit owns these outright
skills/<name>/SKILL-local.md  optional per-repo companions. The target owns these
.claude/COMPANIONS.md         what a companion may and may not override
.github/ISSUE_TEMPLATE/*.md   bug and story templates, human-first shape
tools/Measure-Session.ps1     what a session actually cost, from the transcript
tools/Test-DesignDrift.ps1    criterion-id and commit-pin drift, doc against tracker
tools/Test-Companion.ps1      validates the core/companion split
codex/PROFILES.md             Codex profile definitions
templates/design/*.md         seed copied into a target's design/
reports/                      one-off verification and planning reports, kept for evidence
design/                       the kit's own design. Never installed
  00-brief.md                 mine, typed by /interview or by hand
  10-design.md                /design
  20-contract.md              /spec
  30-slices.md                /plan
  90-decisions.md             append-only
  cost.md                     measured session and output costs behind the budget rules
  state/                      the kit's own design-state records — units, contracts,
                              invariants, decisions, questions, and the work mirror
  state-index.md              projection over state/, regenerated rather than written
```

## Installing

Quick-install AgentKit once for the machine, then use its skills from any project. PowerShell 7 and Git are required. The checkout is `$env:AGENTKIT_HOME` when that variable is set, otherwise `$HOME/.agent-kit`.

**Quick install**, run it yourself in `pwsh` — it verifies an existing checkout's origin before advancing it, so one quietly pointed at a fork or a mirror is refused rather than silently installed from:

```powershell
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'AgentKit requires PowerShell 7. Run this in pwsh.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'AgentKit requires Git on PATH.' }
$kitHome = if ($env:AGENTKIT_HOME) { $env:AGENTKIT_HOME } else { Join-Path $HOME '.agent-kit' }
$source = 'https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git'

if (-not (Test-Path -LiteralPath (Join-Path $kitHome '.git'))) {
    if ((Test-Path -LiteralPath $kitHome) -and (Get-ChildItem -LiteralPath $kitHome -Force -ErrorAction SilentlyContinue)) {
        throw "'$kitHome' exists and is not empty, and is not an AgentKit checkout. Choose an empty path or set AGENTKIT_HOME."
    }
    git clone $source $kitHome
    if ($LASTEXITCODE -ne 0) { throw 'AgentKit clone failed; setup was not run.' }
}

$origin = (git -C $kitHome remote get-url origin).Trim()
if ($origin -ne $source) {
    throw "'$kitHome' has origin '$origin', not the canonical AgentKit source '$source'."
}

$bootstrapHome = $null
try {
    $entryRoot = $kitHome
    if (-not (Test-Path -LiteralPath (Join-Path $entryRoot 'setup.ps1'))) {
        # A managed checkout from an older release has no front door yet.
        $bootstrapHome = Join-Path ([IO.Path]::GetTempPath()) ('agentkit-bootstrap-' + [guid]::NewGuid())
        git clone --depth 1 $source $bootstrapHome
        if ($LASTEXITCODE -ne 0) { throw 'AgentKit bootstrap clone failed.' }
        $entryRoot = $bootstrapHome
    }
    & (Join-Path $entryRoot 'setup.ps1')
} finally {
    if ($bootstrapHome -and (Test-Path -LiteralPath $bootstrapHome)) {
        Remove-Item -LiteralPath $bootstrapHome -Recurse -Force
    }
}
```

Paste the same intent into an agent instead when you want a guided run with a reported version, commit, registrations and collisions: **Bootstrap the public AgentKit checkout globally in `AGENTKIT_HOME` or `$HOME/.agent-kit`; verify an existing checkout's origin is `https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git`; then run its on-disk `setup.ps1` for the newest stable release. Detect and register every supported host, verify the result, and report the version, commit, registrations and collisions. Do not modify the current project or use `iex`, implicit `main`, or an unverified origin.**

**Fast install**, one line, skips the origin check — reach for this only when you already trust whatever checkout sits at `AGENTKIT_HOME` (a scripted or CI install, say), since it fast-forwards it without asking first:

```powershell
$k = if ($env:AGENTKIT_HOME) { $env:AGENTKIT_HOME } else { Join-Path $HOME '.agent-kit' }; if (Test-Path (Join-Path $k '.git')) { if ((git -C $k rev-parse --is-shallow-repository) -eq 'true') { git -C $k fetch --unshallow origin } else { git -C $k fetch origin main }; git -C $k merge --ff-only origin/main } else { git clone --depth 1 https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git $k }; & (Join-Path $k 'setup.ps1')
```

macOS or Linux, PowerShell 7 (`pwsh`) still required — this line clones with `git`, then hands off to `pwsh`:

```bash
command -v pwsh >/dev/null 2>&1 || { echo 'AgentKit requires PowerShell 7 (pwsh) on PATH. Install: https://aka.ms/pwsh'; exit 1; }
k="${AGENTKIT_HOME:-$HOME/.agent-kit}"; if [ -d "$k/.git" ]; then if [ "$(git -C "$k" rev-parse --is-shallow-repository)" = "true" ]; then git -C "$k" fetch --unshallow origin; else git -C "$k" fetch origin main; fi && git -C "$k" merge --ff-only origin/main; else git clone --depth 1 https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git "$k"; fi && pwsh "$k/setup.ps1"
```

Both fast-install lines skip the origin check: a checkout pointed at a fork or a mirror is silently advanced from it.

The default installs the newest valid stable tag named `vYYYY.MM.DD` (with an optional `.N` release suffix). It never falls back to `main`: pass `-Version main` only when you deliberately want that branch. Omit `-Hosts` to detect available host CLI executables and their personal directories: Claude uses `~/.claude`, Codex uses `$CODEX_HOME` when set or `~/.codex` otherwise, and Copilot uses `~/.copilot` (with `~/.agents` also counted for detection). Select a host explicitly when you want only that host refreshed.

To update, roll back, select a branch or SHA, change names, preview, or remove the checkout, run the same checked-out entry point:

```powershell
$kitHome = if ($env:AGENTKIT_HOME) { $env:AGENTKIT_HOME } else { Join-Path $HOME '.agent-kit' }
& (Join-Path $kitHome 'setup.ps1') # Update to latest stable; also the idempotent re-run
& (Join-Path $kitHome 'setup.ps1') -Hosts codex
& (Join-Path $kitHome 'setup.ps1') -Hosts claude
& (Join-Path $kitHome 'setup.ps1') -Version 'vYYYY.MM.DD' # Replace with an existing front-door-capable release
& (Join-Path $kitHome 'setup.ps1') -Version '<commit-sha>' # Replace with a full commit SHA
& (Join-Path $kitHome 'setup.ps1') -Version main
& (Join-Path $kitHome 'setup.ps1') -Prefix ak-
& (Join-Path $kitHome 'setup.ps1') -DryRun
& (Join-Path $kitHome 'setup.ps1') -Uninstall
& (Join-Path $kitHome 'setup.ps1') -Uninstall -Force
```

`-Prefix ak-` installs names such as `$ak-slice` and `$ak-slice-routed`. Existing foreign or modified skill entries are collisions: the installer warns, skips, and preserves them. `-Uninstall` removes only unchanged registrations, hooks, and pointers the manifest records; `-Uninstall -Force` additionally deletes the validated canonical checkout.

Any selected tag, branch, or SHA that lacks `setup.ps1` is unsupported and is refused before checkout. Rollback is therefore limited to front-door-capable releases. The bootstrap always runs the script from disk; it does not fetch and execute text with `iex`.

On a fresh machine, cloning is the one necessary write before `-DryRun` can inspect an installed checkout. Once the checkout exists, `-DryRun` makes no bootstrap, registration, or version-selection changes.

`v2026.09.18` is the first published release carrying `setup.ps1`; `v2026.09.15`, `v2026.09.16` and `v2026.09.17` predate it and a default bootstrap — which selects the newest stable tag — refuses those with *"predates the global front door"*. Pass `-Version main` only to bootstrap unreleased work deliberately.

Create a stable release only after the merged SHA has passed its required workflow gates. A repository maintainer then chooses a `vYYYY.MM.DD` tag — or `vYYYY.MM.DD.N` when that date already carries one — and points it at that merged SHA. The tag must be unused **and rank above every tag already published for that date**; `Resolve-StableTag` in [`tools/Install-AgentKit.ps1`](tools/Install-AgentKit.ps1) orders by date and then by numeric revision, counting a bare tag as revision 0, so a revision below one already published is never selected as newest and the release silently reaches no installation. Then run (substitute the verified SHA and chosen tag):

```powershell
git fetch origin main --tags
$releaseCommit = '<verified-merged-sha>'
$releaseTag = 'vYYYY.MM.DD' # Or vYYYY.MM.DD.N, N above every revision already published for that date
git tag -a $releaseTag $releaseCommit -m "AgentKit $releaseTag: global native and routed skills"
git push origin "refs/tags/$releaseTag"
```

Then exercise the fresh bootstrap block above without `-Version` and confirm the reported commit includes the global-install work. Tagging still requires the maintainer's authorization.

Once the kit is installed, work in a target repository and use `/install <path>` when that repository needs its project-owned files seeded or reconciled. The command reads [`INSTALL.md`](INSTALL.md) from the installed kit.

Installing is a **reconciliation, not a copy**. A repository that already has agent instructions has them for a reason, usually a better-informed one than this kit's defaults. The installer classifies every artifact as absent, identical, divergent, or occupied; proposes a resolution for each; and stops for sign-off before writing. Re-running it upgrades, with the target winning wherever it has since been edited.

**Command files are outside that, on purpose.** Each host receives an ownership-tracked generated adapter that resolves the canonical skill body in the installed checkout. Codex receives both a thin native skill and a thin `-routed` skill for each command. A target repository never receives a core copy; it may keep a companion at `skills/<name>/SKILL-local.md` that it owns entirely. The core names which categories its companion may override — vocabulary, document map, extra steps, gate commands, a tightened authorization — and [`.claude/COMPANIONS.md`](.claude/COMPANIONS.md) holds the vocabulary and the never-list. A companion is never read, written, or deleted by an automated path. `tools/Test-Companion.ps1` checks the split holds.

`/install-all` runs the same reconciliation unattended, across every `SubZeroDev.*` sibling repository in one pass. It applies only the resolutions `INSTALL.md` already states as deterministic; anything that would otherwise stop for sign-off is skipped per repository and reported as needing a decision, not guessed.

Use the same global `setup.ps1` command to update or roll back the shared checkout. `/sync` updates that checkout to the newest stable release (or an explicitly requested version), then reconciles the current target repository.

**Update checks are automatic, and on by default.** The first AgentKit command you run in a session checks whether the installed runtime is behind what it tracks — the newest stable release, or `origin/<branch>` for a branch install — and, when it is, the agent shows the commits in between and asks whether to upgrade before running the command. A yes runs `setup.ps1`; a no carries on unchanged. Nothing is fetched into the working tree without that yes, a pinned tag or SHA is never offered an update, and a check that cannot reach the origin stays silent. Turn it off with `/autoupdate off` (stored in `~/.agent-kit-state/config.json`, or `tools/Get-AgentKitSkill.ps1 -SetAutoUpdate Off` directly; `/autoupdate on` or `-SetAutoUpdate On` restores it), or for one shell session with `/autoupdate-env off` (equivalent to `AGENTKIT_AUTO_UPDATE=0`).

Design docs install at `design/` in the repository root, deliberately — `docs/` is usually occupied by a documentation site, and a design directory inside its build context gets baked into the published image. `INSTALL.md` still checks the path before creating anything.

The installer owns the shared adapters and pointers. A target retains only its project rules, design, lessons, issue templates, and any local companions.

## Three files, three jobs

The agent contract, `agent.md`, and `90-decisions.md` are easy to conflate and stop being useful the moment they overlap.

| File | Holds | Test |
|---|---|---|
| `AGENTS.shared.md` + `AGENTS.md` | Standing instructions. What to do, always — the shared contract first, then this repository's own project rules on top of it. | Would an agent behave wrongly without it? |
| `agent.md` | Lessons. What went wrong, and what it cost. | Would it have changed a decision? |
| `90-decisions.md` | Decisions. What was chosen over what, and why. | Would a future reader ask "why?" |

A rule with no cost attached is an instruction, not a lesson. A lesson that recurs becomes a rule. A choice between viable options is neither — it is a decision. `agent.md` is the one that rots: it loads into context every session, so a lesson kept past its usefulness is a cost you pay forever. `/align` proposes additions; you approve them, and you delete them.

## Stage map

| Stage | Command | Writes |
|---|---|---|
| 0 Brief | `/interview`, or by hand | `00-brief.md` |
| 1 Interrogate | `/brief` | nothing |
| 2 Design | `/design` | `10-design.md`, `90-decisions.md` |
| 3 Red team | `/redteam` | `design/redteam/<date>-<target>.md` |
| 4 Contract | `/spec` | `20-contract.md` |
| 5 Slices | `/plan` | `30-slices.md` |
| 6 Implement | `/slice [S<n>]` | code + tests |
| 7 Reconcile | `/align` | design docs, `agent.md` |
| 8 Human docs | `/docs` | `docs/docs/guide.md` (generated) |

Outside the numbered stages: `/help` says where the repository is and what to run next, `/next` works the same thing out and then *does* it — stopping at a session boundary rather than crossing it — `/pr` takes a branch to merge-ready — description, then gates, then review threads — following the repo's own merge convention, `/check` and `/resolve` are `/pr`'s gate and thread phases and stay callable on their own, `/fix` reproduces and fixes a defect that has no slice, `/clean` switches back to the default branch and cleans up merged local branches, `/track` syncs `design/` to GitHub issues, `/install` reconciles a target repository's project-owned files, `/install-all` migrates those files across sibling repositories, `/install-review` writes the GitHub Actions workflow that puts automated Claude review on a repository's pull requests (the app installation and the API secret stay yours), and `/sync` updates the shared checkout before reconciling the current target. `/hold` and `/resume` drive the design freeze, below.

`/tune` is the front door for asks that fall between the stages. Every other command assumes you are already inside the pipeline — `/slice` needs a slice, `/spec` needs a design. `/tune` takes a rough ask, routes it to the command that owns it where one does, and otherwise emits a prompt carrying the constraints that bind it. It emits rather than executes, because the tier it names is usually not the tier it is running at.

`/handoff` is the way out of the pipeline entirely. Where `/tune` takes a rough *ask* and hands back a prompt, `/handoff` takes finished *instructions* and implements them — branch, build, gates, pull request, merge — consulting no design document and leaving no slice, issue, or decision entry behind. [`AGENTS.shared.md`](AGENTS.shared.md), *Handoff mode* is the binding half: it suspends the pipeline and the design-protecting rules, keeps verification, delivery, and authorization, and says that the mode is declared in whatever words the user likes rather than only by the command. Work that is specified but not designed goes here; pushing it through stages 1–5 anyway is the failure this exists to stop.

**Which model runs which command is in [`AGENTS.shared.md`](AGENTS.shared.md), *Command routing*** — it is binding policy, so it has one home and this is not it.

Effort tracks irreversibility, not stage prestige. Schemas and public interfaces are expensive to change; code is cheap to throw away. Stages 2 and 4 are where the money goes. Stage 6 is where it usually gets wasted.

## Start to finish

**Run [`/help`](skills/help/SKILL.md).** It works out where the repository actually is — which design docs exist, which branch you are on, what the tracker says — and tells you the current step, the next one, and whether it needs a fresh session. `/help all` shows the whole flow.

That command holds the walkthrough, rather than this file, because global command adapters and target-specific reconciliation have different scopes. The shape it walks:

- **Stages 0 to 5, once per project.** One session each, ending in a committed file that is the next stage's only input. Three of them stop rather than proceed — `/design` on a thin brief, `/spec` on a signature the design does not determine, `/redteam` at findings. Sending work back a stage costs a few thousand tokens; finding it in stage 6 costs a re-implementation.
- **Stage 6, once per slice.** `/slice` (branches, implements, commits, pushes, opens the PR — never as a draft — ticks the boxes it confirms) → `/pr` (writes the real description, runs the gates into its `Verified` section, then works the review threads) → merge → `/track` in a new session. One slice, one branch, one session.
- **`/align` and `/docs`** when the slices run out.

**Which model runs each command is in [`AGENTS.shared.md`](AGENTS.shared.md), *Command routing*. Where a session must end is in [`AGENTS.shared.md`](AGENTS.shared.md), *Session boundaries*.** Both are binding policy, so each has one home and this is not it.

## Freezing the design

The loop above — slice lands, `/align` writes reality back, `/track` resyncs the tracker — is right while the design is still being settled and wrong once implementation is the bottleneck. Each pass is generative rather than merely checking, so landing slice N rewrites slice N+1's specification, which desyncs the tracker, which needs `/track`, which finds drift, which needs `/align`. There is no fixed point. Freezing is how you get out.

`/hold` writes `design/FROZEN.md`, and the file's existence is the whole mechanism — it is tracked, because a freeze is a statement to everyone working in the repository rather than local state. While it is there, `/align` and `/track` do not run and `/interview`, `/design`, `/spec` and `/plan` refuse; slices implement against `20-contract.md` as a fixed artifact at the SHA the marker names, and a contradiction found while implementing is stated in that slice's pull request and deliberately left in the document. The tracker is allowed to go stale. That staleness is the point, and recording each contradiction in a PR is what makes the eventual reconciliation cheap.

`/resume` lifts it: deletes the marker, then runs one reconciliation pass — `/align`, then `/track`. It runs unattended, because the decision was already made when `/hold` was invoked.

You write `Frozen because` and `Lifts when` yourself; a command never invents them, and a refusing command quotes them back verbatim, so `Lifts when` wants a checkable condition — "tier one is code-complete", not "when we are ready". The marker's exact format and the full list of what the freeze gates are in [`AGENTS.shared.md`](AGENTS.shared.md), *The design freeze*.

## Invocation

**Claude Code** — the commands are native. `/interview`, `/brief`, `/design`, `/redteam`, `/spec`, `/plan`, `/slice S3`, `/align`. Set the model per session with `/model`.

`/slice` takes the slice id, or no argument at all — bare, it takes the lowest-numbered slice whose issue is neither closed nor fully ticked and whose dependencies are done, says which it picked, and proceeds. It asks rather than guessing when the tracker cannot be read, since doneness is not observable from the working tree.

**Codex** — the bootstrap creates two explicit skills per command. `$<command>` is the native mode: it reads the canonical skill from the installed checkout and works in the current Codex session. It intentionally uses that session's model and approval context; the shared contract carries the narrow model-gate exception for this native path. `$<command>-routed` runs `Start-AgentKitCodex.ps1` with `-NewWindow`, which opens a visible Windows terminal and launches the command through the existing profile, approval, and sandbox routing. Approvals and interaction happen in that visible terminal; opening it is not proof the command has completed.

Use native mode when the current session is the one you want to work in. Use routed mode when command routing and its profiles must select the session. Both read the same canonical skill and preserve the command arguments.

For direct automation, call the routed launcher rather than rebuilding a prompt manually:

```powershell
& (Join-Path $kitHome 'tools/Start-AgentKitCodex.ps1') -Command slice -ArgumentsFile .\agentkit-arguments.json -NewWindow
```

**Copilot** — the bootstrap writes one native adapter per command to `~/.copilot/skills/<name>/SKILL.md`, plus the pointer file `~/.copilot/copilot-instructions.md`. There is no routed mode: the `-routed` pair is Codex-only, because routing means launching a session under a profile and only the Codex launcher does that. Each adapter reads the same canonical skill through `Get-AgentKitSkill.ps1` and executes it under this host's normal model policy, which means **the model gate is yours to apply by hand here** — nothing selects a model for you, so check the banner's stated tier against the session you are actually in.

Two limits worth knowing before you rely on it. The bootstrap path is exercised by `tools/Install-AgentKit.Tests.ps1` — adapters are written, and uninstall removes them — but nothing here exercises *invoking* a command under Copilot, so treat host parity as unproven rather than established. And unlike the Claude adapters, Copilot's carry no `disable-model-invocation` flag, so the only thing discouraging the host from starting a command on its own initiative is the adapter description's "Use only when the user requests this command."

## Cross-vendor rule for stage 3

Stage 3 only works if the reviewer did not write the design. Same model, fresh context, is weak — it recognises its own output distribution and defends it. Alternate:

- Design in Claude Code (Opus) → red team with `$redteam-routed`
- Design with Codex through `$design-routed` → red team in Claude Code (Opus)

That the two never share a session is stated in [`AGENTS.shared.md`](AGENTS.shared.md), *Session boundaries*, with the rest of them.

## Rate-limit budget

You hit limits across all three subscriptions, so the allocation matters more than it would otherwise. Rough shape per project:

- Stages 1–5 consume the top tier. Interrogating the brief and cutting slices are judgement work, not clerical work — a badly cut slice costs more than the tokens saved by cutting it cheaply. This is a few tens of thousands of tokens and it is the highest-leverage spend you make.
- Stage 6 runs mid-tier. A precise `20-contract.md` is what makes this safe — the cheap tiers' known failure mode is multi-step architecture and stateful debugging, neither of which is stage 6's job if stage 4 did its work.
- Stage 6 on the top tier is the classic waste. If you find yourself reaching for it there, the real problem is usually an underspecified contract, not an underpowered model.

A wrong architecture costs several full re-implementations. A thin spec costs a few thousand tokens. Spend accordingly.

Those are estimates. `tools/Measure-Session.ps1` reports what a session actually cost, read from the transcript rather than guessed:

```powershell
pwsh ./tools/Measure-Session.ps1 -Detail
```

It reports the four input classes separately because they are priced differently and behave differently. On the first sessions measured here, cache reads ran roughly fifty times cache creation — a single "tokens in" figure would have hidden the only term that was growing. Which work should stop being model work altogether is in [`AGENTS.shared.md`](AGENTS.shared.md), *What should stop being model work*.

**Claude Code only, and it errors rather than guessing.** Every transcript is shape-checked before it is summed, because a foreign transcript parsed for `message.usage` sums to zero and a zero is indistinguishable from a session that cost nothing. Codex stores `~/.codex/sessions/**/rollout-*.jsonl` and records usage as `token_count` events under `payload.info` — readable in principle, unimplemented here, and counted per turn rather than per call. Copilot stores `globalStorage/github.copilot-chat/session-store.db`, whose `turns` table has no usage column at all; it meters premium requests, not tokens, so there is nothing to read at any effort. Both are named explicitly when the script meets one.

Two global hooks in `~/.claude/settings.json` run the same script automatically. `SessionEnd` appends one row per session to the current project's `.claude/session-costs.tsv`, which is gitignored — a convenience, not the record, since transcripts are durable and a session that ends without the hook firing is recovered by running the script again. `UserPromptSubmit` runs `-Watch`, which is silent until the session's context crosses a threshold and then says so on each prompt, while the session can still be ended.

That second hook exists because measurement found session cost is roughly **quadratic in turn count** — per-call context grows with conversation length, and you pay it again every turn. Ending a long session is worth more than any per-command saving. These are global Claude settings managed by setup.ps1, not target-repository settings.

## When to skip most of this

The pipeline has real overhead — four authored artifacts, a generated guide, three vendor handoffs. That is right for something you will maintain for a year. For a 500-line tool, building it badly and rewriting it once is faster, and the failed version teaches you more about the actual problem than the design doc would have. The `Lifespan` line in the brief exists to make you decide this before you start, not after.

Minimum viable version for short-lived work: `00-brief.md` with real non-goals, `20-contract.md`, and `/slice`. Skip 1, 2, 3, 7, 8.

## On stage 0

The brief is the one artifact a model should not author. Models elaborate well and originate badly — they converge on the median of the training distribution. Handing the concept to ChatGPT gets you something competent and unsurprising. Write it yourself and let `/brief` attack it; that inverts the weakest link in the chain.

**`/interview` is not a hole in that.** It asks; you answer. Five questions one at a time — what breaks today, what you do instead and what that costs, who exactly, the narrowest version worth having this week, whether it still matters in a year — each pushed until the answer is specific enough to write down, then a numbered premise list to agree or disagree with before anything is typed. It may not invent the problem, a non-goal, or a definition-of-done criterion, and a field nobody answered is written empty and reported as empty. Restricting a model from *authoring* the brief was always right; it was also, accidentally, stopping anyone from asking the questions, and those are the cheap half.

Write it by hand if you would rather. The stage is identical either way, and `/brief` attacks the result the same.

---

*Model IDs and Codex profile syntax in `codex/PROFILES.md` change often. Verify against current docs before relying on them.*
