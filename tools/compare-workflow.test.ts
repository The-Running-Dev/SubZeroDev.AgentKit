import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { caseIds, prepare, sha256 } from './evaluate-workflow.ts';
import { assessWorkflow } from './lib/workflow-assessment.ts';
import { reportSuite } from './report-workflow-suite.ts';
import { compareWorkflow, comparisonMarkdown } from './compare-workflow.ts';
import { put, temp } from './lib/fixtures.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const seeds = (['next', 'fix'] as const).flatMap(command => caseIds.map(caseId => prepare({ repo: root, out: join(temp(), 'seed'), command, caseId })));
const host = { name: 'codex', version: '1', model: 'mock', settings: 'PRIVATE_SETTINGS' };
const evaluator = { id: 'fixture', version: '1', codeSha256: sha256('code'), configSha256: sha256('config'), rubricSha256: sha256('rubric'), origin: 'model' };
const reference = (path: string) => ({ path, sha256: sha256(readFileSync(path)) });
function suite() {
  const dir = temp();
  const trials = seeds.map((seed, i) => {
    const home = join(dir, String(i)), packet = join(home, 'packet');
    cpSync(seed.packet, packet, { recursive: true });
    const manifest = JSON.parse(readFileSync(join(packet, 'manifest.json'), 'utf8'));
    manifest.id = randomUUID();
    const bytes = JSON.stringify(manifest); writeFileSync(join(packet, 'manifest.json'), bytes);
    const captures = { a: 'PRIVATE_A initial assessment', b: 'PRIVATE_B final reconciliation' };
    put(home, 'a.txt', captures.a); put(home, 'b.txt', captures.b);
    const receipt = { schema: 1, trialId: manifest.id, packetSha256: sha256(bytes), revision: manifest.revision,
      command: seed.command, caseId: seed.caseId, host: { ...host },
      phases: (['a', 'b'] as const).map(id => ({ id, outcome: 'completed', promptSha256: manifest.files[`phase-${id}.md`], elapsedMs: 1, transcript: `${id}.txt`, transcriptSha256: sha256(captures[id]) })),
      humanReview: { reviewer: 'PRIVATE_REVIEWER', grades: (manifest.criteria as string[]).map(id => ({ id, verdict: 'pass', reason: 'PRIVATE_REASON', evidence: [{ phase: 'b', quote: 'final reconciliation' }] })) }, usage: null as null | { provider: string; transcript: string; transcriptSha256: string; sessionId: string } };
    const result = put(home, 'receipt.json', JSON.stringify(receipt));
    const input = { packet, packetSha256: sha256(bytes), result };
    const draft = { schema: 'agentkit.workflow-assessment.v1', target: { trialId: manifest.id, packetSha256: input.packetSha256, receiptSha256: sha256(readFileSync(result)), transcripts: { a: sha256(captures.a), b: sha256(captures.b) } },
      evaluator: { ...evaluator }, execution: 'synthetic', review: { status: 'unreviewed' },
      results: (manifest.criteria as string[]).map(id => ({ id, verdict: 'pass', reason: 'PRIVATE_REASON', evidence: [{ phase: 'b', quote: 'final reconciliation', start: 10 }] })) };
    const seal = (name = 'assessment.json') => reference(put(home, name, JSON.stringify(assessWorkflow(input, draft))));
    return { input, draft, seal, manifest, receipt };
  });
  const selection = { schema: 1, cohorts: [{ revision: trials[0].manifest.revision, producerSha256: trials[0].manifest.producerSha256, host, repeats: 1 }], receipts: trials.map(t => t.input) };
  const path = put(dir, 'selection.json', JSON.stringify(selection));
  const side = { selection: reference(path), cohortId: reportSuite(path).groups[0].id, corpusSha256: sha256('C2 corpus'), evaluators: [{ ...evaluator }], assessments: trials.map(t => t.seal()) };
  const save = () => { writeFileSync(path, JSON.stringify(selection)); side.selection = reference(path); };
  return { dir, trials, selection, path, side, save };
}
function fixture() {
  const baseline = suite(), candidate = suite(), dir = temp();
  const spec = { schema: 'agentkit.workflow-experiment.v1', hypothesis: 'PRIVATE_HYPOTHESIS', parents: [], baseline: baseline.side, candidate: candidate.side,
    changedVariables: ['source-revision'], authorRole: 'human', conclusion: 'PRIVATE_CONCLUSION', limitations: ['Synthetic evidence only'], evidenceDigests: [] };
  const path = join(dir, 'experiment.json');
  const save = () => writeFileSync(path, JSON.stringify(spec));
  const report = () => { save(); return compareWorkflow(path); };
  return { baseline, candidate, dir, spec, path, save, report };
}

test('complete six-slot comparison separates human evidence and assessments, preserves files and runs the CLI offline', () => {
  const f = fixture(), t = f.candidate.trials[0];
  t.draft.results[0].verdict = 'fail'; f.candidate.side.assessments[0] = t.seal(); f.save();
  const snapshot = () => [f.dir, f.baseline.dir, f.candidate.dir].flatMap(dir => readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => [join(e.parentPath, e.name), sha256(readFileSync(join(e.parentPath, e.name)))]));
  const before = snapshot(), r = compareWorkflow(f.path);
  assert.equal(r.comparability, 'comparable'); assert.equal(r.improvementVerdict, 'not-established');
  assert.deepEqual(r.candidate.humanSuite, reportSuite(f.candidate.path));
  assert.equal(r.candidate.rows.length, 20); assert.equal(r.candidate.rows[0].human.pass, 1);
  assert.equal(r.candidate.rows[0].assessments[0].fail, 1); assert.equal(r.candidate.rows[0].assessments[0].humanModelDisagreements, 1);
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_|receipt.json|a.txt/);
  const cli = spawnSync(process.execPath, [join(root, 'tools/compare-workflow.ts'), '--experiment', f.path, '--format', 'json'], { encoding: 'utf8', env: { ...process.env, PATH: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' } });
  assert.equal(cli.status, 0, cli.stderr); assert.deepEqual(JSON.parse(cli.stdout), r);
  const md = spawnSync(process.execPath, [join(root, 'tools/compare-workflow.ts'), '--experiment', f.path, '--format', 'markdown'], { encoding: 'utf8' });
  assert.equal(md.status, 0, md.stderr); assert.equal(md.stdout.replaceAll('\r\n', '\n'), comparisonMarkdown(r));
  assert.deepEqual(snapshot(), before);
});

test('different rubrics, corpus and cohorts cannot establish improvement', () => {
  const f = fixture(); f.candidate.side.corpusSha256 = sha256('different');
  f.candidate.side.evaluators[0].rubricSha256 = sha256('changed rubric');
  f.candidate.side.assessments = f.candidate.trials.map(t => { t.draft.evaluator.rubricSha256 = sha256('changed rubric'); return t.seal(); });
  let r = f.report(); assert.equal(r.comparability, 'confounded'); assert.ok(r.confounders.includes('corpus')); assert.ok(r.confounders.includes('evaluators-or-rubrics')); assert.equal(r.humanDeltas, null);
  f.candidate.side.cohortId = sha256('unselected'); r = f.report();
  assert.equal(r.comparability, 'insufficient-evidence'); assert.equal(r.candidate.cohortMismatch, true);
});

test('deduplicates attachments and captures, rejects conflicting assessment identities, orders deterministically', () => {
  const f = fixture(); f.candidate.side.assessments.push(f.candidate.side.assessments[0]);
  f.candidate.selection.receipts.push(f.candidate.selection.receipts[0]); f.candidate.save();
  const a = f.report(); assert.equal(a.candidate.assessments.duplicates, 1); assert.equal(a.candidate.humanSuite.duplicates, 1); assert.equal(a.candidate.rows[0].human.pass, 1);
  f.candidate.side.assessments.reverse(); f.candidate.selection.receipts.reverse(); f.candidate.save();
  const b = f.report();
  assert.deepEqual({ ...b, experimentSha256: '', candidate: { ...b.candidate, selectionSha256: '' } }, { ...a, experimentSha256: '', candidate: { ...a.candidate, selectionSha256: '' } });
  const t = f.candidate.trials[0]; t.draft.results[0].verdict = 'fail'; f.candidate.side.assessments.push(t.seal('conflict.json'));
  const conflict = f.report(); assert.equal(conflict.candidate.assessments.conflicts, 1); assert.equal(conflict.candidate.rows[0].assessments[0].conflicting, 1); assert.equal(conflict.candidate.rows[0].assessments[0].pass, 0); assert.equal(conflict.comparability, 'insufficient-evidence');
});

test('missing slots, excess repeats, invalid digests, skipped and unverified evidence stay visible', () => {
  const f = fixture(); f.candidate.selection.receipts.pop(); f.candidate.side.assessments.pop(); f.candidate.save();
  let r = f.report(); assert.equal(r.comparability, 'insufficient-evidence'); assert.equal(r.candidate.humanSuite.groups[0].slots[5].missing, 1); assert.equal(r.candidate.rows.at(-1)!.assessments[0].missing, 1);
  f.candidate.side.assessments[0].sha256 = sha256('tampered'); r = f.report(); assert.equal(r.candidate.assessments.invalid, 1);
  const g = fixture(), t = g.candidate.trials[0];
  t.draft.results[0] = { id: t.draft.results[0].id, verdict: 'skipped', reason: 'Not evaluated', evidence: [] };
  t.draft.results[1].verdict = 'unverified'; g.candidate.side.assessments[0] = t.seal();
  r = g.report(); assert.equal(r.comparability, 'insufficient-evidence'); assert.equal(r.candidate.rows[0].assessments[0].skipped, 1); assert.equal(r.candidate.rows[1].assessments[0].unverified, 1);
  g.candidate.selection.cohorts[0].repeats = 2; g.candidate.save(); r = g.report(); assert.ok(r.confounders.includes('repeats')); assert.equal(r.candidate.humanSuite.groups[0].slots[0].missing, 1);
});

test('reusing baseline evidence does not create independent trials and digest failures are sanitized at entry point', () => {
  const f = fixture(); f.spec.candidate = f.baseline.side;
  let r = f.report(); assert.equal(r.reusedCaptures, 6); assert.equal(r.comparability, 'confounded'); assert.ok(r.confounders.includes('reused-captures'));
  f.spec.baseline.selection.sha256 = sha256('bad'); f.save();
  const cli = spawnSync(process.execPath, [join(root, 'tools/compare-workflow.ts'), '--experiment', f.path], { encoding: 'utf8' });
  assert.equal(cli.status, 1); assert.doesNotMatch(cli.stderr, /PRIVATE_|experiment.json|selection.json/);
});

test('additional evaluators add no trials or usage; reused sessions suppress comparison totals', () => {
  const f = fixture();
  const session = randomUUID();
  for (const s of [f.baseline, f.candidate]) {
    s.side.assessments = s.trials.map((t, i) => {
      const sessionId = i === 0 ? session : randomUUID();
      const body = [
        { type: 'session_meta', payload: { id: sessionId, cli_version: host.version } },
        { type: 'turn_context', payload: { model: host.model } },
        { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 20, cached_input_tokens: 0, output_tokens: 5, reasoning_output_tokens: 0, total_tokens: 25 }, last_token_usage: { input_tokens: 20, cached_input_tokens: 0, output_tokens: 5, reasoning_output_tokens: 0, total_tokens: 25 } } } },
      ].map(x => JSON.stringify(x)).join('\n') + '\n';
      put(join(s.dir, String(i)), 'usage.jsonl', body);
      t.receipt.usage = { provider: 'codex', transcript: 'usage.jsonl', transcriptSha256: sha256(body), sessionId };
      writeFileSync(t.input.result, JSON.stringify(t.receipt)); t.draft.target.receiptSha256 = sha256(readFileSync(t.input.result));
      return t.seal();
    });
    s.side.evaluators.push({ ...evaluator, id: 'second evaluator' });
    s.side.assessments.push(...s.trials.map(t => { t.draft.evaluator.id = 'second evaluator'; return t.seal('second.json'); }));
  }
  const r = f.report(); assert.equal(r.comparability, 'confounded'); assert.ok(r.confounders.includes('reused-usage'));
  assert.equal(r.baseline.comparisonUsage, null); assert.equal(r.candidate.comparisonUsage, null);
  assert.equal(r.baseline.humanSuite.groups[0].usage.coverage.observed, 6);
  assert.equal(r.baseline.rows[0].human.pass, 1); assert.equal(r.baseline.rows[0].assessments.length, 2); assert.equal(r.baseline.assessments.valid, 12);
});

test('human unverified grades and excess trials prevent comparability independently of evaluator passes', () => {
  const f = fixture(), t = f.baseline.trials[0];
  t.receipt.humanReview.grades[0].verdict = 'unverified'; writeFileSync(t.input.result, JSON.stringify(t.receipt));
  t.draft.target.receiptSha256 = sha256(readFileSync(t.input.result)); f.baseline.side.assessments[0] = t.seal();
  let r = f.report(); assert.equal(r.comparability, 'insufficient-evidence'); assert.equal(r.baseline.rows[0].human.unverified, 1);
  const extra = suite().trials[0]; f.candidate.selection.receipts.push(extra.input); f.candidate.side.assessments.push(extra.seal()); f.candidate.save();
  r = f.report(); assert.equal(r.candidate.humanSuite.groups[0].slots[0].excess, 1); assert.equal(r.comparability, 'insufficient-evidence');
});

test('regression: comparison never grades attachment bytes from an unpinned second read', () => {
  const f = fixture(), target = f.baseline.side.assessments[0];
  f.baseline.trials[0].draft.results[0].verdict = 'fail';
  const alternate = f.baseline.trials[0].seal('alternate.json'), replacement = readFileSync(alternate.path);
  f.save();
  const original = fs.readFileSync; let reads = 0;
  fs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) => {
    if (String(args[0]) === target.path && ++reads === 2) writeFileSync(target.path, replacement);
    return Reflect.apply(original, fs, args);
  }) as typeof fs.readFileSync;
  syncBuiltinESMExports();
  try {
    const r = compareWorkflow(f.path);
    assert.equal(r.baseline.rows[0].assessments[0].fail, 0);
    assert.ok(r.baseline.assessments.invalid === 1 || r.baseline.rows[0].assessments[0].pass === 1);
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('regression: experiment enum values must be strings rather than coercible values', () => {
  const f = fixture();
  for (const value of [['human'], ['model'], null, true, 1, {}]) {
    const spec = structuredClone(f.spec) as any; spec.authorRole = value;
    writeFileSync(f.path, JSON.stringify(spec)); assert.throws(() => compareWorkflow(f.path), /schema/);
    spec.authorRole = 'human'; spec.baseline.evaluators[0].origin = value;
    writeFileSync(f.path, JSON.stringify(spec)); assert.throws(() => compareWorkflow(f.path), /schema/);
  }
});

test('regression: every parsed selection snapshot must match its pinned digest', () => {
  const f = fixture(); f.save();
  const changed = structuredClone(f.baseline.selection); changed.cohorts[0].repeats = 2;
  const replacement = JSON.stringify(changed), original = fs.readFileSync; let reads = 0;
  fs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) => {
    if (String(args[0]) === f.baseline.path && ++reads === 2) return args[1] ? replacement : Buffer.from(replacement);
    return Reflect.apply(original, fs, args);
  }) as typeof fs.readFileSync;
  syncBuiltinESMExports();
  try { assert.throws(() => compareWorkflow(f.path), /selection/); }
  finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});
