import { run as runProcess } from './lib/process.ts';
import type { Runner, ProcessResult } from './lib/process.ts';
import { integerOption, parseOptions, requiredOption } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  'pull-request': { type: 'string' },
  'head-sha': { type: 'string' },
  repository: { type: 'string' },
  'timeout-seconds': { type: 'string' },
  'poll-seconds': { type: 'string' },
  quiet: { type: 'boolean' },
} as const;

export interface WaitOptions {
  pullRequest: number;
  headSha: string;
  repository?: string;
  timeoutSeconds?: number;
  pollSeconds?: number;
  quiet?: boolean;
}
export interface CheckRun { Name: string; Bucket: string; IsTerminal: boolean }
export interface WaitResult {
  State: string; HeadSha: string; Passed: CheckRun[]; Failed: CheckRun[];
  NotRun: CheckRun[]; Failure: string; PollCount: number;
}
export function waitExitCode(state: string): number {
  switch (state.toLowerCase()) {
    case 'passed': return 0;
    case 'failed': return 1;
    case 'notevaluated': return 2;
    default: throw new Error('Unknown WaitResult state: ' + state);
  }
}
export function ghFailure(result: ProcessResult): string {
  if (!result.found || result.code === 4) return 'GhUnavailable';
  return result.code === 0 ? '' : 'PullRequestMissing';
}
export function ghText(result: ProcessResult): string {
  return result.stdout + result.stderr;
}
export function repositoryArgs(repository?: string): string[] {
  return repository ? ['-R', repository] : [];
}
export function getPullRequestHead(input: WaitOptions, runner: Runner = runProcess) {
  const result = runner('gh', ['pr', 'view', String(input.pullRequest), '--json', 'headRefOid', ...repositoryArgs(input.repository)]);
  const failure = ghFailure(result);
  if (failure) return { HeadSha: null, Checks: null, Failure: failure };
  try {
    const parsed = JSON.parse(ghText(result));
    if (!Object.hasOwn(parsed, 'headRefOid')) throw new Error('Missing headRefOid');
    return { HeadSha: parsed.headRefOid as string, Checks: null, Failure: '' };
  } catch { return { HeadSha: null, Checks: null, Failure: 'GhUnavailable' }; }
}
export function getPullRequestChecks(input: WaitOptions, runner: Runner = runProcess) {
  const result = runner('gh', ['pr', 'checks', String(input.pullRequest), '--json', 'name,bucket', ...repositoryArgs(input.repository)]);
  let failure = ghFailure(result);
  if (failure === 'PullRequestMissing' && /no checks reported/i.test(ghText(result))) failure = 'NoChecksConfigured';
  if (failure) return { HeadSha: null, Checks: null, Failure: failure };
  try {
    const parsed = JSON.parse(ghText(result));
    return { HeadSha: null, Checks: (Array.isArray(parsed) ? parsed : [parsed]) as { name: string; bucket: string }[], Failure: '' };
  } catch { return { HeadSha: null, Checks: null, Failure: 'GhUnavailable' }; }
}
export async function invokeWait(input: WaitOptions, runner: Runner = runProcess): Promise<WaitResult> {
  let pollCount = 0;
  const deadline = Date.now() + (input.timeoutSeconds ?? 900) * 1000;
  const result = (State: string, values: Partial<WaitResult> = {}): WaitResult => ({
    State, HeadSha: input.headSha, Passed: [], Failed: [], NotRun: [], Failure: '', PollCount: pollCount, ...values,
  });
  while (true) {
    pollCount++;
    const head = getPullRequestHead(input, runner);
    if (head.Failure) return result('NotEvaluated', { Failure: head.Failure });
    if (head.HeadSha?.toLowerCase() !== input.headSha.toLowerCase()) return result('NotEvaluated', { Failure: 'HeadMoved' });
    const checks = getPullRequestChecks(input, runner);
    if (checks.Failure) return result('NotEvaluated', { Failure: checks.Failure });
    const after = getPullRequestHead(input, runner);
    if (after.Failure) return result('NotEvaluated', { Failure: after.Failure });
    if (after.HeadSha?.toLowerCase() !== input.headSha.toLowerCase()) return result('NotEvaluated', { Failure: 'HeadMoved' });
    const Passed: CheckRun[] = [], Failed: CheckRun[] = [], NotRun: CheckRun[] = [];
    for (const check of checks.Checks!) {
      const bucket = check.bucket.toLowerCase();
      const item = { Name: check.name, Bucket: check.bucket, IsTerminal: bucket !== 'pending' };
      if (['pass', 'skipping'].includes(bucket)) Passed.push(item);
      else if (['fail', 'cancel'].includes(bucket)) Failed.push(item);
      else if (bucket === 'pending') NotRun.push(item);
      else return result('NotEvaluated', { Failure: 'UnknownBucket', NotRun: [{ ...item, IsTerminal: false }] });
    }
    if (Failed.length) return result('Failed', { Passed, Failed, NotRun });
    if (!NotRun.length) return result('Passed', { Passed });
    if (Date.now() >= deadline) return result('NotEvaluated', { Passed, NotRun, Failure: 'TimedOut' });
    if (!input.quiet) process.stderr.write('Waiting on ' + NotRun.length + ' check(s) for ' + input.headSha + ' (poll ' + pollCount + ')...\n');
    await new Promise(resolve => setTimeout(resolve, (input.pollSeconds ?? 20) * 1000));
  }
}
export function waitOptions(values: ReturnType<typeof parseOptions<typeof options>>): WaitOptions {
  return {
    pullRequest: integerOption(values['pull-request'], 'pull-request'),
    headSha: requiredOption(values['head-sha'], 'head-sha'),
    repository: values.repository,
    timeoutSeconds: integerOption(values['timeout-seconds'], 'timeout-seconds', 900),
    pollSeconds: integerOption(values['poll-seconds'], 'poll-seconds', 20),
    quiet: values.quiet,
  };
}
if (isMain(import.meta.url)) await main(async () => {
  const result = await invokeWait(waitOptions(parseOptions(options)));
  writeJson(result);
  process.exitCode = waitExitCode(result.State);
});
