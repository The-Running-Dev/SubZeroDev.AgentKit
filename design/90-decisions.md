# Decision log

Append-only. Newest at the top. The rejected alternatives are the point — without them, every future session relitigates the same choice.

## Open
<A staging area, not a home. Things noticed mid-slice that were deliberately not acted on. `/track` turns each into a GitHub issue and removes it from here. An item that is a *decision* rather than a *todo* belongs below as an entry, not in an issue.>

---

### 2026-08-03 — Issues read human-first, with agent detail in a collapsed block
Context: `/track` wrote one undifferentiated body — slice fields dumped in — which served neither audience. A human scanning the tracker met implementation vocabulary; an agent got no stated authority and no stop conditions. The workflow also had no path for a bug or a story at all, since `/track` only syncs from `design/`.
Chosen: Three parts in order — a narrative anyone can follow, `### Done when` checkboxes, then a collapsed `<details>` block. The agent block holds navigation and constraints only: where authority lives, what is out of scope, when to halt. **Anything that could drift from `design/` is a pointer, not a copy.** Bugs and stories are filed by hand from `.github/ISSUE_TEMPLATE/`, which pre-fills the same shape and whose agent blocks encode lessons already earned — the regression test is the spec, verify by reverting the fix, a fix that only changed the odds is not a fix.
Rejected: **A visible `## For the agent` heading** — nothing hidden and it renders everywhere including notification email, but it doubles the length of every issue in list view, which is the noise the change exists to remove. **An HTML comment** — cleanest human view, but the instructions become unauditable: a wrong instruction would be invisible rather than merely ugly. **A slice template alongside bug and story** — consistent, but a slice filed by hand bypasses `/slices` and `design/30-slices.md`, and the template would advertise the wrong workflow.
Reversibility: cheap

### 2026-08-03 — Acceptance criteria are copied into the issue, and drift is reported not fixed
Context: `design/30-slices.md` is authoritative for what a slice is, so single ownership argues the issue should point at it rather than restate it. But a pointer cannot be ticked off, and without checkboxes the tracker shows no progress inside an issue.
Chosen: Copy the criteria as `Done when` checkboxes — a deliberate second copy, accepted because the tracking surface has value a pointer cannot provide. `/track` compares them on every run and **reports a difference without editing either side**. A ticked checkbox is progress someone recorded; regenerating the block would destroy it, so the block is never rewritten.
Rejected: **Point at the doc only** — strictly consistent with single ownership, but leaves no progress surface and shows a triager on a phone nothing concrete. **Make the issue authoritative** — self-contained, no sync, no drift check; rejected because it flips the rule that `30-slices.md` defines a slice, which would leave `/redteam` attacking a document that no longer governs.
Reversibility: cheap — the copy can become a pointer without data loss; the reverse cannot.

### 2026-08-03 — Work defers to GitHub issues, and `/track` owns every GitHub write
Context: Findings, follow-ups and defects noticed in passing were accumulating in conversation and in `## Open` sections — prose, which is where work goes to be forgotten. GitHub issues are the obvious home, but opening one is an external write, which the contract requires authorization for, and a round trip per finding is exactly the friction that causes items to be dropped inline instead. Survey of the four repositories: issues and projects enabled everywhere, zero milestones, six issues total.
Chosen: A narrow carve-out — opening and labelling issues in a repository the user owns needs no prompt, because issues are cheap and reversible. Closing, editing others' issues, and writing to repositories the user does not own stay authorized. Milestones and projects stay authorized, being structural and few. `/track` is the single command that touches GitHub, and is idempotent so it can be run often rather than batched. `design/30-slices.md` stays authoritative for what a slice *is*; the issue tracks whether it is *done*. `## Open` becomes a staging area that `/track` drains.
Rejected: **Propose-then-create on approval** — preserves the gate with no exception to reason about, but the round trip is the friction the change exists to remove. **Carve out milestones and projects too** — fewest interruptions, but a wrong milestone is structural, visible on a public repository, and awkward to unpick. **Move slices into issues wholesale** — one home, no sync; rejected because `/redteam` and `/slices` operate on the slice list *as a set*, and a tracker is a poor place to review coherence. **Let `/slices` open its own issues** — the option as originally framed; rejected on implementation because two commands writing to GitHub is the two-homes problem the ownership split exists to prevent.
Reversibility: cheap

### 2026-08-03 — `/track` adds issues to an existing project, and never creates one
Context: The `project` scope was granted, unblocking Projects v2. `/track` had only a guard for the blocked case and no behaviour for the working one. The account already carries three projects — `Docusaurus-Template`, `Docker-BuildAgent`, `Docker-Watchdog` — one per repository, named after it; none exists for any repository this kit has been installed into.
Chosen: Match a project by repository name; add every issue opened to it; report and continue when none exists. Adding is the only project write — never remove an issue, change a status field, or reorder a board. A missing board no longer aborts the sync, only the project step.
Rejected: **Create the project on approval when missing** — fewer manual steps starting a repository, but board structure is columns, fields and views, and a command gets that generically wrong; a bare auto-created project is worth less than the time it saves. **Leave projects out entirely** — GitHub's built-in auto-add workflow does this natively and arguably better, but then the granted scope goes unused and issues land nowhere visible.
Reversibility: cheap

### 2026-08-03 — Install decisions get a home even when `design/` is skipped
Context: Installing into `SubZeroDev.GameEngine` skipped `design/` — that repository already runs the whole chain under other names (`01-vision`, `02-architecture`, `04-core`, `TODO`, `OPEN-QUESTIONS` §1) across sixteen documents, plus 42 files in `plans/`. Phase 4 then instructed appending a decision-log entry to `90-decisions.md`, a file the install had just decided not to create. The decisions were recorded in `CLAUDE.md` instead, but their **rejected alternatives were lost** — the one thing the log format exists to preserve.
Chosen: A resolution order — `design/90-decisions.md` when it exists, else the target's own slice-local log, else a `Why it is installed this way` subsection in whichever instruction file holds content, with rejected alternatives compressed to a clause each. Architecture ADR sets are excluded outright: different audience, different lifetime, and ADR numbers are cited across repositories. Stated explicitly that skipping `design/` does not skip the record — that is precisely the case where the reasoning is least recoverable later, because the mapping is invisible from the file tree.
Rejected: **Install `design/90-decisions.md` alone even when the rest is skipped** — the log is working-arrangements, not design, so it would not really compete; but creating a `design/` directory immediately after telling the repository not to create one is a contradiction a reader cannot resolve. **Use the target's existing ADR set** — a real home with real durability, but it puts tooling setup among numbered architecture decisions other repositories cite. **Accept the loss and record only what was chosen** — cheapest, and it is exactly how the next install ends up re-arguing a settled question.
Reversibility: cheap
Found by: the third structurally different install. Two prior installs never hit it because both created `design/`.

### 2026-08-03 — `/make-human-docs` produces a generated guide, drift-checked by `/reconcile`
Context: The design docs are organised so they can be checked for correctness, which makes them a poor first read for someone who has to *use* the system. A human-facing guide fixes that, but its whole job is to restate the design — directly against the kit's *Reference, never restate* rule, and a second description of a system with no gate is the drift the kit exists to prevent.
Chosen: The guide is **generated**, carries a do-not-edit header naming `design/` as its source, and `/reconcile` gains a *Generated-guide drift* section that reports **semantic** divergence only — a regenerated file is never byte-identical, so a diff is the wrong instrument. Exact signatures, schemas and error tables are linked to `20-contract.md`, never copied. Output is `docs/docs/guide.md`; where a repository has no documentation project it falls back to `guide.md` at the root rather than creating a `docs/docs/` tree nothing serves. Tier is `sonnet`/`medium`; ambiguity in the design is a stop condition, not something to resolve in prose.
Rejected: **Authored once, then hand-maintained** — best prose, but sanctions a second ungated description of the system. **Generated skeleton with hand-written prose and per-section drift flags** — most honest about how documentation is actually written, but the ownership line between generated and authored sections is fuzzy and the machinery is disproportionate. **Repo-root `GUIDE.md` as the default** — works in every repository including the two with no documentation site, but eight of ten targets publish from `docs/`, and the guide is the one artifact here that is meant to be read by people who will not clone the repository.
Reversibility: cheap

### 2026-08-03 — Model routing names families and lives in `AGENTS.md`
Context: The tier table named tiers only, on the reasoning that model identifiers churn (entry of 2026-08-02, *Import only project-independent conventions*). That reasoning conflated two things: pinned *versions* churn, model *families* do not. In practice a tier table with no names left every session guessing which model a tier meant, and per-command routing had drifted into the README's stage map, where it was documentation rather than binding policy — and where it disagreed with itself once the routing was revised.
Chosen: One table in `AGENTS.md` keyed on tier, with Claude family aliases and Codex profiles as columns. A `Command routing` subsection under it owns per-command model and effort; the README's stage map drops its Tier and Effort columns and points at the contract. Routing revised in the same pass: `/brief-check` and `/slices` up to `opus`/`high` — interrogation and slicing are judgement work — and `/design` down from `xhigh` to `high`, with `xhigh` reserved for a single unresolved question.
Rejected: **Claude aliases only** — the kit ships `codex/PROFILES.md` and a cross-vendor red-team rule; naming one vendor in a file that opens "regardless of tool or model" makes the other second-class. **A separate `MODELS.md`** — strictest neutrality, but a fourth instruction file and a lookup hop for something read every session. **Leave routing in the README** — puts binding policy in documentation, which is how the two copies disagreed in the first place.
Reversibility: cheap
Amends: the 2026-08-02 entry's clause "the tier table names tiers, not model IDs, because those churn" — families, not versions, is the distinction that entry missed.

### 2026-08-03 — A red-team pass is a phase gate, with its stopping rule in the command
Context: Nothing bounded `/redteam`. An adversarial reviewer with no stopping rule re-attacks the same design every time it is invoked, re-raises decisions already accepted as known-and-retained, and treats a wording change as grounds for a full re-read — spending the most expensive tier on re-litigation.
Chosen: A `## Stopping rule` section in `.claude/commands/redteam.md`: one invocation is one pass, at most one pass per materially changed revision, never self-recommend another, findings adjudicated one at a time and classified as defect / accepted risk / brief conflict / not sustained. A known-and-retained decision is a new defect only against named new evidence. `AGENTS.md` carries one cross-cutting line — never recommend re-running a phase gate — because that fires when `redteam.md` is not loaded.
Rejected: **All of it in `AGENTS.md`** — bloats the contract with one command's mechanics and duplicates that command's existing Rules section. **All of it in `redteam.md`** — cleanest ownership, but the no-self-recommend rule applies precisely when that file is not in context.
Reversibility: cheap

### 2026-08-02 — The target's lessons file is never merged into, and provenance is checked
Context: A read-only dry run against `SubZeroDev.GameEngine` — which has `AGENTS.md`, `CLAUDE.md` and `agent.md` all populated — exposed that several lessons in the kit's seed were **harvested from that repository**. Installing would have re-imported its own lessons in generalised, evidence-stripped form, reading as new because the wording had changed, and diluting a maintained file with weaker copies of its own content.
Chosen: Where the target already has a lessons file with content, it wins wholesale and the seed is not merged. Individual kit lessons are offered only where absent *and* applicable, one at a time. A kit lesson that already appears in the target's file with more detail is treated as having originated there and dropped silently.
Rejected: **Merge the seed and let the reader deduplicate** — the seed's generalised wording will not match the target's specific wording, so the duplicates survive review. **Skip `agent.md` entirely when present** — loses the genuinely portable lessons the target has not hit yet.
Reversibility: cheap

### 2026-08-02 — Design docs default to `design/`, not `docs/design/`
Context: The first real install (`SubZeroDev.Platform`) hit a collision the kit had not anticipated: `docs/` was the Docker build context for a documentation site, so `docs/design/` would have shipped internal design documents inside a published image. Checking the rest of the estate, **8 of 10 projects have a `docs/` directory with a `docs/Dockerfile`** — the kit's default was wrong for 80% of the repositories it exists to serve, and every install would have repeated the same relocation decision, each individually expensive to reverse afterwards.
Chosen: Move the kit's own directory to `design/` and rewrite the path across the commands, `AGENTS.md`, `agent.md`, `README.md` and `INSTALL.md`. `INSTALL.md` now explains *why* root is the default and checks only whether `design/` is already occupied.
Rejected: **Keep `docs/design/` and decide per install** — `INSTALL.md` handled it correctly, so nothing was broken, but it charges a decision to each of the seven remaining Docusaurus repositories to reach the same answer. **Flip and remove the choice entirely** — a repository with no documentation site loses the tidier nested option for no gain, and removing an option to save one paragraph is not a trade worth making.
Reversibility: cheap in the kit; expensive in any repository already installed — `SubZeroDev.Platform` chose `design/` before this flip and needs no change.

### 2026-08-02 — Installing is an agent-executed reconciliation, not a script
Context: The kit needs to land in repositories that already have agent instructions. `SubZeroDev.Platform` — the first target — has a `CLAUDE.md` with real standing instructions, no `AGENTS.md`, a dirty worktree on a feature branch, and a Docusaurus build context rooted at `docs/` that a copied `design/` would land inside. None of that is resolvable by copying files.
Chosen: `INSTALL.md` at the kit root, written as a procedure for an agent: classify every artifact as absent / identical / divergent / occupied, propose a resolution per divergence, stop for sign-off, then apply and log. `.claude/commands/install.md` is a thin locator that reads it, so `/install` works from either end and ships into the target for later upgrades.
Rejected: **A PowerShell installer** — a copy cannot merge two `AGENTS.md` files, cannot tell an already-satisfied rule from a missing one, and would either clobber the target's instructions or refuse to run. **A `git subtree`/submodule vendor of the kit** — makes the kit's files read-only in the target, which is backwards: the target's edits are the accumulated knowledge and must win. **Documentation only, no command** — leaves the upgrade path undefined, and the reconciliation is exactly the part nobody redoes carefully by hand the third time.
Reversibility: cheap
Open: `INSTALL.md` has not yet been run against a real target.

### 2026-08-02 — The target wins every divergence; installing never resets
Context: An installer that treats its own copy as canonical will overwrite rules the target learned the expensive way. The surveyed projects are full of instructions whose reason is a specific past failure and is not visible in the text.
Chosen: On divergence the target's rule wins and the difference is reported rather than resolved. A re-install upgrades under the same rule. Rules the target already states are reported as already-satisfied and never added a second time.
Rejected: **Kit wins** — turns every upgrade into a silent regression of local knowledge. **Prompt on every difference with no default** — the common case is a target rule that is simply more specific, and asking about each one buries the two or three that actually matter.
Reversibility: cheap

### 2026-08-02 — `design/` is relocatable at install time
Context: The kit hardcodes `design/` in all seven command files. Where a target serves a documentation site from `docs/`, that path falls inside the site's Docker build context — `SubZeroDev.Platform`'s `docs/Dockerfile` does `COPY . .`, which would bake the design docs into the published image.
Chosen: `INSTALL.md` checks the path first and offers three resolutions, preferring a repository-root `design/` with the path rewritten consistently across the commands and `AGENTS.md`. The decision is logged in the target because moving the directory later breaks every cross-reference.
Rejected: **Fix the kit's path to `design/` for everyone** — `design/` is right for the majority of repositories that have no documentation site, and churns the existing commands for a minority case. **Always exclude via `.dockerignore`** — works, but the exclusion is invisible and gets lost in a template upgrade. **Ignore it** — publishing a project's internal design docs is not a default anyone would choose deliberately.
Reversibility: expensive once installed

### 2026-08-02 — Lessons live in `agent.md`, separate from `AGENTS.md` and the decision log
Context: Ten existing projects were surveyed for reusable agent guidance. Three of them (GameEngine, GameOfLife, SunTrap) had independently converged on a lowercase `agent.md` holding retrospective lessons, distinct from their standing instructions — the kit had no equivalent, so hard-won failures had nowhere to go except into the instruction file, where they dilute rules that must be obeyed.
Chosen: A third file, `agent.md`, with an explicit admission bar — a lesson is admitted only if it would have changed a decision, and only if it names what it cost. `AGENTS.md` holds rules, `agent.md` holds costs, `90-decisions.md` holds choices.
Rejected: **Fold lessons into `AGENTS.md`** — mixes "always do this" with "this once went wrong", and the instruction file is the one an agent must be able to obey literally. **Fold lessons into `90-decisions.md`** — a lesson is not a decision; it has no rejected alternatives, so it corrupts the format that makes the log worth keeping. **No lessons file** — status quo, which loses the retrospective entirely; the surveyed projects show it is the highest-signal artifact of the three.
Reversibility: cheap

### 2026-08-02 — Lesson capture is a `/reconcile` output, not a new stage
Context: A lessons file with no maintenance ritual rots, and `agent.md` costs context on every session, so rot is expensive. Something had to own writing to it.
Chosen: Extend `/reconcile` with a `## Lessons` section, proposed for approval rather than appended directly — consistent with the rest of that command, which reports drift and waits.
Rejected: **A new `/lessons` command** — an eighth stage for an artifact that is a byproduct of reconciliation, and a command that would rarely be invoked deliberately. **Let any stage append to `agent.md`** — the file's value depends entirely on its admission bar, and an unreviewed append is how the bar erodes.
Reversibility: cheap

### 2026-08-02 — Import only project-independent conventions from the surveyed projects
Context: The ten surveyed projects carry a lot of well-earned guidance, but most of it is bound to their stack — Docusaurus route contracts, pinned GHCR digests, an engine state envelope, blog MCP tooling, specific model IDs. One of them (PSGenerator) records the relevant lesson directly: do not import another project's architecture or tooling merely because it appears in a neighbouring instruction file.
Chosen: Import only what holds regardless of stack — safe start, effort and model tiers, single ownership, verification honesty, git and delivery discipline, one-at-a-time sign-off. Stack-specific material was left where it is. The tier table names tiers, not model IDs, because those churn.
Rejected: **Import wholesale and let each project delete what does not apply** — deletion never happens, and the kit would ship a Docusaurus opinion to projects that have no site. **Import nothing and keep the kit minimal** — the surveyed conventions are consistent across ten projects and several are load-bearing (the `git add -A` and deploy-URL rules each have a recorded near-miss behind them).
Reversibility: cheap

### 2026-08-02 — House convention path corrected to `D:\Dropbox\Projects\`
Context: `AGENTS.md` stated projects live under `D:\Projects\`. The survey showed all ten live under `D:\Dropbox\Projects\`.
Chosen: Correct the path.
Rejected: **Leave it** — a house convention that is false about every project teaches an agent to distrust the rest of the section.
Reversibility: cheap
