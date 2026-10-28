import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { conversation } from './conversation.ts';
import { temp, put } from './lib/fixtures.ts';
import { run } from './lib/process.ts';

// Faults occur at the filesystem boundary in separate CLI processes. Everything
// else, including pending plans, receipts and retry delays, uses production code.
function fixture() {
  const root = temp();
  put(root, 'INDEX.md', '# Synthetic Notes\n<!-- notes -->\n');
  const request = { schemaVersion: 1, action: 'fork', branchId: 'synthetic', operationId: 'fork', date: '2026-10-28',
    parent: { uri: 'codex://threads/synthetic-parent', bookmark: 'Synthetic bookmark', question: 'Synthetic question?' },
    sources: [{ id: 'synthetic', file: put(root, 'source.txt', 'Synthetic source only.'), coverage: 'Synthetic excerpt', missing: [], uncertainty: [] }],
    handoff: [{ role: 'user', kind: 'exact', text: 'Synthetic source only.', refs: [{ sourceId: 'synthetic', startByte: 0, endByte: 22 }] }] };
  conversation(root, request);
  const log = join(root, 'fault-log');
  const preload = put(root, 'fault.cjs', `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
let count = 0, hostLock = false;
const method = process.env.FAULT_METHOD, original = fs[method];
fs[method] = function(...args) {
  const target = String(method === 'renameSync' ? args[1] : args[0]);
  if (method === 'rmSync' && target.endsWith('.conversation-lock') && fs.existsSync(target + '/owner.json')) hostLock = JSON.parse(fs.readFileSync(target + '/owner.json', 'utf8')).operationId === 'open';
  if (target.endsWith(process.env.FAULT_TARGET) && (method !== 'rmSync' || hostLock)) {
    count++; fs.appendFileSync(process.env.FAULT_LOG, 'attempt\\n');
    if (count <= Number(process.env.FAULT_COUNT)) throw Object.assign(new Error('Synthetic filesystem fault'), {code: process.env.FAULT_CODE});
  }
  return original.apply(this, args);
};
syncBuiltinESMExports();
`);
  const invoke = (tool: string, input: unknown, method: string, target: string, count = 2, code = 'EPERM') => {
    rmSync(log, { force: true });
    const requestFile = put(root, 'request.json', JSON.stringify(input));
    return run(process.execPath, ['--require', preload, resolve('tools', tool), '--archive-root', root, '--request-file', requestFile], {
      timeout: 20000, env: { ...process.env, FAULT_METHOD: method, FAULT_TARGET: target, FAULT_COUNT: String(count), FAULT_CODE: code, FAULT_LOG: log },
    });
  };
  const attempts = () => readFileSync(log, 'utf8').trim().split('\n').length;
  return { root, request, preload, log, invoke, attempts };
}

test('host CLI retries lock cleanup through prepare, dispatch, record and replay without releasing a second call', () => {
  const f = fixture();
  const create = 'mcp__codex_app__create_thread';
  const prepare = { schemaVersion: 1, action: 'prepare', branchId: 'synthetic', operationId: 'open', expectedRevision: 1, intent: 'open',
    capabilities: { host: 'codex', tools: [create], evidence: 'Synthetic contract fixture' }, authorization: { create: true } };
  const control = (action: string, extra = {}) => ({ schemaVersion: 1, action, branchId: 'synthetic', operationId: 'open', ...extra });
  try {
    const cases = [prepare, control('dispatch'), control('record', { status: 'success', observedTool: create, detail: 'Synthetic confirmed result', threadId: 'synthetic-child' }), control('dispatch')];
    for (const [i, request] of cases.entries()) {
      const result = f.invoke('conversation-host.ts', request, 'rmSync', '.conversation-lock');
      assert.equal(result.code, 0, result.stderr);
      assert.equal(f.attempts(), 3);
      const receipt = JSON.parse(result.stdout);
      assert.equal(receipt.Call?.tool ?? null, i === 1 ? create : null);
      assert.equal(receipt.State, ['prepared', 'unknown', 'success', 'success'][i]);
      assert.equal(existsSync(join(f.root, '.conversation-lock')), false);
    }
    const exhausted = f.invoke('conversation-host.ts', prepare, 'rmSync', '.conversation-lock', 99);
    assert.notEqual(exhausted.code, 0); assert.match(exhausted.stderr, /Synthetic filesystem fault/);
    assert.equal(f.attempts(), 11);
    assert.equal(JSON.parse(readFileSync(join(f.root, 'Journal/raw/conversation-synthetic/open.host-operation.json'), 'utf8')).state, 'success');
    assert.ok(existsSync(join(f.root, '.conversation-lock')));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('portable CLI retries rename, preserves target and pending plan on exhaustion, and recovers the exact request', () => {
  const f = fixture();
  const target = 'General/2026-10-28-conversation-synthetic.md';
  const attach = { schemaVersion: 1, action: 'attach', branchId: 'synthetic', operationId: 'attach', expectedRevision: 1, handoff: f.request.handoff };
  try {
    assert.ok(existsSync(join(f.root, target)));
    const before = readFileSync(join(f.root, target));
    const exhausted = f.invoke('conversation.ts', attach, 'renameSync', target.replaceAll('/', sep), 99);
    assert.notEqual(exhausted.code, 0); assert.equal(f.attempts(), 11);
    assert.deepEqual(readFileSync(join(f.root, target)), before);
    assert.ok(existsSync(join(f.root, '.conversation-pending.json')));
    assert.equal(existsSync(join(f.root, '.conversation-lock')), false);
    const recovered = f.invoke('conversation.ts', attach, 'renameSync', target.replaceAll('/', sep));
    assert.equal(recovered.code, 0, recovered.stderr); assert.equal(f.attempts(), 3);
    assert.equal(JSON.parse(recovered.stdout).Revision, 2);
    assert.equal(existsSync(join(f.root, '.conversation-pending.json')), false);
    const replay = f.invoke('conversation.ts', attach, 'renameSync', target.replaceAll('/', sep));
    assert.equal(replay.code, 0, replay.stderr); assert.equal(JSON.parse(replay.stdout).Revision, 2);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('atomic rename fails immediately for non-transient errors and never deletes the destination', () => {
  const f = fixture();
  const destination = put(f.root, 'target.txt', 'Original synthetic bytes');
  const driver = put(f.root, 'driver.mjs', `import { atomic } from ${JSON.stringify(pathToFileURL(resolve('tools/conversation.ts')).href)}; atomic(${JSON.stringify(destination)}, Buffer.from('Replacement'));`);
  try {
    const result = run(process.execPath, ['--require', f.preload, driver], { env: { ...process.env, FAULT_METHOD: 'renameSync', FAULT_TARGET: 'target.txt', FAULT_COUNT: '99', FAULT_CODE: 'EIO', FAULT_LOG: f.log } });
    assert.notEqual(result.code, 0); assert.equal(f.attempts(), 1);
    assert.equal(readFileSync(destination, 'utf8'), 'Original synthetic bytes');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('Windows atomic replacement survives a real destination handle without delete sharing', { skip: process.platform !== 'win32' }, async () => {
  const root = temp(), destination = put(root, 'target.txt', 'Original synthetic bytes'), ready = join(root, 'ready'), release = join(root, 'release');
  const driver = put(root, 'driver.mjs', `
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const rename = fs.renameSync;
fs.renameSync = (...args) => { try { return rename(...args); } catch (error) { fs.writeFileSync(${JSON.stringify(release)}, error.code); throw error; } };
syncBuiltinESMExports();
const { atomic } = await import(${JSON.stringify(pathToFileURL(resolve('tools/conversation.ts')).href)});
atomic(${JSON.stringify(destination)}, Buffer.from('Replacement'));
`);
  const script = `$stream = [IO.File]::Open($env:HOLD_TARGET, 'Open', 'Read', 'ReadWrite'); try { [IO.File]::WriteAllText($env:HOLD_READY, 'ready'); $deadline = [DateTime]::UtcNow.AddSeconds(10); while (!(Test-Path -LiteralPath $env:HOLD_RELEASE) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 10 } } finally { $stream.Dispose() }`;
  const holder = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    windowsHide: true, stdio: 'ignore', env: { ...process.env, HOLD_TARGET: destination, HOLD_READY: ready, HOLD_RELEASE: release },
  });
  const exited = new Promise<void>((resolve, reject) => { holder.once('exit', () => resolve()); holder.once('error', reject); });
  try {
    const deadline = Date.now() + 10000;
    while (!existsSync(ready)) {
      if (Date.now() > deadline) throw new Error('Synthetic Windows holder did not start');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(readFileSync(destination, 'utf8'), 'Original synthetic bytes');
    const result = run(process.execPath, [driver], { timeout: 15000 });
    assert.equal(result.code, 0, result.stderr);
    assert.match(readFileSync(release, 'utf8'), /^(EPERM|EACCES|EBUSY)$/);
    assert.equal(readFileSync(destination, 'utf8'), 'Replacement');
  } finally {
    holder.kill(); await exited;
    rmSync(root, { recursive: true, force: true });
  }
});
