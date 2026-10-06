import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getNextSlice } from './get-next-slice.ts';
import type { NextInput } from './get-next-slice.ts';
import { temp, put, git } from './lib/fixtures.ts';
const plan = '# Slices\n\n## S1 - First\nStatus: todo\nDepends on: none\n\n## S2 - Second\nStatus: todo\nDepends on: S1\n\n## S3 - Third\nStatus: todo\nDepends on: none\n\n## Landed\n| S0 | retired |\n';
function writePlan(root: string, text: string) { put(root, 'design/30-slices.md', text); git(root, 'add', 'design/30-slices.md'); git(root, 'commit', '-qm', 'plan'); }
function fixture(text = plan) {
  const base = temp(), origin = join(base, 'origin.git'), seed = join(base, 'seed'), work = join(base, 'work');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin); git(base, 'clone', '-q', origin, seed);
  writePlan(seed, text); git(seed, 'push', '-q', 'origin', 'main'); git(base, 'clone', '-q', origin, work);
  return { origin, seed, work };
}
const pr = (number: number, headRefName: string, baseRefName = 'main', isCrossRepository = false) => ({ number, headRefName, baseRefName, isCrossRepository, url: `https://example.test/pull/${number}` });
const next = (f: ReturnType<typeof fixture>, prs: ReturnType<typeof pr>[] = [], extra: NextInput = {}) => getNextSlice({ repoRoot: f.work, pullRequestsJson: JSON.stringify(prs), ...extra });
test('starts the first slice whose dependencies are done', () => { const r = next(fixture()); assert.equal(r.State, 'Start'); assert.equal(r.Slice, 'S1'); assert.equal(r.Base, 'origin/main'); assert.deepEqual(r.DirtyFiles, []); });
test('resumes the branch instead of trusting its unmerged done status', () => { const f = fixture(); git(f.work, 'switch', '-qc', 'slice/S1-first'); writePlan(f.work, plan.replace('Status: todo', 'Status: done')); const r = next(f); assert.equal(r.State, 'Resume'); assert.equal(r.Reason, 'UnmergedBranch'); assert.equal(r.Slice, 'S1'); });
test('resumes a later open PR before starting an earlier slice', () => { const r = next(fixture(), [pr(42, 'slice/S3-third')]); assert.equal(r.Reason, 'OpenPullRequest'); assert.equal(r.Slice, 'S3'); assert.equal(r.PullRequest, 42); });
test('does not mistake S10 for S1', () => { const r = next(fixture(), [pr(7, 'slice/S10-other')]); assert.equal(r.State, 'Start'); assert.equal(r.Slice, 'S1'); });
test('ignores an origin slice branch already contained by main', () => { const f = fixture(); git(f.seed, 'push', '-q', 'origin', 'main:slice/S1-first'); assert.equal(next(f).State, 'Start'); });
test('ignores forks and other bases and blocks on ambiguous PRs', () => { const f = fixture(); assert.equal(next(f, [pr(5, 'slice/S3-third', 'main', true), pr(6, 'slice/S3-third', 'release')]).State, 'Start'); const r = next(f, [pr(8, 'slice/S3-third'), pr(9, 'slice/S3-again')]); assert.equal(r.Reason, 'AmbiguousPullRequest'); assert.match(r.Detail!, /#8 slice\/S3-third, #9 slice\/S3-again/); });
test('resumes an empty branch and separates owned edits from guarded files', () => { const f = fixture(); put(f.work, 'notes/user.txt', 'user'); next(f); git(f.work, 'switch', '-qc', 'slice/S1-first', 'origin/main'); put(f.work, 'src/impl.txt', 'own'); const r = next(f); assert.equal(r.Reason, 'EmptyBranch'); assert.deepEqual(r.GuardedFiles, ['notes/user.txt']); assert.deepEqual(r.OwnFiles, ['src/impl.txt']); });
test('keeps edits made after the first commit as owned', () => { const f = fixture(); put(f.work, 'notes/user.txt', 'user'); next(f); git(f.work, 'switch', '-qc', 'slice/S1-first'); put(f.work, 'src/a.txt', 'committed'); git(f.work, 'add', 'src/a.txt'); git(f.work, 'commit', '-qm', 'first'); put(f.work, 'src/a.txt', 'edited'); put(f.work, 'src/b.txt', 'new'); const r = next(f); assert.equal(r.Reason, 'UnmergedBranch'); assert.deepEqual(r.GuardedFiles, ['notes/user.txt']); assert.deepEqual(r.OwnFiles.sort(), ['src/a.txt', 'src/b.txt']); });
test('guards all dirty files without an ownership record', () => { const f = fixture(); git(f.work, 'switch', '-qc', 'slice/S1-first'); put(f.work, 'src/impl.txt', 'unknown'); const r = next(f); assert.deepEqual(r.GuardedFiles, ['src/impl.txt']); assert.deepEqual(r.OwnFiles, []); });
test('does not reuse another slice ownership record', () => { const f = fixture(); next(f, [], { slice: 'S3' }); git(f.work, 'switch', '-qc', 'slice/S1-first'); put(f.work, 'src/impl.txt', 'unknown'); assert.deepEqual(next(f).GuardedFiles, ['src/impl.txt']); });
test('reads origin plan when local main is behind', () => { const f = fixture(); writePlan(f.seed, plan.replace('Status: todo', 'Status: done')); git(f.seed, 'push', '-q', 'origin', 'main'); assert.equal(next(f).Slice, 'S2'); assert.match(readFileSync(join(f.work, 'design/30-slices.md'), 'utf8'), /S1 - First\nStatus: todo/); });
test('reports the git error on failed fetch', () => { const f = fixture(); git(f.work, 'remote', 'set-url', 'origin', join(f.work, 'missing.git')); const r = next(f); assert.equal(r.State, 'Blocked'); assert.equal(r.Reason, 'FetchFailed'); assert.match(r.Detail!, /missing/); });
test('reports finished with Landed slices', () => { const r = next(fixture('## S4 - Last\nStatus: done\nDepends on: S0\n\n## Landed\n| S0 | old |\n')); assert.equal(r.State, 'Finished'); assert.equal(r.Reason, ''); });
test('blocks when dependencies prevent all starts', () => { const r = next(fixture('## S1 - A\nStatus: todo\nDepends on: S2\n\n## S2 - B\nStatus: todo\nDepends on: S1\n')); assert.equal(r.Reason, 'NoEligibleSlice'); assert.match(r.Detail!, /S1 waits on S2; S2 waits on S1/); });
test('lists and preserves dirty files and current branch', () => { const f = fixture(); put(f.work, 'notes/scratch.txt', 'user'); put(f.work, 'design/30-slices.md', plan + 'user edit'); const before = git(f.work, 'status', '--porcelain'); const r = next(f); assert.deepEqual(r.GuardedFiles.sort(), ['design/30-slices.md', 'notes/scratch.txt']); assert.deepEqual(r.OwnFiles, []); assert.equal(git(f.work, 'status', '--porcelain'), before); assert.equal(git(f.work, 'branch', '--show-current'), 'main'); });
test('takes an explicit slice and refuses an already completed slice', () => { assert.equal(next(fixture(), [], { slice: 'S3' }).Slice, 'S3'); const r = next(fixture('## S1 - A\nStatus: done\n'), [], { slice: '1' }); assert.equal(r.State, 'Blocked'); assert.equal(r.Reason, 'AlreadyDone'); });
test('accepts a single pull request object as gh and PowerShell did', () => { const f = fixture(); const r = getNextSlice({ repoRoot: f.work, pullRequestsJson: JSON.stringify(pr(42, 'slice/S3-third')) }); assert.equal(r.Reason, 'OpenPullRequest'); assert.equal(r.PullRequest, 42); });
