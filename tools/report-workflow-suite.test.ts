import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caseIds, prepare, sha256 } from './evaluate-workflow.ts';
import { reportSuite, suiteMarkdown } from './report-workflow-suite.ts';
import { put, temp } from './lib/fixtures.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = join(root, 'tools/report-workflow-suite.ts');
const seeds = (['next', 'fix'] as const).flatMap(command => caseIds.map(caseId => prepare({ repo: root, out: join(temp(), 'seed'), command, caseId })));
const host = { name: 'codex', version: '0.0.0-fixture', model: 'gpt-fixture', settings: 'PRIVATE_SETTINGS_<script> /private/host' };

function fixture() {
  const dir = temp();
  const trials = seeds.map((seed, index) => {
    const home = join(dir, String(index)), packet = join(home, 'packet');
    cpSync(seed.packet, packet, { recursive: true });
    const manifest = JSON.parse(readFileSync(join(packet, 'manifest.json'), 'utf8'));
    manifest.id = randomUUID();
    const bytes = JSON.stringify(manifest);
    writeFileSync(join(packet, 'manifest.json'), bytes);
    const a = 'PRIVATE_PHASE_A initial assessment', b = 'PRIVATE_PHASE_B final reconciliation';
    put(home, 'a.txt', a); put(home, 'b.txt', b);
    const result = { schema: 1, trialId: manifest.id, packetSha256: sha256(bytes), revision: manifest.revision, command: seed.command, caseId: seed.caseId, host: { ...host },
      phases: [{ id: 'a', outcome: 'completed', promptSha256: manifest.files['phase-a.md'], elapsedMs: 99999999, transcript: 'a.txt', transcriptSha256: sha256(a) },
        { id: 'b', outcome: 'completed', promptSha256: manifest.files['phase-b.md'], elapsedMs: 99999999, transcript: 'b.txt', transcriptSha256: sha256(b) }],
      humanReview: { reviewer: 'PRIVATE_REVIEWER', grades: (manifest.criteria as string[]).map(id => ({ id, verdict: 'pass', reason: 'PRIVATE_REASON', evidence: [{ phase: 'b', quote: 'PRIVATE_PHASE_B' }] })) },
      usage: null as null | { provider: string; transcript: string; transcriptSha256: string; sessionId: string } };
    const resultPath = join(home, 'result.json');
    const save = () => writeFileSync(resultPath, JSON.stringify(result));
    save();
    return { home, packet, manifest, result, resultPath, save, selection: { packet: relative(dir, packet), packetSha256: result.packetSha256, result: relative(dir, resultPath) } };
  });
  const cohorts = [{ revision: trials[0].manifest.revision, producerSha256: trials[0].manifest.producerSha256, host: { ...host }, repeats: 1 }];
  const selection = { schema: 1, cohorts, receipts: trials.map(t => ({ ...t.selection })) };
  const path = join(dir, 'selection.json');
  const save = () => { for (const t of trials) t.save(); writeFileSync(path, JSON.stringify(selection)); };
  const report = () => { save(); return reportSuite(path); };
  return { dir, path, trials, selection, save, report };
}

function attach(t: ReturnType<typeof fixture>['trials'][number], sessionId = randomUUID(), mode = 'observed') {
  const counter = { input_tokens: 200, cached_input_tokens: 80, output_tokens: 30, reasoning_output_tokens: 10, total_tokens: 230 };
  const rows: object[] = [{ type: 'session_meta', payload: { id: sessionId, cli_version: host.version } }, { type: 'turn_context', payload: { model: host.model } }];
  if (mode !== 'unavailable') rows.push({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: counter, last_token_usage: counter } } });
  if (mode === 'partial') rows.push({ type: 'token_usage_record', payload: {} });
  const body = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
  put(t.home, 'usage.jsonl', body);
  t.result.usage = { provider: 'codex', transcript: 'usage.jsonl', transcriptSha256: sha256(body), sessionId };
}

test('six C2 slots and fixed criteria are reported without inventing grades or changing evidence', () => {
  const f = fixture();
  f.trials[0].result.humanReview.grades[0].verdict = 'fail';
  f.trials[1].result.humanReview.grades[0].verdict = 'unverified';
  f.save();
  const snapshot = () => readdirSync(f.dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => [join(e.parentPath, e.name), sha256(readFileSync(join(e.parentPath, e.name)))]);
  const before = snapshot(), r = reportSuite(f.path);
  assert.deepEqual(snapshot(), before);
  assert.equal(r.status, 'human-assessed-fail');
  assert.equal(r.groups.length, 1);
  const g = r.groups[0];
  assert.equal(g.complete, true); assert.equal(g.slots.length, 6);
  assert.equal(g.slots.flatMap(s => s.criteria).length, 20);
  assert.equal(g.slots.find(s => s.command === 'next' && s.caseId === 'caller')!.criteria[0].fail, 1);
  assert.equal(g.slots.find(s => s.command === 'next' && s.caseId === 'scope-growth')!.trials.unverified, 1);
  assert.equal(g.usage.coverage.unattached, 6); assert.equal(g.usage.totals, null);
});

test('order determinism, exact duplicates and conflicting same-trial identities fail closed', () => {
  const f = fixture(); f.selection.receipts.push({ ...f.selection.receipts[0] });
  const a = f.report();
  f.selection.receipts.reverse();
  assert.deepEqual(f.report(), a); assert.equal(a.duplicates, 1); assert.equal(a.status, 'human-assessed-pass');
  const t = f.trials[0], changed = structuredClone(t.result);
  changed.humanReview.grades[0].reason = 'Different attestation, even with same verdict';
  put(t.home, 'changed.json', JSON.stringify(changed));
  f.selection.receipts.push({ ...t.selection, result: relative(f.dir, join(t.home, 'changed.json')) });
  f.selection.receipts.push({ ...t.selection, result: relative(f.dir, join(t.home, 'changed.json')) });
  const rejected = f.report(); assert.equal(rejected.status, 'rejected'); assert.deepEqual(rejected.groups, []); assert.equal(rejected.conflicts, 1);
  f.selection.receipts.reverse(); assert.deepEqual(f.report(), rejected);
});

test('invalid and missing evidence stays visible with sanitized errors and missing slots', () => {
  const f = fixture(); f.selection.receipts.pop();
  put(f.trials[0].home, 'a.txt', 'tampered PRIVATE_PATH');
  const r = f.report(); assert.equal(r.invalid, 1); assert.equal(r.status, 'incomplete');
  assert.equal(r.groups[0].slots.reduce((n, s) => n + s.missing!, 0), 2);
  assert.equal(r.groups[0].usage.totals, null);
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_|a.txt|result.json/);
});

test('empty selections, extra trials and repeats cannot become complete through deduplication', () => {
  const f = fixture(); f.selection.cohorts[0].repeats = 2;
  f.selection.receipts.push(...f.selection.receipts.map(r => ({ ...r })));
  let r = f.report(); assert.equal(r.status, 'incomplete'); assert.equal(r.duplicates, 6);
  assert.equal(r.groups[0].slots.reduce((n, s) => n + s.missing!, 0), 6);
  f.selection.receipts = []; r = f.report(); assert.equal(r.status, 'incomplete'); assert.equal(r.groups[0].slots.length, 6);
  f.selection.cohorts[0].repeats = 1; f.selection.receipts = f.trials.map(t => ({ ...t.selection }));
  const t = f.trials[0], extra = structuredClone(t.result), manifest = { ...t.manifest, id: randomUUID() };
  cpSync(t.packet, join(t.home, 'extra-packet'), { recursive: true });
  put(t.home, 'extra-packet/manifest.json', JSON.stringify(manifest));
  extra.trialId = manifest.id; extra.packetSha256 = sha256(JSON.stringify(manifest));
  put(t.home, 'extra-result.json', JSON.stringify(extra));
  f.selection.receipts.push({ packet: relative(f.dir, join(t.home, 'extra-packet')), packetSha256: extra.packetSha256, result: relative(f.dir, join(t.home, 'extra-result.json')) });
  r = f.report(); assert.equal(r.status, 'incomplete'); assert.equal(r.groups[0].slots[0].excess, 1);
});

test('source, producer, host version, model and settings split incompatible cohorts', () => {
  for (const field of ['revision', 'producerSha256', 'name', 'version', 'model', 'settings']) {
    const f = fixture(), t = f.trials[0];
    if (field === 'revision' || field === 'producerSha256') {
      t.manifest[field] = field === 'revision' ? 'b'.repeat(40) : 'b'.repeat(64);
      const body = JSON.stringify(t.manifest); writeFileSync(join(t.packet, 'manifest.json'), body);
      t.result.revision = t.manifest.revision; t.result.packetSha256 = sha256(body); f.selection.receipts[0].packetSha256 = sha256(body);
    } else t.result.host[field as keyof typeof host] += '-different';
    const r = f.report(); assert.equal(r.status, 'incomplete', field); assert.equal(r.groups.length, 2, field);
    assert.equal(r.groups.filter(g => !g.declared).length, 1, field);
    f.selection.receipts.reverse(); assert.deepEqual(f.report(), r);
  }
});

test('independent cumulative sessions add once with cache/reasoning retained as subsets and null retained', () => {
  const f = fixture(); for (const t of f.trials) attach(t);
  f.selection.receipts.push({ ...f.selection.receipts[0] });
  const r = f.report(), usage = r.groups[0].usage;
  assert.equal(usage.coverage.observed, 6); assert.equal(usage.coverage.reused, 0);
  assert.deepEqual(usage.totals, { inputTokens: 1200, cachedInputTokens: 480, cacheWriteInputTokens: null, outputTokens: 180, reasoningOutputTokens: 60, totalTokens: 1380 });
});

test('reused sessions across slots or cohorts suppress totals even when source bytes differ', () => {
  for (const split of [false, true]) {
    const f = fixture(), session = randomUUID();
    for (const t of f.trials) attach(t);
    attach(f.trials[0], session); attach(f.trials[1], session);
    // Different original-byte digest is still the same cumulative session.
    const t = f.trials[1], body = readFileSync(join(t.home, 'usage.jsonl'), 'utf8') + '\n';
    put(t.home, 'usage.jsonl', body); t.result.usage!.transcriptSha256 = sha256(body);
    if (split) f.trials[1].result.host.settings += ' different cohort';
    const r = f.report(); assert.equal(r.groups.reduce((n, g) => n + g.usage.coverage.reused, 0), 2);
    assert.ok(r.groups.every(g => g.usage.totals === null));
  }
});

test('unattached, unavailable and partial evidence never become zero or a complete usage denominator', () => {
  for (const mode of ['unattached', 'unavailable', 'partial']) {
    const f = fixture(); for (const t of f.trials) attach(t);
    if (mode === 'unattached') f.trials[0].result.usage = null; else attach(f.trials[0], randomUUID(), mode);
    const r = f.report(); assert.equal(r.status, 'human-assessed-pass');
    assert.equal(r.groups[0].usage.totals, null); assert.equal(r.groups[0].usage.coverage[mode as 'unattached' | 'unavailable' | 'partial'], 1);
  }
});

test('observed zero stays zero, overflow and invalid selected evidence suppress totals', () => {
  const f = fixture();
  const setCounters = (input: number) => {
    for (const t of f.trials) {
      attach(t);
      const lines = readFileSync(join(t.home, 'usage.jsonl'), 'utf8').trim().split('\n').map(s => JSON.parse(s));
      const counters = { input_tokens: input, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: input };
      lines[2].payload.info = { total_token_usage: counters, last_token_usage: counters };
      const body = lines.map(r => JSON.stringify(r)).join('\n') + '\n';
      put(t.home, 'usage.jsonl', body); t.result.usage!.transcriptSha256 = sha256(body);
    }
  };
  setCounters(0);
  assert.equal(f.report().groups[0].usage.totals!.totalTokens, 0);
  setCounters(Number.MAX_SAFE_INTEGER);
  let r = f.report(); assert.equal(r.groups[0].usage.overflow, true); assert.equal(r.groups[0].usage.totals, null);
  setCounters(1);
  f.selection.receipts.push({ ...f.selection.receipts[0], result: 'PRIVATE_MISSING' });
  r = f.report(); assert.equal(r.invalid, 1); assert.equal(r.groups[0].complete, true); assert.equal(r.status, 'incomplete'); assert.equal(r.groups[0].usage.totals, null);
});

test('explicit multiple cohorts stay separate and deterministic', () => {
  const f = fixture();
  f.selection.cohorts.push({ ...f.selection.cohorts[0], host: { ...host, settings: 'second cohort' } });
  const r = f.report(); assert.equal(r.groups.length, 2); assert.equal(r.status, 'incomplete');
  f.selection.cohorts.reverse(); f.selection.receipts.reverse(); assert.deepEqual(f.report(), r);
});

test('CLI JSON and Markdown redact private paths, quotes, reasons, host settings and session/trial IDs', () => {
  const f = fixture(); for (const t of f.trials) { attach(t); t.result.humanReview.grades[0].verdict = 'unverified'; }
  f.save();
  for (const format of ['json', 'markdown']) {
    const r = spawnSync(process.execPath, [entry, '--selection', f.path, '--format', format], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stderr); assert.equal(r.stderr, '');
    assert.doesNotMatch(r.stdout, /PRIVATE_|usage.jsonl|result.json|99999999|gpt-fixture|<script>/);
    assert.ok(!r.stdout.includes(f.dir));
    for (const t of f.trials) { assert.ok(!r.stdout.includes(t.result.trialId)); assert.ok(!r.stdout.includes(t.result.usage!.sessionId)); }
    if (format === 'json') assert.equal(JSON.parse(r.stdout).status, 'unverified');
    else { assert.match(r.stdout, /next\/caller\/real-caller-boundary/); assert.match(r.stdout, /unverified/); }
  }
  f.trials.forEach(t => t.result.humanReview.grades[0].verdict = 'pass'); f.save();
  assert.equal(spawnSync(process.execPath, [entry, '--selection', f.path], { encoding: 'utf8' }).status, 0);
  assert.equal(suiteMarkdown(f.report()), suiteMarkdown(reportSuite(f.path)));
});

test('bounded strict selection rejects malformed schemas without echoing input paths', () => {
  const f = fixture();
  for (const mutate of [(s: any) => s.extra = true, (s: any) => s.schema = 2, (s: any) => s.cohorts[0].repeats = 0, (s: any) => s.cohorts[0].repeats = 21, (s: any) => s.cohorts.push(s.cohorts[0]), (s: any) => s.receipts = Array(101).fill(s.receipts[0]), (s: any) => s.receipts[0].packetSha256 = 'bad', (s: any) => s.cohorts[0].revision = 'PRIVATE_PATH']) {
    const s = structuredClone(f.selection); mutate(s); writeFileSync(f.path, JSON.stringify(s));
    assert.throws(() => reportSuite(f.path), /Invalid|Duplicate|exceeds/);
  }
  writeFileSync(f.path, ' '.repeat(1024 * 1024 + 1)); assert.throws(() => reportSuite(f.path), /up to 1 MiB/);
  const bad = spawnSync(process.execPath, [entry, '--selection', join(f.dir, 'PRIVATE_MISSING')], { encoding: 'utf8' });
  assert.equal(bad.status, 1); assert.doesNotMatch(bad.stderr, /PRIVATE_|agentkit-node/);
});
