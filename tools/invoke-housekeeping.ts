import { doneHousekeeping } from './invoke-done-housekeeping.ts';
import type { HousekeepingInput } from './invoke-done-housekeeping.ts';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  'repo-root': { type: 'string' }, 'default-branch': { type: 'string' }, 'skip-pull': { type: 'boolean' },
} as const;
export function housekeeping(input: Pick<HousekeepingInput, 'repoRoot' | 'defaultBranch' | 'skipPull'> = {}, runner: Runner = run) {
  const root = input.repoRoot ?? process.cwd();
  const startedDirty = !!runner('git', ['-C', root, 'status', '--short']).stdout.trim();
  const discover = doneHousekeeping({ ...input, keepDirty: startedDirty }, runner);
  if (discover.Stopped) return { Escalate: true, Discover: discover, Applied: null };
  const applied = discover.Candidates.length || discover.SquashMergeCandidates.length
    ? doneHousekeeping({ repoRoot: root, defaultBranch: discover.DefaultBranch!, skipPull: true,
      keepDirty: startedDirty, deleteBranches: discover.Candidates.map(c => c.Branch),
      forceDeleteBranches: discover.SquashMergeCandidates.map(c => c.Branch) }, runner) : discover;
  return { Escalate: applied.Stopped || discover.TipAheadOfMergedPr.length > 0 || applied.Refused.length > 0, Discover: discover, Applied: applied };
}
export function housekeepingSummary(r: ReturnType<typeof housekeeping>): string {
  const d = r.Discover, a = r.Applied;
  if (!a) return `Stopped: ${d.Reason} - ${d.Detail}\n`;
  const lines = [`Default branch: ${d.DefaultBranch} (${d.Pulled ? 'pulled' : 'not pulled'})`,
    `Pruned remote-tracking refs: ${d.PrunedCount}`, a.Deleted.length ? `Deleted:\n${a.Deleted.map(b => `  - ${b}`).join('\n')}` : 'Deleted: (none)'];
  if (a.Stopped) lines.push(`Stopped during apply: ${a.Reason} - ${a.Detail}`);
  for (const e of d.TipAheadOfMergedPr) lines.push(`Kept ${e.Branch}: it has commits that no merged pull request accounts for - ${e.Reason} (TipAheadOfMergedPr)`);
  for (const e of a.Refused) lines.push(`Kept ${e.Branch}: Git refused the safe delete - ${e.Reason} (Refused)`);
  if (r.Escalate) lines.push('A judgement case was found. This script has not decided anything about it - read the cases above and open a session if one is warranted.');
  return lines.join('\n') + '\n';
}
if (isMain(import.meta.url)) await main(() => {
  const o = parseOptions(options); const r = housekeeping({ repoRoot: o['repo-root'], defaultBranch: o['default-branch'], skipPull: o['skip-pull'] });
  process.stderr.write(housekeepingSummary(r)); writeJson(r);
});
