import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Runner } from './lib/process.ts';
import type { WaitResult } from './wait-pull-request-check.ts';
import { invokeMerge, mergeExitCode } from './merge-pull-request.ts';
const input = { pullRequest: 9, headSha: 'abc123' };
const page = (nodes: object[] = [], more = false) => ({ data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: more }, nodes } } } } });
const node = (resolved = false, path = 'a.ps1') => ({ id: 't1', isResolved: resolved, isOutdated: false, path, line: 3 });
const response = (value: unknown, code = 0) => ({ code, found: true, stdout: typeof value === 'string' ? value : JSON.stringify(value), stderr: '' });
const passed = (values: Partial<WaitResult> = {}): WaitResult => ({ State: 'Passed', HeadSha: 'abc123', Failure: '', Passed: [], Failed: [], NotRun: [], PollCount: 1, ...values });
const wait = () => passed();
function mock(overrides: { pr?: object; threads?: unknown; merge?: string; mergeCode?: number; moved?: string } = {}) {
  const calls: string[][] = []; let views = 0;
  const runner: Runner = (_command, args) => {
    calls.push(args);
    if (args[0] === 'pr' && args[1] === 'view') return response(overrides.pr ?? { state: 'OPEN', isDraft: false, headRefOid: ++views > 1 && overrides.moved ? overrides.moved : 'abc123' });
    if (args[0] === 'repo') return response({ owner: { login: 'o' }, name: 'r' });
    if (args[0] === 'api') return response(overrides.threads ?? page());
    return response(overrides.merge ?? '', overrides.mergeCode ?? 0);
  };
  return { runner, calls };
}
const check = { Name: 'build', Bucket: 'fail', IsTerminal: true };
test('merge exit-code map only reports success for Merged and WouldMerge', () => {
  assert.equal(mergeExitCode('Merged'), 0); assert.equal(mergeExitCode('WouldMerge'), 0); assert.equal(mergeExitCode('Refused'), 1); assert.equal(mergeExitCode('NotEvaluated'), 2);
});
test('merge exit-code map throws for an unknown state', () => { assert.throws(() => mergeExitCode('Whatever')); });
test('merges an open non-draft matching head after checks and reviews pass', async () => {
  const r = await invokeMerge(input, mock().runner, wait); assert.equal(r.State, 'Merged'); assert.equal(r.Refusal, ''); assert.equal(mergeExitCode(r.State), 0);
});
test('refuses a pull request that is not open', async () => {
  const r = await invokeMerge(input, mock({ pr: { state: 'MERGED', isDraft: false, headRefOid: 'abc123' } }).runner, wait); assert.equal(r.State, 'Refused'); assert.equal(r.Refusal, 'NotOpen');
});
test('refuses a draft', async () => {
  const r = await invokeMerge(input, mock({ pr: { state: 'OPEN', isDraft: true, headRefOid: 'abc123' } }).runner, wait); assert.equal(r.State, 'Refused'); assert.equal(r.Refusal, 'IsDraft');
});
test('refuses a moved head before running checks', async () => {
  let checked = false;
  const r = await invokeMerge(input, mock({ pr: { state: 'OPEN', isDraft: false, headRefOid: 'deadbee' } }).runner, () => { checked = true; return passed(); });
  assert.equal(r.State, 'Refused'); assert.equal(r.Refusal, 'HeadMoved'); assert.match(r.Detail, /deadbee/); assert.equal(checked, false);
});
test('gh exit 4 is GhUnavailable and NotEvaluated', async () => {
  const r = await invokeMerge(input, () => response('', 4), wait); assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Refusal, 'GhUnavailable'); assert.equal(mergeExitCode(r.State), 2);
});
test('refuses failing checks and carries their names', async () => {
  const r = await invokeMerge(input, mock().runner, () => passed({ State: 'Failed', Passed: [{ ...check, Name: 'lint', Bucket: 'pass' }], Failed: [check] }));
  assert.equal(r.State, 'Refused'); assert.equal(r.Refusal, 'ChecksFailed'); assert.equal(r.Failed[0].Name, 'build');
});
test('no configured checks is not a pass', async () => {
  const r = await invokeMerge(input, mock().runner, () => passed({ State: 'NotEvaluated', Failure: 'NoChecksConfigured' }));
  assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Refusal, 'NoChecksConfigured'); assert.notEqual(mergeExitCode(r.State), 0);
});
test('carries a checks timeout through verbatim', async () => {
  const r = await invokeMerge(input, mock().runner, () => passed({ State: 'NotEvaluated', Failure: 'TimedOut', NotRun: [{ ...check, Name: 'slow' }] }));
  assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Refusal, 'TimedOut'); assert.equal(r.NotRun[0].Name, 'slow');
});
test('never calls merge for non-passing checks', async () => {
  const m = mock(); await invokeMerge(input, m.runner, () => passed({ State: 'Failed', Failed: [check] })); assert.equal(m.calls.some(a => a[1] === 'merge'), false);
});
test('refuses unresolved review threads and names them', async () => {
  const r = await invokeMerge(input, mock({ threads: page([node()]) }).runner, wait); assert.equal(r.State, 'Refused'); assert.equal(r.Refusal, 'UnresolvedThreads'); assert.equal(r.UnresolvedThreads.length, 1); assert.equal(r.UnresolvedThreads[0].Path, 'a.ps1');
});
test('ignores resolved threads', async () => {
  assert.equal((await invokeMerge(input, mock({ threads: page([node(true)]) }).runner, wait)).State, 'Merged');
});
test('requests slurp on the paginated GraphQL call', async () => {
  const m = mock(); await invokeMerge(input, m.runner, wait); assert.ok(m.calls.some(a => a[0] === 'api' && a.includes('--paginate') && a.includes('--slurp')));
});
test('counts unresolved threads across every page', async () => {
  const r = await invokeMerge(input, mock({ threads: [page([node(true)], true), page([node(false, 'b.ps1')])] }).runner, wait);
  assert.equal(r.State, 'Refused'); assert.equal(r.Refusal, 'UnresolvedThreads'); assert.equal(r.UnresolvedThreads[0].Path, 'b.ps1');
});
test('unslurped multi-page response fails closed', async () => {
  const r = await invokeMerge(input, mock({ threads: JSON.stringify(page([], true)) + JSON.stringify(page([node()])) }).runner, wait); assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Refusal, 'GhUnavailable');
});
test('always passes match-head-commit with the named SHA', async () => {
  const m = mock(); await invokeMerge(input, m.runner, wait); const a = m.calls.find(a => a[1] === 'merge')!; assert.equal(a[a.indexOf('--match-head-commit') + 1], 'abc123');
});
test('never passes admin', async () => {
  const m = mock(); await invokeMerge(input, m.runner, wait); assert.equal(m.calls.some(a => a.includes('--admin')), false);
});
test('uses the requested merge method', async () => {
  const m = mock(); await invokeMerge({ ...input, method: 'rebase' }, m.runner, wait); assert.ok(m.calls.some(a => a[1] === 'merge' && a.includes('--rebase')));
});
test('server rejection is Refused and carries the diagnostic', async () => {
  const r = await invokeMerge(input, mock({ merge: 'Protected branch update failed', mergeCode: 1 }).runner, wait); assert.equal(r.State, 'Refused'); assert.equal(r.Refusal, 'MergeRejected'); assert.match(r.Detail, /Protected branch/);
});
test('dry run evaluates every gate but does not merge', async () => {
  const m = mock(); const r = await invokeMerge({ ...input, dryRun: true }, m.runner, wait); assert.equal(r.State, 'WouldMerge'); assert.equal(m.calls.some(a => a[1] === 'merge'), false); assert.ok(m.calls.some(a => a[0] === 'api'));
});
test('refuses a head that moves after reading threads', async () => {
  const m = mock({ moved: 'newsha' }); const r = await invokeMerge(input, m.runner, wait); assert.equal(r.State, 'Refused'); assert.equal(r.Refusal, 'HeadMoved'); assert.equal(m.calls.some(a => a[1] === 'merge'), false);
});
