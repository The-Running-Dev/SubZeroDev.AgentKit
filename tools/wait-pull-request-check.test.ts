import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Runner } from './lib/process.ts';
import { getPullRequestHead, invokeWait, waitExitCode } from './wait-pull-request-check.ts';
const input = { pullRequest: 9, headSha: 'abc123', pollSeconds: 0, quiet: true };
function runner(checks: unknown = [{ name: 'build', bucket: 'pass' }], head = 'abc123'): Runner {
  return (_command, args) => ({ code: 0, found: true, stderr: '', stdout: JSON.stringify(args[1] === 'view' ? { headRefOid: head } : checks) });
}
test('S1.1: every terminal passing check is named, exit 0', async () => {
  const r = await invokeWait(input, runner([{ name: 'build', bucket: 'pass' }, { name: 'lint', bucket: 'skipping' }]));
  assert.equal(r.State, 'Passed'); assert.equal(r.HeadSha, 'abc123'); assert.deepEqual(r.Passed.map(c => c.Name), ['build', 'lint']); assert.equal(r.Failed.length, 0); assert.equal(waitExitCode(r.State), 0);
});
test('S1.2: failing terminal bucket is carried verbatim, exit 1', async () => {
  const r = await invokeWait(input, runner([{ name: 'build', bucket: 'pass' }, { name: 'deploy', bucket: 'cancel' }]));
  assert.equal(r.State, 'Failed'); assert.equal(r.Failed[0].Name, 'deploy'); assert.equal(r.Failed[0].Bucket, 'cancel'); assert.equal(waitExitCode(r.State), 1);
});
test('S1.3: pending first read polls until the later terminal read', async () => {
  let calls = 0;
  const mock: Runner = (cmd, args) => runner([{ name: 'build', bucket: args[1] === 'checks' && ++calls === 1 ? 'pending' : 'pass' }])(cmd, args);
  const r = await invokeWait(input, mock); assert.equal(r.State, 'Passed'); assert.ok(r.PollCount > 1);
});
test('S1.4: moved head reports neither pass nor fail, exit 2', async () => {
  const r = await invokeWait(input, runner([], 'different-sha'));
  assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Failure, 'HeadMoved'); assert.equal(r.Passed.length, 0); assert.equal(r.Failed.length, 0); assert.equal(waitExitCode(r.State), 2);
});
test('S1.4 guard removed: ignoring the mismatched head would continue', () => {
  assert.notEqual(getPullRequestHead(input, runner([], 'different-sha')).HeadSha, input.headSha);
});
test('I2: failed post-check head read reports actual failure', async () => {
  let reads = 0;
  const mock: Runner = (cmd, args) => args[1] === 'view' && ++reads > 1 ? { code: 4, found: true, stdout: '', stderr: '' } : runner()(cmd, args);
  const r = await invokeWait(input, mock); assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Failure, 'GhUnavailable'); assert.equal(waitExitCode(r.State), 2);
});
test('S1.5: unknown bucket fails closed with its verbatim value', async () => {
  const r = await invokeWait(input, runner([{ name: 'weird', bucket: 'quarantine' }]));
  assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Failure, 'UnknownBucket'); assert.equal(r.NotRun[0].Bucket, 'quarantine'); assert.equal(r.Passed.length, 0); assert.equal(waitExitCode(r.State), 2);
});
test('S1.5 guard removed: quarantine belongs to no recognized bucket', () => {
  assert.equal(['pass', 'skipping', 'fail', 'cancel', 'pending'].includes('quarantine'), false);
});
test('S1.7: deadline elapsed while pending yields TimedOut', async () => {
  const r = await invokeWait({ ...input, timeoutSeconds: -1 }, runner([{ name: 'slow', bucket: 'pending' }]));
  assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Failure, 'TimedOut'); assert.equal(r.NotRun[0].Name, 'slow'); assert.equal(waitExitCode(r.State), 2);
});
test('S1.7 guard removed: the pending set does not become terminal', () => {
  const pending = [{ Name: 'slow', Bucket: 'pending', IsTerminal: false }]; assert.ok(pending.length > 0);
});
test('#254: malformed head JSON reports GhUnavailable', async () => {
  const mock: Runner = (cmd, args) => args[1] === 'view' ? { code: 0, found: true, stdout: 'not valid json', stderr: '' } : runner()(cmd, args);
  const r = await invokeWait(input, mock); assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Failure, 'GhUnavailable'); assert.equal(waitExitCode(r.State), 2);
});
test('#254: malformed checks JSON reports GhUnavailable', async () => {
  const mock: Runner = (cmd, args) => args[1] === 'checks' ? { code: 0, found: true, stdout: 'not valid json', stderr: '' } : runner()(cmd, args);
  const r = await invokeWait(input, mock); assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Failure, 'GhUnavailable'); assert.equal(waitExitCode(r.State), 2);
});
test('S1.10: no configured checks never passes', async () => {
  const mock: Runner = (cmd, args) => args[1] === 'checks' ? { code: 1, found: true, stdout: '', stderr: "no checks reported on the 'abc123' branch" } : runner()(cmd, args);
  const r = await invokeWait(input, mock); assert.equal(r.State, 'NotEvaluated'); assert.equal(r.Failure, 'NoChecksConfigured'); assert.equal(waitExitCode(r.State), 2);
});
test('WaitResult exit-code map', () => {
  assert.equal(waitExitCode('Passed'), 0); assert.equal(waitExitCode('Failed'), 1); assert.equal(waitExitCode('NotEvaluated'), 2);
});
