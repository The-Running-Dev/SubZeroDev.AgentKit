import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from './lib/process.ts';
import type { ProcessOptions, Runner } from './lib/process.ts';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

// Publishes a stable release: a signed annotated tag on a verified main, plus the source archive and
// its SHA-256 checksum as release assets (#404). --dry-run does everything up to the first external
// write - it signs and verifies the tag, builds the archive and checksum, then removes its own tag.
export const options = {
  'repo-root': { type: 'string' },
  'default-branch': { type: 'string' },
  repository: { type: 'string' },
  workflow: { type: 'string' },
  'allowed-signers': { type: 'string' },
  'out-dir': { type: 'string' },
  'dry-run': { type: 'boolean' },
} as const;
export interface ReleaseInput {
  repoRoot?: string; defaultBranch?: string; repository?: string; workflow?: string;
  allowedSigners?: string; outDir?: string; dryRun?: boolean; now?: Date;
}
export interface ReleaseResult {
  State: string; Refusal: string; Detail: string; Tag: string; PreviousTag: string; HeadSha: string;
  Signature: string; Archive: string; Checksum: string; Sha256: string; Pushed: boolean; ReleaseUrl: string;
  TagRemoved: boolean;
}
// Released and DryRun succeed. TagPushed means the tag is public but the release is not, so it is
// reported apart from a failure that left nothing outside this machine.
export function releaseExitCode(state: string): number {
  switch (state) {
    case 'Released': case 'DryRun': return 0;
    case 'Refused': case 'Failed': return 1;
    case 'TagPushed': return 2;
    default: throw new Error('Unknown ReleaseResult state: ' + state);
  }
}

const tagPattern = /^v(\d{4})\.(\d{2})\.(\d{2})(?:\.([1-9]\d*))?$/;
export function parseTag(tag: string): { Date: string; Revision: number } | null {
  const m = tagPattern.exec(tag);
  return m ? { Date: `${m[1]}.${m[2]}.${m[3]}`, Revision: m[4] ? Number(m[4]) : 0 } : null;
}
export function compareTags(a: string, b: string): number {
  const x = parseTag(a)!, y = parseTag(b)!;
  return x.Date === y.Date ? x.Revision - y.Revision : x.Date < y.Date ? -1 : 1;
}
// The first release of a day is the bare tag; the second is .2, then .3 (the repository's practice).
export function nextTag(now: Date, tags: string[]): string {
  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const revisions = tags.map(parseTag).filter(t => t?.Date === date).map(t => t!.Revision);
  return revisions.length ? `v${date}.${Math.max(2, Math.max(...revisions) + 1)}` : `v${date}`;
}
export function previousTag(tags: string[], tag: string): string {
  return tags.filter(t => parseTag(t) && compareTags(t, tag) < 0).sort(compareTags).at(-1) ?? '';
}
export function repositoryFromUrl(url: string): string {
  return /github\.com[:/]([^/:]+\/[^/]+?)(?:\.git)?\/?$/.exec(url.trim())?.[1] ?? '';
}

// The newest `verify` run that main's own push started for this exact SHA must have succeeded.
export function verifyState(runner: Runner, repository: string, sha: string, workflow = 'verify'): { Refusal: string; Detail: string } {
  const r = runner('gh', ['run', 'list', '-R', repository, '--workflow', workflow, '--commit', sha, '--limit', '20',
    '--json', 'databaseId,status,conclusion,headSha,event,createdAt'], { timeout: 60_000 });
  if (!r.found || r.code !== 0) return { Refusal: 'GhUnavailable', Detail: (r.stderr || r.stdout).trim() };
  let runs: { databaseId: number; status: string; conclusion: string; headSha: string; event: string; createdAt: string }[];
  try { runs = JSON.parse(r.stdout); if (!Array.isArray(runs)) throw new Error('not a list'); }
  catch { return { Refusal: 'GhUnavailable', Detail: 'Unreadable gh run list output.' }; }
  const own = runs.filter(x => x.headSha === sha && x.event === 'push').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!own.length) return { Refusal: 'VerifyNotRun', Detail: `No '${workflow}' push run for ${sha}.` };
  const latest = own[0];
  if (latest.status !== 'completed') return { Refusal: 'VerifyPending', Detail: `Run ${latest.databaseId} is ${latest.status}.` };
  if (latest.conclusion !== 'success') return { Refusal: 'VerifyFailed', Detail: `Run ${latest.databaseId} concluded ${latest.conclusion}.` };
  return { Refusal: '', Detail: `Run ${latest.databaseId} succeeded.` };
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
// git archive output is a function of the tree and the commit it names, so the same tag always
// yields the same bytes for a given git.
export function buildArchive(runner: Runner, root: string, tag: string, path: string, prefix: string) {
  return runner('git', ['-C', root, 'archive', '--format=tar.gz', `--prefix=${prefix}/`, '-o', path, tag]);
}

export function publishRelease(input: ReleaseInput = {}, runner: Runner = run): ReleaseResult {
  const result: ReleaseResult = {
    State: '', Refusal: '', Detail: '', Tag: '', PreviousTag: '', HeadSha: '', Signature: '', Archive: '',
    Checksum: '', Sha256: '', Pushed: false, ReleaseUrl: '', TagRemoved: false,
  };
  const end = (State: string, Refusal = '', Detail = '') => ({ ...result, State, Refusal, Detail });
  const root = realpathSync(input.repoRoot ?? process.cwd());
  const network: ProcessOptions = { timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } };
  const git = (args: string[], options: ProcessOptions = {}) => {
    const r = runner('git', ['-C', root, ...args], options);
    return { ...r, out: r.stdout.trim(), text: [r.stdout.trim(), r.stderr.trim()].filter(Boolean).join('\n') };
  };
  const branch = input.defaultBranch ?? 'main';

  const top = git(['rev-parse', '--show-toplevel']);
  if (top.code) return end('Refused', 'NotARepository', top.text);
  const current = git(['branch', '--show-current']).out;
  if (current !== branch) return end('Refused', 'NotOnDefaultBranch', `On '${current || 'detached HEAD'}', not '${branch}'.`);
  const status = git(['status', '--porcelain']);
  if (status.code || status.out) return end('Refused', 'DirtyTree', status.text);
  const signers = resolve(input.allowedSigners ?? join(root, '.github', 'allowed_signers'));
  if (!existsSync(signers)) return end('Refused', 'AllowedSignersMissing', signers);
  const repository = input.repository ?? repositoryFromUrl(git(['remote', 'get-url', 'origin']).out);
  if (!repository) return end('Refused', 'RepositoryUnknown', 'origin is not a GitHub URL; pass --repository owner/name.');

  const fetch = git(['fetch', '--quiet', '--tags', 'origin', branch], network);
  if (fetch.code) return end('Refused', 'FetchFailed', fetch.text);
  result.HeadSha = git(['rev-parse', 'HEAD']).out;
  const remote = git(['rev-parse', `refs/remotes/origin/${branch}`]).out;
  if (result.HeadSha !== remote) return end('Refused', 'HeadNotOrigin', `HEAD is ${result.HeadSha}; origin/${branch} is ${remote}.`);
  const tags = git(['tag', '--list', 'v*']).out.split('\n').map(t => t.trim()).filter(t => parseTag(t));
  const atHead = git(['tag', '--points-at', 'HEAD']).out.split('\n').map(t => t.trim()).filter(t => parseTag(t));
  if (atHead.length) return end('Refused', 'HeadAlreadyTagged', `HEAD is already released as ${atHead.join(', ')}.`);
  const verify = verifyState(runner, repository, result.HeadSha, input.workflow);
  if (verify.Refusal) return end('Refused', verify.Refusal, verify.Detail);

  result.Tag = nextTag(input.now ?? new Date(), tags);
  result.PreviousTag = previousTag(tags, result.Tag);
  const removeTag = () => { result.TagRemoved = git(['tag', '-d', result.Tag]).code === 0; };
  // A passphrase prompt cannot be answered here, so it surfaces as a timeout rather than a hang.
  const sign = git(['-c', 'gpg.format=ssh', 'tag', '-s', result.Tag, '-m', `AgentKit ${result.Tag}`, result.HeadSha], { timeout: 60_000 });
  if (sign.code) {
    if (git(['rev-parse', '--verify', '--quiet', `refs/tags/${result.Tag}`]).code === 0) removeTag();
    return end('Failed', 'SigningFailed', sign.text);
  }
  const check = git(['-c', `gpg.ssh.allowedSignersFile=${signers}`, 'tag', '-v', result.Tag], { timeout: 60_000 });
  const good = /^Good "git" signature for \S+ with .*$/m.exec(check.stderr);
  if (check.code || !good) { removeTag(); return end('Refused', 'SignatureNotVerified', check.stderr.trim()); }
  result.Signature = good[0].trim();

  const outDir = input.outDir ? resolve(input.outDir) : mkdtempSync(join(tmpdir(), 'agentkit-release-'));
  mkdirSync(outDir, { recursive: true });
  const name = `${repository.split('/').pop()}-${result.Tag}`;
  result.Archive = join(outDir, `${name}.tar.gz`);
  const archive = buildArchive(runner, root, result.Tag, result.Archive, name);
  if (archive.code) { removeTag(); return end('Failed', 'ArchiveFailed', (archive.stderr || archive.stdout).trim()); }
  result.Sha256 = sha256File(result.Archive);
  result.Checksum = `${result.Archive}.sha256`;
  writeFileSync(result.Checksum, `${result.Sha256}  ${name}.tar.gz\n`);

  if (input.dryRun) { removeTag(); return end('DryRun'); }
  const push = git(['push', 'origin', `refs/tags/${result.Tag}`], network);
  if (push.code) { removeTag(); return end('Failed', 'PushFailed', push.text); }
  result.Pushed = true;
  const release = runner('gh', ['release', 'create', result.Tag, result.Archive, result.Checksum, '-R', repository,
    '--title', `AgentKit ${result.Tag}`, '--generate-notes', ...(result.PreviousTag ? ['--notes-start-tag', result.PreviousTag] : []),
    '--verify-tag'], { timeout: 300_000 });
  if (!release.found || release.code) {
    return end('TagPushed', 'ReleaseFailed', `${(release.stderr || release.stdout).trim()}\nThe tag is pushed; finish with: gh release create ${result.Tag} "${result.Archive}" "${result.Checksum}" -R ${repository} --title "AgentKit ${result.Tag}" --generate-notes${result.PreviousTag ? ' --notes-start-tag ' + result.PreviousTag : ''} --verify-tag`);
  }
  result.ReleaseUrl = release.stdout.trim().split('\n').at(-1) ?? '';
  return end('Released');
}

if (isMain(import.meta.url)) await main(() => {
  const o = parseOptions(options);
  const result = publishRelease({ repoRoot: o['repo-root'], defaultBranch: o['default-branch'], repository: o.repository,
    workflow: o.workflow, allowedSigners: o['allowed-signers'], outDir: o['out-dir'], dryRun: o['dry-run'] });
  writeJson(result);
  process.exitCode = releaseExitCode(result.State);
});
