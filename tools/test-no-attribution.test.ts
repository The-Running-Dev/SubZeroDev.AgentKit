import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib/process.ts';
import { getCommitRangeShas } from './test-no-attribution.ts';
const skipHook = !run('sh', ['--version']).found;
const hookPath = fileURLToPath(new URL('./git-hooks/commit-msg', import.meta.url));
function hook(lines: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'commit-msg-test-'));
  try {
    const path = join(root, 'message.txt'); writeFileSync(path, lines.join('\n') + '\n');
    const result = run('sh', [hookPath, path]);
    return { code: result.code, text: readFileSync(path, 'utf8').replace(/\r\n/g, '\n') };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('hook strips Claude trailer and preceding blank line', { skip: skipHook }, () => { assert.equal(hook(['Fix the thing', '', 'Co-authored-by: Claude <noreply@anthropic.com>']).text, 'Fix the thing\n'); });
test('hook strips Codex trailer', { skip: skipHook }, () => { assert.equal(hook(['Fix the thing', '', 'Co-authored-by: Codex <noreply@openai.com>']).text, 'Fix the thing\n'); });
test('hook strips Copilot trailer', { skip: skipHook }, () => { assert.equal(hook(['Fix the thing', '', 'Co-authored-by: Copilot <noreply@github.com>']).text, 'Fix the thing\n'); });
test('hook strips Generated with footer', { skip: skipHook }, () => { assert.equal(hook(['Fix the thing', '', 'Generated with [Claude Code](https://claude.com/claude-code)']).text, 'Fix the thing\n'); });
test('hook strips robot footer', { skip: skipHook }, () => { assert.equal(hook(['Fix the thing', '', '🤖 Generated with Claude Code']).text, 'Fix the thing\n'); });
test('hook leaves non-trigger message byte-identical', { skip: skipHook }, () => {
  const lines = ['Fix the thing', '', 'Body text that mentions a co-author is not the same trailer shape.']; assert.equal(hook(lines).text, lines.join('\n') + '\n');
});
test('hook never exits nonzero', { skip: skipHook }, () => { assert.equal(hook(['Fix the thing', '', 'Co-authored-by: Claude <noreply@anthropic.com>']).code, 0); });
let root: string; const shas: string[] = [];
before(() => {
  root = mkdtempSync(join(tmpdir(), 'no-attribution-test-'));
  const git = (...args: string[]) => { const r = run('git', args, { cwd: root }); assert.equal(r.code, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test');
  const messages = ['Clean commit, no attribution', 'Second clean commit, no attribution', 'Add a feature\n\nCo-authored-by: Claude <noreply@anthropic.com>', 'Add another feature\n\nGenerated with [Claude Code](https://claude.com/claude-code)'];
  for (const [i, message] of messages.entries()) { writeFileSync(join(root, 'file.txt'), String(i)); git('add', 'file.txt'); git('-c', 'core.hooksPath=', 'commit', '-q', '-m', message); shas.push(git('rev-parse', 'HEAD')); }
});
after(() => { if (root) rmSync(root, { recursive: true, force: true }); });
const gate = (base: string, head: string) => run(process.execPath, [fileURLToPath(new URL('./test-no-attribution.ts', import.meta.url)), '--base-sha', base, '--head-sha', head], { cwd: root });
test('gate passes a clean range', () => { assert.equal(gate(shas[0], shas[1]).code, 0); });
test('gate rejects a co-authored trailer', () => { assert.equal(gate(shas[0], shas[2]).code, 1); });
test('gate rejects a Generated with footer', () => { assert.equal(gate(shas[2], shas[3]).code, 1); });
test('first-push sentinel checks only the head', () => { assert.equal(gate('0'.repeat(40), shas[2]).code, 1); assert.equal(gate('0'.repeat(40), shas[0]).code, 0); });
test('missing head fails closed', () => { assert.throws(() => getCommitRangeShas(shas[0], '')); });
const install = readFileSync(new URL('../INSTALL.md', import.meta.url), 'utf8');
const installAll = readFileSync(new URL('../skills/install-all/SKILL.md', import.meta.url), 'utf8');
test('install phase 1 classifies the commit-msg hook', () => { assert.match(install, /\|\s*`\.git\/hooks\/commit-msg`\s*\|/); });
test('install phase 4 names the hook among written paths', () => { assert.match(install, /and `\.git\/hooks\/commit-msg` — nothing under `skills\/`/); });
test('install skips a custom hooksPath', () => { assert.match(install, /core\.hooksPath/); });
test('install does not overwrite an unowned hook', () => { assert.match(install, /Not overwrite, append to, or move aside a `commit-msg` hook/); });
test('install-all writes no git hooks', () => { assert.match(installAll, /No write to a target's `\.git\/hooks\/`/); });
