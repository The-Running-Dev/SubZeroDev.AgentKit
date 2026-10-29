import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSkill, readState, updatePolicy } from './get-agentkit-skill.ts';
import { put, temp } from './lib/fixtures.ts';
import { run } from './lib/process.ts';
import type { ProcessResult } from './lib/process.ts';

const entry = fileURLToPath(new URL('./get-agentkit-skill.ts', import.meta.url));
const commands = [
  { name: 'update policy', args: ['--update-policy', 'auto'], file: 'config.json', policy: 'auto' },
  { name: 'legacy On', args: ['--set-auto-update', 'On'], file: 'config.json', policy: 'ask' },
  { name: 'legacy Off', args: ['--set-auto-update', 'Off'], file: 'config.json', policy: 'off' },
  { name: 'snooze', args: ['--snooze-update'], file: 'update-check.json', policy: undefined },
];
const secret = 'private-setting-must-not-appear';
const statePath = (home: string, file: string) => join(home, '.agent-kit-state', file);
const invoke = (home: string, args: string[], preload?: string) => run(process.execPath, [
  ...(preload ? ['--require', preload] : []), entry, ...args,
], { env: { ...process.env, HOME: home, USERPROFILE: home } });
function refused(result: ProcessResult, path: string, problem: RegExp) {
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.ok(result.stderr.includes(path), result.stderr);
  assert.match(result.stderr, problem);
  assert.match(result.stderr, /then retry; nothing was written/);
  assert.doesNotMatch(result.stderr, new RegExp(secret));
}

for (const command of commands) {
  test(`${command.name}: malformed JSON is refused without changing its bytes or disclosing it`, t => {
    const home = temp(); t.after(() => rmSync(home, { recursive: true, force: true }));
    const path = put(home, `.agent-kit-state/${command.file}`, `{"private":"${secret}",\r\n`);
    const before = readFileSync(path);
    refused(invoke(home, command.args), path, /not valid JSON.*Back up and fix it, or move it aside/);
    assert.deepEqual(readFileSync(path), before);
  });

  test(`${command.name}: every non-object JSON shape is refused and left byte-identical`, t => {
    const home = temp(); t.after(() => rmSync(home, { recursive: true, force: true }));
    for (const text of ['null', '[]', `["${secret}"]`, `"${secret}"`, '42', 'true', 'false']) {
      const path = put(home, `.agent-kit-state/${command.file}`, ` \r\n${text}\r\n`), before = readFileSync(path);
      refused(invoke(home, command.args), path, /does not hold a JSON object.*Back up and fix it, or move it aside/);
      assert.deepEqual(readFileSync(path), before);
    }
  });

  test(`${command.name}: unreadable existing files are refused even when an existence probe fails`, t => {
    const home = temp(); t.after(() => rmSync(home, { recursive: true, force: true }));
    const path = put(home, `.agent-kit-state/${command.file}`, ` {"private":"${secret}"}\r\n`), before = readFileSync(path);
    // Inject at the filesystem boundary in a child process: chmod is ineffective
    // under root and differs on Windows. The file and all writes remain real.
    for (const code of ['EACCES', 'EPERM', 'EIO']) {
      const preload = put(home, 'unreadable.cjs', `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const target = ${JSON.stringify(path)}, read = fs.readFileSync, exists = fs.existsSync;
fs.readFileSync = function(file, ...args) {
  if (String(file) === target) throw Object.assign(new Error(${JSON.stringify(secret)}), { code: ${JSON.stringify(code)} });
  return read.call(this, file, ...args);
};
fs.existsSync = function(file) { return String(file) === target ? false : exists.call(this, file); };
syncBuiltinESMExports();
`);
      refused(invoke(home, command.args, preload), path, new RegExp(`Cannot read.*${code}.*permissions and accessibility`));
      assert.deepEqual(readFileSync(path), before);
    }
  });

  test(`${command.name}: a missing state file can be initialized`, t => {
    const home = temp(); t.after(() => rmSync(home, { recursive: true, force: true }));
    const result = invoke(home, command.args);
    assert.equal(result.code, 0, result.stderr); assert.equal(result.stderr, '');
    const saved = JSON.parse(readFileSync(statePath(home, command.file), 'utf8'));
    if (command.policy) assert.deepEqual(saved, { updatePolicy: command.policy });
    else { assert.deepEqual(Object.keys(saved), ['snoozedUntil']); assert.ok(Date.parse(saved.snoozedUntil) > Date.now()); }
  });

  test(`${command.name}: valid unrelated settings, including modelProfiles, survive`, t => {
    const home = temp(); t.after(() => rmSync(home, { recursive: true, force: true }));
    const unrelated = { modelProfiles: { implement: { openai: { effort: 'high' }, anthropic: { model: 'sonnet' } } }, other: { keep: [1, true, null] }, sessions: ['existing-session'] };
    put(home, `.agent-kit-state/${command.file}`, JSON.stringify({ ...unrelated, ...(command.policy ? { autoUpdate: false, updatePolicy: 'off' } : { snoozedUntil: '2000-01-01T00:00:00Z' }) }));
    const otherFile = command.file === 'config.json' ? 'update-check.json' : 'config.json';
    const otherPath = put(home, `.agent-kit-state/${otherFile}`, ` {"private":"${secret}"}\r\n`), otherBefore = readFileSync(otherPath);
    const result = invoke(home, command.args);
    assert.equal(result.code, 0, result.stderr);
    const saved = JSON.parse(readFileSync(statePath(home, command.file), 'utf8'));
    if (command.policy) assert.deepEqual(saved, { ...unrelated, updatePolicy: command.policy });
    else { assert.ok(Date.parse(saved.snoozedUntil) > Date.now()); delete saved.snoozedUntil; assert.deepEqual(saved, unrelated); }
    assert.deepEqual(readFileSync(otherPath), otherBefore);
  });
}

test('passive skill reading tolerates invalid state without replacing either state file', t => {
  const home = temp(); t.after(() => rmSync(home, { recursive: true, force: true }));
  const root = join(home, 'kit'); put(root, 'skills/next/SKILL.md', 'Synthetic skill body.');
  put(home, '.agent-kit-state/installed.json', JSON.stringify({ installRoot: root, version: 'abcdef1' }));
  for (const text of [`{"private":"${secret}",`, 'null', '[1, 2]']) {
    const config = put(home, '.agent-kit-state/config.json', text), state = put(home, '.agent-kit-state/update-check.json', text);
    const before = readFileSync(state);
    assert.deepEqual(readState(config), {}); assert.equal(updatePolicy(home, {}), 'ask');
    const content = getSkill('next', { root, home, env: { CODEX_THREAD_ID: 'synthetic' }, runner: () => ({ code: 0, found: true, stdout: 'abcdef1', stderr: '' }) });
    assert.match(content, /Synthetic skill body/);
    assert.deepEqual(readFileSync(config), before); assert.deepEqual(readFileSync(state), before);
  }
});
