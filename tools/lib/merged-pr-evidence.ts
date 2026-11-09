import type { Runner } from './process.ts';

export interface MergedPr { url: string; headRefOid?: string; mergeCommit?: { oid: string } | null; isCrossRepository?: boolean }
export interface PrEvidence { prs: MergedPr[]; complete: boolean; reason?: string }
type Comparison = { kind: 'contained' } | { kind: 'unaccounted'; commits: string[] } | { kind: 'unknown'; reason: string };
const oid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{40,64}$/.test(value);

// A bounded query must never turn a truncated/error response into proof of absence.
export function mergedPrEvidence(root: string, branch: string, ghArgs: string[], runner: Runner): PrEvidence {
  const r = runner('gh', ['pr', 'list', ...ghArgs, '--state', 'merged', '--head', branch, '--limit', '1000',
    '--json', 'number,url,mergeCommit,headRefOid,isCrossRepository'], { cwd: root });
  if (r.code) return { prs: [], complete: false, reason: `GitHub evidence unavailable: ${r.stderr || r.stdout || 'gh failed'}` };
  try {
    const data: unknown = JSON.parse(r.stdout);
    if (!Array.isArray(data) || data.some(p => !p || typeof p.url !== 'string' || typeof p.isCrossRepository !== 'boolean')) throw new Error('invalid PR response');
    return { prs: data.filter(p => !p.isCrossRepository), complete: data.length < 1000,
      reason: data.length >= 1000 ? 'Merged PR query reached its 1000-result limit.' : undefined };
  } catch { return { prs: [], complete: false, reason: 'GitHub returned malformed merged PR evidence.' }; }
}

// `settled` names a ref whose commits are already kept elsewhere (the default branch):
// they are never reported as work a merged PR must account for.
export function compareMergedPr(root: string, local: string, pr: MergedPr, runner: Runner, settled?: string): Comparison {
  const git = (...args: string[]) => runner('git', ['-C', root, ...args]);
  const available = new Map<string, boolean>();
  const ensure = (sha: string): boolean => {
    if (available.has(sha)) return available.get(sha)!;
    if (git('cat-file', '-e', `${sha}^{commit}`).code === 0) return true;
    // Fetch objects only: no local branches, tracking refs, tags or FETCH_HEAD are written.
    const fetched = git('fetch', '--no-tags', '--no-write-fetch-head', 'origin', sha);
    const found = fetched.code === 0 && git('cat-file', '-e', `${sha}^{commit}`).code === 0;
    available.set(sha, found);
    return found;
  };
  const head = pr.headRefOid;
  if (!oid(head) || !oid(local)) return { kind: 'unknown', reason: 'Missing or invalid commit OID.' };
  if (local === head) return { kind: 'contained' };
  if (!ensure(head)) return { kind: 'unknown', reason: `Merged head ${head} is unavailable locally and could not be fetched.` };
  const ancestor = git('merge-base', '--is-ancestor', local, head);
  if (ancestor.code === 0) return { kind: 'contained' };
  if (ancestor.code !== 1) return { kind: 'unknown', reason: `Ancestry check failed: ${ancestor.stderr}` };
  const shallow = git('rev-parse', '--is-shallow-repository');
  if (shallow.code || shallow.stdout.trim() !== 'false') return { kind: 'unknown', reason: 'Complete history is unavailable for patch comparison.' };
  const unique = git('rev-list', local, '--not', head, ...(settled ? [settled] : []), '--');
  const cherry = git('cherry', head, local);
  if (unique.code || cherry.code) return { kind: 'unknown', reason: 'Could not compare local commits and merged patches.' };
  const commits = unique.stdout.trim().split('\n').filter(Boolean);
  const equivalent = new Set(cherry.stdout.trim().split('\n').filter(l => /^- [0-9a-f]+$/.test(l)).map(l => l.slice(2)));
  // cherry ignores whitespace, including semantically significant indentation and
  // string contents. Confirm its matches with whitespace-preserving patch IDs.
  if (equivalent.size) {
    const patchIds = (range: string) => {
      const patches = git('log', '--no-merges', '--format=medium', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none', '--submodule=short', '--binary', '-p', range, '--');
      if (patches.code) return null;
      const ids = runner('git', ['-C', root, 'patch-id', '--verbatim'], { input: patches.stdout });
      if (ids.code) return null;
      const lines = ids.stdout.trim().split('\n').filter(Boolean).map(l => l.split(/\s+/));
      if (lines.some(l => l.length !== 2 || !l.every(oid))) return null;
      return new Map(lines.map(([patch, commit]) => [commit, patch]));
    };
    const upstream = patchIds(`${local}..${head}`), branch = patchIds(`${head}..${local}`);
    if (!upstream || !branch) return { kind: 'unknown', reason: 'Whitespace-preserving patch comparison failed.' };
    const upstreamIds = new Set(upstream.values());
    for (const commit of equivalent) if (!branch.has(commit) || !upstreamIds.has(branch.get(commit)!)) equivalent.delete(commit);
  }
  const unmatched = commits.filter(c => !equivalent.has(c));
  if (commits.length && !unmatched.length) return { kind: 'contained' };

  // git cherry handles rebases/cherry-picks. A multi-commit squash instead needs
  // the complete branch diff to match the actual squash commit's patch.
  const merge = pr.mergeCommit?.oid;
  if (oid(merge) && ensure(merge)) {
    const base = git('merge-base', '--all', head, local);
    const parents = git('rev-list', '--parents', '-n', '1', merge);
    if (base.code || !oid(base.stdout.trim()) || parents.code) return { kind: 'unknown', reason: 'Could not resolve the squash comparison base or parents.' };
    if (parents.stdout.trim().split(/\s+/).length === 2) {
      let failed = false;
      const patchId = (from: string, to: string) => {
        const diff = git('diff', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none', '--submodule=short', '--binary', from, to, '--');
        if (diff.code) { failed = true; return null; }
        if (!diff.stdout.trim()) return null;
        const id = runner('git', ['-C', root, 'patch-id', '--verbatim'], { input: diff.stdout });
        if (id.code || !oid(id.stdout.trim().split(/\s+/)[0])) { failed = true; return null; }
        return id.stdout.trim().split(/\s+/)[0];
      };
      const localPatch = patchId(base.stdout.trim(), local);
      const mergedPatch = patchId(`${merge}^`, merge);
      if (failed) return { kind: 'unknown', reason: 'Squash patch comparison failed.' };
      if (localPatch && localPatch === mergedPatch) {
        // Do not discard empty commits or merge topology merely because their net diff vanished.
        const topology = git('rev-list', '--min-parents=2', `${head}..${local}`);
        const empty = unmatched.some(c => {
          const diff = git('diff-tree', '--root', '--no-commit-id', '--ignore-submodules=none', '--submodule=short', '--name-only', '-r', c);
          return diff.code !== 0 || !diff.stdout.trim();
        });
        if (topology.code) return { kind: 'unknown', reason: 'Could not inspect local merge topology.' };
        if (!topology.stdout.trim() && !empty) return { kind: 'contained' };
      }
    }
  }
  // Missing merge objects do not invalidate a successful head comparison; however
  // they can hide a squash match, so they cannot establish unaccounted work.
  if (!oid(merge) || !ensure(merge)) return { kind: 'unknown', reason: 'Squash-merge evidence is unavailable.' };
  if (!commits.length) return { kind: 'unknown', reason: 'No unique commits were returned after ancestry failed.' };
  return { kind: 'unaccounted', commits: unmatched };
}
