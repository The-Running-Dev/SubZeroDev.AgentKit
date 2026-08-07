---
description: Switch back to the default branch, delete local branches already merged into it, and prune stale remote-tracking refs
---

Housekeeping for the end of a piece of work: get back to the default branch, remove the local branches that are done, and drop remote-tracking refs for branches deleted on the remote.

**Deleting a branch is not carved out of the authorization rule** (`AGENTS.md`, *Git and delivery* — "Do not delete files, branches, or history without explicit authorization"). This command lists every candidate before deleting any of it and asks once, over the whole list — it does not delete branch-by-branch.

## Before doing anything

```powershell
git status --short
git branch --show-current
```

**If the working tree is dirty, stop and say so.** Uncommitted work is not this command's to stash or discard — that decision belongs to whoever is mid-change, not to a cleanup command.

## Switch back

Find the actual default branch rather than assuming `main`:

```powershell
git remote show origin | Select-String "HEAD branch"
```

```powershell
git checkout <default branch>
git pull
```

**If the current branch has commits not on the default branch and no merged PR accounts for them, stop before switching** — that is unmerged work, not a done branch, and this command does not decide whether to abandon it.

## Prune the remote-tracking refs

```powershell
git fetch --prune origin
```

This only removes local *references* to branches already deleted on the remote (e.g. after a squash-merge on GitHub). It deletes nothing that still exists anywhere.

## Find local branches that are done

```powershell
git branch --merged <default branch>
```

Exclude the default branch itself from that list. **`--merged` is a genuine merge check** — a branch only appears here if its commits are actually reachable from the default branch's tip, so this will not catch a branch that was squash-merged (GitHub's squash produces a new commit that `--merged` cannot see as "the same"). For each remaining candidate, cross-check with `gh pr list --state merged --head <branch>` before treating a branch git itself doesn't recognize as merged as safe to delete.

## Ask, once

Present the full candidate list — branch name and, where known, the PR it merged through — and ask once whether to delete all of them. Do not ask per-branch.

## Delete

On yes:

```powershell
git branch -d <branch>
```

**Always the safe form, never `-D`.** `-d` refuses to delete a branch with commits git cannot prove are merged; if it refuses one that `gh pr list` showed as merged (the squash-merge case above), report it and ask separately before using `-D` on that specific branch — do not silently escalate to a force delete.

## Report

- Default branch confirmed and checked out
- Remote-tracking refs pruned, and how many
- Branches deleted, and the PR each merged through where known
- Any branch left alone, and why — dirty tree, unmerged work, or a `-d` refusal not separately authorized

## Never

- Delete a branch `--merged` does not confirm without a separate ask, even if `gh pr list` shows it merged.
- Touch a remote branch. This command prunes local refs to already-deleted remotes; it does not delete anything on `origin` itself.
- Discard uncommitted changes to force the branch switch.
