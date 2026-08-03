# Decision log

Append-only. Newest at the top. The rejected alternatives are the point — without them, every future session relitigates the same choice.

## Open
<Things noticed mid-slice that were deliberately not acted on. Move them out or delete them; do not let this section rot.>

---

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
