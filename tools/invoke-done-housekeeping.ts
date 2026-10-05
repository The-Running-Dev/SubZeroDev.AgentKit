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
    Deleted: [] as string[], Refused: [] as { Branch: string; Reason: string }[], Stashed: false, StashRef: null as string | null,
  };
  const stop = (reason: string, detail: string) => ({ ...result, Stopped: true, Reason: reason, Detail: detail });
  const url = git('remote', 'get-url', 'origin');
  const repo = url.code === 0 ? url.output.trim().match(/[:/]([^/:]+\/[^/]+?)(\.git)?$/)?.[1] : undefined;
  const ghArgs = repo ? ['-R', repo] : [];
  const prs = (branch: string, fields: string) => {
    const r = runner('gh', ['pr', 'list', ...ghArgs, '--state', 'merged', '--head', branch, '--json', fields], { cwd: root });
    if (r.code || !r.stdout.trim()) return [];
    return JSON.parse(r.stdout) as { url: string; headRefOid?: string }[];
  };
  const status = git('status', '--short');
  if (status.output.trim() && !input.keepDirty) {
    if (!input.autoStash) return { ...stop('DirtyTree', status.output), DefaultBranch: null };
    const stash = git('stash', 'push', '-u', '-m', 'Invoke-DoneHousekeeping auto-stash');
    if (stash.code) throw new Error(`AutoStash was requested but 'git stash push -u' failed: ${stash.output}`);
    result.Stashed = true; result.StashRef = 'stash@{0}';
  }
  try {
    let branch = input.defaultBranch;
    if (!branch) {
      branch = git('remote', 'show', 'origin').output.match(/HEAD branch:\s*(\S+)/)?.[1];
      if (!branch || branch === '(unknown)') throw new Error("Could not resolve the default branch from 'git remote show origin' (reported '(unknown)' or no HEAD branch line). Pass --default-branch explicitly.");
    }
    result.DefaultBranch = branch;
    const current = git('branch', '--show-current').output.trim();
    if (current && current !== branch && git('log', `${branch}..HEAD`, '--oneline').output.trim() && !prs(current, 'number,url').length) {
      return stop('UnmergedCurrentBranch', `Branch '${current}' has commits not on '${branch}' and no merged PR was found for it via gh.`);
    }
    const checkout = git('checkout', branch);
    if (checkout.code) return stop('CheckoutFailed', checkout.output);
    if (!input.skipPull) result.Pulled = git('pull').code === 0;
    result.PrunedCount = git('fetch', '--prune', 'origin').output.split('\n').filter(l => /\[deleted\]/.test(l)).length;
    const merged = git('for-each-ref', '--format=%(refname:short)', `--merged=${branch}`, 'refs/heads').output.split('\n').map(l => l.trim()).filter(l => l && l !== branch);
    for (const b of merged) result.Candidates.push({ Branch: b, MergedPr: prs(b, 'number,url')[0]?.url ?? null });
    const others = git('for-each-ref', '--format=%(refname:short)', 'refs/heads').output.split('\n').map(l => l.trim()).filter(l => l && l !== branch && !merged.includes(l));
    for (const b of others) {
      const p = prs(b, 'number,url,mergeCommit,headRefOid')[0];
      if (!p) continue;
      const tip = git('rev-parse', b); const local = tip.code === 0 ? tip.output.split('\n')[0].trim() : null;
      const head = p.headRefOid ?? null;
      if (!local || !head || local !== head) {
        result.TipAheadOfMergedPr.push({ Branch: b, MergedPr: p.url, LocalTip: local, MergedHead: head,
          Reason: !head ? `PR ${p.url} reported no headRefOid - cannot confirm the local tip is what merged.`
            : !local ? `Could not resolve the local tip of '${b}' - cannot confirm it is what merged.`
              : `Local tip ${local} is not the head that merged in ${p.url} (${head}) - commits exist on this branch that no merged PR accounts for.` });
      } else result.SquashMergeCandidates.push({ Branch: b, MergedPr: p.url, MergedHead: head });
    }
    for (const [branches, force] of [[input.deleteBranches ?? [], false], [input.forceDeleteBranches ?? [], true]] as const) {
      for (const b of branches) {
        if (force ? !result.SquashMergeCandidates.some(c => c.Branch === b) : !merged.includes(b)) {
          result.Refused.push({ Branch: b, Reason: force ? "Not in this run's SquashMergeCandidates - not force-deleted." : `Not in --merged '${branch}' - not deleted.` });
          continue;
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
      Candidates: [], SquashMergeCandidates: [], TipAheadOfMergedPr: [], Deleted: [], Refused: [] };
  }
}
if (isMain(import.meta.url)) await main(() => {
  const o = parseOptions(options);
  writeJson(doneHousekeeping({ repoRoot: o['repo-root'], defaultBranch: o['default-branch'], skipPull: o['skip-pull'],
    deleteBranches: o['delete-branches'], forceDeleteBranches: o['force-delete-branches'], autoStash: o['auto-stash'], keepDirty: o['keep-dirty'] }));
});
