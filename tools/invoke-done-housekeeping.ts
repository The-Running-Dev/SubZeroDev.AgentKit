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
    Deleted: [] as string[], Refused: [] as { Branch: string; Reason: string }[], Stashed: false, StashRef: null as string | null,
  };
  const stop = (reason: string, detail: string) => ({ ...result, Stopped: true, Reason: reason, Detail: detail });
  const url = git('remote', 'get-url', 'origin');
  const repo = url.code === 0 ? url.output.trim().match(/[:/]([^/:]+\/[^/]+?)(\.git)?$/)?.[1] : undefined;
  const ghArgs = repo ? ['-R', repo] : [];
  // gh paginates up to this limit. Reaching it without a match is inconclusive,
  // rather than proof that no other merged PR accounts for a reused branch name.
  const prLimit = 1000;
  const prs = (branch: string, fields: string) => {
    const r = runner('gh', ['pr', 'list', ...ghArgs, '--state', 'merged', '--head', branch, '--limit', String(prLimit), '--json', fields], { cwd: root });
    if (r.code || !r.stdout.trim()) return [];
    return JSON.parse(r.stdout) as { url: string; headRefOid?: string }[];
  };
  const verifyHead = (local: string, head: string): { contained: boolean; unknown?: string } => {
    if (local === head) return { contained: true };
    const hasHead = () => git('cat-file', '-e', `${head}^{commit}`).code === 0;
    if (!hasHead()) {
      // Fetch the immutable PR head, never the possibly reused branch ref. Do not
      // move local branches or overwrite another operation's FETCH_HEAD.
      const fetched = git('fetch', '--no-tags', '--no-write-fetch-head', 'origin', head);
      if (fetched.code || !hasHead()) return { contained: false, unknown: `merged head ${head} is unavailable after fetch: ${fetched.output}` };
    }
    const ancestor = git('merge-base', '--is-ancestor', local, head);
    if (ancestor.code === 0) return { contained: true };
    if (ancestor.code !== 1) return { contained: false, unknown: `ancestry check failed: ${ancestor.output}` };
    const shallow = git('rev-parse', '--is-shallow-repository');
    if (shallow.code || shallow.stdout.trim() !== 'false') return { contained: false, unknown: 'history is shallow or its completeness could not be established' };
    const base = git('merge-base', local, head);
    if (base.code || !base.stdout.trim()) return { contained: false, unknown: 'no common history could be established' };
    const commits = git('rev-list', `${head}..${local}`);
    const merges = git('rev-list', '--min-parents=2', `${head}..${local}`);
    const unique = commits.stdout.trim().split('\n').filter(Boolean);
    if (commits.code || merges.code || !unique.length || merges.stdout.trim()) {
      return { contained: false, unknown: 'local-only history is unavailable or contains merge commits that patch comparison cannot verify' };
    }
    const cherry = git('cherry', head, local);
    const patches = cherry.stdout.trim().split('\n').filter(Boolean).map(line => /^([+-]) ([0-9a-f]+)$/.exec(line));
    // git cherry omits merges. Require an explicit result for every local-only
    // commit; failed/empty/incomplete output is never evidence of containment.
    if (cherry.code || patches.length !== unique.length || patches.some(p => !p)
      || new Set(patches.map(p => p![2])).size !== unique.length
      || patches.some(p => !unique.includes(p![2]))) {
      return { contained: false, unknown: `patch comparison was unsuccessful or incomplete: ${cherry.output}` };
    }
    if (patches.some(p => p![1] === '+')) return { contained: false };
    // cherry ignores whitespace, including changes inside string literals or
    // indentation. It is only a first filter; deletion also requires verbatim
    // patch IDs. Empty commits produce no patch ID and remain protected.
    const patchIds = (range: string) => {
      const log = git('log', '--no-merges', '--format=medium', '--no-notes', '--no-show-signature',
        '--no-decorate', '--no-color', '--no-ext-diff', '--no-textconv', '--binary', '--full-index', '--no-renames', '-p', range);
      if (log.code) return null;
      const ids = runner('git', ['-C', root, 'patch-id', '--verbatim'], { input: log.stdout });
      if (ids.code) return null;
      const entries = ids.stdout.trim().split('\n').filter(Boolean).map(line => /^([0-9a-f]+) ([0-9a-f]+)$/.exec(line));
      return entries.some(e => !e) ? null : entries.map(e => ({ patch: e![1], commit: e![2] }));
    };
    const localPatches = patchIds(`${head}..${local}`), mergedPatches = patchIds(`${local}..${head}`);
    if (!localPatches || !mergedPatches || localPatches.length !== unique.length
      || new Set(localPatches.map(p => p.commit)).size !== unique.length
      || localPatches.some(p => !unique.includes(p.commit))) {
      return { contained: false, unknown: 'verbatim patch verification failed, was incomplete, or encountered empty commits' };
    }
    if (localPatches.some(p => !mergedPatches.some(m => m.patch === p.patch))) return { contained: false };
    return { contained: true };
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
      const matches = prs(b, 'number,url,headRefOid');
      if (!matches.length) continue;
      const tip = git('rev-parse', b); const local = tip.code === 0 ? tip.output.split('\n')[0].trim() : null;
      const unknown: string[] = [];
      const proofs = new Map<string, ReturnType<typeof verifyHead>>();
      let contained = false;
      for (const p of matches) {
        const head = p.headRefOid;
        const proof = !local ? { contained: false, unknown: `could not resolve local tip of '${b}'` }
          : !head ? { contained: false, unknown: `PR ${p.url} reported no headRefOid` } : proofs.get(head) ?? verifyHead(local, head);
        if (head) proofs.set(head, proof);
        if (proof.contained) {
          result.SquashMergeCandidates.push({ Branch: b, MergedPr: p.url, MergedHead: head! });
          contained = true; break;
        }
        if (proof.unknown) unknown.push(`${p.url}: ${proof.unknown}`);
      }
      if (contained) continue;
      if (matches.length === prLimit) unknown.push(`merged PR query reached its ${prLimit} result limit`);
      // Keep the legacy bucket for callers, but never describe uncertainty as
      // proven unmerged work. Only the positive proof above authorizes -D.
      result.TipAheadOfMergedPr.push({ Branch: b, MergedPr: matches[0].url, LocalTip: local, MergedHead: matches[0].headRefOid ?? null,
        Reason: unknown.length ? `Cannot verify containment in merged history; branch kept. ${unknown.join('; ')}`
          : `Local commits or patches are not accounted for by any of the ${matches.length} merged PR heads checked; branch kept.` });
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
