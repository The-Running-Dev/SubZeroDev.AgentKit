import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { run } from './lib/process.ts';
import { join } from 'node:path';
import { housekeeping, housekeepingSummary } from './invoke-housekeeping.ts';
import { temp, repo, put, git, merged, unmerged, fakeGh } from './lib/fixtures.ts';
const tidy = (root: string, runner = fakeGh()) => housekeeping({ repoRoot: root, defaultBranch: 'main', skipPull: true }, runner);
function hook(root: string) { const p = put(root, '.git/hooks/post-checkout', '#!/bin/sh\nprintf dirty > newly-dirty.txt\n'); chmodSync(p, 0o755); }
test('deletes proven merged branches without escalation', () => { const r = repo(); merged(r); const d = tidy(r); assert.equal(d.Escalate, false); assert.deepEqual(d.Applied!.Deleted, ['feature/foo']); assert.equal(git(r, 'branch', '--list', 'feature/foo'), ''); });
test('renders pull state as words instead of a bare boolean', () => { const r = repo(); merged(r); const summary = housekeepingSummary(tidy(r)); assert.match(summary, /\(not pulled\)/); assert.doesNotMatch(summary, /\bTrue\b|\bFalse\b|exit code/); });
test('preserves tracked and untracked work without stashing', () => { const r = repo(); put(r, 'tracked.txt', 'committed'); git(r, 'add', 'tracked.txt'); git(r, 'commit', '-qm', 'tracked'); merged(r); git(r, 'switch', '-q', 'feature/foo'); put(r, 'tracked.txt', 'my edit'); put(r, 'scratch.txt', 'scratch'); const d = tidy(r); assert.equal(d.Escalate, false); assert.deepEqual(d.Applied!.Deleted, ['feature/foo']); assert.equal(readFileSync(join(r, 'tracked.txt'), 'utf8'), 'my edit'); assert.equal(readFileSync(join(r, 'scratch.txt'), 'utf8'), 'scratch'); assert.equal(git(r, 'stash', 'list'), ''); });
test('escalates and explains commits beyond the merged PR head', () => { const r = repo(), tip = unmerged(r, 'fix/ahead'); git(r, 'switch', '-q', 'fix/ahead'); git(r, 'commit', '--allow-empty', '-qm', 'later'); git(r, 'switch', '-q', 'main'); const d = tidy(r, fakeGh('fix/ahead', tip)); assert.equal(d.Escalate, true); assert.equal(d.Discover.TipAheadOfMergedPr[0].Branch, 'fix/ahead'); assert.ok(git(r, 'rev-parse', 'fix/ahead')); assert.match(housekeepingSummary(d), /Kept fix\/ahead:.*\(TipAheadOfMergedPr\)/); });
test('explains refused safe deletion and keeps the branch', () => { const r = repo(), wt = join(temp(), 'wt'); merged(r, 'feature/foo', wt); const d = tidy(r); assert.equal(d.Escalate, true); assert.equal(d.Applied!.Refused[0].Branch, 'feature/foo'); assert.ok(git(r, 'rev-parse', 'feature/foo')); assert.match(housekeepingSummary(d), /Kept feature\/foo: Git refused the safe delete.*\(Refused\)/); });
test('escalates when the apply pass becomes dirty after discovery', () => { const r = repo(); merged(r); hook(r); const d = tidy(r); assert.equal(d.Discover.Stopped, false); assert.equal(d.Applied!.Reason, 'DirtyTree'); assert.equal(d.Escalate, true); assert.ok(git(r, 'branch', '--list', 'feature/foo')); assert.match(housekeepingSummary(d), /Stopped during apply: DirtyTree/); });
test('retains discovery summary when the apply pass stops', () => { const r = repo(); merged(r); hook(r); assert.match(housekeepingSummary(tidy(r)), /Default branch: main \(not pulled\)/); });

// Exercise the actual CLI with real Git, replacing only gh in the child process.
test('CLI reports unavailable GitHub evidence and preserves the branch', () => {
  const r = repo(); unmerged(r, 'feature');
  const preload = put(temp(), 'gh-unavailable.cjs', `
    const cp = require('node:child_process');
    const original = cp.spawnSync;
    cp.spawnSync = (cmd, args, opts) => cmd === 'gh'
      ? { status: 1, stdout: '', stderr: 'GitHub unavailable' } : original(cmd, args, opts);
    require('node:module').syncBuiltinESMExports();
  `);
  const output = run(process.execPath, ['--require', preload, fileURLToPath(new URL('./invoke-housekeeping.ts', import.meta.url)),
    '--repo-root', r, '--default-branch', 'main', '--skip-pull']);
  assert.equal(output.code, 0, output.stderr);
  const data = JSON.parse(output.stdout);
  assert.equal(data.Escalate, true); assert.deepEqual(data.Applied.Deleted, []);
  assert.equal(data.Discover.TipAheadOfMergedPr.length, 0);
  assert.match(output.stderr, /Kept feature:.*GitHub unavailable.*UnknownMergedPrEvidence/);
  assert.doesNotMatch(output.stderr, /it has commits that no merged pull request accounts for/);
  assert.ok(git(r, 'rev-parse', 'feature'));
});
test('CLI deletes a sandbox ancestor candidate and retains genuine extra work', () => {
  const r = repo(); const ancestor = unmerged(r, 'contained'); git(r, 'switch', '-q', 'contained');
  git(r, 'commit', '--allow-empty', '-qm', 'review fix'); const head = git(r, 'rev-parse', 'HEAD');
  git(r, 'switch', '-q', 'main'); git(r, 'branch', '-f', 'contained', ancestor);
  git(r, 'branch', 'ahead', head); git(r, 'switch', '-q', 'ahead');
  git(r, 'commit', '--allow-empty', '-qm', 'unmerged'); git(r, 'switch', '-q', 'main');
  const preload = put(temp(), 'gh-merged.cjs', `
    const cp = require('node:child_process');
    const original = cp.spawnSync;
    cp.spawnSync = (cmd, args, opts) => cmd === 'gh' ? { status: 0, stderr: '', stdout: JSON.stringify([
      { url: 'https://example.invalid/pr/1', headRefOid: '${head}', mergeCommit: { oid: '${head}' }, isCrossRepository: false }
    ]) } : original(cmd, args, opts);
    require('node:module').syncBuiltinESMExports();
  `);
  const output = run(process.execPath, ['--require', preload, fileURLToPath(new URL('./invoke-housekeeping.ts', import.meta.url)),
    '--repo-root', r, '--default-branch', 'main', '--skip-pull']);
  assert.equal(output.code, 0, output.stderr); const data = JSON.parse(output.stdout);
  assert.deepEqual(data.Applied.Deleted, ['contained']);
  assert.equal(data.Escalate, true); assert.equal(data.Discover.TipAheadOfMergedPr[0].Branch, 'ahead');
  assert.ok(git(r, 'rev-parse', 'ahead')); assert.equal(git(r, 'branch', '--list', 'contained'), '');
});
