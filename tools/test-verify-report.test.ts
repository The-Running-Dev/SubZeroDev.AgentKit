import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib/process.ts';
import { getVerifyReportDocument, invokeVerifyReportCheck as check, verifyReportExitCode as exitCode } from './test-verify-report.ts';
function temp(t: TestContext) { const root = mkdtempSync(join(tmpdir(), 'verify-report-')); t.after(() => rmSync(root, { recursive: true, force: true })); return root; }
const report = (...gates: object[]) => ({ gates });
test('a Passed gate needs no detail, Valid, exit 0', () => {
  const r = check(report({ name: 'Pester', status: 'Passed' })); assert.equal(r.State, 'Valid'); assert.equal(r.Findings.length, 0); assert.equal(r.GateCount, 1); assert.equal(exitCode(r.State), 0);
});
test('a Failed gate with real pasted output is Valid', () => {
  assert.equal(check(report({ name: 'npm test', status: 'Failed', detail: 'Expected 200, got 500 at line 42 of api.test.js' })).State, 'Valid');
});
test('a DidNotRun gate with a stated reason is Valid', () => {
  assert.equal(check(report({ name: 'docs.ps1', status: 'DidNotRun', reason: 'Docker unavailable' })).State, 'Valid');
});
test('several gates with distinct names and valid outcomes together are Valid', () => {
  const r = check(report({ name: 'Pester', status: 'Passed' }, { name: 'lint', status: 'Failed', detail: '3 errors: unused var x at line 9, missing semi at line 22' }, { name: 'docs.ps1', status: 'DidNotRun', reason: 'Docker unavailable' }));
  assert.equal(r.State, 'Valid'); assert.equal(r.GateCount, 3);
});
test('unknown status is rejected rather than dropped', () => {
  const r = check(report({ name: 'test', status: 'Skipped' })); assert.equal(r.State, 'Invalid'); assert.equal(r.Findings[0].Kind, 'UnknownStatus'); assert.equal(exitCode(r.State), 1);
});
test('Failed with no detail is rejected', () => {
  const r = check(report({ name: 'npm test', status: 'Failed' })); assert.equal(r.State, 'Invalid'); assert.equal(r.Findings[0].Kind, 'MissingDetail');
});
test('Failed with a one-word detail is rejected', () => {
  const r = check(report({ name: 'npm test', status: 'Failed', detail: 'broken' })); assert.equal(r.State, 'Invalid'); assert.equal(r.Findings[0].Kind, 'TrivialDetail');
});
test('DidNotRun with no reason is rejected', () => {
  const r = check(report({ name: 'docs.ps1', status: 'DidNotRun' })); assert.equal(r.State, 'Invalid'); assert.equal(r.Findings[0].Kind, 'MissingReason');
});
test('duplicate gate names are rejected', () => {
  const r = check(report({ name: 'Pester', status: 'Passed' }, { name: 'Pester', status: 'Failed', detail: 'the second run disagreed with the first, full trace attached' })); assert.equal(r.State, 'Invalid'); assert.equal(r.Findings[0].Kind, 'DuplicateGate');
});
test('a gate with no name is rejected', () => {
  const r = check(report({ status: 'Passed' })); assert.equal(r.State, 'Invalid'); assert.equal(r.Findings[0].Kind, 'EmptyName');
});
test('an empty gates array is rejected', () => {
  const r = check(report()); assert.equal(r.State, 'Invalid'); assert.equal(r.Findings[0].Kind, 'NoGates');
});
test('missing gates property is NotEvaluated, never Invalid', () => {
  const r = check({ generated: '2026-08-12' }); assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Failures[0].Reason, 'NoGatesProperty'); assert.equal(exitCode(r.State), 2);
});
test('missing report file is NotEvaluated', t => {
  assert.equal(getVerifyReportDocument(join(temp(t), 'nothing-here.json')).Failure?.Reason, 'ReportMissing');
});
test('invalid JSON is unreadable, not Invalid', t => {
  const path = join(temp(t), 'bad.json'); writeFileSync(path, '{ this is not json'); assert.equal(getVerifyReportDocument(path).Failure?.Reason, 'ReportUnreadable');
});
test('report exit-code map rejects an unknown state', () => {
  assert.equal(exitCode('Valid'), 0); assert.equal(exitCode('Invalid'), 1); assert.equal(exitCode('NotEvaluated'), 2); assert.throws(() => exitCode('Something'));
});
test('default path uses caller cwd: missing report exits 2', t => {
  const r = run(process.execPath, [fileURLToPath(new URL('./test-verify-report.ts', import.meta.url)), '--quiet'], { cwd: temp(t) }); assert.equal(r.code, 2); assert.equal(JSON.parse(r.stdout).State, 'NotEvaluated');
});
test('default path reads caller report, not the kit report', t => {
  const root = temp(t); mkdirSync(join(root, '.claude')); writeFileSync(join(root, '.claude/verify-report.json'), JSON.stringify(report({ name: 'caller-only-gate', status: 'Passed' })));
  const r = run(process.execPath, [fileURLToPath(new URL('./test-verify-report.ts', import.meta.url))], { cwd: root }); assert.equal(r.code, 0); assert.equal(JSON.parse(r.stdout).GateCount, 1); assert.match(r.stderr, /Gates in report: 1/);
});
