# Design — the agent kit

> Rewritten 2026-10-04 (#436). The earlier design of the design-state mechanism is
> `git show c3a9577:design/10-design.md`.

## Shape

The kit is a set of command files (`skills/<name>/SKILL.md`) plus a shared rule file
(`AGENTS.shared.md`) and a few Node/TypeScript scripts that do the mechanical parts. A command file
is Markdown loaded into the agent; every gate in it is prose the agent follows, except where a
script enforces it. There is no runtime.

```
design phase (user-driven)         build phase (autonomous)            outside the plan
/interview -> 00-brief.md          /next -> slice -> branch -> tests   /fix   a bug
/design    -> 10-design.md                  -> PR -> CI -> review      /align on request only
             20-contract.md                 -> merge -> cleanup -> Status: done
/plan      -> 30-slices.md                  -> next slice (same session)
/redteam   optional, never a gate
```

## Tracking

A slice's state is its `Status: todo|done` line in `design/30-slices.md`, set to `done` in that
slice's own pull request. A slice is a `## S<n> — <name>` heading and the lines under it.
Anything else in the file — prose, the `## Landed` index of slices retired by earlier versions
of the kit — is history and counts as done. Bugs and follow-ups are GitHub issues.

## The design is the spec

`design/` is written once and not kept in sync with the code. When code and design disagree the
agent does what works and records the mismatch in the pull request's *Differs from design*
section. `/align` brings the documents back into agreement when the user asks; it is the
on-demand audit.

## Delivery

- **`tools/wait-pull-request-check.ts`** waits for checks against a named head SHA and refuses
  to report if the head moved.
- **`tools/merge-pull-request.ts`** is the only merge path: every check on the exact head SHA
  green, no open review thread, otherwise it refuses and the refusal stands.
- **`tools/invoke-housekeeping.ts`** (over `invoke-done-housekeeping.ts`) runs after a merge:
  switch to the default branch, pull, delete branches git confirms merged. It never stashes;
  uncommitted work is carried across the switch untouched. Anything needing judgement is
  escalated and named, not decided.
- **`tools/test-gates-cache.ts`, `test-verify-report.ts`, `test-no-attribution.ts`** discover
  and record the verification gates and enforce the no-attribution rule in commits.

## Install

`setup.ts` / `tools/install-agentkit.ts` keep one checkout at `$HOME/.agent-kit` and register
the commands with Claude Code (a skills-directory plugin, `/agentkit:<name>`), Codex and
Copilot. `/install` seeds a repository (`new-design-docs.ts`, `AGENTS.md`, pointer blocks);
`/sync` updates the checkout; `/install-all` migrates repositories off pre-home-install copies.
The only `settings.json` entry the kit writes is the `SessionEnd` cost-log hook.

## Models

Guidance, never a gate. Deep reasoning (`opus`, `architect`) for the design commands and
`/redteam`/`/align`; implementation tier (`sonnet`, `builder`) for `/next`, `/fix` and the
install commands. The table in `AGENTS.shared.md` § *Models* is read by
`tools/invoke-codex-command.ts` to route Codex profiles.

## Alternatives rejected

- **Keep fresh-session hand-offs as a safety net.** They cost the user a manual hand-off per slice
  and protected nothing the merge script does not already protect.
- **Per-slice GitHub issues as the tracker.** A second copy of state that had to be synchronised
  by a dedicated command; the `Status:` line is the state.
- **A drift checker as a CI gate.** It turned every design edit into a repair task and was the
  largest source of the friction this redesign removes. Reconciliation is `/align`, on request.
