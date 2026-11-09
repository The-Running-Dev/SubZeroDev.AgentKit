import { compareMergedPr, mergedPrEvidence } from './lib/merged-pr-evidence.ts';
import type { PrEvidence } from './lib/merged-pr-evidence.ts';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  'repo-root': { type: 'string' }, 'default-branch': { type: 'string' }, 'skip-pull': { type: 'boolean' },
  'delete-branches': { type: 'string', multiple: true }, 'force-delete-branches': { type: 'string', multiple: true },
  'auto-stash': { type: 'boolean' }, 'keep-dirty': { type: 'boolean' },
} as const;
export interface HousekeepingInput {
  repoRoot?: string; defaultBranch?: string; skipPull?: boolean; deleteBranches?: string[];
  forceDeleteBranches?: string[]; autoStash?: boolean; keepDirty?: boolean;
}
export function doneHousekeeping(input: HousekeepingInput = {}, runner: Runner = run) {
  const root = realpathSync(input.repoRoot ?? process.cwd());
  const git = (...args: string[]) => {
    const r = runner('git', ['-C', root, ...args]);
    return { ...r, output: [r.stdout.trimEnd(), r.stderr.trimEnd()].filter(Boolean).join('\n') };
  };
  const result = {
    Stopped: false, Reason: null as string | null, Detail: null as string | null,
    DefaultBranch: input.defaultBranch ?? null, Pulled: false, PrunedCount: 0,
    Candidates: [] as { Branch: string; MergedPr: string | null }[],
    SquashMergeCandidates: [] as { Branch: string; MergedPr: string; MergedHead: string }[],
    TipAheadOfMergedPr: [] as { Branch: string; MergedPr: string; LocalTip: string | null; MergedHead: string | null; Reason: string }[],
    UnknownMergedPrEvidence: [] as { Branch: string; Reason: string }[],
    Deleted: [] as string[], Refused: [] as { Branch: string; Reason: string }[], Stashed: false, StashRef: null as string | null,
  };
  const stop = (reason: string, detail: string) => ({ ...result, Stopped: true, Reason: reason, Detail: detail });
  const url = git('remote', 'get-url', 'origin');
  const repo = url.code === 0 ? url.output.trim().match(/[:/]([^/:]+\/[^/]+?)(\.git)?$/)?.[1] : undefined;
  const ghArgs = repo ? ['-R', repo] : [];
  const evidence = new Map<string, PrEvidence>();
  const prs = (branch: string) => {
    if (!evidence.has(branch)) evidence.set(branch, mergedPrEvidence(root, branch, ghArgs, runner));
    return evidence.get(branch)!;
  };
  const status = git('status', '--short');
  if (status.output.trim() && !input.keepDirty) {
    if (!input.autoStash) return { ...stop('DirtyTree', status.output), DefaultBranch: null };
    // The stash stack is shared by every worktree, so neither 'stash@{0}' nor a fixed message keeps naming this entry.
    // Push under a unique tag, then record the entry's commit SHA, which no later stash can move.
    const tag = `Invoke-DoneHousekeeping auto-stash ${randomUUID()}`;
    const stash = git('stash', 'push', '-u', '-m', tag);
    if (stash.code) throw new Error(`AutoStash was requested but 'git stash push -u' failed: ${stash.output}`);
    const sha = git('stash', 'list', '--format=%H %gs').output.split('\n').map(l => l.trim()).find(l => l.endsWith(` ${tag}`))?.split(' ')[0];
    if (!sha) throw new Error(`AutoStash pushed a stash tagged '${tag}' but could not find it in 'git stash list' to record its SHA. Find it by that tag and restore with 'git stash apply <sha>'.`);
    result.Stashed = true; result.StashRef = sha;
  }
  try {
    let branch = input.defaultBranch;
    if (!branch) {
      branch = git('remote', 'show', 'origin').output.match(/HEAD branch:\s*(\S+)/)?.[1];
      if (!branch || branch === '(unknown)') throw new Error("Could not resolve the default branch from 'git remote show origin' (reported '(unknown)' or no HEAD branch line). Pass --default-branch explicitly.");
    }
    result.DefaultBranch = branch;
    const current = git('branch', '--show-current').output.trim();
    if (current && current !== branch && git('log', `${branch}..HEAD`, '--oneline').output.trim() && !prs(current).prs.length) {
      return stop('UnmergedCurrentBranch', `Branch '${current}' has commits not on '${branch}' and no merged PR was found for it via gh.`);
    }
    const checkout = git('checkout', branch);
    if (checkout.code) return stop('CheckoutFailed', checkout.output);
    if (!input.skipPull) result.Pulled = git('pull').code === 0;
    result.PrunedCount = git('fetch', '--prune', 'origin').output.split('\n').filter(l => /\[deleted\]/.test(l)).length;
    const merged = git('for-each-ref', '--format=%(refname:short)', `--merged=${branch}`, 'refs/heads').output.split('\n').map(l => l.trim()).filter(l => l && l !== branch);
    for (const b of merged) result.Candidates.push({ Branch: b, MergedPr: prs(b).prs[0]?.url ?? null });
    const others = git('for-each-ref', '--format=%(refname:short)', 'refs/heads').output.split('\n').map(l => l.trim()).filter(l => l && l !== branch && !merged.includes(l));
    for (const b of others) {
      const all = prs(b);
      if (!all.complete) {
        result.UnknownMergedPrEvidence.push({ Branch: b, Reason: all.reason ?? 'Merged PR evidence is incomplete.' });
        continue;
      }
      if (!all.prs.length) continue;
      const tip = git('rev-parse', b); const local = tip.code === 0 ? tip.stdout.trim() : null;
      const comparisons = all.prs.map(p => ({ p, comparison: local ? compareMergedPr(root, local, p, runner, `refs/heads/${branch}`)
        : { kind: 'unknown' as const, reason: `Could not resolve the local tip of '${b}'.` } }));
      const contained = comparisons.find(c => c.comparison.kind === 'contained');
      if (contained) {
        result.SquashMergeCandidates.push({ Branch: b, MergedPr: contained.p.url, MergedHead: contained.p.headRefOid! });
        continue;
      }
      // Only a commit unaccounted for by EVERY matching PR establishes ahead work.
      const unmatched = comparisons.map(c => c.comparison.kind === 'unaccounted' ? c.comparison.commits : []);
      const common = unmatched[0]?.filter(c => unmatched.every(set => set.includes(c))) ?? [];
      if (all.complete && common.length) {
        const p = all.prs[0];
        result.TipAheadOfMergedPr.push({ Branch: b, MergedPr: p.url, LocalTip: local, MergedHead: p.headRefOid ?? null,
          Reason: `Local commit(s) ${common.join(', ')} have no ancestry or patch match in any of the ${all.prs.length} merged PR(s) for this branch; no merged PR accounts for this work.` });
      } else result.UnknownMergedPrEvidence.push({ Branch: b,
        Reason: all.reason ?? (comparisons.filter(c => c.comparison.kind === 'unknown').map(c =>
          `${c.p.url}: ${c.comparison.kind === 'unknown' ? c.comparison.reason : ''}`).join('; ') || 'No single merged PR accounts for the complete tip; evidence is insufficient.') });
    }
    for (const [branches, force] of [[input.deleteBranches ?? [], false], [input.forceDeleteBranches ?? [], true]] as const) {
      for (const b of branches) {
        if (force ? !result.SquashMergeCandidates.some(c => c.Branch === b) : !merged.includes(b)) {
          result.Refused.push({ Branch: b, Reason: force ? "Not in this run's SquashMergeCandidates - not force-deleted." : `Not in --merged '${branch}' - not deleted.` });
          continue;
        }
        if (force) {
          const currentTip = git('rev-parse', b);
          const recorded = result.SquashMergeCandidates.find(c => c.Branch === b)!;
          const checkedTip = git('rev-parse', `${recorded.MergedHead}^{commit}`);
          // Recheck against the recorded PR immediately before a destructive operation.
          const comparison = currentTip.code || checkedTip.code ? null : compareMergedPr(root, currentTip.stdout.trim(),
            prs(b).prs.find(p => p.url === recorded.MergedPr)!, runner, `refs/heads/${branch}`);
          if (comparison?.kind !== 'contained') {
            result.Refused.push({ Branch: b, Reason: 'Branch containment could not be reconfirmed before force deletion.' });
            continue;
          }
        }
        const deleted = git('branch', force ? '-D' : '-d', b);
        if (!deleted.code) result.Deleted.push(b);
        else {
          const path = deleted.output.match(/used by worktree at '([^']+)'/)?.[1];
          result.Refused.push({ Branch: b, Reason: path ? `Checked out in another worktree at '${path}' - run 'git worktree remove ${path}' first, not deleted.` : deleted.output });
        }
      }
    }
    return result;
  } catch (e) {
    return { ...stop('UnhandledError', e instanceof Error ? e.message : String(e)), Pulled: false, PrunedCount: 0,
      Candidates: [], SquashMergeCandidates: [], TipAheadOfMergedPr: [], UnknownMergedPrEvidence: [], Deleted: [], Refused: [] };
  }
}
if (isMain(import.meta.url)) await main(() => {
  const o = parseOptions(options);
  writeJson(doneHousekeeping({ repoRoot: o['repo-root'], defaultBranch: o['default-branch'], skipPull: o['skip-pull'],
    deleteBranches: o['delete-branches'], forceDeleteBranches: o['force-delete-branches'], autoStash: o['auto-stash'], keepDirty: o['keep-dirty'] }));
});
