import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { arch, platform } from 'node:process';
import { browse, callCli, context, correct, DEFAULT_CONTEXT_BYTES, installedVersion, remember, select } from './memorykit.ts';
import type { Context } from './memorykit.ts';
import { integerOption, parseOptions, requiredOption } from './lib/options.ts';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { isMain, main } from './lib/runtime.ts';

// This command never reads AgentKit's installed config or accepts an existing store.
// All writes, including negative controls, go to a newly created temporary directory.
export const NAMESPACE = 'project/example-org/demo.repo';
export interface Target { id: string; revision: number; marker: string }
export interface Call {
  verb: string; cursorSupplied: boolean; hasNextCursor: boolean; rows: number;
  stdoutBytes: number; stderrBytes: number; elapsedMs: number;
}
export interface Cost {
  elapsedMs: number; cliCalls: number; rawCliStdoutBytes: number; rawCliStderrBytes: number;
  agentkitResponseBytes: number; legacyOutputBytes: number; contextTextBytes: number;
  pageCount: number; recordsInspected: number; distinctRecordsInspected: number;
  targetHits: number; targetCount: number; calls: Call[];
}
const bytes = (value: string) => Buffer.byteLength(value, 'utf8');
const jsonBytes = (value: unknown) => bytes(JSON.stringify(value) + '\n');

// Counters exist for one operation only. Setup and postflight validation use ctx.runner.
function meter(ctx: Context) {
  const calls: Call[] = [], ids = new Set<string>();
  const runner: Runner = (command, args, options) => {
    const start = performance.now(), result = ctx.runner(command, args, options);
    const elapsedMs = performance.now() - start;
    // callCli runs a script via Node, or an executable directly.
    const verb = args[0] === ctx.config.cli ? args[1] : args[0];
    assert.ok(['search', 'browse', 'get'].includes(verb), `unexpected measured command: ${verb}`);
    assert.ok(result.code === 0 || result.code === 3, `${verb}: ${result.stderr}`);
    const value = JSON.parse(result.stdout), rows = verb === 'get' ? [value] : value.items;
    assert.ok(Array.isArray(rows), `${verb} returned no records`);
    for (const row of rows) ids.add(row.id);
    calls.push({ verb, cursorSupplied: args.some(a => a.startsWith('--cursor=')), hasNextCursor: !!value.nextCursor,
      rows: rows.length, stdoutBytes: bytes(result.stdout), stderrBytes: bytes(result.stderr), elapsedMs });
    return result;
  };
  return {
    ctx: { ...ctx, runner },
    finish(start: number, responses: unknown[], legacyOutputBytes: number, text: string, targets: Target[]): Cost {
      return { elapsedMs: performance.now() - start, cliCalls: calls.length,
        rawCliStdoutBytes: calls.reduce((n, c) => n + c.stdoutBytes, 0),
        rawCliStderrBytes: calls.reduce((n, c) => n + c.stderrBytes, 0),
        agentkitResponseBytes: responses.reduce<number>((n, r) => n + jsonBytes(r), 0), legacyOutputBytes,
        contextTextBytes: bytes(text), pageCount: calls.filter(c => c.verb !== 'get').length,
        recordsInspected: calls.reduce((n, c) => n + c.rows, 0), distinctRecordsInspected: ids.size,
        targetHits: targets.filter(t => text.includes(t.marker)).length, targetCount: targets.length, calls };
    },
  };
}

// Full enumeration is deliberate: this measures exhaustive navigation, not a ranking model.
// Targets are fixed at seeding time and must be discovered at the revision browse returns.
export function measurePair(ctx: Context, targets: Target[], expectedIds: string[], options: {
  limitBytes?: number; pageLimit?: number; pageBytes?: number; previewChars?: number; browseFirst?: boolean;
} = {}) {
  const limitBytes = options.limitBytes ?? DEFAULT_CONTEXT_BYTES;
  let automatic!: Cost, browseSelect!: Cost, autoResult!: ReturnType<typeof context>;
  const auto = () => {
    const m = meter(ctx), start = performance.now();
    autoResult = context(m.ctx, limitBytes);
    automatic = m.finish(start, [autoResult], autoResult.Bytes, autoResult.Text, targets);
    assert.equal(automatic.legacyOutputBytes, automatic.contextTextBytes);
  };
  const explicit = () => {
    const m = meter(ctx), start = performance.now(), responses: unknown[] = [], seen = new Set<string>();
    const cursors = new Set<string>(), chosen = new Map<string, string>();
    let cursor: string | undefined, browseBytes = 0;
    do {
      assert.ok(responses.length <= expectedIds.length, 'browse did not terminate');
      const page = browse(m.ctx, { limit: options.pageLimit ?? 20, maxBytes: options.pageBytes ?? 8192,
        previewChars: options.previewChars ?? 0, cursor });
      responses.push(page); browseBytes += page.Bytes;
      for (const it of page.Items) {
        assert.ok(!seen.has(it.id), `duplicate browse record: ${it.id}`); seen.add(it.id);
        const target = targets.find(t => t.id === it.id);
        if (target) { assert.equal(it.revision, target.revision); chosen.set(it.id, `${it.id}@${it.revision}`); }
      }
      cursor = page.NextCursor ?? undefined;
      if (cursor) {
        assert.ok(page.Count > 0, 'non-progressing browse page');
        assert.ok(!cursors.has(cursor), 'repeated continuation cursor'); cursors.add(cursor);
      }
    } while (cursor);
    assert.deepEqual([...seen].sort(), [...expectedIds].sort(), 'browse must enumerate every accepted record exactly once');
    assert.equal(chosen.size, targets.length, 'all fixed targets must be discovered');
    const selected = select(m.ctx, targets.map(t => chosen.get(t.id)!), limitBytes);
    assert.deepEqual(selected.Rejected, []);
    assert.deepEqual(selected.Inserted, targets.map(({ id, revision }) => ({ id, revision })));
    responses.push(selected);
    browseSelect = m.finish(start, responses, browseBytes + selected.Bytes, selected.Text, targets);
    assert.equal(browseSelect.targetHits, targets.length);
  };
  if (options.browseFirst) { explicit(); auto(); } else { auto(); explicit(); }
  // Out of band: never inflate automatic CLI counts with this invariance check.
  assert.deepEqual(context(ctx, limitBytes), autoResult, 'browse/select changed automatic context');
  return { automatic, browseSelect, automaticItems: autoResult.Items, automaticOmitted: autoResult.Omitted,
    automaticTruncated: autoResult.Truncated };
}

// Same body sizes/kind mix as #528's twelve-memory test. Larger stores repeat the
// 12-body distribution rather than growing every memory with the store size.
export function seed(ctx: Context, count: number) {
  assert.ok(Number.isSafeInteger(count) && count >= 3 && count <= 500, 'records must be between 3 and 500');
  const kept = Array.from({ length: count }, (_, i) => remember(ctx, { kind: i % 3 ? 'lesson' : 'decision',
    content: `Kept ${i}. ${'w'.repeat(40 * (i % 12 + 1))}`, accept: true }).Memory);
  // Same eligibility controls as the previous paired diagnostic, including its accepted replacement.
  remember(ctx, { kind: 'lesson', content: 'Forbidden candidate.' });
  remember({ ...ctx, namespace: 'project/other/repo' }, { kind: 'lesson', content: 'Forbidden foreign.', accept: true });
  const superseded = remember(ctx, { kind: 'lesson', content: 'Forbidden superseded.', accept: true }).Memory;
  const replacement = correct(ctx, superseded.id, superseded.revision, { content: 'Kept replacement.', accept: true }).Memory;
  const archived = remember(ctx, { kind: 'lesson', content: 'Forbidden revoked.', accept: true }).Memory;
  const result = callCli(ctx.config, ['archive', archived.id, `--expected-revision=${archived.revision}`, '--operation-id=bench-archive'], ctx.runner);
  assert.ok(result.ok, JSON.stringify(result));
  const targets = [0, Math.floor(count / 2), count - 1].map(i => ({ id: kept[i].id, revision: kept[i].revision, marker: `Kept ${i}. ` }));
  return { targets, expectedIds: [...kept, replacement].map(m => m.id),
    // A deliberately generous shared budget for the all-fit comparison, verified below.
    allFitBytes: 2048 + [...kept, replacement].reduce((n, m) => n + bytes(m.content) + 512, 0) };
}

export function benchmark(cli: string, counts: number[], repeats: number) {
  assert.ok(Number.isSafeInteger(repeats) && repeats >= 1 && repeats <= 20, 'repeats must be between 1 and 20');
  assert.ok(counts.length > 0 && counts.every(n => Number.isSafeInteger(n) && n >= 3 && n <= 500), 'records must be between 3 and 500');
  const scenarios = [];
  for (const count of counts) {
    const root = mkdtempSync(join(tmpdir(), 'agentkit-memorykit-bench-'));
    try {
      const store = join(root, 'store'), init = run(process.execPath, [cli, 'init', store]);
      assert.equal(init.code, 0, init.stderr);
      const ctx: Context = { config: { cli, store }, root, project: root, namespace: NAMESPACE, host: 'test-host', runner: run };
      const fixture = seed(ctx, count);
      for (const [budget, limitBytes] of [['default', DEFAULT_CONTEXT_BYTES], ['all-fit', fixture.allFitBytes]] as const) {
        const samples = [];
        for (let repeat = 0; repeat < repeats; repeat++) {
          process.stderr.write(`Measuring ${count} + replacement / ${budget} / repeat ${repeat + 1}\n`);
          const pair = measurePair(ctx, fixture.targets, fixture.expectedIds, { limitBytes, browseFirst: repeat % 2 === 1 });
          if (budget === 'all-fit') {
            assert.equal(pair.automaticItems, fixture.expectedIds.length);
            assert.equal(pair.automatic.targetHits, fixture.targets.length);
            assert.equal(pair.automaticTruncated, false);
          }
          samples.push({ repeat: repeat + 1, order: repeat % 2 ? 'browse-first' : 'automatic-first', ...pair });
        }
        scenarios.push({ primaryRecords: count, acceptedRecords: fixture.expectedIds.length, budget, limitBytes,
          pageLimit: 20, pageBytes: 8192, previewChars: 0, targetOrdinals: [0, Math.floor(count / 2), count - 1], samples });
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  return scenarios;
}

if (isMain(import.meta.url)) await main(() => {
  const opts = parseOptions({ cli: { type: 'string' }, records: { type: 'string' }, repeats: { type: 'string' } });
  const cli = resolve(requiredOption(opts.cli ?? process.env.MEMORYKIT_CLI, 'cli'));
  const scenarios = benchmark(cli, (opts.records ?? '12,120').split(',').map(Number), integerOption(opts.repeats, 'repeats', 3));
  const commit = run('git', ['-C', import.meta.dirname, 'rev-parse', 'HEAD']);
  process.stdout.write(JSON.stringify({ schemaVersion: 1, backend: 'real-memorykit-cli', data: 'synthetic-only',
    measuredAt: new Date().toISOString(), environment: { node: process.version, platform, arch },
    agentkitBaseCommit: commit.code === 0 ? commit.stdout.trim() : null,
    harnessSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
    memorykitVersion: installedVersion({ cli, store: '' }), cliSha256: createHash('sha256').update(readFileSync(cli)).digest('hex'),
    actualModelTokens: null, tokenEstimates: null, scenarios }, null, 2) + '\n');
});
