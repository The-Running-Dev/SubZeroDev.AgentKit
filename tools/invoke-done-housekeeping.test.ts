import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doneHousekeeping } from './invoke-done-housekeeping.ts';
import type { HousekeepingInput } from './invoke-done-housekeeping.ts';
import { temp, repo, put, git, merged, unmerged, fakeGh } from './lib/fixtures.ts';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
const done = (root: string, extra: HousekeepingInput = {}, runner = fakeGh()) => doneHousekeeping({ repoRoot: root, defaultBranch: 'main', skipPull: true, ...extra }, runner);
test('lists a merged branch in another worktree by its bare name', () => { const r = repo(), wt = join(temp(), 'wt'); merged(r, 'feature/foo', wt); const d = done(r); assert.equal(d.Stopped, false); assert.deepEqual(d.Candidates.map(c => c.Branch), ['feature/foo']); });
test('names the blocking worktree in a delete refusal', () => { const r = repo(), wt = join(temp(), 'wt'); merged(r, 'feature/foo', wt); const d = done(r, { deleteBranches: ['feature/foo'] }); assert.deepEqual(d.Deleted, []); const registered = git(r, 'worktree', 'list', '--porcelain').split('\n\n').find(block => block.includes('branch refs/heads/feature/foo'))!.split('\n')[0].slice('worktree '.length); assert.ok(d.Refused[0].Reason.replaceAll('\\', '/').includes(registered.replaceAll('\\', '/')), d.Refused[0].Reason); assert.doesNotMatch(d.Refused[0].Reason, /Not in --merged/); });
test('deletes after the blocking worktree is removed', () => { const r = repo(), wt = join(temp(), 'wt'); merged(r, 'feature/foo', wt); git(r, 'worktree', 'remove', '--force', wt); const d = done(r, { deleteBranches: ['feature/foo'] }); assert.deepEqual(d.Deleted, ['feature/foo']); assert.deepEqual(d.Refused, []); });
test('offers force delete when the local tip equals the merged head', () => { const r = repo(), tip = unmerged(r, 'fix/squashed'); const d = done(r, {}, fakeGh('fix/squashed', tip)); assert.deepEqual(d.SquashMergeCandidates.map(c => c.Branch), ['fix/squashed']); assert.deepEqual(d.TipAheadOfMergedPr, []); });
test('keeps branches with commits beyond the merged head', () => { const r = repo(), tip = unmerged(r, 'fix/squashed'); git(r, 'switch', '-q', 'fix/squashed'); git(r, 'commit', '--allow-empty', '-qm', 'later'); git(r, 'switch', '-q', 'main'); const d = done(r, {}, fakeGh('fix/squashed', tip)); assert.deepEqual(d.SquashMergeCandidates, []); assert.equal(d.TipAheadOfMergedPr[0].MergedHead, tip); assert.match(d.TipAheadOfMergedPr[0].Reason, /not accounted for/); });
test('refuses requested force deletion of a tip ahead of the merged head', () => { const r = repo(), tip = unmerged(r, 'fix/squashed'); git(r, 'switch', '-q', 'fix/squashed'); git(r, 'commit', '--allow-empty', '-qm', 'later'); git(r, 'switch', '-q', 'main'); const d = done(r, { forceDeleteBranches: ['fix/squashed'] }, fakeGh('fix/squashed', tip)); assert.deepEqual(d.Deleted, []); assert.equal(d.Refused[0].Branch, 'fix/squashed'); assert.ok(git(r, 'rev-parse', '--verify', 'fix/squashed')); });
test('stops when main is checked out in another worktree', () => { const r = repo(), wt = join(temp(), 'wt'); git(r, 'worktree', 'add', '-qb', 'fix/foo', wt, 'main'); const d = done(wt); assert.equal(d.Reason, 'CheckoutFailed'); assert.match(d.Detail!, /used by worktree/); assert.equal(git(wt, 'branch', '--show-current'), 'fix/foo'); });
test('keep-dirty preserves edits without a stash', () => { const r = repo(); put(r, 'dirty.txt', 'uncommitted'); const d = done(r, { keepDirty: true }); assert.equal(d.Stopped, false); assert.equal(d.Stashed, false); assert.ok(existsSync(join(r, 'dirty.txt'))); assert.equal(git(r, 'stash', 'list'), ''); });
test('stops on dirt without keep-dirty', () => { const r = repo(); put(r, 'dirty.txt', 'uncommitted'); assert.equal(done(r).Reason, 'DirtyTree'); });
test('reports the stash even when default branch resolution throws', () => { const r = repo(); put(r, 'dirty.txt', 'uncommitted'); const d = doneHousekeeping({ repoRoot: r, autoStash: true }, fakeGh()); assert.equal(d.Stopped, true); assert.equal(d.Stashed, true); assert.ok(d.StashRef); assert.match(git(r, 'stash', 'list'), /Invoke-DoneHousekeeping auto-stash/); });
test('records a stash SHA that an intervening stash from another worktree cannot move', () => {
  const r = repo(), wt = join(temp(), 'wt'); git(r, 'worktree', 'add', '-qb', 'other', wt, 'main'); put(r, 'dirty.txt', 'mine');
  let intervened = false;
  const d = doneHousekeeping({ repoRoot: r, defaultBranch: 'main', skipPull: true, autoStash: true }, (cmd, args, opts) => {
    const out = run(cmd, args, opts);
    if (!intervened && cmd === 'git' && args.includes('stash') && args.includes('push')) { intervened = true; put(wt, 'theirs.txt', 'theirs'); git(wt, 'stash', 'push', '-u', '-m', 'another worktree'); }
    return out;
  });
  assert.equal(intervened, true); assert.equal(d.Stashed, true);
  git(r, 'stash', 'apply', d.StashRef!);
  assert.equal(existsSync(join(r, 'theirs.txt')), false, `restoring '${d.StashRef}' brought back the other worktree's stash`);
  assert.equal(readFileSync(join(r, 'dirty.txt'), 'utf8'), 'mine');
  assert.match(d.StashRef!, /^[0-9a-f]{40}$/);
  assert.match(git(r, 'show', '-s', '--format=%s', d.StashRef!), /^On main: Invoke-DoneHousekeeping auto-stash [0-9a-f-]{36}$/);
});
test('gives every auto-stash its own message', () => { const tags = [0, 1].map(() => { const r = repo(); put(r, 'dirty.txt', 'x'); const d = doneHousekeeping({ repoRoot: r, defaultBranch: 'main', skipPull: true, autoStash: true }, fakeGh()); return git(r, 'show', '-s', '--format=%s', d.StashRef!); }); assert.notEqual(tags[0], tags[1]); });
test('scopes every gh query to the target repository remote', () => { const r = repo(); merged(r); unmerged(r, 'fix/other'); git(r, 'remote', 'add', 'origin', 'https://github.com/target/repo.git'); const calls: string[][] = []; done(r, {}, (cmd, args, opts) => { if (cmd === 'gh') { calls.push(args); return { code: 0, stdout: '[]', stderr: '', found: true }; } if (args.includes('fetch')) return { code: 0, stdout: '', stderr: '', found: true }; return run(cmd, args, opts); }); assert.ok(calls.length >= 2); for (const args of calls) assert.equal(args[args.indexOf('-R') + 1], 'target/repo'); });

// These histories live only in temporary repositories; no user's branches are cleaned up.
const branch = 'fix/reused';
function commitFile(r: string, name: string, text: string) {
  put(r, name, text); git(r, 'add', name); git(r, 'commit', '-qm', text);
  return git(r, 'rev-parse', 'HEAD');
}
function history() {
  const r = repo(); git(r, 'switch', '-qc', branch);
  const local = commitFile(r, 'feature.txt', 'merged work');
  git(r, 'switch', '-q', 'main');
  return { r, local };
}
function prHeads(heads: (string | null)[]): Runner {
  return (cmd, args, opts) => cmd !== 'gh' ? run(cmd, args, opts) : {
    code: 0, found: true, stderr: '', stdout: JSON.stringify(args[args.indexOf('--head') + 1] === branch
      ? heads.map((head, i) => ({ number: i + 1, url: `https://example.invalid/pr/${i + 1}`, headRefOid: head })) : []),
  };
}
function assertProtected(r: string, runner: Runner, reason: RegExp) {
  const d = done(r, { forceDeleteBranches: [branch] }, runner);
  assert.equal(d.Stopped, false); assert.deepEqual(d.SquashMergeCandidates, []);
  assert.deepEqual(d.Deleted, []); assert.equal(d.Refused[0].Branch, branch);
  assert.match(d.TipAheadOfMergedPr[0].Reason, reason);
  assert.ok(git(r, 'rev-parse', '--verify', branch));
}
test('regression: a local tip behind a merged PR head is contained', () => {
  const { r, local } = history(); git(r, 'switch', '-qc', 'remote-head', branch);
  const head = commitFile(r, 'review.txt', 'review fix'); git(r, 'switch', '-q', 'main');
  const d = done(r, {}, prHeads([head]));
  assert.equal(git(r, 'rev-parse', branch), local);
  assert.equal(d.SquashMergeCandidates.find(c => c.Branch === branch)?.MergedHead, head);
  assert.deepEqual(d.TipAheadOfMergedPr, []);
});
test('regression: reused names select the PR that actually contains the tip, in either order', () => {
  const { r, local } = history(); git(r, 'switch', '-qc', 'old-head', 'main');
  const old = commitFile(r, 'old.txt', 'unrelated old PR'); git(r, 'switch', '-q', 'main');
  for (const heads of [[old, local], [local, old]]) {
    const d = done(r, {}, prHeads(heads));
    assert.equal(d.SquashMergeCandidates.find(c => c.Branch === branch)?.MergedPr,
      `https://example.invalid/pr/${heads.indexOf(local) + 1}`);
    assert.equal(d.TipAheadOfMergedPr.some(c => c.Branch === branch), false);
  }
});
test('regression: divergent SHAs with all local patches in a merged head are contained', () => {
  const { r, local } = history(); git(r, 'switch', '-qc', 'rebased-head', 'main');
  commitFile(r, 'review.txt', 'upstream change'); git(r, 'cherry-pick', local);
  const head = git(r, 'rev-parse', 'HEAD'); assert.notEqual(head, local); git(r, 'switch', '-q', 'main');
  const d = done(r, {}, prHeads([head]));
  assert.equal(d.SquashMergeCandidates.find(c => c.Branch === branch)?.MergedHead, head);
  assert.equal(d.TipAheadOfMergedPr.some(c => c.Branch === branch), false);
});
test('regression: real unmerged file changes stay protected across reused PR names', () => {
  const { r, local } = history(); git(r, 'switch', '-q', branch);
  commitFile(r, 'unmerged.txt', 'keep this work'); git(r, 'switch', '-q', 'main');
  assertProtected(r, prHeads([git(r, 'rev-parse', 'main'), local]), /not accounted for/);
});
test('regression: whitespace-normalized cherry equivalence cannot delete distinct string literals', () => {
  const r = repo(); git(r, 'switch', '-qc', branch);
  const local = commitFile(r, 'value.ts', 'export const value = "a b";\n');
  git(r, 'switch', '-qc', 'remote-head', 'main');
  const head = commitFile(r, 'value.ts', 'export const value = "ab";\n'); git(r, 'switch', '-q', 'main');
  assert.equal(git(r, 'cherry', head, local), `- ${local}`, 'reproduce whitespace-normalized equivalence');
  assertProtected(r, prHeads([head]), /not accounted for/);
});
test('failed or incomplete verbatim patch verification stays protected', () => {
  const { r, local } = history(); git(r, 'switch', '-qc', 'remote-head', 'main');
  commitFile(r, 'other.txt', 'other'); git(r, 'cherry-pick', local);
  const head = git(r, 'rev-parse', 'HEAD'); git(r, 'switch', '-q', 'main');
  for (const code of [0, 128]) assertProtected(r, (cmd, args, opts) => cmd === 'git' && args[2] === 'patch-id'
    ? { code, stdout: '', stderr: code ? 'verbatim check failed' : '', found: true } : prHeads([head])(cmd, args, opts), /cannot verify/i);
});
test('regression: a missing merged head is fetched by exact SHA before ancestry verification', () => {
  const { r, local } = history(), remote = repo(); git(remote, 'fetch', r, branch);
  git(remote, 'switch', '--detach', 'FETCH_HEAD'); const head = commitFile(remote, 'review.txt', 'remote review');
  git(r, 'remote', 'add', 'origin', remote);
  assert.notEqual(run('git', ['-C', r, 'cat-file', '-e', `${head}^{commit}`]).code, 0);
  const fetches: string[][] = [], runner = prHeads([head]);
  const d = done(r, {}, (cmd, args, opts) => {
    if (cmd === 'git' && args.includes('fetch')) {
      fetches.push(args);
      // Keep the initial prune from incidentally loading the object under test.
      if (args.includes('--prune')) return { code: 0, stdout: '', stderr: '', found: true };
    }
    return runner(cmd, args, opts);
  });
  assert.ok(fetches.some(args => args.includes(head)));
  assert.equal(d.SquashMergeCandidates.find(c => c.Branch === branch)?.MergedHead, head);
  assert.equal(git(r, 'rev-parse', branch), local);
});
test('regression: failed merged-head fetch is unknown, never evidence of unmerged commits', () => {
  const { r } = history(), missing = '1'.repeat(40);
  assertProtected(r, prHeads([missing]), /cannot verify/i);
});
test('regression: absent PR head metadata remains unknown and protected', () => {
  const { r } = history(); assertProtected(r, prHeads([null]), /cannot verify/i);
});
test('regression: unrelated histories cannot establish patch equivalence', () => {
  const { r } = history(); git(r, 'switch', '--orphan', 'unrelated');
  const head = commitFile(r, 'other.txt', 'other root'); git(r, 'switch', '-q', 'main');
  assertProtected(r, prHeads([head]), /cannot verify/i);
});
test('regression: a failed ancestry command does not become a deletion candidate', () => {
  const { r } = history();
  // Compare to a distinct descendant so that the ancestry command is required.
  git(r, 'switch', '-qc', 'remote-head', branch); const head = commitFile(r, 'review.txt', 'review'); git(r, 'switch', '-q', 'main');
  assertProtected(r, (cmd, args, opts) => cmd === 'git' && args.includes('merge-base')
    ? { code: 128, stdout: '', stderr: 'ancestry failed', found: true } : prHeads([head])(cmd, args, opts), /cannot verify/i);
});
test('regression: patch comparison failures and empty output remain protected', () => {
  const { r, local } = history(); git(r, 'switch', '-qc', 'remote-head', 'main');
  commitFile(r, 'other.txt', 'other'); git(r, 'cherry-pick', local); const head = git(r, 'rev-parse', 'HEAD'); git(r, 'switch', '-q', 'main');
  for (const code of [0, 128]) assertProtected(r, (cmd, args, opts) => cmd === 'git' && args[2] === 'cherry'
    ? { code, stdout: '', stderr: code ? 'patch check failed' : '', found: true } : prHeads([head])(cmd, args, opts), /cannot verify/i);
});
test('protects local merge commits even when cherry omits them', () => {
  const { r, local } = history(); git(r, 'switch', '-qc', 'remote-head', 'main');
  commitFile(r, 'remote.txt', 'remote'); git(r, 'cherry-pick', local); const head = git(r, 'rev-parse', 'HEAD');
  git(r, 'switch', '-q', branch); git(r, 'merge', '--no-ff', '-qm', 'local merge', 'main');
  // main is already an ancestor; create a true local-only merge with a side branch.
  git(r, 'switch', '-qc', 'side', 'main'); commitFile(r, 'side.txt', 'side');
  git(r, 'switch', '-q', branch); git(r, 'merge', '--no-ff', '-qm', 'local merge', 'side'); git(r, 'switch', '-q', 'main');
  assertProtected(r, prHeads([head]), /cannot verify.*merge commits/i);
});
test('protects divergent empty commits rather than treating absent patches as proof', () => {
  const r = repo(); const local = unmerged(r, branch);
  git(r, 'switch', '-qc', 'remote-head', 'main'); git(r, 'commit', '--allow-empty', '-qm', 'different empty commit');
  const head = git(r, 'rev-parse', 'HEAD'); assert.notEqual(local, head); git(r, 'switch', '-q', 'main');
  assertProtected(r, prHeads([head]), /branch kept/);
});
test('protects non-ancestor comparisons in shallow history', () => {
  const { r, local } = history(); const runner = prHeads([git(r, 'rev-parse', 'main')]);
  assertProtected(r, (cmd, args, opts) => cmd === 'git' && args.includes('--is-shallow-repository')
    ? { code: 0, stdout: 'true\n', stderr: '', found: true } : runner(cmd, args, opts), /cannot verify.*shallow/i);
  assert.equal(git(r, 'rev-parse', branch), local);
});
test('a failed fetch for one PR does not hide a later containing PR', () => {
  const { r, local } = history(); const d = done(r, {}, prHeads(['1'.repeat(40), local]));
  assert.equal(d.SquashMergeCandidates.find(c => c.Branch === branch)?.MergedHead, local);
  assert.equal(d.TipAheadOfMergedPr.some(c => c.Branch === branch), false);
});
test('a capped PR query remains unknown when no returned head contains the tip', () => {
  const { r } = history(); const head = git(r, 'rev-parse', 'main');
  assertProtected(r, prHeads(Array(1000).fill(head)), /cannot verify.*result limit/i);
});
test('new ancestry candidates still refuse force deletion from another worktree', () => {
  const { r } = history(); git(r, 'switch', '-qc', 'remote-head', branch);
  const head = commitFile(r, 'review.txt', 'review'); git(r, 'switch', '-q', 'main');
  const wt = join(temp(), 'wt'); git(r, 'worktree', 'add', '-q', wt, branch);
  const d = done(r, { forceDeleteBranches: [branch] }, prHeads([head]));
  assert.equal(d.SquashMergeCandidates.find(c => c.Branch === branch)?.MergedHead, head);
  assert.deepEqual(d.Deleted, []); assert.match(d.Refused[0].Reason, /worktree/);
  assert.ok(git(r, 'rev-parse', branch));
});
test('CLI discovery and automatic housekeeping verify containment and preserve unmerged work in a sandbox', () => {
  const { r, local } = history(); git(r, 'switch', '-qc', 'remote-head', branch);
  const head = commitFile(r, 'review.txt', 'review'); git(r, 'switch', '-q', 'main');
  // Mock only gh at the process boundary; the CLI, parser, JSON, two passes,
  // ancestry checks and branch deletions all run for real in this temp repo.
  const preload = put(temp(), 'gh.cjs', `const cp = require('node:child_process');
const spawn = cp.spawnSync;
cp.spawnSync = (cmd, args, opts) => cmd !== 'gh' ? spawn(cmd, args, opts) : {
  status: 0, stdout: JSON.stringify(args[args.indexOf('--head') + 1] === ${JSON.stringify(branch)}
    ? [{ url: 'https://example.invalid/pr/1', headRefOid: ${JSON.stringify(head)} }] : []), stderr: ''
};
require('node:module').syncBuiltinESMExports();\n`);
  const cli = (script: string, extra: string[] = []) => {
    const d = run(process.execPath, ['--require', preload, fileURLToPath(new URL(script, import.meta.url)),
      '--repo-root', r, '--default-branch', 'main', '--skip-pull', ...extra]);
    assert.equal(d.code, 0, d.stderr); return { output: JSON.parse(d.stdout), summary: d.stderr };
  };
  const discovery = cli('./invoke-done-housekeeping.ts').output;
  assert.equal(discovery.SquashMergeCandidates.find((c: { Branch: string }) => c.Branch === branch)?.MergedHead, head);
  assert.equal(git(r, 'rev-parse', branch), local);
  git(r, 'switch', '-q', branch); commitFile(r, 'unmerged.txt', 'keep'); git(r, 'switch', '-q', 'main');
  const protectedRun = cli('./invoke-housekeeping.ts');
  assert.equal(protectedRun.output.Escalate, true); assert.ok(git(r, 'rev-parse', branch));
  assert.match(protectedRun.summary, /not accounted for/);
  // Reset only the disposable fixture branch to exercise actual safe deletion.
  git(r, 'branch', '-f', branch, local);
  const applied = cli('./invoke-housekeeping.ts').output;
  assert.equal(applied.Escalate, false); assert.deepEqual(applied.Applied.Deleted, [branch]);
  assert.equal(git(r, 'branch', '--list', branch), '');
});
