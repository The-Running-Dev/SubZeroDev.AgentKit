import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from './process.ts';
import type { Runner } from './process.ts';

export const temp = () => mkdtempSync(join(tmpdir(), 'agentkit-node-'));
export function put(root: string, file: string, text: string) {
  const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); return path;
}
export function git(root: string, ...args: string[]) {
  const r = run('git', ['-C', root, '-c', 'core.autocrlf=false', '-c', 'user.email=test@example.com', '-c', 'user.name=Test', ...args]);
  assert.equal(r.code, 0, `${args.join(' ')}: ${r.stderr}`); return r.stdout.trimEnd();
}
export function repo() { const root = temp(); git(root, 'init', '-q', '-b', 'main'); git(root, 'commit', '--allow-empty', '-qm', 'initial'); return root; }
export function unmerged(root: string, branch: string) {
  git(root, 'switch', '-qc', branch); git(root, 'commit', '--allow-empty', '-qm', 'branch work');
  const sha = git(root, 'rev-parse', 'HEAD'); git(root, 'switch', '-q', 'main'); return sha;
}
export function merged(root: string, branch = 'feature/foo', worktree?: string) {
  unmerged(root, branch); git(root, 'merge', '--no-ff', '-qm', 'merge', branch);
  if (worktree) git(root, 'worktree', 'add', '-q', worktree, branch);
}
export function fakeGh(branch = '', head = ''): Runner {
  return (command, args, options) => command !== 'gh' ? run(command, args, options) : {
    code: 0, found: true, stderr: '', stdout: JSON.stringify(args[args.indexOf('--head') + 1] === branch
      ? [{ number: 1, url: 'https://example.invalid/pr/1', mergeCommit: { oid: 'abc123' }, headRefOid: head }] : []),
  };
}
