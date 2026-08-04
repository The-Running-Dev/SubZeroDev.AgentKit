# Design pipeline — agent kit

Eight stages. Most end in a committed artifact; the two review gates deliberately write nothing. The artifact is the handoff, not the conversation.

## Layout

```
AGENTS.md                     binding contract, read by Codex
CLAUDE.md                     pointer to AGENTS.md, read by Claude Code
agent.md                      lessons learned the hard way
INSTALL.md                    how the kit installs into a repo
.claude/commands/*.md         slash commands
.github/ISSUE_TEMPLATE/*.md   bug and story templates, human-first shape
tools/Measure-Session.ps1     what a session actually cost, from the transcript
codex/PROFILES.md             Codex profile definitions
design/
  00-brief.md                 mine
  10-design.md                /design
  20-contract.md              /contract
  30-slices.md                /slices
  90-decisions.md             append-only
```

## Installing

Work in this repo and say **"run this against `<path>`"**, or `/install <path>`. It works from the target end too, pointed back at the kit. Either way the agent reads [`INSTALL.md`](INSTALL.md) and follows it.

Installing is a **reconciliation, not a copy**. A repository that already has agent instructions has them for a reason, usually a better-informed one than this kit's defaults. The installer classifies every artifact as absent, identical, divergent, or occupied; proposes a resolution for each; and stops for sign-off before writing. Re-running it upgrades, with the target winning wherever it has since been edited.

`/install-all` runs the same reconciliation unattended, across every `SubZeroDev.*` sibling repository in one pass. It applies only the resolutions `INSTALL.md` already states as deterministic; anything that would otherwise stop for sign-off is skipped per repository and reported as needing a decision, not guessed.

Design docs install at `design/` in the repository root, deliberately — `docs/` is usually occupied by a documentation site, and a design directory inside its build context gets baked into the published image. `INSTALL.md` still checks the path before creating anything.

To do it by hand instead: copy `AGENTS.md`, `CLAUDE.md`, `agent.md`, `.claude/`, and `design/` into the repo root. Profiles go in `~/.codex/`, not the repo.

## Three files, three jobs

`AGENTS.md`, `agent.md`, and `90-decisions.md` are easy to conflate and stop being useful the moment they overlap.

| File | Holds | Test |
|---|---|---|
| `AGENTS.md` | Standing instructions. What to do, always. | Would an agent behave wrongly without it? |
| `agent.md` | Lessons. What went wrong, and what it cost. | Would it have changed a decision? |
| `90-decisions.md` | Decisions. What was chosen over what, and why. | Would a future reader ask "why?" |

A rule with no cost attached is an instruction, not a lesson. A lesson that recurs becomes a rule. A choice between viable options is neither — it is a decision. `agent.md` is the one that rots: it loads into context every session, so a lesson kept past its usefulness is a cost you pay forever. `/reconcile` proposes additions; you approve them, and you delete them.

## Stage map

| Stage | Command | Writes |
|---|---|---|
| 0 Brief | — | `00-brief.md` |
| 1 Interrogate | `/brief-check` | nothing |
| 2 Design | `/design` | `10-design.md`, `90-decisions.md` |
| 3 Red team | `/redteam` | nothing |
| 4 Contract | `/contract` | `20-contract.md` |
| 5 Slices | `/slices` | `30-slices.md` |
| 6 Implement | `/slice [S<n>]` | code + tests |
| 7 Reconcile | `/reconcile` | design docs, `agent.md` |
| 8 Human docs | `/make-human-docs` | `docs/docs/guide.md` (generated) |

Outside the numbered stages: `/kit-help` says where the repository is and what to run next, `/verify` runs the repo's gates and reports what did *not* run, `/pr` opens a pull request following the repo's own merge convention, `/resolve` works a pull request's review threads, `/track` syncs `design/` to GitHub issues, `/install` puts the kit into a repo, and `/install-all` runs that same install unattended across every sibling repo.

`/refine` is the front door for asks that fall between the stages. Every other command assumes you are already inside the pipeline — `/slice` needs a slice, `/contract` needs a design. `/refine` takes a rough ask, routes it to the command that owns it where one does, and otherwise emits a prompt carrying the constraints that bind it. It emits rather than executes, because the tier it names is usually not the tier it is running at.

**Which model runs which command is in [`AGENTS.md`](AGENTS.md), *Command routing*** — it is binding policy, so it has one home and this is not it.

Effort tracks irreversibility, not stage prestige. Schemas and public interfaces are expensive to change; code is cheap to throw away. Stages 2 and 4 are where the money goes. Stage 6 is where it usually gets wasted.

## Start to finish

**Run [`/kit-help`](.claude/commands/kit-help.md).** It works out where the repository actually is — which design docs exist, which branch you are on, what the tracker says — and tells you the current step, the next one, and whether it needs a fresh session. `/kit-help all` shows the whole flow.

That command holds the walkthrough, rather than this file, because commands install into target repositories and this README does not. The shape it walks:

- **Stages 0 to 5, once per project.** One session each, ending in a committed file that is the next stage's only input. Three of them stop rather than proceed — `/design` on a thin brief, `/contract` on a signature the design does not determine, `/redteam` at findings. Sending work back a stage costs a few thousand tokens; finding it in stage 6 costs a re-implementation.
- **Stage 6, once per slice.** `/slice` (branches, implements, commits, pushes, opens the PR as a draft, ticks the boxes it confirms) → `/verify` → `/pr` (writes the real description, asks before marking ready) → `/resolve` → merge → `/track` in a new session. One slice, one branch, one session.
- **`/reconcile` and `/make-human-docs`** when the slices run out.

**Which model runs each command is in [`AGENTS.md`](AGENTS.md), *Command routing*. Where a session must end is in [`AGENTS.md`](AGENTS.md), *Session boundaries*.** Both are binding policy, so each has one home and this is not it.

## Invocation

**Claude Code** — the commands are native. `/brief-check`, `/design`, `/redteam`, `/contract`, `/slices`, `/slice S3`, `/reconcile`. Set the model per session with `/model`.

`/slice` takes the slice id, or no argument at all — bare, it takes the lowest-numbered slice whose issue is neither closed nor fully ticked and whose dependencies are done, says which it picked, and proceeds. It asks rather than guessing when the tracker cannot be read, since doneness is not observable from the working tree.

**Codex CLI** — no slash-command equivalent, so pipe the command body in:

```powershell
# stage 2
codex --profile architect exec (Get-Content .claude/commands/design.md -Raw)

# stage 3, adversarial, sandboxed read-only
codex --profile architect exec (Get-Content .claude/commands/redteam.md -Raw)

# stage 6, one slice
codex --profile builder exec ((Get-Content .claude/commands/slice.md -Raw) -replace '\$1','S3')

# stage 6, whichever slice is next
codex --profile builder exec ((Get-Content .claude/commands/slice.md -Raw) -replace '\$1','')

# stage 6, mechanical edits only
codex --profile quick exec ((Get-Content .claude/commands/slice.md -Raw) -replace '\$1','S7')
```

Wrap it:

```powershell
# Invoke-Stage.ps1
param(
  [Parameter(Mandatory)][string]$Stage,
  [string]$Slice,
  [ValidateSet('architect','builder','quick')][string]$Profile = 'builder'
)
$body = Get-Content ".claude/commands/$Stage.md" -Raw
if ($Slice) { $body = $body -replace '\$1', $Slice }
codex --profile $Profile exec $body
```

```powershell
.\Invoke-Stage.ps1 -Stage design -Profile architect
.\Invoke-Stage.ps1 -Stage slice -Slice S3
```

The YAML frontmatter in each command file is inert to Codex — harmless, ignored.

## Cross-vendor rule for stage 3

Stage 3 only works if the reviewer did not write the design. Same model, fresh context, is weak — it recognises its own output distribution and defends it. Alternate:

- Design in Claude Code (Opus) → red team with `codex --profile architect`
- Design with `codex --profile architect` (Sol) → red team in Claude Code (Opus)

That the two never share a session is stated in [`AGENTS.md`](AGENTS.md), *Session boundaries*, with the rest of them.

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

It reports the four input classes separately because they are priced differently and behave differently. On the first sessions measured here, cache reads ran roughly fifty times cache creation — a single "tokens in" figure would have hidden the only term that was growing. Which work should stop being model work altogether is in [`AGENTS.md`](AGENTS.md), *What should stop being model work*.

A `SessionEnd` hook in `.claude/settings.json` runs the same script automatically and appends one row per session to `.claude/session-costs.tsv`, which is gitignored. That file is a convenience, not the record — transcripts are durable, so a session that ends without the hook firing is recovered by running the script again. The hook is the one thing an install may write into a target's `settings.json`, under the conditions in [`INSTALL.md`](INSTALL.md).

## When to skip most of this

The pipeline has real overhead — four authored artifacts, a generated guide, three vendor handoffs. That is right for something you will maintain for a year. For a 500-line tool, building it badly and rewriting it once is faster, and the failed version teaches you more about the actual problem than the design doc would have. The `Lifespan` line in the brief exists to make you decide this before you start, not after.

Minimum viable version for short-lived work: `00-brief.md` with real non-goals, `20-contract.md`, and `/slice`. Skip 1, 2, 3, 7, 8.

## On stage 0

The brief is the one artifact a model should not author. Models elaborate well and originate badly — they converge on the median of the training distribution. Handing the concept to ChatGPT gets you something competent and unsurprising. Write it yourself and let `/brief-check` attack it; that inverts the weakest link in the chain.

---

*Model IDs and Codex profile syntax in `codex/PROFILES.md` change often. Verify against current docs before relying on them.*
