# Slices — the defect-to-merge path

> Scoped to the defect-to-merge path, whose design body is retired to
> `git show dfd1cab:design/10-design.md` and whose contract stands in `design/20-contract.md`.
> Every slice cut for it has landed. The explicit design-state mechanism in the current
> `design/10-design.md` has no slices yet.

Three slices were cut for this path. The riskiest assumption in the design was that a check
result can be tied to a named head SHA reliably enough to gate an irreversible action on it
— S1 did nothing else, so that was proven before any policy changed.

`/track` should be run after this document is reviewed. **Do not open issues from here.**

## How this document is kept

**A slice's full body lives here only until it lands.** Once its issue is closed the body is
retired to the index below, which keeps the name, the issue number, and the commit the body
was last complete at. Nothing is lost — `git show <sha>:design/30-slices.md` returns it, and
the issue's agent block still pins `§ S<n> @ <sha>` for its own criteria.

The reason is the churn loop in `AGENTS.md`, *The design freeze*: a landed slice's criteria
have no reader left except a drift check, and every pass over them is a pass that can
rewrite the slice after it. Retiring them shrinks what any later pass can touch. `/reconcile`
is barred from this document outright (`.claude/commands/reconcile.md`), so the two rules are
the same rule from either end.

**`/slices` appends new slices under `## Outstanding`.** Never renumber, and never reuse a
retired id — criterion ids are cited by closed issues and are expensive to withdraw
(`design/90-decisions.md`, 2026-08-03).

## Contract questions

**None outstanding.** `design/20-contract.md` § Unresolved is empty: zero checks configured
yields `NotEvaluated` (I8, exercised by S1.10), the batch is unavailable in a repository the
user does not own (I9, stated by S2.9), and `/fix` files a bug issue after reproducing and
implements against its agent block (I10 and I11, exercised by S3.11–S3.14).

A slice that discovers something undetermined stops and adds it to § Unresolved. It does not
resolve it in the implementing session.

## Outstanding

**None.** Every slice cut for this path has landed. Further work on it starts at `/slices`,
which appends here; a defect in what already landed starts at `/fix`, which needs no slice.

## Landed

| Slice | Name | Issue | Criteria | Body complete at |
|---|---|---|---|---|
| **S1** | Wait for a pull request's checks against a named commit | [#9](../../issues/9), closed | S1.1–S1.10 | `af610a6` |
| **S2** | One approval covers push, pull request, and the threads it names | [#10](../../issues/10), closed | S2.1–S2.9 | `af610a6` |
| **S3** | A defect that is not a slice gets a front door | [#11](../../issues/11), closed | S3.1–S3.14 | `af610a6` |

What each delivered, in one line, because the index is the only place a reader now meets
them:

- **S1** — `tools/Wait-PullRequestCheck.ps1`, which watches a pull request's checks against a
  named head SHA and refuses to answer at all if someone pushed while it was watching.
- **S2** — one approval covering push, pull-request update, and the exact review threads it
  names, in `AGENTS.md` and `.claude/commands/resolve.md`.
- **S3** — `/fix`, the entry point for a defect that has no slice: reproduce, get to a bug
  issue, branch, fix, hand off to the same single approval.
