import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caseIds, prepare, sha256, verify } from './evaluate-workflow.ts';
import { git, put, repo, temp } from './lib/fixtures.ts';
import type { CaseId, Command } from './evaluate-workflow.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = join(root, 'tools/evaluate-workflow.ts');
const seed = prepare({ repo: root, out: join(temp(), 'seed'), command: 'next', caseId: 'caller' });
const seedManifest = JSON.parse(readFileSync(join(seed.packet, 'manifest.json'), 'utf8'));
// A real local git source makes dirty-tree and SHA tests independent of CI history.
const source = repo();
for (const path of Object.keys(seedManifest.files) as string[]) {
  if (path.startsWith('workspace/') && path !== 'workspace/AGENTS.md') put(source, path.slice(10), readFileSync(join(seed.packet, path), 'utf8'));
}
put(source, 'reports/493-change-impact-regression.md', readFileSync(join(seed.packet, 'oracle.md'), 'utf8'));
const paths = [...Object.keys(seedManifest.files).filter(p => p.startsWith('workspace/') && p !== 'workspace/AGENTS.md').map(p => p.slice(10)), 'reports/493-change-impact-regression.md'];
git(source, 'add', '--', ...paths);
git(source, 'commit', '-qm', 'Synthetic workflow replay source');

function trial(command: Command = 'next', caseId: CaseId = 'caller') {
  const dir = temp();
  const packet = prepare({ repo: source, out: join(dir, 'packet'), command, caseId });
  const manifest = JSON.parse(readFileSync(join(packet.packet, 'manifest.json'), 'utf8'));
  const a = 'Synthetic verifier fixture: pre-edit assessment. Not an observed model trial.\n';
  const b = 'Synthetic verifier fixture: final reconciliation. Not an observed model trial.\n';
  put(dir, 'a.txt', a); put(dir, 'b.txt', b);
  const result = {
    schema: 1, trialId: packet.id, packetSha256: packet.packetSha256, revision: packet.revision, command, caseId,
    host: { name: 'synthetic', version: 'test', model: 'not-a-model', settings: 'no model was called' },
    phases: [
      { id: 'a', outcome: 'completed', promptSha256: manifest.files['phase-a.md'], elapsedMs: 1, transcript: 'a.txt', transcriptSha256: sha256(a) },
      { id: 'b', outcome: 'completed', promptSha256: manifest.files['phase-b.md'], elapsedMs: 2, transcript: 'b.txt', transcriptSha256: sha256(b) },
    ],
    humanReview: { reviewer: 'Synthetic test fixture', grades: (manifest.criteria as string[]).map(id => ({ id, verdict: 'pass', reason: 'Synthetic verifier fixture only', evidence: [{ phase: 'b', quote: 'final reconciliation' }] })) },
    usage: null as null | { provider: string; transcript: string; transcriptSha256: string; sessionId: string },
  };
  const resultPath = join(dir, 'result.json');
  const save = () => writeFileSync(resultPath, JSON.stringify(result));
  save();
  return { dir, packet, manifest, result, resultPath, save, verify: () => { save(); return verify(packet.packet, packet.packetSha256, resultPath); } };
}

test('prepares all six C2 replays from committed source, with separate prompts and private oracle', () => {
  for (const command of ['next', 'fix'] as const) for (const caseId of caseIds) {
    const p = prepare({ repo: source, out: join(temp(), 'packet'), command, caseId });
    const m = JSON.parse(readFileSync(join(p.packet, 'manifest.json'), 'utf8'));
    assert.equal(p.revision, git(source, 'rev-parse', 'HEAD'));
    assert.equal(readFileSync(join(p.packet, 'oracle.md'), 'utf8').trimEnd(), git(source, 'show', `${p.revision}:reports/493-change-impact-regression.md`));
    assert.equal(readFileSync(join(p.packet, `workspace/skills/${command}/SKILL.md`), 'utf8').trimEnd(), git(source, 'show', `${p.revision}:skills/${command}/SKILL.md`));
    assert.equal(m.files['workspace/reports/493-change-impact-regression.md'], undefined);
    assert.notEqual(m.files['phase-a.md'], m.files['phase-b.md']);
    assert.equal(m.criteria.length, caseId === 'scope-growth' ? 4 : 3);
    assert.equal(sha256(readFileSync(join(p.packet, 'manifest.json'))), p.packetSha256);
  }
});

test('does not read dirty source, execute scripts, update or overwrite an existing packet', () => {
  const original = readFileSync(join(source, 'README.md'), 'utf8');
  put(source, 'README.md', 'dirty uncommitted content');
  try {
    const p = prepare({ repo: source, out: join(temp(), 'packet'), command: 'fix', caseId: 'prose' });
    assert.equal(readFileSync(join(p.packet, 'workspace/README.md'), 'utf8'), original);
    assert.throws(() => prepare({ repo: source, out: p.packet, command: 'fix', caseId: 'prose' }), /EEXIST/);
  } finally { put(source, 'README.md', original); }
  assert.equal(git(source, 'status', '--porcelain'), '');
});

test('rejects source-overlapping output, invalid commands/cases and unpinned revisions', () => {
  const input = { repo: source, out: join(temp(), 'packet'), command: 'next' as const, caseId: 'caller' as const };
  assert.throws(() => prepare({ ...input, out: join(source, 'packet') }), /outside/);
  assert.throws(() => prepare({ ...input, revision: 'main' }), /full commit SHA/);
  assert.throws(() => prepare({ ...input, command: 'unknown' as any }), /Invalid command/);
  assert.throws(() => prepare({ ...input, caseId: 'unknown' as any }), /Invalid case/);
  const alias = join(temp(), 'source-link');
  symlinkSync(source, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => prepare({ ...input, out: join(alias, 'packet') }), /outside/);
});

test('accepts complete human attestations but labels their provenance limitation', () => {
  const t = trial(), v = t.verify();
  assert.equal(v.status, 'human-assessed-pass');
  assert.equal(v.elapsedMs, 3);
  assert.equal(v.usage, null);
  assert.match(v.limitation, /not independently verified model behavior/);
});

test('accepts a result directory reached through a directory link', () => {
  const t = trial(), alias = join(temp(), 'receipt-link');
  symlinkSync(t.dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(verify(t.packet.packet, t.packet.packetSha256, join(alias, 'result.json')).status, 'human-assessed-pass');
});

test('rejects captures reached through a directory link outside the result directory', () => {
  const t = trial(), outside = temp();
  put(outside, 'capture.txt', readFileSync(join(t.dir, 'a.txt'), 'utf8'));
  symlinkSync(outside, join(t.dir, 'outside-link'), process.platform === 'win32' ? 'junction' : 'dir');
  t.result.phases[0].transcript = 'outside-link/capture.txt';
  assert.throws(() => t.verify(), /resolves outside/);
});

test('resolves nested repo inputs before enforcing the source checkout boundary', () => {
  assert.throws(() => prepare({ repo: join(source, 'tools'), out: join(source, 'forbidden-packet'), command: 'next', caseId: 'caller' }), /outside/);
});

test('rejects source-overlapping output through a Windows short path', { skip: process.platform !== 'win32' }, context => {
  const alias = spawnSync('cmd.exe', ['/d', '/c', `for %I in ("${source}") do @echo %~sI`], { encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true });
  assert.equal(alias.status, 0, alias.stderr);
  const short = alias.stdout.trim();
  const long = resolve(git(source, 'rev-parse', '--show-toplevel'));
  if (resolve(short).toLowerCase() === long.toLowerCase()) { context.skip('Filesystem has no short-path alias.'); return; }
  assert.throws(() => prepare({ repo: short, out: join(short, 'forbidden-short-packet'), command: 'next', caseId: 'caller' }), /outside/);
});

test('preserves a behavioral failure or unverified grade instead of turning receipt validity into success', () => {
  const t = trial();
  t.result.humanReview.grades[0].verdict = 'fail';
  assert.equal(t.verify().status, 'human-assessed-fail');
  t.result.humanReview.grades[0].verdict = 'unverified';
  assert.equal(t.verify().status, 'unverified');
});

for (const field of ['trialId', 'packetSha256', 'revision', 'command', 'caseId'] as const) test(`rejects mismatched result ${field}`, () => {
  const t = trial(); (t.result as Record<string, unknown>)[field] = 'wrong'; assert.throws(() => t.verify(), /identity mismatch/);
});

test('rejects a changed manifest, packet content or phase prompt digest', () => {
  const t = trial();
  assert.throws(() => verify(t.packet.packet, '0'.repeat(64), t.resultPath), /Packet digest mismatch/);
  put(t.dir, 'packet/phase-b.md', 'tampered');
  assert.throws(() => t.verify(), /Packet artifact mismatch/);
  const u = trial(); u.result.phases[1].promptSha256 = '0'.repeat(64);
  assert.throws(() => u.verify(), /prompt mismatches/);
});

test('rejects missing, timed-out and failed phases even with passing human grades', () => {
  for (const outcome of ['timeout', 'failed', 'not-run']) {
    const t = trial(); t.result.phases[1].outcome = outcome;
    assert.throws(() => t.verify(), /incomplete/);
  }
  const t = trial(); t.result.phases.pop(); assert.throws(() => t.verify(), /Both phases/);
});

test('rejects missing, empty, directory, escaped and modified captures', () => {
  for (const path of ['absent.txt', '', '.', '../outside.txt', resolve(temp(), 'outside.txt')]) {
    const t = trial(); t.result.phases[0].transcript = path; assert.throws(() => t.verify());
  }
  const t = trial(); put(t.dir, 'a.txt', ''); assert.throws(() => t.verify(), /non-empty/);
  const u = trial(); put(u.dir, 'b.txt', 'modified'); assert.throws(() => u.verify(), /transcript digest mismatch/);
});

test('rejects reused captures, absent quotes and unknown or duplicated rubric criteria', () => {
  const t = trial(); t.result.phases[1].transcript = 'a.txt'; t.result.phases[1].transcriptSha256 = t.result.phases[0].transcriptSha256;
  assert.throws(() => t.verify(), /separate response captures/);
  const u = trial(); u.result.humanReview.grades[0].evidence[0].quote = 'fabricated success';
  assert.throws(() => u.verify(), /quote absent/);
  const v = trial(); v.result.humanReview.grades[0].id = 'unknown'; assert.throws(() => v.verify(), /criterion/);
  const w = trial(); w.result.humanReview.grades[0].id = w.result.humanReview.grades[1].id; assert.throws(() => w.verify(), /Duplicate/);
});

test('refuses success-only JSON, omitted human review, omitted grades, no evidence and invented usage', () => {
  const t = trial(); writeFileSync(t.resultPath, JSON.stringify({ success: true }));
  assert.throws(() => verify(t.packet.packet, t.packet.packetSha256, t.resultPath), /identity mismatch/);
  const u = trial(); (u.result as any).humanReview = null; assert.throws(() => u.verify(), /humanReview/);
  const v = trial(); v.result.humanReview.grades.pop(); assert.throws(() => v.verify(), /Every fixed criterion/);
  const w = trial(); w.result.humanReview.grades[0].evidence = []; assert.throws(() => w.verify(), /transcript evidence/);
  const x = trial(); (x.result as any).usage = { tokens: 0, cost: 0 }; assert.throws(() => x.verify(), /supplied totals are not accepted/);
});

const usageFixture = join(root, 'tools/fixtures/codex-session/usage.jsonl');
function attachUsage(t: ReturnType<typeof trial>, body = readFileSync(usageFixture, 'utf8')) {
  put(t.dir, 'usage.jsonl', body);
  t.result.host = { name: 'codex', version: '0.0.0-fixture', model: 'gpt-fixture', settings: 'Synthetic usage fixture; no candidate execution' };
  t.result.usage = { provider: 'codex', transcript: 'usage.jsonl', transcriptSha256: sha256(body), sessionId: 'fixture-session' };
}

test('all six C2 receipts derive optional session usage without adding repeated snapshots or subsets', () => {
  for (const command of ['next', 'fix'] as const) for (const caseId of caseIds) {
    const t = trial(command, caseId); attachUsage(t);
    const r = t.verify();
    assert.equal(r.status, 'human-assessed-pass');
    assert.equal(r.usage!.scope, 'session');
    assert.equal(r.usage!.association, 'operator-attested-trial-membership');
    assert.equal(r.usage!.report.totals!.totalTokens, 230);
    assert.equal(r.usage!.report.coverage, 'observed');
    assert.equal(r.usage!.report.source.sha256, t.result.usage!.transcriptSha256);
    assert.doesNotMatch(JSON.stringify(r), /PRIVATE_|usage.jsonl/);
    t.result.humanReview.grades[0].verdict = 'unverified';
    assert.equal(t.verify().status, 'unverified');
    t.result.humanReview.grades[0].verdict = 'fail';
    assert.equal(t.verify().status, 'human-assessed-fail');
  }
});

test('optional usage preserves partial, unavailable and zero coverage rather than inventing totals', () => {
  const body = readFileSync(usageFixture, 'utf8');
  const t = trial(); attachUsage(t, body + '{');
  assert.equal(t.verify().usage!.report.coverage, 'partial');
  assert.equal(t.verify().usage!.report.totals!.totalTokens, 230);
  const identity = body.split('\n').filter(line => /session_meta|turn_context/.test(line)).join('\n') + '\n';
  attachUsage(t, identity);
  assert.equal(t.verify().usage!.report.coverage, 'unavailable');
  assert.equal(t.verify().usage!.report.totals, null);
  const zero = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0 };
  attachUsage(t, identity + JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: zero } } }) + '\n');
  assert.equal(t.verify().usage!.report.totals!.totalTokens, 0);
  assert.equal(t.verify().usage!.report.coverage, 'observed');
  t.result.usage = null;
  assert.equal(t.verify().usage, null);
});

test('usage rejects changed bytes, missing source, escapes, directories and invented report fields', () => {
  const t = trial(); attachUsage(t);
  put(t.dir, 'usage.jsonl', readFileSync(usageFixture, 'utf8') + '\n');
  assert.throws(() => t.verify(), /Usage transcript digest mismatch/);
  for (const path of ['missing.jsonl', '.', '../outside.jsonl', resolve(temp(), 'outside.jsonl')]) {
    attachUsage(t); t.result.usage!.transcript = path; assert.throws(() => t.verify());
  }
  attachUsage(t); (t.result.usage as any).totals = { totalTokens: 0 };
  assert.throws(() => t.verify(), /supplied totals are not accepted/);
  const outside = temp(); put(outside, 'usage.jsonl', readFileSync(usageFixture, 'utf8'));
  symlinkSync(outside, join(t.dir, 'usage-link'), process.platform === 'win32' ? 'junction' : 'dir');
  attachUsage(t); t.result.usage!.transcript = 'usage-link/usage.jsonl';
  assert.throws(() => t.verify(), /resolves outside/);
});

test('usage requires consistent session, provider, producer version and model identity', () => {
  for (const [field, value] of [['sessionId', 'wrong'], ['sessionId', null], ['provider', 'claude'], ['transcriptSha256', 'bad']] as const) {
    const t = trial(); attachUsage(t); (t.result.usage as any)[field] = value; assert.throws(() => t.verify(), /Usage|usage/);
  }
  for (const field of ['name', 'version', 'model'] as const) {
    const t = trial(); attachUsage(t); t.result.host[field] = 'wrong'; assert.throws(() => t.verify(), /Usage|usage/);
  }
  const body = readFileSync(usageFixture, 'utf8');
  for (const bodyChange of [body.replaceAll('0.0.0-fixture', ''), body.replace('gpt-fixture', ''), body + JSON.stringify({ type: 'session_meta', payload: { id: 'other-session' } }) + '\n', body + JSON.stringify({ type: 'turn_context', payload: { model: 'other-model' } }) + '\n']) {
    const t = trial(); attachUsage(t, bodyChange); assert.throws(() => t.verify(), /identit|version|model/);
  }
});

test('usage refuses reset counters and malformed records even with valid source digests', () => {
  const body = readFileSync(usageFixture, 'utf8');
  const reset = { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0 } } } };
  const t = trial(); attachUsage(t, body + JSON.stringify(reset) + '\n');
  assert.throws(() => t.verify(), /counters decreased/);
  attachUsage(t, body + '{broken}\n'); assert.throws(() => t.verify(), /Malformed Codex JSON/);
});

test('CLI verifies source-backed usage without publishing the source path or content', () => {
  const t = trial(); attachUsage(t); t.save();
  const r = spawnSync(process.execPath, [entry, '--verify', '--packet', t.packet.packet, '--packet-sha', t.packet.packetSha256, '--result', t.resultPath], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).usage.report.totals.totalTokens, 230);
  assert.doesNotMatch(r.stdout, /PRIVATE_|usage.jsonl/);
});

test('validates host identity, non-empty reasons and positive elapsed time', () => {
  const t = trial(); t.result.host.model = ''; assert.throws(() => t.verify(), /host.model/);
  const u = trial(); u.result.phases[0].elapsedMs = -1; assert.throws(() => u.verify(), /positive elapsedMs/);
  const v = trial(); v.result.humanReview.grades[0].reason = ''; assert.throws(() => v.verify(), /grade reason/);
});

test('CLI entry points prepare and verify, and exit nonzero for failed, incomplete or invalid evidence', () => {
  const dir = temp(), out = join(dir, 'cli packet');
  const cli = (...args: string[]) => spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8' });
  const prepared = cli('--prepare', '--repo', source, '--command', 'fix', '--case', 'scope-growth', '--out', out);
  assert.equal(prepared.status, 0, prepared.stderr);
  assert.equal(JSON.parse(prepared.stdout).command, 'fix');
  const t = trial();
  const args = ['--verify', '--packet', t.packet.packet, '--packet-sha', t.packet.packetSha256, '--result', t.resultPath];
  assert.equal(JSON.parse(cli(...args).stdout).status, 'human-assessed-pass');
  for (const verdict of ['fail', 'unverified']) {
    t.result.humanReview.grades[0].verdict = verdict; t.save();
    const r = cli(...args); assert.equal(r.status, 1); assert.equal(JSON.parse(r.stdout).status, verdict === 'fail' ? 'human-assessed-fail' : 'unverified');
  }
  const invalid = cli('--verify', '--packet', t.packet.packet, '--packet-sha', 'bad', '--result', t.resultPath);
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /Packet digest mismatch/);
  assert.equal(cli('--prepare', '--verify').status, 1);
  assert.equal(cli('--verify', '--out', out).status, 1);
});
