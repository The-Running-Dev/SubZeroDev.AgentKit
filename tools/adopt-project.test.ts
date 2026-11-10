import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adoptProject } from './adopt-project.ts';
import { getNextSlice } from './get-next-slice.ts';
import { git, put, temp } from './lib/fixtures.ts';
import { run } from './lib/process.ts';

const kit = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plan = '## S1 - First\nStatus: todo\nDepends on: none\n\n## S2 - Second\nStatus: todo\nDepends on: S1\n';
function fixture() {
  const base = temp(), origin = join(base, 'origin.git'), repo = join(base, 'project'), source = join(base, 'prepared plan.md');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin); git(base, 'clone', '-q', origin, repo);
  put(repo, 'source.txt', 'existing'); git(repo, 'add', 'source.txt'); git(repo, 'commit', '-qm', 'existing project'); git(repo, 'push', '-q', 'origin', 'main');
  git(repo, 'remote', 'set-head', 'origin', 'main'); git(repo, 'switch', '-qc', 'plan/adopt'); put(base, 'prepared plan.md', plan);
  return { base, repo, source };
}
test('entry points adopt a missing remote plan and select two successive slices after delivery', () => {
  const f = fixture(), cli = (name: string, args: string[]) => {
    const result = run(process.execPath, [join(kit, 'tools', name), ...args], { cwd: f.repo });
    assert.equal(result.code, 0, result.stderr + result.stdout); return JSON.parse(result.stdout);
  };
  assert.equal(cli('get-next-slice.ts', ['--repo-root', f.repo]).State, 'Prepare');
  put(f.repo, 'private-user.txt', 'leave alone');
  const prepared = cli('adopt-project.ts', ['--repo-root', f.repo, '--plan', f.source]);
  assert.equal(prepared.State, 'Publish'); assert.ok(prepared.Written.includes('AGENTS.md'));
  assert.equal(cli('get-next-slice.ts', ['--repo-root', f.repo]).State, 'Prepare');
  const remoteAdvance = (message: string) => { git(f.repo, 'add', 'design/30-slices.md'); git(f.repo, 'commit', '-qm', message); git(f.repo, 'push', '-q', 'origin', 'HEAD:main'); };
  // This disposable bare remote simulates the guarded delivery boundary; it does not test GitHub review/merge.
  remoteAdvance('adopt');
  assert.equal(cli('get-next-slice.ts', ['--repo-root', f.repo, '--pull-requests-json', '[]']).Slice, 'S1');
  put(f.repo, 'design/30-slices.md', plan.replace('Status: todo', 'Status: done')); remoteAdvance('first');
  assert.equal(cli('get-next-slice.ts', ['--repo-root', f.repo, '--pull-requests-json', '[]']).Slice, 'S2');
  put(f.repo, 'design/30-slices.md', plan.replaceAll('Status: todo', 'Status: done')); remoteAdvance('second');
  assert.equal(getNextSlice({ repoRoot: f.repo, pullRequestsJson: '[]' }).State, 'Finished');
  assert.equal(readFileSync(join(f.repo, 'private-user.txt'), 'utf8'), 'leave alone');
});
test('adoption is repeatable and never overwrites divergent project documents', () => {
  const f = fixture(); adoptProject({ repoRoot: f.repo, plan: f.source }, kit);
  assert.deepEqual(adoptProject({ repoRoot: f.repo, plan: f.source }, kit).Written, []);
  put(f.base, 'prepared plan.md', plan + 'changed');
  assert.throws(() => adoptProject({ repoRoot: f.repo, plan: f.source }, kit), /Preserving divergent/);
  assert.equal(readFileSync(join(f.repo, 'design/30-slices.md'), 'utf8'), plan);
});
test('invalid plans and default-branch adoption are refused before writing project files', () => {
  const f = fixture(); put(f.base, 'prepared plan.md', '# no reconciled slices');
  assert.throws(() => adoptProject({ repoRoot: f.repo, plan: f.source }, kit), /unique/);
  put(f.base, 'prepared plan.md', plan); git(f.repo, 'switch', '-q', 'main');
  assert.throws(() => adoptProject({ repoRoot: f.repo, plan: f.source }, kit), /default branch/);
  assert.equal(existsSync(join(f.repo, 'design')), false);
});

test('adoption preserves an occupied design directory before creating any kit documents', () => {
  const f = fixture(); put(f.repo, 'design/mockup.svg', 'project assets');
  assert.throws(() => adoptProject({ repoRoot: f.repo, plan: f.source }, kit), /occupied design/);
  assert.equal(existsSync(join(f.repo, 'design/30-slices.md')), false);
  assert.equal(existsSync(join(f.repo, 'AGENTS.md')), false);
  assert.equal(readFileSync(join(f.repo, 'design/mockup.svg'), 'utf8'), 'project assets');
});
