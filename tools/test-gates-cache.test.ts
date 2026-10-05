import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { testGatesCache } from './test-gates-cache.ts';
import { temp, put } from './lib/fixtures.ts';
const gates = '[{"name":"Node","command":"node --test tools/"}]';
function fixture(write = false) { const r = temp(); put(r, '.github/workflows/ci.yml', 'on: push\n'); if (write) testGatesCache(r, true, gates); return r; }
function corrupt(r: string, gates: unknown) { const c = JSON.parse(readFileSync(join(r, '.claude/gates.json'), 'utf8')); c.gates = gates; put(r, '.claude/gates.json', JSON.stringify(c)); }
test('cache is Missing before writing', () => { assert.equal(testGatesCache(fixture()).Status, 'Missing'); });
test('cache is Fresh with cached gates for an unchanged manifest', () => { const r = testGatesCache(fixture(true)); assert.equal(r.Status, 'Fresh'); assert.deepEqual(r.Gates, JSON.parse(gates)); });
test('workflow edits invalidate the cache', () => { const r = fixture(true); put(r, '.github/workflows/ci.yml', 'on: pull_request\n'); assert.equal(testGatesCache(r).Status, 'Stale'); });
test('null gates are Stale under a matching hash', () => { const r = fixture(true); corrupt(r, null); const c = testGatesCache(r); assert.equal(c.Status, 'Stale'); assert.deepEqual(c.Gates, []); });
test('empty gates are Stale under a matching hash', () => { const r = fixture(true); corrupt(r, []); assert.equal(testGatesCache(r).Status, 'Stale'); });
test('rejects writes without a nonempty usable gate array', () => { for (const value of ['not-a-gate', { name: 'Node', command: 'node' }, [], [{ name: ' ', command: 'node' }], [{ name: 'Node', command: null }], [{ name: 1, command: 'node' }], [{ name: 'Node' }], [...JSON.parse(gates), null]]) { const r = fixture(); assert.throws(() => testGatesCache(r, true, JSON.stringify(value))); assert.equal(existsSync(join(r, '.claude/gates.json')), false); } });
test('malformed cached gates are Stale', () => { for (const value of ['not-a-gate', { name: 'Node', command: 'node' }, [...JSON.parse(gates), null], [{ name: 'Node', command: ' ' }], [{ name: 'Node', command: 42 }], [{ command: 'node' }]]) { const r = fixture(true); corrupt(r, value); const c = testGatesCache(r); assert.equal(c.Status, 'Stale'); assert.deepEqual(c.Gates, []); } });
test('invalid cache JSON is Stale', () => { const r = fixture(true); put(r, '.claude/gates.json', '{invalid'); assert.equal(testGatesCache(r).Status, 'Stale'); });
