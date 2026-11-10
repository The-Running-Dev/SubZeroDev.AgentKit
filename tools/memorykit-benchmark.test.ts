import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { measurePair, NAMESPACE, seed } from './memorykit-benchmark.ts';
import type { Context } from './memorykit.ts';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';

// Synthetic runner: deterministic regression coverage only, never cost evidence for MemoryKit.
function fixture() {
  const records = Array.from({ length: 7 }, (_, i) => ({ id: `M${i}`, revision: 1, namespace: NAMESPACE,
    kind: 'lesson', state: 'active', content: `Target ${i}.`, updatedAt: `2026-01-0${i + 1}`,
    metadata: { status: 'accepted' }, supersededBy: [] }));
  const rawBytes: number[] = [];
  const runner: Runner = (_command, args) => {
    const verb = args[0], flags = Object.fromEntries(args.filter(a => a.startsWith('--') && a.includes('=')).map(a => {
      const at = a.indexOf('='); return [a.slice(2, at), a.slice(at + 1)];
    }));
    let value;
    if (verb === 'get') value = records.find(r => r.id === args[1]);
    else if (verb === 'search') value = { items: records, nextCursor: null };
    else {
      assert.equal(verb, 'browse');
      const from = flags.cursor ? Number(flags.cursor.slice(2)) : 0, limit = Number(flags.limit);
      const items = records.slice(from, from + limit).map(r => ({ id: r.id, revision: r.revision, namespace: r.namespace,
        kind: r.kind, state: r.state, status: 'accepted', updatedAt: r.updatedAt, contentBytes: r.content.length }));
      const nextCursor = from + limit < records.length ? `c:${from + limit}` : null;
      value = { items, count: items.length, nextCursor, bytes: 0, completeness: nextCursor ? 'partial' : 'complete',
        reasons: nextCursor ? ['item_limit'] : [] };
      for (;;) { const n = Buffer.byteLength(JSON.stringify(value)); if (n === value.bytes) break; value.bytes = n; }
    }
    const stdout = JSON.stringify(value) + '\n'; rawBytes.push(Buffer.byteLength(stdout));
    return { code: 0, found: true, stdout, stderr: '' };
  };
  const ctx: Context = { config: { cli: 'synthetic-memorykit', store: 'unused' }, runner,
    project: '.', root: '.', namespace: NAMESPACE, host: 'test' };
  const targets = [0, 3, 6].map(i => ({ id: records[i].id, revision: 1, marker: records[i].content }));
  return { ctx, targets, ids: records.map(r => r.id), rawBytes };
}

test('synthetic runner: follows all continuation pages, discovers fixed targets, and excludes postflight calls', () => {
  for (const browseFirst of [false, true]) {
    const f = fixture(), pair = measurePair(f.ctx, f.targets, f.ids, { pageLimit: 2, browseFirst });
    const { automatic: a, browseSelect: b } = pair;
    assert.deepEqual([a.cliCalls, a.pageCount, a.recordsInspected, a.distinctRecordsInspected], [1, 1, 7, 7]);
    assert.deepEqual([b.cliCalls, b.pageCount, b.recordsInspected, b.distinctRecordsInspected], [7, 4, 10, 7]);
    assert.deepEqual(b.calls.filter(c => c.verb === 'browse').map(c => [c.rows, c.cursorSupplied, c.hasNextCursor]),
      [[2, false, true], [2, true, true], [2, true, true], [1, true, false]]);
    assert.deepEqual([a.targetHits, b.targetHits], [3, 3]);
    assert.equal(f.rawBytes.length, a.cliCalls + b.cliCalls + 1, 'one extra unmeasured postflight search');
    assert.equal(a.rawCliStdoutBytes + b.rawCliStdoutBytes, f.rawBytes.slice(0, -1).reduce((n, b) => n + b, 0));
    assert.equal(a.rawCliStderrBytes + b.rawCliStderrBytes, 0);
    assert.ok(a.agentkitResponseBytes > a.contextTextBytes);
    assert.ok(b.agentkitResponseBytes > b.contextTextBytes);
  }
});

test('synthetic runner: refuses a repeated page instead of silently reporting partial evidence', () => {
  const f = fixture(), base = f.ctx.runner;
  f.ctx.runner = (command, args, opts) => base(command, args.filter(a => !a.startsWith('--cursor=')), opts);
  assert.throws(() => measurePair(f.ctx, f.targets, f.ids, { pageLimit: 2 }), /duplicate browse record/);
});

test('real CLI: benchmark discovers targets across item- and byte-limited pages', { skip: !process.env.MEMORYKIT_CLI }, () => {
  const root = mkdtempSync(join(tmpdir(), 'agentkit-bench-test-'));
  try {
    const cli = resolve(process.env.MEMORYKIT_CLI!), store = join(root, 'store');
    const init = run(process.execPath, [cli, 'init', store]); assert.equal(init.code, 0, init.stderr);
    const ctx: Context = { config: { cli, store }, runner: run, root, project: root, namespace: NAMESPACE, host: 'test-host' };
    const f = seed(ctx, 12);
    for (const opts of [{ pageLimit: 2 }, { pageLimit: 20, pageBytes: 1000 }]) {
      const p = measurePair(ctx, f.targets, f.expectedIds, opts);
      assert.ok(p.browseSelect.pageCount > 1);
      assert.ok(p.browseSelect.calls.some(c => c.cursorSupplied));
      assert.equal(p.browseSelect.distinctRecordsInspected, 13);
      assert.equal(p.automatic.cliCalls, 1, 'automatic postflight is not measured');
      assert.equal(p.automatic.targetHits, 3);
      assert.equal(p.browseSelect.targetHits, 3);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
