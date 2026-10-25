import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { findExecutable } from './lib/executable.ts';
import { git, put, temp } from './lib/fixtures.ts';
import { buildArchive, nextTag, previousTag, publishRelease, releaseExitCode, repositoryFromUrl, sha256File, verifyState } from './publish-release.ts';

const now = new Date(2026, 9, 25, 12);
const repository = 'owner/AgentKit';
const noSsh = findExecutable('ssh-keygen') ? false : 'ssh-keygen is not on PATH';
type Run = { databaseId: number; status: string; conclusion: string; headSha: string; event: string; createdAt: string };
const green = (sha: string): Run[] => [{ databaseId: 7, status: 'completed', conclusion: 'success', headSha: sha, event: 'push', createdAt: '2026-10-25T10:00:00Z' }];

// Real git throughout; gh answers from `runs` and records every call instead of reaching GitHub.
function fakeGh(runs: (sha: string) => Run[] = green, release = { code: 0, stdout: 'https://example.invalid/releases/tag/x\n' }) {
  const calls: string[][] = [];
  const runner: Runner = (command, args, options) => {
    if (command !== 'gh') return run(command, args, options);
    calls.push(args);
    if (args[0] === 'run') return { code: 0, found: true, stderr: '', stdout: JSON.stringify(runs(args[args.indexOf('--commit') + 1])) };
    return { ...release, found: true, stderr: release.code ? 'release refused' : '' };
  };
  return { runner, calls };
}
function sshKey(dir: string, name: string) {
  const path = join(dir, name);
  const r = run('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', name, '-f', path]);
  assert.equal(r.code, 0, r.stderr);
  return { path, pub: readFileSync(path + '.pub', 'utf8').trim().split(/\s+/).slice(0, 2).join(' ') };
}
// A clean main, equal to its bare origin, signing as release@example.com with a throwaway key.
function setup({ tags = [] as string[], signerKey = true } = {}) {
  const dir = temp(), origin = join(dir, 'origin.git'), root = join(dir, 'work'), out = join(dir, 'out');
  git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  git(dir, 'init', '-q', '-b', 'main', root);
  git(root, 'config', 'user.email', 'release@example.com'); git(root, 'config', 'user.name', 'Release');
  let pub = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHlGwFYwq9pEBhUqm0mR0B0b2nJZmY1mGq3w0HqYF1Zr';
  if (!noSsh) {
    const key = sshKey(dir, 'signer'); git(root, 'config', 'user.signingkey', key.path);
    pub = signerKey ? key.pub : sshKey(dir, 'other').pub;
  }
  put(root, '.github/allowed_signers', `release@example.com namespaces="git" ${pub}\n`);
  put(root, 'README.md', 'kit\n');
  git(root, 'add', '.github/allowed_signers', 'README.md'); git(root, 'commit', '-qm', 'first');
  for (const t of tags) git(root, 'tag', '-a', t, '-m', t);
  git(root, 'commit', '--allow-empty', '-qm', 'second');
  git(root, 'remote', 'add', 'origin', origin); git(root, 'push', '-q', '--follow-tags', 'origin', 'main');
  git(root, 'branch', '-q', '--set-upstream-to=origin/main');
  return { root, origin, out, input: { repoRoot: root, repository, now, outDir: out } };
}
const remoteTags = (origin: string) => git(origin, 'tag', '--list');

test('the first release of a day is the bare tag, then .2 and .3', () => {
  assert.equal(nextTag(now, ['v2026.10.24', 'v2026.10.24.2']), 'v2026.10.25');
  assert.equal(nextTag(now, ['v2026.10.25']), 'v2026.10.25.2');
  assert.equal(nextTag(now, ['v2026.10.25', 'v2026.10.25.2']), 'v2026.10.25.3');
  assert.equal(nextTag(new Date(2026, 0, 5), ['v2026.01.05.x', 'v2026.1.5']), 'v2026.01.05');
});
test('the previous tag sorts by date, then revision, with the bare tag as revision zero', () => {
  assert.equal(previousTag(['v2026.10.24.2', 'v2026.10.09', 'v2026.10.24', 'v2026.10.24.10', 'junk'], 'v2026.10.25'), 'v2026.10.24.10');
  assert.equal(previousTag(['v2026.10.25'], 'v2026.10.25.2'), 'v2026.10.25');
  assert.equal(previousTag([], 'v2026.10.25'), '');
});
test('repository comes from a GitHub origin and nothing else', () => {
  assert.equal(repositoryFromUrl('https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git'), 'The-Running-Dev/SubZeroDev.AgentKit');
  assert.equal(repositoryFromUrl('git@github.com:o/r.git'), 'o/r');
  assert.equal(repositoryFromUrl('D:/tmp/origin.git'), '');
});
test('exit codes separate success, failure and a pushed tag without a release', () => {
  assert.equal(releaseExitCode('Released'), 0); assert.equal(releaseExitCode('DryRun'), 0);
  assert.equal(releaseExitCode('Refused'), 1); assert.equal(releaseExitCode('Failed'), 1);
  assert.equal(releaseExitCode('TagPushed'), 2); assert.equal(releaseExitCode('Skipped'), 0);
  assert.throws(() => releaseExitCode('Whatever'));
});
test('verify must be the newest push run for the exact SHA, and successful', () => {
  const state = (runs: Run[], code = 0) => verifyState(() => ({ code, found: true, stderr: '', stdout: JSON.stringify(runs) }), repository, 'abc').Refusal;
  const one = (values: Partial<Run>): Run => ({ ...green('abc')[0], ...values });
  assert.equal(state(green('abc')), '');
  assert.equal(state([]), 'VerifyNotRun');
  assert.equal(state([one({ event: 'pull_request' }), one({ headSha: 'def' })]), 'VerifyNotRun');
  assert.equal(state([one({ status: 'in_progress', conclusion: '' })]), 'VerifyPending');
  assert.equal(state([one({ conclusion: 'failure' })]), 'VerifyFailed');
  assert.equal(state([one({ createdAt: '2026-10-25T09:00:00Z' }), one({ conclusion: 'failure', createdAt: '2026-10-25T11:00:00Z' })]), 'VerifyFailed');
  assert.equal(state([], 1), 'GhUnavailable');
});
test('refuses anything but a clean main equal to origin, before tagging', () => {
  const s = setup();
  put(s.root, 'stray.txt', 'x\n');
  assert.equal(publishRelease(s.input, fakeGh().runner).Refusal, 'DirtyTree');
  git(s.root, 'add', 'stray.txt'); git(s.root, 'commit', '-qm', 'local only');
  assert.equal(publishRelease(s.input, fakeGh().runner).Refusal, 'HeadNotOrigin');
  git(s.root, 'switch', '-qc', 'feature');
  assert.equal(publishRelease(s.input, fakeGh().runner).Refusal, 'NotOnDefaultBranch');
  assert.equal(git(s.root, 'tag', '--list'), '');
});
test('refuses without verify green on HEAD, an allowed-signers file, or a repository', () => {
  const s = setup();
  const failed = fakeGh(sha => [{ ...green(sha)[0], conclusion: 'failure' }]);
  const r = publishRelease(s.input, failed.runner);
  assert.equal(r.State, 'Refused'); assert.equal(r.Refusal, 'VerifyFailed'); assert.equal(git(s.root, 'tag', '--list'), '');
  assert.equal(publishRelease({ ...s.input, allowedSigners: join(s.root, 'missing') }, fakeGh().runner).Refusal, 'AllowedSignersMissing');
  assert.equal(publishRelease({ ...s.input, repository: undefined }, fakeGh().runner).Refusal, 'RepositoryUnknown');
});
test('refuses a HEAD that is already released', () => {
  const s = setup(); git(s.root, 'tag', '-a', 'v2026.10.24', '-m', 'x'); git(s.root, 'push', '-q', 'origin', 'v2026.10.24');
  const r = publishRelease(s.input, fakeGh().runner); assert.equal(r.Refusal, 'HeadAlreadyTagged'); assert.match(r.Detail, /v2026\.10\.24/);
});
test('--skip-unready skips what a later run releases, and still refuses what no run would', () => {
  const s = setup(), input = { ...s.input, skipUnready: true };
  const pending = fakeGh(sha => [{ ...green(sha)[0], status: 'in_progress', conclusion: '' }]);
  for (const [runner, refusal] of [[pending.runner, 'VerifyPending'], [fakeGh(() => []).runner, 'VerifyNotRun']] as const) {
    const r = publishRelease(input, runner); assert.equal(r.State, 'Skipped'); assert.equal(r.Refusal, refusal);
  }
  const failed = publishRelease(input, fakeGh(sha => [{ ...green(sha)[0], conclusion: 'failure' }]).runner);
  assert.equal(failed.State, 'Refused'); assert.equal(failed.Refusal, 'VerifyFailed');
  git(s.root, 'tag', '-a', 'v2026.10.24', '-m', 'x');
  const tagged = publishRelease(input, fakeGh().runner); assert.equal(tagged.State, 'Skipped'); assert.equal(tagged.Refusal, 'HeadAlreadyTagged');
  git(s.root, 'commit', '--allow-empty', '-qm', 'local only');
  const ahead = publishRelease(input, fakeGh().runner); assert.equal(ahead.State, 'Skipped'); assert.equal(ahead.Refusal, 'HeadNotOrigin');
  put(s.root, 'stray.txt', 'x\n');
  assert.equal(publishRelease(input, fakeGh().runner).State, 'Refused');
  assert.equal(publishRelease({ ...s.input, skipUnready: false }, pending.runner).State, 'Refused');
  assert.equal(remoteTags(s.origin), '');
});
test('dry run signs, verifies and builds the checksummed archive, then removes its tag and writes nothing outside', { skip: noSsh }, () => {
  const s = setup({ tags: ['v2026.10.25'] }); const gh = fakeGh();
  const r = publishRelease({ ...s.input, dryRun: true }, gh.runner);
  assert.equal(r.State, 'DryRun', r.Detail); assert.equal(r.Tag, 'v2026.10.25.2'); assert.equal(r.PreviousTag, 'v2026.10.25');
  assert.match(r.Signature, /^Good "git" signature for release@example\.com with ED25519 key/);
  assert.equal(r.TagRemoved, true); assert.equal(git(s.root, 'tag', '--list', 'v2026.10.25.2'), '');
  assert.equal(remoteTags(s.origin), 'v2026.10.25'); assert.equal(gh.calls.some(a => a[0] === 'release'), false);
  assert.equal(r.Archive, join(s.out, 'AgentKit-v2026.10.25.2.tar.gz')); assert.equal(r.Sha256, sha256File(r.Archive));
  assert.equal(readFileSync(r.Checksum, 'utf8'), `${r.Sha256}  AgentKit-v2026.10.25.2.tar.gz\n`);
});
test('a release pushes the signed tag and attaches the archive and checksum', { skip: noSsh }, () => {
  const s = setup({ tags: ['v2026.10.24'] }); const gh = fakeGh();
  const r = publishRelease(s.input, gh.runner);
  assert.equal(r.State, 'Released', r.Detail); assert.equal(r.Tag, 'v2026.10.25'); assert.equal(r.Pushed, true); assert.equal(r.TagRemoved, false);
  assert.equal(r.ReleaseUrl, 'https://example.invalid/releases/tag/x');
  assert.deepEqual(remoteTags(s.origin).split('\n'), ['v2026.10.24', 'v2026.10.25']);
  assert.equal(git(s.origin, 'rev-parse', 'v2026.10.25^{commit}'), git(s.root, 'rev-parse', 'HEAD'));
  const signers = join(s.root, '.github', 'allowed_signers');
  const verified = run('git', ['-C', s.origin, '-c', `gpg.ssh.allowedSignersFile=${signers}`, 'tag', '-v', 'v2026.10.25']);
  assert.equal(verified.code, 0, verified.stderr);
  const create = gh.calls.find(a => a[0] === 'release')!;
  assert.deepEqual(create.slice(0, 5), ['release', 'create', 'v2026.10.25', r.Archive, r.Checksum]);
  for (const [flag, value] of [['-R', repository], ['--title', 'AgentKit v2026.10.25'], ['--notes-start-tag', 'v2026.10.24']]) assert.equal(create[create.indexOf(flag) + 1], value);
  assert.ok(create.includes('--verify-tag') && create.includes('--generate-notes'));
});
test('a signature the allowed signers do not name removes the tag and pushes nothing', { skip: noSsh }, () => {
  const s = setup({ signerKey: false }); const gh = fakeGh();
  const r = publishRelease(s.input, gh.runner);
  assert.equal(r.State, 'Refused'); assert.equal(r.Refusal, 'SignatureNotVerified'); assert.match(r.Detail, /No principal matched/);
  assert.equal(r.TagRemoved, true); assert.equal(git(s.root, 'tag', '--list'), ''); assert.equal(remoteTags(s.origin), '');
  assert.equal(existsSync(s.out), false); assert.equal(gh.calls.some(a => a[0] === 'release'), false);
});
test('a failed push removes the local tag and creates no release', { skip: noSsh }, () => {
  const s = setup(); const gh = fakeGh();
  git(s.root, 'remote', 'set-url', '--push', 'origin', join(s.origin, '..', 'missing.git'));
  const r = publishRelease(s.input, gh.runner);
  assert.equal(r.State, 'Failed'); assert.equal(r.Refusal, 'PushFailed'); assert.equal(r.TagRemoved, true);
  assert.equal(git(s.root, 'tag', '--list'), ''); assert.equal(gh.calls.some(a => a[0] === 'release'), false);
});
test('a refused release after the push reports TagPushed with the command to finish', { skip: noSsh }, () => {
  const s = setup(); const r = publishRelease(s.input, fakeGh(green, { code: 1, stdout: '' }).runner);
  assert.equal(r.State, 'TagPushed'); assert.equal(r.Pushed, true); assert.equal(remoteTags(s.origin), 'v2026.10.25');
  assert.match(r.Detail, /release refused[\s\S]*gh release create v2026\.10\.25 /);
});
test('the source archive is byte-identical when built twice from one tag', () => {
  const s = setup(); git(s.root, 'tag', '-a', 'v1', '-m', 'v1');
  const a = join(s.root, '..', 'a.tar.gz'), b = join(s.root, '..', 'b.tar.gz');
  assert.equal(buildArchive(run, s.root, 'v1', a, 'AgentKit-v1').code, 0);
  assert.equal(buildArchive(run, s.root, 'v1', b, 'AgentKit-v1').code, 0);
  assert.equal(sha256File(a), sha256File(b));
});
