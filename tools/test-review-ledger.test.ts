import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { put, temp } from './lib/fixtures.ts';
import { run } from './lib/process.ts';
import { evaluateLedger as evaluate, ledgerExitCode } from './test-review-ledger.ts';
import { auditArgs, ciArgs, npmCliPath, rebuildArgs } from './fixtures/rea-installer/helpers.ts';
import { install as defective } from './fixtures/rea-installer/install-defective.ts';
import { install as fixed } from './fixtures/rea-installer/install-fixed.ts';

const script = fileURLToPath(new URL('./test-review-ledger.ts', import.meta.url));
const passed = { Syntax: 'passed — tsc', Unit: 'passed — 12/12', Integration: 'not applicable — one component', 'Entry point': 'passed — ran main against a mock', 'End to end': 'passed — ran it for real' };
type Levels = Partial<Record<keyof typeof passed | 'Risk check', string | null>>;
function ledger(risk: string, sections: string[] = [], levels: Levels = {}, header: string[] = []) {
  const lines = Object.entries({ ...passed, ...levels }).filter(([, value]) => value !== null).map(([level, value]) => `${level}: ${value}`);
  return [`# Review — x`, '', 'Deliverable: x', `Risk: ${risk} — why`, ...header, '', '## Verification', ...lines, '', ...sections].join('\n');
}
const pass = (id: string, kind = 'review', vendor = 'openai', model = 'gpt') => `## ${id}\nKind: ${kind}\nRevision: abc\nVendor: ${vendor}\nModel: ${model}\nDate: 2026-10-24\n`;
const finding = (id: string, severity: string, status: string, raised = 'R1', extra: Record<string, string> = {}) =>
  [`## ${id}`, `Severity: ${severity}`, `Status: ${status}`, `Raised in: ${raised}`, `Where: src/a.ts:${id.slice(1)}`, `Claim: claim ${id}`, 'Evidence: test output: expected 1, got 2',
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`), ''].join('\n');
const correction = (id: string, fixes: string) => `## ${id}\nRevision: def\nFixes: ${fixes}\n`;

test('LOW risk with every level passed needs no independent review: COMPLETE', () => {
  const r = evaluate(ledger('LOW')); assert.equal(r.State, 'COMPLETE'); assert.equal(r.NextReview, 'review'); assert.equal(ledgerExitCode(r.State), 0);
});
test('MEDIUM risk with no review yet is VERIFYING, asking for the one review', () => {
  const r = evaluate(ledger('MEDIUM')); assert.equal(r.State, 'VERIFYING'); assert.match(r.Next, /independent review/); assert.equal(r.NextReview, 'review');
});
test('HIGH risk needs its risk check recorded before it can complete', () => {
  assert.equal(evaluate(ledger('HIGH', [pass('R1')])).State, 'VERIFYING');
  assert.equal(evaluate(ledger('HIGH', [pass('R1')], { 'Risk check': 'passed — sandbox dry run' })).State, 'COMPLETE');
});
test('the budget lives in the record, so separate sessions, vendors and models share it', () => {
  const sections = [pass('R1', 'review', 'openai', 'gpt'), finding('F1', 'BLOCKING', 'resolved'), correction('C1', 'F1'), pass('R2', 're-review', 'anthropic', 'opus')];
  const r = evaluate(ledger('MEDIUM', sections));
  assert.equal(r.Reviews.Used, 2); assert.equal(r.Reviews.Remaining, 0); assert.equal(r.Corrections.Remaining, 0); assert.equal(r.NextReview, 'none'); assert.equal(r.State, 'COMPLETE');
});
test('a third review pass without authorization is over budget', () => {
  const r = evaluate(ledger('MEDIUM', [pass('R1'), correction('C1', 'F1'), pass('R2', 're-review'), pass('R3', 'review', 'google', 'gemini')]));
  assert.equal(r.State, 'Invalid'); assert.equal(r.Problems[0].Check, 'OverBudget'); assert.equal(ledgerExitCode(r.State), 1);
});
test("the user's authorization allows one more review and one more correction", () => {
  const r = evaluate(ledger('MEDIUM', [pass('R1'), correction('C1', 'F1'), pass('R2', 're-review'), pass('R3')], {}, ['Authorized: 2026-10-24 — "review it once more after the API change"']));
  assert.equal(r.State, 'COMPLETE'); assert.equal(r.Reviews.Allowed, 3); assert.equal(r.Corrections.Allowed, 2);
});
test('a second consolidated correction after review is over budget', () => {
  const r = evaluate(ledger('MEDIUM', [pass('R1'), correction('C1', 'F1'), correction('C2', 'F2')]));
  assert.equal(r.Problems[0].Check, 'OverBudget'); assert.equal(r.Problems[0].Section, 'C2');
});
test('an open BLOCKING finding asks for one consolidated correction', () => {
  const r = evaluate(ledger('MEDIUM', [pass('R1'), finding('F1', 'BLOCKING', 'open'), finding('F2', 'BLOCKING', 'open')]));
  assert.equal(r.State, 'CORRECTING'); assert.deepEqual(r.OpenBlocking, ['F1', 'F2']); assert.match(r.Next, /F1, F2 in one change.*C1/);
});
test('after the correction the next pass is a targeted re-review', () => {
  const r = evaluate(ledger('MEDIUM', [pass('R1'), finding('F1', 'BLOCKING', 'resolved'), correction('C1', 'F1')]));
  assert.equal(r.State, 'VERIFYING'); assert.equal(r.NextReview, 're-review'); assert.match(r.Next, /corrections/);
});
test('a new evidenced BLOCKING finding after the budget is spent is BLOCKED, never COMPLETE', () => {
  const r = evaluate(ledger('MEDIUM', [pass('R1'), finding('F1', 'BLOCKING', 'resolved'), correction('C1', 'F1'), pass('R2', 're-review'), finding('F2', 'BLOCKING', 'open', 'R2')]));
  assert.equal(r.State, 'BLOCKED'); assert.equal(r.NextReview, 'none'); assert.match(r.Next, /F2/);
});
test('a duplicate finding does not force a correction', () => {
  const r = evaluate(ledger('MEDIUM', [pass('R1'), finding('F1', 'BLOCKING', 'resolved'), correction('C1', 'F1'), pass('R2', 're-review'), finding('F2', 'DUPLICATE', 'open', 'R2', { 'Duplicate of': 'F1' })]));
  assert.equal(r.State, 'COMPLETE'); assert.deepEqual(r.OpenBlocking, []);
});
test('a repeat not marked DUPLICATE is rejected, and so is a duplicate naming nothing', () => {
  const repeat = `## F2\nSeverity: BLOCKING\nStatus: open\nRaised in: R2\nWhere: src/a.ts:1\nClaim: claim F1\nEvidence: same as before\n`;
  assert.equal(evaluate(ledger('MEDIUM', [pass('R1'), finding('F1', 'BLOCKING', 'resolved'), correction('C1', 'F1'), pass('R2', 're-review'), repeat])).Problems[0].Check, 'UnmarkedDuplicate');
  assert.equal(evaluate(ledger('MEDIUM', [pass('R1'), finding('F1', 'DUPLICATE', 'open', 'R1', { 'Duplicate of': 'F9' })])).Problems[0].Check, 'BadDuplicate');
});
test('a finding comes back only with new evidence', () => {
  const reopened = (by: string) => ledger('MEDIUM', [pass('R1'), finding('F1', 'BLOCKING', 'resolved'), correction('C1', 'F1'), pass('R2', 're-review'),
    `## F2\nSeverity: BLOCKING\nStatus: open\nRaised in: R2\nWhere: src/a.ts:1\nClaim: claim F1\nEvidence: new trace\nReopened by: ${by}\n`]);
  assert.equal(evaluate(reopened('')).Problems[0].Check, 'ReopenWithoutEvidence');
  assert.equal(evaluate(reopened('a new failing test, tools/a.test.ts:40')).State, 'BLOCKED');
});
test('BLOCKING without evidence is rejected; it is SPECULATIVE', () => {
  const r = evaluate(ledger('MEDIUM', [pass('R1'), '## F1\nSeverity: BLOCKING\nStatus: open\nRaised in: R1\nWhere: a\nClaim: b\nEvidence:\n']));
  assert.equal(r.State, 'Invalid'); assert.equal(r.Problems[0].Check, 'MissingEvidence');
});
test('a re-review opens nothing but BLOCKING findings', () => {
  const r = evaluate(ledger('MEDIUM', [pass('R1'), correction('C1', 'F1'), pass('R2', 're-review'), finding('F2', 'NON-BLOCKING', 'open', 'R2')]));
  assert.equal(r.Problems[0].Check, 'OutsideReReview');
  assert.equal(evaluate(ledger('MEDIUM', [pass('R1'), correction('C1', 'F1'), pass('R2', 're-review'), finding('F2', 'NON-BLOCKING', 'tracked', 'R2')])).State, 'COMPLETE');
});
test('accepted risk needs the user\'s words, and then ends ACCEPTED_RISK', () => {
  const sections = (extra: Record<string, string>) => [pass('R1'), finding('F1', 'BLOCKING', 'accepted risk', 'R1', extra)];
  assert.equal(evaluate(ledger('MEDIUM', sections({}))).Problems[0].Check, 'AcceptedWithoutUser');
  assert.equal(evaluate(ledger('MEDIUM', sections({ Accepted: '"ship it, we will fix it in v2"' }))).State, 'ACCEPTED_RISK');
});
test('no entry-point evidence prevents COMPLETE', () => {
  assert.equal(evaluate(ledger('LOW', [], { 'Entry point': null })).State, 'VERIFYING');
  assert.equal(evaluate(ledger('LOW', [], { 'Entry point': 'passed' })).Problems[0].Check, 'MissingEvidence');
  assert.equal(evaluate(ledger('LOW', [], { 'Entry point': 'not run — no sandbox' })).State, 'BLOCKED');
});
test('the entry point runs before review: an unassessed level outranks the missing review', () => {
  const r = evaluate(ledger('MEDIUM', [], { 'Entry point': null })); assert.equal(r.State, 'VERIFYING'); assert.match(r.Next, /Entry point/);
});
test('a failed level is corrected like a BLOCKING finding, and a correction before review is not counted', () => {
  assert.equal(evaluate(ledger('LOW', [], { 'Entry point': 'failed — Cannot find module npm-cli.jsrebuild' })).State, 'CORRECTING');
  const r = evaluate(ledger('MEDIUM', [correction('C1', 'F1'), pass('R1'), finding('F2', 'BLOCKING', 'open')]));
  assert.equal(r.Corrections.Used, 0); assert.equal(r.State, 'CORRECTING');
});
test('end to end not run, everything else passed, is READY_FOR_EXECUTION', () => {
  const r = evaluate(ledger('LOW', [], { 'End to end': 'not run — writes to the production database; needs the go-ahead' }));
  assert.equal(r.State, 'READY_FOR_EXECUTION'); assert.match(r.Next, /production database/);
});
test('not run and not applicable need a reason; passed and failed need evidence', () => {
  assert.equal(evaluate(ledger('LOW', [], { Integration: 'not applicable' })).Problems[0].Check, 'MissingReason');
  assert.equal(evaluate(ledger('LOW', [], { Unit: 'green' })).Problems[0].Check, 'BadValue');
});
test('risk is required and is one of three levels', () => {
  assert.equal(evaluate(ledger('SEVERE')).Problems[0].Check, 'BadRisk');
});
test('a cancelled record ends CANCELLED whatever else it holds', () => {
  assert.equal(evaluate(ledger('HIGH', [pass('R1'), finding('F1', 'BLOCKING', 'open')], {}, ['Cancelled: 2026-10-24 — "drop it"'])).State, 'CANCELLED');
});

// The five risk cases the policy is demonstrated on.
test('risk cases: trivial fix, medium subsystem, high-risk installer, large low-risk change, small security fix', () => {
  const trivial = evaluate(ledger('LOW'));
  const subsystem = evaluate(ledger('MEDIUM', [pass('R1'), finding('F1', 'BLOCKING', 'resolved'), correction('C1', 'F1'), pass('R2', 're-review')]));
  const installer = evaluate(ledger('HIGH', [pass('R1')], { 'Risk check': 'passed — install into a throwaway prefix', 'End to end': 'not run — real install needs the user' }));
  const largeLow = evaluate(ledger('LOW', [], { Unit: 'passed — 412/412 across 60 renamed files' }));
  const security = evaluate(ledger('HIGH', [pass('R1')], { 'Risk check': null }));
  assert.deepEqual([trivial.State, subsystem.State, installer.State, largeLow.State, security.State], ['COMPLETE', 'COMPLETE', 'READY_FOR_EXECUTION', 'COMPLETE', 'VERIFYING']);
  assert.deepEqual([trivial.Reviews.Used, subsystem.Reviews.Used, installer.Reviews.Used, largeLow.Reviews.Used], [0, 2, 1, 0]);
});

test('the command line: a missing record exits 2, an over-budget one exits 1', () => {
  const root = temp();
  try {
    assert.equal(run(process.execPath, [script, '--path', `${root}/none.md`, '--quiet']).code, 2);
    const path = put(root, 'reviews/x.md', ledger('MEDIUM', [pass('R1'), pass('R2'), pass('R3')]));
    const r = run(process.execPath, [script, '--path', path, '--quiet']);
    assert.equal(r.code, 1); assert.equal(JSON.parse(r.stdout).Problems[0].Check, 'OverBudget');
    assert.notEqual(run(process.execPath, [script, '--quiet']).code, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// The REA installer, replayed: helper tests pass on both copies; only the entry point tells them apart.
const recording = () => {
  const calls: string[][] = [];
  const runner = (command: string, args: string[]) => { calls.push([command, ...args]); return args[0]?.endsWith('npm-cli.js') ? 0 : 1; };
  return { calls, runner };
};
test('REA: the helpers are green, the defect is not in them', () => {
  assert.match(npmCliPath('/x'), /npm-cli\.js$/); assert.equal(ciArgs()[0], 'ci'); assert.deepEqual(rebuildArgs(['frida']), ['rebuild', 'frida']); assert.equal(auditArgs()[0], 'audit');
});
test('REA: the entry point fails on the defective installer and passes on the fixed one', () => {
  const bad = recording(), good = recording();
  assert.equal(defective('/x', 'node', bad.runner), 1); assert.doesNotMatch(bad.calls[0][1], /npm-cli\.js$/);
  assert.equal(fixed('/x', 'node', good.runner), 0); assert.equal(good.calls.length, 3);
  for (const call of good.calls) assert.match(call[1], /npm-cli\.js$/);
  assert.deepEqual(good.calls[1].slice(2), ['rebuild', 'frida']);
});
test('REA: the replay record ends READY_FOR_EXECUTION after one review, with nothing left to review', () => {
  const path = fileURLToPath(new URL('./fixtures/rea-installer/review.md', import.meta.url));
  assert.ok(existsSync(path));
  const r = evaluate(readFileSync(path, 'utf8'));
  assert.deepEqual(r.Problems, []); assert.equal(r.State, 'READY_FOR_EXECUTION'); assert.equal(r.Reviews.Used, 1); assert.equal(r.Corrections.Used, 0); assert.equal(r.NextReview, 'none');
});
