import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caseCriteria, prepare, sha256, verify } from './evaluate-workflow.ts';
import { assessWorkflow, assessmentSchema, readAssessment } from './lib/workflow-assessment.ts';
import { temp, put } from './lib/fixtures.ts';
import type { CaseId } from './evaluate-workflow.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
function fixture(caseId: CaseId = 'caller', phaseB = 'Synthetic final reconciliation. No model was called.\n') {
  const dir = temp();
  const packet = prepare({ repo: root, out: join(dir, 'packet'), command: 'next', caseId });
  const manifest = JSON.parse(readFileSync(join(packet.packet, 'manifest.json'), 'utf8'));
  const captures = { a: 'Synthetic initial assessment. No model was called.\n', b: phaseB };
  for (const [phase, capture] of Object.entries(captures)) put(dir, `${phase}.txt`, capture);
  const receipt = { schema: 1, trialId: packet.id, packetSha256: packet.packetSha256, revision: packet.revision,
    command: 'next', caseId, host: { name: 'synthetic', version: '1', model: 'mock', settings: 'offline' },
    phases: (['a', 'b'] as const).map(id => ({ id, outcome: 'completed', promptSha256: manifest.files[`phase-${id}.md`],
      elapsedMs: 1, transcript: `${id}.txt`, transcriptSha256: sha256(captures[id]) })),
    humanReview: { reviewer: 'Synthetic fixture', grades: caseCriteria(caseId).map(id => ({ id, verdict: 'unverified',
      reason: 'Synthetic only', evidence: [{ phase: 'b', quote: 'final reconciliation' }] })) }, usage: null };
  const result = put(dir, 'receipt.json', JSON.stringify(receipt));
  const input = { packet: packet.packet, packetSha256: packet.packetSha256, result };
  const draft = { schema: assessmentSchema, target: { trialId: packet.id, packetSha256: packet.packetSha256,
    receiptSha256: sha256(readFileSync(result)), transcripts: { a: sha256(captures.a), b: sha256(captures.b) } },
    evaluator: { id: 'mock', version: '1', codeSha256: sha256('code'), configSha256: sha256('config'), rubricSha256: sha256('rubric'), origin: 'mock' },
    execution: 'synthetic', review: { status: 'unreviewed' },
    results: caseCriteria(caseId).map(id => ({ id, verdict: 'pass', reason: 'Synthetic fixture only', evidence: [{ phase: 'b', quote: 'final reconciliation', start: 10 }] })) };
  return { dir, input, draft, receipt };
}
test('seals independent assessments without promoting human grades or changing capture bytes', () => {
  const f = fixture();
  const before = readFileSync(f.input.result);
  const first = assessWorkflow(f.input, f.draft);
  assert.deepEqual(assessWorkflow(f.input, first, true), first);
  const reordered = Object.fromEntries(Object.entries(f.draft).reverse());
  assert.equal(assessWorkflow(f.input, reordered).assessmentSha256, first.assessmentSha256);
  for (const mutate of [
    (d: typeof f.draft) => { d.evaluator.id = 'second'; },
    (d: typeof f.draft) => { d.evaluator.version = '2'; },
    (d: typeof f.draft) => { d.evaluator.codeSha256 = sha256('other'); },
    (d: typeof f.draft) => { d.evaluator.configSha256 = sha256('other'); },
    (d: typeof f.draft) => { d.evaluator.rubricSha256 = sha256('other'); },
    (d: typeof f.draft) => { d.results[0].verdict = 'fail'; },
    (d: typeof f.draft) => { d.review.status = 'accepted'; },
    (d: typeof f.draft) => { d.execution = 'replay'; },
  ]) {
    const draft = structuredClone(f.draft); mutate(draft);
    assert.notEqual(assessWorkflow(f.input, draft).assessmentSha256, first.assessmentSha256);
  }
  assert.deepEqual(readFileSync(f.input.result), before);
  assert.equal(verify(f.input.packet, f.input.packetSha256, f.input.result).status, 'unverified');
});
test('rejects malformed assessments, wrong targets and invented or wrong-phase evidence', () => {
  const f = fixture();
  const mutations: ((d: any) => void)[] = [
    d => { d.schema = 'v2'; }, d => { d.extra = true; },
    d => { d.target.trialId = 'other'; }, d => { d.target.packetSha256 = sha256('other'); },
    d => { d.target.receiptSha256 = sha256('other'); }, d => { d.target.transcripts.a = sha256('other'); },
    d => { d.evaluator.origin = 'automatic'; }, d => { d.evaluator.codeSha256 = 'bad'; },
    d => { d.evaluator.version = ''; }, d => { d.execution = 'observed'; }, d => { d.review.status = 'pass'; },
    d => { d.results.pop(); }, d => { d.results[0].id = 'unknown'; }, d => { d.results[0].id = d.results[1].id; },
    d => { d.results[0].verdict = 'maybe'; }, d => { d.results[0].reason = ''; },
    d => { d.results[0].evidence = []; }, d => { d.results[0].evidence[0].phase = 'a'; },
    d => { d.results[0].evidence[0].quote = 'invented'; }, d => { d.results[0].evidence[0].start = 11; },
    d => { d.results[0].evidence[0].start = -1; }, d => { d.results[0].evidence[0].start = 0.5; },
    d => { d.results[0].evidence = Array(17).fill(d.results[0].evidence[0]); },
    d => { d.results[0].reason = 'x'.repeat(4097); }, d => { d.results[0].reason = 'x'.repeat(262145); },
    d => { d.results[0].verdict = 'skipped'; },
  ];
  for (const mutate of mutations) { const d = structuredClone(f.draft); mutate(d); assert.throws(() => assessWorkflow(f.input, d)); }
  const sealed = assessWorkflow(f.input, f.draft);
  sealed.assessmentSha256 = sha256('wrong');
  assert.throws(() => assessWorkflow(f.input, sealed, true), /identity mismatch/);
});
test('preserves fail, unverified and skipped separately; skipped requires reason and no quote', () => {
  const f = fixture();
  f.draft.results[0].verdict = 'fail'; f.draft.results[1].verdict = 'unverified';
  f.draft.results[2] = { id: f.draft.results[2].id, verdict: 'skipped', reason: 'No applicable evaluator', evidence: [] };
  assert.deepEqual(assessWorkflow(f.input, f.draft).results.map((r: any) => r.verdict), ['fail', 'unverified', 'skipped']);
});
test('revalidates original verifier and capture bytes when reading a sealed attachment', () => {
  for (const tamper of ['phase', 'receipt', 'human', 'packet']) {
    const f = fixture(); const sealed = assessWorkflow(f.input, f.draft);
    if (tamper === 'phase') put(f.dir, 'b.txt', 'changed');
    if (tamper === 'receipt') writeFileSync(f.input.result, JSON.stringify(f.receipt) + '\n');
    if (tamper === 'human') { f.receipt.humanReview.grades = []; writeFileSync(f.input.result, JSON.stringify(f.receipt)); }
    if (tamper === 'packet') put(f.input.packet, 'phase-a.md', 'changed');
    assert.throws(() => assessWorkflow(f.input, sealed, true));
  }
});
test('offline CLI writes distinct attachments exclusively and emits only schema and digest', () => {
  const f = fixture(); const draft = put(f.dir, 'draft.json', JSON.stringify(f.draft));
  const out = join(f.dir, 'attachment.json');
  const args = [join(root, 'tools/assess-workflow.ts'), '--packet', f.input.packet, '--packet-sha', f.input.packetSha256,
    '--result', f.input.result, '--assessment', draft, '--out', out];
  const run = () => spawnSync(process.execPath, args, { encoding: 'utf8' });
  const first = run(); assert.equal(first.status, 0, first.stderr);
  const attachment = assessWorkflow(f.input, readAssessment(out), true);
  assert.deepEqual(JSON.parse(first.stdout), { schema: assessmentSchema, assessmentSha256: attachment.assessmentSha256 });
  const bytes = readFileSync(out); assert.equal(run().status, 1); assert.deepEqual(readFileSync(out), bytes);
  f.draft.evaluator.version = '2'; writeFileSync(draft, JSON.stringify(f.draft)); args[args.length - 1] = join(f.dir, 'second.json');
  assert.equal(run().status, 0); assert.notEqual((readAssessment(args.at(-1)!) as any).assessmentSha256, attachment.assessmentSha256);
  writeFileSync(draft, 'x'.repeat(262145)); const rejected = run(); assert.equal(rejected.status, 1);
  assert.equal(rejected.stdout, ''); assert.ok(!rejected.stderr.includes(f.dir));
});

test('near-boundary scope-growth CLI outputs remain readable; oversized sealed bytes are rejected', () => {
  const f = fixture('scope-growth', 'final reconciliation' + 'x'.repeat(4000));
  const draft = join(f.dir, 'draft.json'); const out = join(f.dir, 'attachment.json');
  const run = () => spawnSync(process.execPath, [join(root, 'tools/assess-workflow.ts'), '--packet', f.input.packet,
    '--packet-sha', f.input.packetSha256, '--result', f.input.result, '--assessment', draft, '--out', out], { encoding: 'utf8' });
  for (const r of f.draft.results) r.evidence = Array.from({ length: 16 }, () => ({ phase: 'b', quote: 'x'.repeat(4000), start: 20 }));
  assert.ok(Buffer.byteLength(JSON.stringify(f.draft)) < 262144);
  writeFileSync(draft, JSON.stringify(f.draft));
  assert.equal(run().status, 1, 'must reject output that its reader cannot consume');
  for (const r of f.draft.results) for (const e of r.evidence) e.quote = 'x'.repeat(3900);
  writeFileSync(draft, JSON.stringify(f.draft));
  const result = run(); assert.equal(result.status, 0, result.stderr);
  assert.ok(readFileSync(out).length > 250000);
  assert.ok(assessWorkflow(f.input, readAssessment(out), true));
});
