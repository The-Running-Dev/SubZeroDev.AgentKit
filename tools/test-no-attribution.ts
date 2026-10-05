import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = { 'base-sha': { type: 'string' }, 'head-sha': { type: 'string' } } as const;
// Keep the expression in sync with tools/git-hooks/commit-msg.
export const attributionPattern = /^(Co-authored-by:\s*(Claude|Anthropic|GPT|Codex|Copilot))|(Generated with \[?(Claude|Codex|Copilot))|(🤖 Generated with)/im;
export function getCommitRangeShas(baseSha: string | undefined, headSha: string | undefined, runner: Runner = run): string[] {
  if (!headSha?.trim()) throw new Error('test-no-attribution.ts: --head-sha (or ATTRIBUTION_HEAD_SHA) is required.');
  if (!baseSha?.trim() || baseSha === '0'.repeat(40)) return [headSha];
  const result = runner('git', ['log', '--format=%H', baseSha + '..' + headSha]);
  if (!result.found || result.code !== 0) throw new Error('test-no-attribution.ts: git log failed for range ' + baseSha + '..' + headSha);
  return result.stdout.split(/\r?\n/).filter(Boolean);
}
export function testNoAttribution(baseSha: string | undefined, headSha: string | undefined, runner: Runner = run) {
  const shas = getCommitRangeShas(baseSha, headSha, runner);
  const offenders: { Sha: string; Line: string }[] = [];
  for (const sha of shas) {
    const body = runner('git', ['log', '--format=%B', '-1', sha]);
    if (!body.found || body.code !== 0) throw new Error('test-no-attribution.ts: git log failed for commit ' + sha);
    const match = attributionPattern.exec(body.stdout.replace(/\r\n/g, '\n'));
    if (match) offenders.push({ Sha: sha, Line: match[0] });
  }
  return { State: offenders.length ? 'Failed' : 'Passed', CommitCount: shas.length, Offenders: offenders };
}
if (isMain(import.meta.url)) await main(() => {
  const values = parseOptions(options);
  const result = testNoAttribution(values['base-sha'] ?? process.env.ATTRIBUTION_BASE_SHA, values['head-sha'] ?? process.env.ATTRIBUTION_HEAD_SHA);
  if (result.Offenders.length) {
    process.stderr.write('RESULT=FAILED - ' + result.Offenders.length + ' commit(s) carry AI attribution:\n');
    for (const offender of result.Offenders) process.stderr.write('  ' + offender.Sha.slice(0, 9) + ' - ' + offender.Line + '\n');
  } else process.stderr.write('RESULT=PASSED - ' + result.CommitCount + ' commit(s) checked, none carry AI attribution.\n');
  writeJson(result);
  process.exitCode = result.State === 'Passed' ? 0 : 1;
});
