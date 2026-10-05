import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { resolveExecutable } from './executable.ts';
import { put, temp } from './fixtures.ts';
test('resolves an npm cmd shim to its JavaScript entry without executing shell text', () => { const r = temp(); put(r, 'codex.cmd', '@echo off\n"%_prog%" "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*'); const entry = put(r, 'node_modules/@openai/codex/bin/codex.js', ''); assert.deepEqual(resolveExecutable('codex', { PATH: r }, 'win32'), { command: process.execPath, args: [entry] }); });
test('refuses an unknown cmd shim rather than using a shell', () => { const r = temp(); put(r, 'codex.cmd', 'echo untrusted %*'); assert.throws(() => resolveExecutable('codex', { PATH: r }, 'win32'), /Cannot safely resolve/); });
test('distinguishes a missing executable and a missing shim entry', () => { const r = temp(); assert.throws(() => resolveExecutable('codex', { PATH: r }, 'win32'), /not found/); put(r, 'codex.cmd', '"%dp0%\\missing.js"'); assert.throws(() => resolveExecutable('codex', { PATH: r }, 'win32'), /does not exist/); assert.equal(join(r, 'missing.js').length > 0, true); });
