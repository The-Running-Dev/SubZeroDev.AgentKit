import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';
import { ghFailure, ghText, invokeWait, repositoryArgs, waitOptions } from './wait-pull-request-check.ts';
import type { CheckRun, WaitOptions, WaitResult } from './wait-pull-request-check.ts';

export const options = {
  'pull-request': { type: 'string' },
  'head-sha': { type: 'string' },
  repository: { type: 'string' },
  method: { type: 'string' },
  'timeout-seconds': { type: 'string' },
  'poll-seconds': { type: 'string' },
  'delete-branch': { type: 'boolean' },
  'dry-run': { type: 'boolean' },
} as const;
export interface MergeOptions extends WaitOptions {
  method?: string; deleteBranch?: boolean; dryRun?: boolean;
}
export interface ReviewThread { Id: string; Path: string; Line: number | null; IsOutdated: boolean }
export interface MergeResult {
  State: string; HeadSha: string; Refusal: string;
  Passed: CheckRun[]; Failed: CheckRun[]; NotRun: CheckRun[];
  UnresolvedThreads: ReviewThread[]; Detail: string;
}
export function mergeExitCode(state: string): number {
  switch (state.toLowerCase()) {
    case 'merged': case 'wouldmerge': return 0;
    case 'refused': return 1;
    case 'notevaluated': return 2;
    default: throw new Error('Unknown MergeResult state: ' + state);
  }
}
export function getPullRequestState(input: MergeOptions, runner: Runner = run) {
  const result = runner('gh', ['pr', 'view', String(input.pullRequest), '--json', 'state,isDraft,headRefOid', ...repositoryArgs(input.repository)]);
  const failure = ghFailure(result);
  if (failure) return { Failure: failure };
  try {
    const parsed = JSON.parse(ghText(result));
    for (const key of ['state', 'isDraft', 'headRefOid']) if (!Object.hasOwn(parsed, key)) throw new Error('Missing ' + key);
    return { State: parsed.state as string, IsDraft: Boolean(parsed.isDraft), HeadSha: parsed.headRefOid as string, Failure: null };
  } catch { return { Failure: 'GhUnavailable' }; }
}
export function getUnresolvedReviewThreads(input: MergeOptions, runner: Runner = run): { Threads?: ReviewThread[]; Failure: string | null } {
  let owner: string, repo: string;
  if (input.repository) {
    const slash = input.repository.indexOf('/');
    owner = slash < 0 ? input.repository : input.repository.slice(0, slash);
    repo = slash < 0 ? '' : input.repository.slice(slash + 1);
  } else {
    const lookup = runner('gh', ['repo', 'view', '--json', 'owner,name']);
    const failure = ghFailure(lookup);
    if (failure) return { Failure: failure };
    try {
      const parsed = JSON.parse(ghText(lookup));
      if (!Object.hasOwn(parsed.owner, 'login') || !Object.hasOwn(parsed, 'name')) throw new Error('Missing repository');
      owner = parsed.owner.login; repo = parsed.name;
    } catch { return { Failure: 'GhUnavailable' }; }
  }
  const query = `query($endCursor: String, $owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first:100, after:$endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id isResolved isOutdated path line }
      }
    }
  }
}`;
  const response = runner('gh', ['api', 'graphql', '--paginate', '--slurp', '-f', 'query=' + query, '-f', 'owner=' + owner, '-f', 'repo=' + repo, '-F', 'number=' + input.pullRequest]);
  const failure = ghFailure(response);
  if (failure) return { Failure: failure };
  try {
    const parsed = JSON.parse(ghText(response));
    const threads: ReviewThread[] = [];
    for (const page of Array.isArray(parsed) ? parsed : [parsed]) {
      const nodes = page.data.repository.pullRequest.reviewThreads.nodes;
      if (nodes === undefined) throw new Error('Missing nodes');
      for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
        if (!node) continue;
        for (const key of ['isResolved', 'id', 'path', 'line', 'isOutdated']) if (!Object.hasOwn(node, key)) throw new Error('Missing ' + key);
        if (!node.isResolved) threads.push({ Id: node.id, Path: node.path, Line: node.line, IsOutdated: Boolean(node.isOutdated) });
      }
    }
    return { Threads: threads, Failure: null };
  } catch { return { Failure: 'GhUnavailable' }; }
}
type Waiter = (input: WaitOptions, runner: Runner) => Promise<WaitResult> | WaitResult;
export async function invokeMerge(input: MergeOptions, runner: Runner = run, waitForChecks: Waiter = invokeWait): Promise<MergeResult> {
  const result = (State: string, values: Partial<MergeResult> = {}): MergeResult => ({ State, HeadSha: input.headSha, Refusal: '', Passed: [], Failed: [], NotRun: [], UnresolvedThreads: [], Detail: '', ...values });
  const method = input.method ?? 'squash';
  if (!['squash', 'merge', 'rebase'].includes(method.toLowerCase())) throw new Error('Invalid merge method: ' + method);
  const pr = getPullRequestState(input, runner);
  if (pr.Failure) return result('NotEvaluated', { Refusal: pr.Failure });
  if (pr.State?.toUpperCase() !== 'OPEN') return result('Refused', { Refusal: 'NotOpen', Detail: 'Pull request state is ' + pr.State + '.' });
  if (pr.IsDraft) return result('Refused', { Refusal: 'IsDraft' });
  if (pr.HeadSha?.toLowerCase() !== input.headSha.toLowerCase()) return result('Refused', { Refusal: 'HeadMoved', Detail: 'Pull request head is ' + pr.HeadSha + '.' });
  const wait = await waitForChecks(input, runner);
  const lists = { Passed: wait.Passed, Failed: wait.Failed, NotRun: wait.NotRun };
  if (wait.State.toLowerCase() === 'failed') return result('Refused', { Refusal: 'ChecksFailed', ...lists });
  if (wait.State.toLowerCase() !== 'passed') return result('NotEvaluated', { Refusal: wait.Failure, ...lists });
  const Passed = wait.Passed;
  const threads = getUnresolvedReviewThreads(input, runner);
  if (threads.Failure) return result('NotEvaluated', { Refusal: threads.Failure, Passed });
  if (threads.Threads!.length) return result('Refused', { Refusal: 'UnresolvedThreads', Passed, UnresolvedThreads: threads.Threads, Detail: threads.Threads!.length + ' unresolved review thread(s).' });
  const after = getPullRequestState(input, runner);
  if (after.Failure) return result('NotEvaluated', { Refusal: after.Failure, Passed });
  if (after.HeadSha?.toLowerCase() !== input.headSha.toLowerCase()) return result('Refused', { Refusal: 'HeadMoved', Passed, Detail: 'Pull request head is ' + after.HeadSha + '.' });
  if (input.dryRun) return result('WouldMerge', { Passed });
  const args = ['pr', 'merge', String(input.pullRequest), '--' + method, '--match-head-commit', input.headSha, ...repositoryArgs(input.repository)];
  if (input.deleteBranch) args.push('--delete-branch');
  const merge = runner('gh', args);
  if (!merge.found) return result('NotEvaluated', { Refusal: 'GhUnavailable', Passed });
  if (merge.code !== 0) return result('Refused', { Refusal: 'MergeRejected', Passed, Detail: ghText(merge).trim() });
  return result('Merged', { Passed });
}
if (isMain(import.meta.url)) await main(async () => {
  const values = parseOptions(options);
  const result = await invokeMerge({ ...waitOptions(values), method: values.method, deleteBranch: values['delete-branch'], dryRun: values['dry-run'] });
  writeJson(result);
  process.exitCode = mergeExitCode(result.State);
});
