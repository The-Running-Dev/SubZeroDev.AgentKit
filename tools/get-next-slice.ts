import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  'repo-root': { type: 'string' }, 'default-branch': { type: 'string' },
  slice: { type: 'string' }, 'pull-requests-json': { type: 'string' }, quiet: { type: 'boolean' },
} as const;

export function getSlicePlan(text: string) {
  const index = text.search(/^## Landed\b/m);
  const live = index < 0 ? text : text.slice(0, index);
  return {
    Slices: [...live.matchAll(/^## S(\d+)\b/gm)].map(h => {
      const rest = live.slice(h.index! + h[0].length);
      const body = rest.split(/^#{1,2} /m)[0];
      return { Id: Number(h[1]), Done: /^Status:[ \t]*done(?:\s|$)/mi.test(body),
        DependsOn: [...(body.match(/^Depends on:(.*)$/m)?.[1] ?? '').matchAll(/\bS?(\d+)\b/g)].map(m => Number(m[1])) };
    }),
    Landed: [...text.slice(live.length).matchAll(/\bS(\d+)\b/g)].map(m => Number(m[1])),
  };
}

export interface NextInput { repoRoot?: string; defaultBranch?: string; slice?: string; pullRequestsJson?: string }
export function getNextSlice(input: NextInput = {}, runner: Runner = run) {
  const root = realpathSync(input.repoRoot ?? process.cwd());
  const git = (...args: string[]) => {
    const r = runner('git', ['-C', root, ...args]);
    return { ...r, output: [r.stdout.trimEnd(), r.stderr.trimEnd()].filter(Boolean).join('\n').trim() };
  };
  const result = {
    State: '', Slice: null as string | null, Branch: null as string | null,
    PullRequest: null as number | null, PullRequestUrl: null as string | null,
    Base: null as string | null, DefaultBranch: null as string | null,
    DirtyFiles: [] as string[], GuardedFiles: [] as string[], OwnFiles: [] as string[],
    Reason: null as string | null, Detail: null as string | null,
  };
  const guardPath = resolve(root, git('rev-parse', '--git-path', 'agentkit/next-guard.json').output);
  const complete = (state: string, reason: string | null, detail: string) => {
    result.State = state; result.Reason = reason ?? ''; result.Detail = detail;
    result.GuardedFiles = result.DirtyFiles;
    if (state === 'Start') {
      mkdirSync(dirname(guardPath), { recursive: true });
      writeFileSync(guardPath, JSON.stringify({ Slice: result.Slice, Files: result.DirtyFiles }) + '\n');
    } else if (state === 'Resume' && existsSync(guardPath)) {
      const guard = JSON.parse(readFileSync(guardPath, 'utf8').replace(/^\uFEFF/, ''));
      if (guard.Slice === result.Slice) {
        const guarded = (file: string) => guard.Files.some((f: string) => f.toLowerCase() === file.toLowerCase());
        result.GuardedFiles = result.DirtyFiles.filter(guarded);
        result.OwnFiles = result.DirtyFiles.filter(f => !guarded(f));
      }
    }
    return result;
  };
  result.DirtyFiles = runner('git', ['-C', root, '-c', 'core.quotepath=false', 'status', '--porcelain', '--untracked-files=all']).stdout
    .split(/\r?\n/).filter(l => l.length > 3).map(l => l.slice(3).split(' -> ').at(-1)!.replace(/^"|"$/g, ''));
  let branch = input.defaultBranch;
  if (!branch) {
    const head = git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD');
    if (head.code === 0 && /^origin\/(.+)$/.test(head.output)) branch = head.output.slice(7);
    else {
      const show = git('remote', 'show', 'origin');
      branch = show.output.match(/HEAD branch:\s*(\S+)/m)?.[1];
      if (!branch || branch === '(unknown)') return complete('Blocked', 'NoDefaultBranch', `Could not resolve origin's default branch: ${show.output} Pass --default-branch.`);
    }
  }
  const base = `origin/${branch}`;
  result.DefaultBranch = branch; result.Base = base;
  const fetch = git('fetch', '--prune', 'origin');
  if (fetch.code) return complete('Blocked', 'FetchFailed', `git fetch origin failed, so ${base} may be stale: ${fetch.output}`);
  const show = git('show', `${base}:design/30-slices.md`);
  if (show.code) return complete('Blocked', 'NoPlan', `No design/30-slices.md on ${base}: ${show.output}`);
  const plan = getSlicePlan(show.output);
  const done = [...plan.Landed, ...plan.Slices.filter(s => s.Done).map(s => s.Id)];
  let pending = plan.Slices.filter(s => !s.Done);
  if (input.slice) {
    const match = /^[Ss]?(\d+)$/.exec(input.slice);
    if (!match) return complete('Blocked', 'UnknownSlice', `'${input.slice}' is not a slice id.`);
    const id = Number(match[1]); const wanted = plan.Slices.find(s => s.Id === id);
    if (!wanted) return complete('Blocked', 'UnknownSlice', `S${id} is not a slice heading on ${base}.`);
    result.Slice = `S${id}`;
    if (wanted.Done) return complete('Blocked', 'AlreadyDone', `S${id} is already done on ${base}.`);
    pending = [wanted];
  }
  if (!pending.length) return complete('Finished', null, `Every slice on ${base} is done.`);
  let prs: { number: number; headRefName: string; baseRefName: string; isCrossRepository: boolean; url: string }[];
  try {
    let json = input.pullRequestsJson;
    if (!json) {
      const r = runner('gh', ['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'number,headRefName,baseRefName,isCrossRepository,url'], { cwd: root });
      if (r.code) throw new Error(`gh pr list failed: ${[r.stdout, r.stderr].filter(Boolean).join('\n').trim()}`);
      json = r.stdout;
    }
    const parsed = JSON.parse(json);
    prs = Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) { return complete('Blocked', 'PullRequestsUnavailable', String(e instanceof Error ? e.message : e)); }
  prs = prs.filter(p => p.isCrossRepository === false && p.baseRefName?.toLowerCase() === branch!.toLowerCase());
  const flights = new Map<string, boolean>();
  for (const ref of git('for-each-ref', '--format=%(refname)', 'refs/heads/slice/', 'refs/remotes/origin/slice/').output.split('\n').filter(Boolean)) {
    const ahead = git('merge-base', '--is-ancestor', ref, base).code === 1;
    if (ahead || ref.startsWith('refs/heads/')) {
      const name = ref.replace(/^refs\/(heads|remotes\/origin)\//, '');
      flights.set(name, ahead || (flights.get(name) ?? false));
    }
  }
  for (const s of pending) {
    const pattern = new RegExp(`^slice/S${s.Id}(?![0-9])`, 'i');
    const matching = prs.filter(p => pattern.test(p.headRefName));
    if (matching.length > 1) {
      result.Slice = `S${s.Id}`;
      return complete('Blocked', 'AmbiguousPullRequest', `S${s.Id} has more than one open pull request: ${matching.map(p => `#${p.number} ${p.headRefName}`).join(', ')}.`);
    }
    if (matching.length === 1) {
      const p = matching[0]; result.Slice = `S${s.Id}`; result.Branch = p.headRefName; result.PullRequest = p.number; result.PullRequestUrl = p.url;
      return complete('Resume', 'OpenPullRequest', `S${s.Id} has open pull request #${p.number} on ${p.headRefName}.`);
    }
    const branches = [...flights].filter(([name]) => pattern.test(name));
    if (branches.length > 1) {
      result.Slice = `S${s.Id}`;
      return complete('Blocked', 'AmbiguousBranch', `S${s.Id} has work in flight on more than one branch: ${branches.map(b => b[0]).join(', ')}.`);
    }
    if (branches.length === 1) {
      const [name, ahead] = branches[0]; result.Slice = `S${s.Id}`; result.Branch = name;
      return complete('Resume', ahead ? 'UnmergedBranch' : 'EmptyBranch', ahead
        ? `S${s.Id} has unmerged work on ${name} and no open pull request.`
        : `S${s.Id} has branch ${name} with no commits yet and no open pull request.`);
    }
  }
  const waiting: string[] = [];
  for (const s of pending) {
    const missing = s.DependsOn.filter(d => !done.includes(d));
    if (!missing.length) { result.Slice = `S${s.Id}`; return complete('Start', null, `Start S${s.Id} from ${base}.`); }
    waiting.push(`S${s.Id} waits on ${missing.map(d => `S${d}`).join(', ')}`);
  }
  return complete('Blocked', 'NoEligibleSlice', `Slices remain but none can start: ${waiting.join('; ')}.`);
}

if (isMain(import.meta.url)) await main(() => {
  const o = parseOptions(options);
  const r = getNextSlice({ repoRoot: o['repo-root'], defaultBranch: o['default-branch'], slice: o.slice, pullRequestsJson: o['pull-requests-json'] });
  if (!o.quiet) {
    const what = [r.Slice, r.Branch, r.PullRequest ? `#${r.PullRequest}` : null].filter(Boolean);
    process.stderr.write(`Next slice: ${r.State}${what.length ? ` ${what.join(' ')}` : ''} - ${r.Detail}`
      + `${r.GuardedFiles.length ? ` Uncommitted, never stage: ${r.GuardedFiles.join(', ')}.` : ''}`
      + `${r.OwnFiles.length ? ` Uncommitted slice work to carry on: ${r.OwnFiles.join(', ')}.` : ''}\n`);
  }
  writeJson(r); process.exitCode = r.State === 'Blocked' ? 1 : 0;
});
