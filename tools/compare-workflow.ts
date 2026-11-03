import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caseCriteria, caseIds, readArtifact, sha256, verify } from './evaluate-workflow.ts';
import { readSuiteSelection, reportSuite } from './report-workflow-suite.ts';
import { assessWorkflow, readAssessment } from './lib/workflow-assessment.ts';
import { parseOptions, requiredOption } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

type Ref = { path: string; sha256: string };
type Evaluator = { id: string; version: string; codeSha256: string; configSha256: string; rubricSha256: string; origin: string };
type Side = { selection: Ref; cohortId: string; corpusSha256: string; evaluators: Evaluator[]; assessments: Ref[] };
type Experiment = { schema: string; hypothesis: string; parents: string[]; baseline: Side; candidate: Side;
  changedVariables: string[]; authorRole: string; conclusion: string; limitations: string[]; evidenceDigests: string[] };
type Verified = ReturnType<typeof verify>;
type Assessment = { target: { trialId: string; packetSha256: string; receiptSha256: string }; evaluator: Evaluator;
  execution: string; assessmentSha256: string; results: { id: string; verdict: Verdict }[] };
type Verdict = 'pass' | 'fail' | 'unverified' | 'skipped';
const commands = ['next', 'fix'] as const;
const sorted = <T>(items: T[], key: (item: T) => string) => [...items].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && Buffer.byteLength(value) <= 4096;
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
function strings(value: unknown, max: number, valid = text): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every(valid) && new Set(value).size === value.length;
}
const evaluatorKey = (e: Evaluator) => sha256(JSON.stringify([e.id, e.version, e.codeSha256, e.configSha256, e.rubricSha256, e.origin]));
function evaluator(value: unknown): value is Evaluator {
  return exact(value, ['id', 'version', 'codeSha256', 'configSha256', 'rubricSha256', 'origin']) &&
    text(value.id) && Buffer.byteLength(value.id) <= 256 && text(value.version) && Buffer.byteLength(value.version) <= 256 &&
    hash(value.codeSha256) && hash(value.configSha256) && hash(value.rubricSha256) && typeof value.origin === 'string' && ['human', 'model', 'deterministic', 'mock'].includes(value.origin);
}
function ref(value: unknown): value is Ref { return exact(value, ['path', 'sha256']) && text(value.path) && hash(value.sha256); }
function side(value: unknown): value is Side {
  return exact(value, ['selection', 'cohortId', 'corpusSha256', 'evaluators', 'assessments']) && ref(value.selection) && hash(value.cohortId) && hash(value.corpusSha256) &&
    Array.isArray(value.evaluators) && value.evaluators.length > 0 && value.evaluators.length <= 8 && value.evaluators.every(evaluator) &&
    new Set(value.evaluators.map(evaluatorKey)).size === value.evaluators.length && Array.isArray(value.assessments) && value.assessments.length <= 800 && value.assessments.every(ref);
}
function experiment(path: string): { value: Experiment; bytes: Buffer } {
  const bytes = readArtifact(dirname(resolve(path)), basename(path));
  if (bytes.length > 1024 * 1024) throw new Error('Experiment exceeds 1 MiB.');
  const value: unknown = JSON.parse(bytes.toString('utf8'));
  if (!exact(value, ['schema', 'hypothesis', 'parents', 'baseline', 'candidate', 'changedVariables', 'authorRole', 'conclusion', 'limitations', 'evidenceDigests']) ||
      value.schema !== 'agentkit.workflow-experiment.v1' || !text(value.hypothesis) || !strings(value.parents, 16, hash) || !side(value.baseline) || !side(value.candidate) ||
      !strings(value.changedVariables, 16) || typeof value.authorRole !== 'string' || !['human', 'model', 'mixed'].includes(value.authorRole) || !text(value.conclusion) || !strings(value.limitations, 16) || !strings(value.evidenceDigests, 64, hash)) throw new Error('Invalid experiment schema.');
  return { value: value as unknown as Experiment, bytes };
}
const captureKey = (v: Verified) => sha256(JSON.stringify([v.evidence.packetSha256, v.evidence.receiptSha256]));
const tally = () => ({ pass: 0, fail: 0, unverified: 0, skipped: 0 });
function loadSide(base: string, selected: Side) {
  const path = resolve(base, selected.selection.path), report = reportSuite(path, selected.selection.sha256), selection = readSuiteSelection(path, selected.selection.sha256);
  const group = report.groups.find(g => g.id === selected.cohortId);
  const cohortMismatch = !group || report.groups.length !== 1;
  const trials = new Map<string, { input: { packet: string; packetSha256: string; result: string }; verified: Verified }>();
  for (const r of selection.receipts) {
    const input = { packet: resolve(dirname(path), r.packet), packetSha256: r.packetSha256, result: resolve(dirname(path), r.result) };
    try {
      const verified = verify(input.packet, input.packetSha256, input.result);
      if (group?.receipts.some(t => t.packetSha256 === verified.evidence.packetSha256 && t.receiptSha256 === verified.evidence.receiptSha256)) trials.set(captureKey(verified), { input, verified });
    } catch { /* reportSuite retains invalid receipts in its denominator. */ }
  }
  let invalid = 0, duplicates = 0;
  const attachments = new Map<string, Assessment>(), assignments = new Map<string, Set<string>>();
  const expected = new Set(selected.evaluators.map(evaluatorKey));
  for (const reference of selected.assessments) {
    try {
      const raw = readAssessment(resolve(base, reference.path), reference.sha256) as Assessment;
      const trial = [...trials.values()].find(t => t.verified.trialId === raw.target?.trialId &&
        t.verified.evidence.packetSha256 === raw.target.packetSha256 && t.verified.evidence.receiptSha256 === raw.target.receiptSha256);
      if (!trial) throw new Error('Unselected assessment target.');
      const attachment = assessWorkflow(trial.input, raw, true) as unknown as Assessment;
      if (!expected.has(evaluatorKey(attachment.evaluator))) throw new Error('Unselected evaluator.');
      if (attachments.has(attachment.assessmentSha256)) { duplicates++; continue; }
      attachments.set(attachment.assessmentSha256, attachment);
      const key = captureKey(trial.verified) + ':' + evaluatorKey(attachment.evaluator);
      const variants = assignments.get(key) ?? new Set<string>(); variants.add(attachment.assessmentSha256); assignments.set(key, variants);
    } catch { invalid++; }
  }
  const conflicts = [...assignments.values()].reduce((n, values) => n + Math.max(0, values.size - 1), 0);
  const rows = commands.flatMap(command => caseIds.flatMap(caseId => caseCriteria(caseId).map(criterion => {
    const matching = [...trials.values()].map(t => t.verified).filter(t => t.command === command && t.caseId === caseId);
    const human = { pass: 0, fail: 0, unverified: 0 };
    for (const t of matching) human[t.grades.find(g => g.id === criterion)!.verdict]++;
    const assessments = sorted(selected.evaluators, evaluatorKey).map(e => {
      const results = tally(); let missing = Math.max(0, (group?.slots.find(s => s.command === command && s.caseId === caseId)?.expected ?? 0) - matching.length), conflicting = 0, disagreements = 0, humanModelDisagreements = 0;
      for (const t of matching) {
        const ids = assignments.get(captureKey(t) + ':' + evaluatorKey(e));
        if (!ids) { missing++; continue; } if (ids.size !== 1) { conflicting++; continue; }
        const a = attachments.get([...ids][0])!, verdict = a.results.find(r => r.id === criterion)!.verdict;
        results[verdict]++;
        const grade = t.grades.find(g => g.id === criterion)!.verdict;
        if ((grade === 'pass' || grade === 'fail') && (verdict === 'pass' || verdict === 'fail') && grade !== verdict) {
          disagreements++; if (e.origin === 'model') humanModelDisagreements++;
        }
      }
      return { evaluator: evaluatorKey(e), ...results, missing, conflicting, disagreements, humanModelDisagreements };
    });
    return { command, caseId, criterion, human, assessments };
  })));
  return { report, selection, group, cohortMismatch, trials, attachments, invalid, duplicates, conflicts, rows };
}

export function compareWorkflow(path: string) {
  const { value: spec, bytes } = experiment(path), base = dirname(resolve(path));
  const baseline = loadSide(base, spec.baseline), candidate = loadSide(base, spec.candidate);
  const confounders: string[] = [];
  const a = baseline.selection, b = candidate.selection;
  if (spec.baseline.corpusSha256 !== spec.candidate.corpusSha256) confounders.push('corpus');
  if (JSON.stringify(sorted(spec.baseline.evaluators.map(evaluatorKey), x => x)) !== JSON.stringify(sorted(spec.candidate.evaluators.map(evaluatorKey), x => x))) confounders.push('evaluators-or-rubrics');
  const hosts = (s: typeof a) => s.cohorts.map(c => [c.host.name, c.host.version, c.host.model, c.host.settings]);
  if (JSON.stringify(hosts(a)) !== JSON.stringify(hosts(b))) confounders.push('host-model-settings');
  const executions = (s: typeof baseline) => sorted([...new Set([...s.attachments.values()].map(a => evaluatorKey(a.evaluator) + ':' + a.execution))], x => x);
  if (JSON.stringify(executions(baseline)) !== JSON.stringify(executions(candidate))) confounders.push('execution-provenance');
  if (JSON.stringify(a.cohorts.map(c => c.repeats)) !== JSON.stringify(b.cohorts.map(c => c.repeats))) confounders.push('repeats');
  if (JSON.stringify(a.cohorts.map(c => c.producerSha256)) !== JSON.stringify(b.cohorts.map(c => c.producerSha256))) confounders.push('capture-producer');
  const sourceChanged = JSON.stringify(a.cohorts.map(c => c.revision)) !== JSON.stringify(b.cohorts.map(c => c.revision));
  if (sourceChanged && !spec.changedVariables.includes('source-revision')) confounders.push('undeclared-source-change');
  const overlap = [...baseline.trials.keys()].filter(key => candidate.trials.has(key)).length;
  if (overlap) confounders.push('reused-captures');
  const sessions = new Set<string>(), sources = new Set<string>(); let reusedUsage = false;
  for (const { verified: t } of [...baseline.trials.values(), ...candidate.trials.values()]) if (t.usage) {
    const r = t.usage.report;
    if (sessions.has(r.sessionId) || sources.has(r.source.sha256)) reusedUsage = true;
    sessions.add(r.sessionId); sources.add(r.source.sha256);
  }
  if (reusedUsage) confounders.push('reused-usage');
  if (JSON.stringify(baseline.group?.usage.coverage) !== JSON.stringify(candidate.group?.usage.coverage)) confounders.push('usage-coverage');
  const incomplete = [baseline, candidate].some(s => s.cohortMismatch || !s.group?.complete || s.report.invalid || s.report.conflicts || s.invalid || s.conflicts ||
    s.rows.some(r => r.assessments.some(e => e.missing || e.conflicting || e.unverified || e.skipped)));
  const humanInsufficient = [baseline, candidate].some(s => s.rows.some(r => r.human.unverified));
  const comparability = incomplete || humanInsufficient ? 'insufficient-evidence' : confounders.length ? 'confounded' : 'comparable';
  const summarize = (s: typeof baseline, selected: Side) => ({ selectionSha256: selected.selection.sha256, corpusSha256: selected.corpusSha256,
    evaluators: sorted(selected.evaluators, evaluatorKey).map(e => ({ identity: evaluatorKey(e), codeSha256: e.codeSha256,
      configSha256: e.configSha256, rubricSha256: e.rubricSha256, origin: e.origin })), humanSuite: s.report, cohortMismatch: s.cohortMismatch,
    assessments: { selected: s.attachments.size + s.invalid + s.duplicates, valid: s.attachments.size, invalid: s.invalid, duplicates: s.duplicates, conflicts: s.conflicts,
      identities: [...s.attachments.keys()].sort() }, rows: s.rows,
    comparisonUsage: reusedUsage ? null : s.group?.usage ?? null });
  return { schema: 'agentkit.workflow-comparison.v1', experimentSha256: sha256(bytes),
    comparatorSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    lineage: { parents: [...spec.parents].sort(), authorRole: spec.authorRole, hypothesisSha256: sha256(spec.hypothesis),
      conclusionSha256: sha256(spec.conclusion), limitationsSha256: spec.limitations.map(sha256).sort(), evidenceDigests: [...spec.evidenceDigests].sort(), changedVariablesSha256: spec.changedVariables.map(sha256).sort() },
    comparability, confounders: confounders.sort(), sourceChanged, reusedCaptures: overlap,
    improvementVerdict: 'not-established', baseline: summarize(baseline, spec.baseline), candidate: summarize(candidate, spec.candidate),
    humanDeltas: comparability === 'comparable' ? baseline.rows.map((r, i) => ({ command: r.command, caseId: r.caseId, criterion: r.criterion,
      pass: candidate.rows[i].human.pass - r.human.pass, fail: candidate.rows[i].human.fail - r.human.fail })) : null,
    limitation: 'Supplied corpus, lineage, evaluator and execution metadata are attestations. Descriptive counts establish no causal or statistical improvement. Human grades remain separate. Session usage is not billed cost. No models, candidates or memory writes are invoked.' };
}

export function comparisonMarkdown(report: ReturnType<typeof compareWorkflow>): string {
  const lines = ['# Workflow comparison', '', `Comparability: ${report.comparability}`, `Improvement: ${report.improvementVerdict}`, `Confounders: ${report.confounders.join(', ') || 'none'}`, '',
    '| Side | Command/case/criterion | Human pass/fail/unverified | Evaluator | Assessment pass/fail/unverified/skipped | Missing/conflicting | Disagreements (model) |', '| --- | --- | --- | --- | --- | --- | --- |'];
  for (const side of ['baseline', 'candidate'] as const) for (const r of report[side].rows) for (const e of r.assessments) lines.push(`| ${side} | ${r.command}/${r.caseId}/${r.criterion} | ${r.human.pass}/${r.human.fail}/${r.human.unverified} | ${e.evaluator} | ${e.pass}/${e.fail}/${e.unverified}/${e.skipped} | ${e.missing}/${e.conflicting} | ${e.disagreements} (${e.humanModelDisagreements}) |`);
  lines.push('', '## Coverage and integrity', '');
  for (const side of ['baseline', 'candidate'] as const) {
    const s = report[side]; lines.push(`${side}: human status ${s.humanSuite.status}; cohort mismatch ${s.cohortMismatch}; attachments ${JSON.stringify(s.assessments)}; usage ${JSON.stringify(s.comparisonUsage)}`, '');
    for (const g of s.humanSuite.groups) for (const slot of g.slots) lines.push(`${side} ${slot.command}/${slot.caseId}: expected ${slot.expected}, received ${slot.received}, missing ${slot.missing}, excess ${slot.excess}.`);
  }
  lines.push('', report.limitation, ''); return lines.join('\n');
}
if (isMain(import.meta.url)) await main(() => {
  try {
    const options = parseOptions({ experiment: { type: 'string' }, format: { type: 'string' } });
    if (options.format && !['json', 'markdown'].includes(options.format)) throw new Error('Invalid format.');
    const report = compareWorkflow(requiredOption(options.experiment, 'experiment'));
    if (options.format === 'markdown') process.stdout.write(comparisonMarkdown(report)); else writeJson(report);
    if (report.comparability !== 'comparable') process.exitCode = 1;
  } catch { throw new Error('Workflow comparison rejected: check experiment schema, selected evidence and digests.'); }
});
