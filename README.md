# Design pipeline — agent kit

You design; the agent builds. The design phase is yours and gets the effort: `/interview` and `/brief` pin down the problem, `/design` writes the architecture and the contract, `/plan` cuts it into slices. After that, `/next` builds the whole plan — every slice through tests, pull request, CI, review comments and merge — in one session, and stops only when the plan is done or something genuinely needs you.

## Layout

```
AGENTS.shared.md              binding contract every repo using the kit shares
AGENTS.md                     this repo's project rules on top of it, read by Codex
CLAUDE.md                     imports both, read by Claude Code
agent.md                      lessons learned the hard way
setup.ts                      global front door — bootstrap and update the shared checkout
INSTALL.md                    how the kit installs into a repo
skills/<name>/SKILL.md        slash commands, owned by the kit
.github/ISSUE_TEMPLATE/*.md   bug and story templates, human-first shape
tools/*.ts                    Node scripts the commands call; no PowerShell needed
  merge-pull-request.ts       merges only when every check on the exact head passed
  wait-pull-request-check.ts  waits for checks on an exact head SHA
  invoke-housekeeping.ts      post-merge branch cleanup, no model call
  invoke-done-housekeeping.ts confirmed-merged branch deletion
  measure-session.ts          what a session actually cost, from the transcript
  get-next-slice.ts           the first unfinished slice in 30-slices.md
  new-design-docs.ts          seeds design/ from templates/design
  install-agentkit.ts         host registrations behind setup.ts
  get-agentkit-skill.ts       resolves a command's skill body and update check
  start-agentkit-codex.ts     routed Codex launcher
  test-*.ts                   gate, verify-report and contract checks
tools/git-hooks/commit-msg    rejects AI attribution in commit messages
codex/PROFILES.md             Codex profile definitions
templates/design/*.md         seed copied into a target's design/
reports/                      one-off verification and planning reports, kept for evidence
design/                       the kit's own design. Never installed
  00-brief.md                 the problem, typed by /interview or by hand
  10-design.md                /design
  20-contract.md              /design
  30-slices.md                /plan; each slice's Status: line is the tracker
  90-decisions.md             append-only
  cost.md                     measured session and output costs
```


## Installing

Quick-install AgentKit once for the machine, then use its skills from any project. Git and Node >= 22.18 are required; merging also needs an authenticated GitHub CLI (`gh`). Users do not need npm install. The checkout is `AGENTKIT_HOME` when set, otherwise `$HOME/.agent-kit`.

**Windows**, in the built-in Windows PowerShell 5.1 or a newer shell. This verifies the checkout's origin before running setup:

```powershell
$ErrorActionPreference = 'Stop'
node -e "const [a,b]=process.versions.node.split('.').map(Number); if(a<22||(a===22&&b<18))process.exit(2)"
if ($LASTEXITCODE -ne 0) { throw 'AgentKit requires Node >= 22.18 on PATH.' }
$kitHome = if ($env:AGENTKIT_HOME) { $env:AGENTKIT_HOME } else { Join-Path $HOME '.agent-kit' }
$source = 'https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git'
if (-not (Test-Path -LiteralPath (Join-Path $kitHome '.git'))) {
    git clone $source $kitHome
    if ($LASTEXITCODE -ne 0) { throw 'AgentKit clone failed.' }
}
$origin = git -C $kitHome remote get-url origin
if ($LASTEXITCODE -ne 0 -or $origin -ne $source) { throw 'AgentKit origin is not the canonical source.' }
$bootstrapHome = $null
try {
    $entryRoot = $kitHome
    if (-not (Test-Path -LiteralPath (Join-Path $entryRoot 'setup.ts'))) {
        $bootstrapHome = Join-Path ([IO.Path]::GetTempPath()) ('agentkit-bootstrap-' + [guid]::NewGuid())
        git clone --depth 1 $source $bootstrapHome
        if ($LASTEXITCODE -ne 0) { throw 'AgentKit bootstrap clone failed.' }
        $entryRoot = $bootstrapHome
    }
    node (Join-Path $entryRoot 'setup.ts')
    if ($LASTEXITCODE -ne 0) { throw 'AgentKit setup failed; read the diagnostic above.' }
} finally {
    if ($bootstrapHome -and (Test-Path -LiteralPath $bootstrapHome)) {
        Remove-Item -LiteralPath $bootstrapHome -Recurse -Force
    }
}
```

**macOS or Linux**, in bash or zsh:

```bash
(
set -eu
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<18))process.exit(2)'
kit="${AGENTKIT_HOME:-$HOME/.agent-kit}"
source='https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git'
if [ ! -e "$kit/.git" ]; then git clone "$source" "$kit"; fi
[ "$(git -C "$kit" remote get-url origin)" = "$source" ] || { echo 'AgentKit origin is not the canonical source.' >&2; exit 1; }
entry="$kit"
if [ ! -f "$entry/setup.ts" ]; then
    bootstrap="$(mktemp -d)"
    trap 'rm -rf -- "$bootstrap"' EXIT
    git clone --depth 1 "$source" "$bootstrap"
    entry="$bootstrap"
fi
node "$entry/setup.ts"
)
```

For a guided run, ask an agent to bootstrap the canonical checkout, verify its origin, run `node setup.ts`, and report the selected version, commit, registrations and collisions.

The default selects the newest valid stable `vYYYY.MM.DD` tag, with an optional numeric `.N` suffix. It never falls back to `main`. Omit `--hosts` to detect available host executables and personal directories: Claude uses `~/.claude`, Codex uses `CODEX_HOME` or `~/.codex`, and Copilot uses `~/.copilot` (`~/.agents` also counts for detection).

Run the same front door for updates and removal. In these shell-neutral examples, replace `<kit-root>` with the checkout's absolute path:

```text
node "<kit-root>/setup.ts"
node "<kit-root>/setup.ts" --hosts codex
node "<kit-root>/setup.ts" --hosts claude --hosts copilot
node "<kit-root>/setup.ts" --version vYYYY.MM.DD
node "<kit-root>/setup.ts" --version <commit-sha>
node "<kit-root>/setup.ts" --version main
node "<kit-root>/setup.ts" --prefix ak-
node "<kit-root>/setup.ts" --dry-run
node "<kit-root>/setup.ts" --verify
node "<kit-root>/setup.ts" --uninstall
node "<kit-root>/setup.ts" --uninstall --force
```

`--prefix ak-` installs names such as `$ak-next` and `$ak-next-routed`. Foreign or edited registrations are preserved and reported as collisions. Uninstall removes only unchanged owned registrations, pointers and hooks; adding `--force` also removes the validated checkout. Verify is read-only. Dry runs make no checkout or host changes; the initial bootstrap clone itself is a write.

Create a stable release only after the merged SHA passes its required workflow gates. Choose an unused `vYYYY.MM.DD` tag, or `vYYYY.MM.DD.N` above every revision already published for that date. Stable selection sorts by date, then numeric revision; the bare tag is revision zero. Substitute the chosen tag and verified SHA:

```text
git fetch origin main --tags
git tag -a vYYYY.MM.DD <verified-merged-sha> -m "AgentKit vYYYY.MM.DD"
git push origin refs/tags/vYYYY.MM.DD
```

Then exercise the fresh bootstrap without `--version` and confirm its reported commit is the release SHA. Tagging and publishing are the maintainer's release step.

For post-merge branch cleanup, run the housekeeping script from the target repository. In bash or zsh:

```bash
node "${AGENTKIT_HOME:-$HOME/.agent-kit}/tools/invoke-housekeeping.ts"
```

In Windows PowerShell:

```powershell
$kitHome = if ($env:AGENTKIT_HOME) { $env:AGENTKIT_HOME } else { Join-Path $HOME '.agent-kit' }
node (Join-Path $kitHome 'tools/invoke-housekeeping.ts')
```

Once the kit is installed, work in a target repository and use `/install <path>` when that repository needs its project-owned files seeded or reconciled. The command reads [`INSTALL.md`](INSTALL.md) from the installed kit.

Installing is a **reconciliation, not a copy**. A repository that already has agent instructions has them for a reason, usually a better-informed one than this kit's defaults. The installer classifies every artifact as absent, identical, divergent, or occupied; proposes a resolution for each; and stops for sign-off before writing. Re-running it upgrades, with the target winning wherever it has since been edited.

**Command files are outside that, on purpose.** Each host receives an ownership-tracked generated adapter that resolves the canonical skill body in the installed checkout. Codex receives both a thin native skill and a thin `-routed` skill for each command. A target repository never receives a copy of a skill.

`/install-all` runs the same reconciliation unattended, across every `SubZeroDev.*` sibling repository in one pass. It applies only the resolutions `INSTALL.md` already states as deterministic; anything that would otherwise stop for sign-off is skipped per repository and reported as needing a decision, not guessed.

Use the same global `node setup.ts` command to update the shared checkout. `/sync` updates that checkout to the newest stable release (or an explicitly requested version), then reconciles the current target repository.

**Update checks are automatic, and on by default.** The first AgentKit command you run in a session checks whether the installed runtime is behind what it tracks — the newest stable release, or `origin/<branch>` for a branch install — and, when it is, the agent runs the command anyway and ends its report with the upgrade command to run, so a check never stops the work to ask. Nothing is fetched into the working tree until you run that command, a pinned tag or SHA is never offered an update, and a check that cannot reach the origin stays silent. Turn it off with `node tools/get-agentkit-skill.ts --set-auto-update Off` (stored in `~/.agent-kit-state/config.json`; `--set-auto-update On` restores it), or for one shell with `AGENTKIT_AUTO_UPDATE=0`.

Design docs install at `design/` in the repository root, deliberately — `docs/` is usually occupied by a documentation site, and a design directory inside its build context gets baked into the published image. `INSTALL.md` still checks the path before creating anything.

The installer owns the shared adapters and pointers. A target retains only its project rules, design, lessons, and issue templates.

## Three files, three jobs

The agent contract, `agent.md`, and `90-decisions.md` are easy to conflate and stop being useful the moment they overlap.

| File | Holds | Test |
|---|---|---|
| `AGENTS.shared.md` + `AGENTS.md` | Standing instructions. What to do, always — the shared contract first, then this repository's own project rules on top of it. | Would an agent behave wrongly without it? |
| `agent.md` | Lessons. What went wrong, and what it cost. | Would it have changed a decision? |
| `90-decisions.md` | Decisions. What was chosen over what, and why. | Would a future reader ask "why?" |

A rule with no cost attached is an instruction, not a lesson. A lesson that recurs becomes a rule. A choice between viable options is neither — it is a decision. `agent.md` is the one that rots: it loads into context every session, so a lesson kept past its usefulness is a cost you pay forever. `/align` proposes additions; you approve them, and you delete them.

## How it works

| Phase | Command | Writes |
|---|---|---|
| Brief | `/interview`, or by hand | `00-brief.md` |
| Interrogate | `/brief` | nothing |
| Design | `/design` | `10-design.md`, `20-contract.md`, `90-decisions.md` |
| Red team (optional) | `/redteam` | `design/redteam/<date>-<target>.md` |
| Plan | `/plan` | `30-slices.md`, every slice `Status: todo` |
| Build | `/next` | code, tests, one merged pull request per slice |

**`/next` is the whole build.** It picks the first slice that is not done and whose dependencies are, builds it test-first, opens the pull request, waits for CI, fixes failures and review comments, merges through `tools/merge-pull-request.ts`, cleans up the branch, and moves on to the next slice — same session. Each slice's pull request sets its `Status:` to `done` in `30-slices.md`; that line is the only tracker. `/next one` stops after a single slice; `/next S4` starts at S4. It stops only for a genuine blocker — two incompatible readings of the design with no evidence for either, a missing credential, a merge the script refused, three failed attempts at the same fix — and tells you exactly what it needs.

**The design is the spec, not a mirror.** `design/` is written once and left alone. When building shows the design was wrong somewhere, `/next` does what works and lists the mismatch in that pull request's *Differs from design* section. Nothing stops on drift and nothing rewrites the design behind your back. When you want the documents brought up to date, run `/align`: it gathers those *Differs from design* notes, compares the docs against the tree, and asks you to decide each divergence.

**Outside the plan:** `/fix` reproduces and fixes a bug, files it as an issue, and ships the fix the same way. Anything you tell the agent directly — "just do this", a pasted spec — is done directly, with no brief or slice first. `/install` reconciles a target repository's project-owned files, `/install-all` does it across sibling repositories, `/install-review` writes the GitHub Actions workflow for automated Claude review, and `/sync` updates the shared checkout before reconciling the current target.

**Which model suits which command is in [`AGENTS.shared.md`](AGENTS.shared.md), *Models*.** It is guidance, never a gate.

Effort tracks irreversibility. Schemas and public interfaces are expensive to change; code is cheap to throw away. The design phase is where the money goes.

## Invocation

**Claude Code** — the bootstrap installs the commands as one plugin, `~/.claude/skills/agentkit`, which Claude Code loads in every session with no marketplace or install step. Every command is namespaced under it: `/agentkit:interview`, `/agentkit:brief`, `/agentkit:design`, `/agentkit:redteam`, `/agentkit:plan`, `/agentkit:next`, `/agentkit:fix`, `/agentkit:align`. The namespace is not optional. Bare `/plan` is Claude Code's own command, and `/design` is a skill it bundles. An install that predates the plugin had bare per-command folders under `~/.claude/skills/`; re-running `node setup.ts` moves them into the plugin and removes the bare folders, unless you edited one. Set the model per session with `/model`.

**Codex** — the bootstrap creates two explicit skills per command. `$<command>` is the native mode: it reads the canonical skill from the installed checkout and works in the current Codex session. It uses that session's model and approval context. `$<command>-routed` runs `start-agentkit-codex.ts` with `--new-window`, which opens a visible terminal and launches the command through the existing profile, approval, and sandbox routing. Approvals and interaction happen in that visible terminal; opening it is not proof the command has completed.

Use native mode when the current session is the one you want to work in. Use routed mode when command routing and its profiles must select the session. Both read the same canonical skill and preserve the command arguments.

For direct automation, call the routed launcher rather than rebuilding a prompt manually:

```sh
node "${AGENTKIT_HOME:-$HOME/.agent-kit}/tools/start-agentkit-codex.ts" --command next --arguments-file ./agentkit-arguments.json --new-window
```

In Windows PowerShell, with `$kitHome` set as in the housekeeping example:

```powershell
node (Join-Path $kitHome 'tools/start-agentkit-codex.ts') --command next --arguments-file ./agentkit-arguments.json --new-window
```

**Copilot** — the bootstrap writes one native adapter per command to `~/.copilot/skills/<name>/SKILL.md`, plus the pointer file `~/.copilot/copilot-instructions.md`. There is no routed mode: the `-routed` pair is Codex-only, because routing means launching a session under a profile and only the Codex launcher does that. Each adapter reads the same canonical skill through `get-agentkit-skill.ts` and executes it under this host's normal model policy — nothing selects a model for you, so pick one by [`AGENTS.shared.md`](AGENTS.shared.md), *Models*.

Two limits worth knowing before you rely on it. The bootstrap path is exercised by `tools/install-agentkit.test.ts` — adapters are written, and uninstall removes them — but nothing here exercises *invoking* a command under Copilot, so treat host parity as unproven rather than established. And unlike the Claude adapters, Copilot's carry no `disable-model-invocation` flag, so the only thing discouraging the host from starting a command on its own initiative is the adapter description's "Use only when the user requests this command."

## Cross-vendor red team

A red team only works if the reviewer did not write the design. Same model, fresh context, is weak — it recognises its own output distribution and defends it. Alternate:

- Design in Claude Code (Opus) → red team with `$redteam-routed`
- Design with Codex through `$design-routed` → red team in Claude Code (Opus)

It is optional. Run it when the design is expensive to get wrong.

## Rate-limit budget

You hit limits across all three subscriptions, so the allocation matters more than it would otherwise. Rough shape per project:

- The design phase consumes the top tier. Interrogating the brief and cutting slices are judgement work, not clerical work — a badly cut slice costs more than the tokens saved by cutting it cheaply. This is a few tens of thousands of tokens and it is the highest-leverage spend you make.
- `/next` runs mid-tier. A precise `20-contract.md` is what makes this safe — the cheap tiers' known failure mode is multi-step architecture and stateful debugging, neither of which is the build's job if the design did its work.
- The build on the top tier is the classic waste. If you find yourself reaching for it there, the real problem is usually an underspecified contract, not an underpowered model.

A wrong architecture costs several full re-implementations. A thin spec costs a few thousand tokens. Spend accordingly.

Those are estimates. `tools/measure-session.ts` reports what a session actually cost, read from the transcript rather than guessed:

```sh
node ./tools/measure-session.ts --detail
```

It reports the four input classes separately because they are priced differently and behave differently. On the first sessions measured here, cache reads ran roughly fifty times cache creation — a single "tokens in" figure would have hidden the only term that was growing.

**Claude Code only, and it errors rather than guessing.** Every transcript is shape-checked before it is summed, because a foreign transcript parsed for `message.usage` sums to zero and a zero is indistinguishable from a session that cost nothing. Codex stores `~/.codex/sessions/**/rollout-*.jsonl` and records usage as `token_count` events under `payload.info` — readable in principle, unimplemented here, and counted per turn rather than per call. Copilot stores `globalStorage/github.copilot-chat/session-store.db`, whose `turns` table has no usage column at all; it meters premium requests, not tokens, so there is nothing to read at any effort. Both are named explicitly when the script meets one.

A global `SessionEnd` hook in `~/.claude/settings.json` runs the same script automatically. It appends one row per session to the current project's `.claude/session-costs.tsv`, which is gitignored — a convenience, not the record, since transcripts are durable and a session that ends without the hook firing is recovered by running the script again.

That second hook exists because measurement found session cost is roughly **quadratic in turn count** — per-call context grows with conversation length, and you pay it again every turn. Context compaction keeps a long `/next` run going; the warning is there so the cost stays visible. These are global Claude settings managed by setup.ts, not target-repository settings.

## When to skip most of this

The design phase has real overhead. That is right for something you will maintain for a year. For a 500-line tool, building it badly and rewriting it once is faster, and the failed version teaches you more about the actual problem than the design doc would have. The `Lifespan` line in the brief exists to make you decide this before you start, not after.

Minimum viable version for short-lived work: `00-brief.md` with real non-goals, `/design`, `/plan`, `/next`. Or skip all of it and tell the agent what to build.

## On the brief

The brief is the one artifact a model should not author. Models elaborate well and originate badly — they converge on the median of the training distribution. Handing the concept to ChatGPT gets you something competent and unsurprising. Write it yourself and let `/brief` attack it; that inverts the weakest link in the chain.

**`/interview` is not a hole in that.** It asks; you answer. Five questions one at a time — what breaks today, what you do instead and what that costs, who exactly, the narrowest version worth having this week, whether it still matters in a year — each pushed until the answer is specific enough to write down, then a numbered premise list to agree or disagree with before anything is typed. It may not invent the problem, a non-goal, or a definition-of-done criterion, and a field nobody answered is written empty and reported as empty. Restricting a model from *authoring* the brief was always right; it was also, accidentally, stopping anyone from asking the questions, and those are the cheap half.

Write it by hand if you would rather. The stage is identical either way, and `/brief` attacks the result the same.

---

*Model IDs and Codex profile syntax in `codex/PROFILES.md` change often. Verify against current docs before relying on them.*
