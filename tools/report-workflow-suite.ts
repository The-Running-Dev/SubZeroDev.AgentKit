import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caseCriteria, caseIds, sha256, verify } from './evaluate-workflow.ts';
import type { CodexTokens } from './lib/codex-session-usage.ts';
import { parseOptions, requiredOption } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

type Host = { name: string; version: string; model: string; settings: string };
type Cohort = { revision: string; producerSha256: string; host: Host; repeats: number };
type Selection = { packet: string; packetSha256: string; result: string };
type Verified = ReturnType<typeof verify>;
const commands = ['next', 'fix'] as const;
const digest = (v: unknown, length: number): v is string => typeof v === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Object.keys(v).sort().join(',') === keys.sort().join(',');
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 4096;
const verifierSha256 = sha256(readFileSync(fileURLToPath(new URL('./evaluate-workflow.ts', import.meta.url))));
const reporterSha256 = sha256(readFileSync(fileURLToPath(import.meta.url)));

function boundedJson(path: string): unknown {
  const info = statSync(path);
  if (!info.isFile() || !info.size || info.size > 1024 * 1024) throw new Error('Invalid selection file.');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cohortKey(v: Pick<Cohort, 'revision' | 'producerSha256' | 'host'>): string {
  return sha256(JSON.stringify([v.revision, v.producerSha256, v.host.name, v.host.version, v.host.model, v.host.settings]));
}

function selection(path: string): { cohorts: Cohort[]; receipts: Selection[] } {
  let v: unknown;
  try { v = boundedJson(path); } catch { throw new Error('Invalid suite selection: expected a nonempty JSON file up to 1 MiB.'); }
  if (!exact(v, ['schema', 'cohorts', 'receipts']) || v.schema !== 1 || !Array.isArray(v.cohorts) || !v.cohorts.length || v.cohorts.length > 16 || !Array.isArray(v.receipts) || v.receipts.length > 100) throw new Error('Invalid suite selection schema or limits.');
  for (const c of v.cohorts) {
    if (!exact(c, ['revision', 'producerSha256', 'host', 'repeats']) || !digest(c.revision, 40) || !digest(c.producerSha256, 64) || !Number.isInteger(c.repeats) || Number(c.repeats) < 1 || Number(c.repeats) > 20 || !exact(c.host, ['name', 'version', 'model', 'settings']) || !Object.values(c.host).every(text)) throw new Error('Invalid expected cohort.');
  }
  const cohorts = v.cohorts as Cohort[];
  if (new Set(cohorts.map(cohortKey)).size !== cohorts.length) throw new Error('Duplicate expected cohort.');
  if (cohorts.reduce((n, c) => n + 6 * c.repeats, 0) > 100) throw new Error('Expected suite exceeds 100 trials.');
  for (const r of v.receipts) if (!exact(r, ['packet', 'packetSha256', 'result']) || !text(r.packet) || !text(r.result) || !digest(r.packetSha256, 64)) throw new Error('Invalid receipt selection.');
  return { cohorts, receipts: v.receipts as Selection[] };
}

const counts = () => ({ pass: 0, fail: 0, unverified: 0 });

export function reportSuite(path: string) {
  const selected = selection(path), base = dirname(resolve(path));
  const verified: Verified[] = [], identities = new Map<string, Set<string>>();
  let duplicates = 0, invalid = 0;
  for (const r of selected.receipts) {
    let v: Verified;
    try {
      v = verify(resolve(base, r.packet), r.packetSha256, resolve(base, r.result));
      if (!digest(v.evidence.producerSha256, 64) || !text(v.trialId) || !Object.values(v.host).every(text)) throw new Error('Invalid suite metadata.');
    } catch { invalid++; continue; }
    const evidence = sha256(JSON.stringify([v.evidence.packetSha256, v.evidence.receiptSha256]));
    const previous = identities.get(v.trialId) ?? new Set<string>();
    if (previous.has(evidence)) duplicates++;
    else { previous.add(evidence); verified.push(v); }
    identities.set(v.trialId, previous);
  }
  const conflicts = [...identities.values()].reduce((n, variants) => n + variants.size - 1, 0);
  // A conflicting trial identity invalidates the entire selection, regardless of order.
  const rejection = { schema: 'agentkit.workflow-suite.v1', verifierSha256, reporterSha256, status: 'rejected', selected: selected.receipts.length, duplicates, invalid, conflicts, groups: [] } as const;
  if (conflicts) return rejection;

  // Session counters are cumulative. Even different rollout digests for one session
  // cannot become additive trial measurements. Detect reuse across ALL cohorts.
  const sessions = new Map<string, number>(), sources = new Map<string, number>();
  for (const v of verified) if (v.usage) {
    const r = v.usage.report;
    sessions.set(r.sessionId, (sessions.get(r.sessionId) ?? 0) + 1);
    sources.set(r.source.sha256, (sources.get(r.source.sha256) ?? 0) + 1);
  }
  const groups = new Map<string, { revision: string; producerSha256: string; repeats: number | null; trials: Verified[] }>();
  for (const c of selected.cohorts) groups.set(cohortKey(c), { revision: c.revision, producerSha256: c.producerSha256, repeats: c.repeats, trials: [] });
  for (const v of verified) {
    const key = cohortKey({ revision: v.revision, producerSha256: v.evidence.producerSha256, host: v.host as Host });
    if (!groups.has(key)) groups.set(key, { revision: v.revision, producerSha256: v.evidence.producerSha256, repeats: null, trials: [] });
    groups.get(key)!.trials.push(v);
  }
  const result = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, g]) => {
    const slots = commands.flatMap(command => caseIds.map(caseId => {
      const trials = g.trials.filter(v => v.command === command && v.caseId === caseId);
      const criteria = caseCriteria(caseId).map(criterion => {
        const tally = counts();
        for (const t of trials) { const grade = t.grades.find(v => v.id === criterion)!; tally[grade.verdict]++; }
        return { id: criterion, ...tally };
      });
      return { command, caseId, expected: g.repeats, received: trials.length,
        missing: g.repeats === null ? null : Math.max(0, g.repeats - trials.length),
        excess: g.repeats === null ? null : Math.max(0, trials.length - g.repeats),
        trials: { pass: trials.filter(t => t.status === 'human-assessed-pass').length, fail: trials.filter(t => t.status === 'human-assessed-fail').length, unverified: trials.filter(t => t.status === 'unverified').length }, criteria };
    }));
    const coverage = { observed: 0, partial: 0, unavailable: 0, unattached: 0, reused: 0 };
    let totals: CodexTokens | null = null, overflow = false;
    for (const v of g.trials) {
      if (!v.usage) { coverage.unattached++; continue; }
      const r = v.usage.report;
      coverage[r.coverage]++;
      if (sessions.get(r.sessionId)! > 1 || sources.get(r.source.sha256)! > 1) coverage.reused++;
      if (r.totals) {
        if (!totals) totals = { ...r.totals };
        else for (const k of Object.keys(totals) as (keyof CodexTokens)[]) {
          if (k === 'cacheWriteInputTokens' && (totals[k] === null || r.totals[k] === null)) { totals[k] = null; continue; }
          totals[k] = totals[k]! + r.totals[k]!;
          if (totals[k] !== null && !Number.isSafeInteger(totals[k])) overflow = true;
        }
      }
    }
    // No partial denominators, reused sessions, zero-for-unknown counters or
    // cache/reasoning subset additions. Missing slots also prevent a suite total.
    const complete = g.repeats !== null && slots.every(s => s.missing === 0 && s.excess === 0);
    if (invalid || !complete || !g.trials.length || coverage.observed !== g.trials.length || coverage.reused || overflow) totals = null;
    const receipts = g.trials.map(v => ({ trial: sha256(v.trialId), packetSha256: v.evidence.packetSha256, receiptSha256: v.evidence.receiptSha256 })).sort((a, b) => a.trial.localeCompare(b.trial));
    return { id, revision: g.revision, producerSha256: g.producerSha256, declared: g.repeats !== null, complete, slots, receipts,
      usage: { scope: 'sum-of-independent-session-cumulative-counters', coverage, overflow, totals } };
  });
  const status = invalid || result.some(g => !g.complete) ? 'incomplete' : result.some(g => g.slots.some(s => s.trials.fail)) ? 'human-assessed-fail' : result.some(g => g.slots.some(s => s.trials.unverified)) ? 'unverified' : 'human-assessed-pass';
  return { schema: 'agentkit.workflow-suite.v1', verifierSha256, reporterSha256, status, selected: selected.receipts.length, duplicates, invalid, conflicts, groups: result,
    limitation: 'Integrity checks and human attestations only; no execution provenance or behavioral improvement is proven. Cohort IDs hash attested revision, producer and host/model/settings. Usage is session-scoped, not billed cost; elapsed times are omitted.' };
}

export function suiteMarkdown(report: ReturnType<typeof reportSuite>): string {
  const lines = ['# Behavioral pilot suite', '', `Status: ${report.status}`, '', `Selected: ${report.selected}; exact duplicates: ${report.duplicates}; invalid: ${report.invalid}; conflicts: ${report.conflicts}.`, '', `Verifier SHA-256: ${report.verifierSha256}`, `Reporter SHA-256: ${report.reporterSha256}`, ''];
  for (const g of report.groups) {
    lines.push(`## Cohort ${g.id}`, '', `Source: ${g.revision}; producer: ${g.producerSha256}; declared: ${g.declared}; complete: ${g.complete}.`, '', '| Command/case | Expected | Received | Missing | Excess | Pass/fail/unverified |', '| --- | ---: | ---: | ---: | ---: | --- |');
    for (const s of g.slots) lines.push(`| ${s.command}/${s.caseId} | ${s.expected ?? 'undeclared'} | ${s.received} | ${s.missing ?? 'unknown'} | ${s.excess ?? 'unknown'} | ${s.trials.pass}/${s.trials.fail}/${s.trials.unverified} |`);
    lines.push('', '| Command/case/criterion | Pass | Fail | Unverified |', '| --- | ---: | ---: | ---: |');
    for (const s of g.slots) for (const c of s.criteria) lines.push(`| ${s.command}/${s.caseId}/${c.id} | ${c.pass} | ${c.fail} | ${c.unverified} |`);
    lines.push('', `Usage: ${JSON.stringify(g.usage)}`, '');
  }
  lines.push('Integrity checks and human attestations only; no execution provenance or behavioral improvement is proven. Cohort IDs hash attested revision, producer and host/model/settings. Usage is session-scoped, not billed cost; elapsed times are omitted.', '');
  return lines.join('\n');
}

if (isMain(import.meta.url)) await main(() => {
  const options = parseOptions({ selection: { type: 'string' }, format: { type: 'string' } });
  if (options.format !== undefined && !['json', 'markdown'].includes(options.format)) throw new Error('Format must be json or markdown.');
  const report = reportSuite(requiredOption(options.selection, 'selection'));
  if (options.format === 'markdown') process.stdout.write(suiteMarkdown(report));
  else writeJson(report);
  if (report.status !== 'human-assessed-pass') process.exitCode = 1;
});
