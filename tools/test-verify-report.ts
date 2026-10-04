import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = { path: { type: 'string' }, quiet: { type: 'boolean' } } as const;
interface Finding { Kind: string; Gate: string; Detail: string }
interface Failure { Reason: string; Detail: string }
export interface ReportResult { State: string; Findings: Finding[]; Failures: Failure[]; GateCount: number }
const result = (State: string, values: Partial<ReportResult> = {}): ReportResult => ({ State, Findings: [], Failures: [], GateCount: 0, ...values });
export function getVerifyReportDocument(path: string): { Report: unknown; Failure: Failure | null } {
  if (!existsSync(path)) return { Report: null, Failure: { Reason: 'ReportMissing', Detail: path } };
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  if (!raw.trim()) return { Report: null, Failure: { Reason: 'ReportEmpty', Detail: path } };
  try { return { Report: JSON.parse(raw), Failure: null }; }
  catch (error) { return { Report: null, Failure: { Reason: 'ReportUnreadable', Detail: (error as Error).message } }; }
}
export function invokeVerifyReportCheck(report: unknown): ReportResult {
  const document = report as Record<string, unknown>;
  if (!document || !Object.hasOwn(document, 'gates')) return result('NotEvaluated', { Failures: [{ Reason: 'NoGatesProperty', Detail: 'report has no "gates" property' }] });
  const gates = Array.isArray(document.gates) ? document.gates : [document.gates];
  const findings: Finding[] = [];
  const finding = (Kind: string, Gate: string, Detail: string) => findings.push({ Kind, Gate, Detail });
  if (!gates.length) finding('NoGates', '', 'gates array is empty');
  const seen = new Set<string>();
  for (const gate of gates) {
    const name = String(gate?.name ?? '');
    if (!name.trim()) { finding('EmptyName', '(unnamed)', 'gate has no name'); continue; }
    if (seen.has(name.toLowerCase())) finding('DuplicateGate', name, 'gate name appears more than once');
    seen.add(name.toLowerCase());
    const status = String(gate?.status ?? '');
    if (!['Passed', 'Failed', 'DidNotRun'].includes(status)) { finding('UnknownStatus', name, "status: '" + status + "'"); continue; }
    const detail = String(gate?.detail ?? ''), reason = String(gate?.reason ?? '');
    if (status === 'Failed') {
      if (!detail.trim()) finding('MissingDetail', name, 'Failed gate has no detail');
      else if (detail.trim().length < 15) finding('TrivialDetail', name, "detail too short to be pasted output: '" + detail + "'");
    }
    if (status === 'DidNotRun' && !reason.trim()) finding('MissingReason', name, 'DidNotRun gate has no reason');
  }
  return result(findings.length ? 'Invalid' : 'Valid', { Findings: findings, GateCount: gates.length });
}
export function verifyReportExitCode(state: string): number {
  switch (state.toLowerCase()) {
    case 'valid': return 0;
    case 'invalid': return 1;
    case 'notevaluated': return 2;
    default: throw new Error('Unknown verify-report state: ' + state);
  }
}
export function verifyReport(path = join(process.cwd(), '.claude/verify-report.json')): ReportResult {
  const doc = getVerifyReportDocument(path);
  return doc.Failure ? result('NotEvaluated', { Failures: [doc.Failure] }) : invokeVerifyReportCheck(doc.Report);
}
if (isMain(import.meta.url)) await main(() => {
  const values = parseOptions(options);
  const report = verifyReport(values.path);
  if (!values.quiet) {
    process.stderr.write('Gates in report: ' + report.GateCount + '\nFindings: ' + report.Findings.length + '    Could not evaluate: ' + report.Failures.length + '\n');
    for (const f of report.Findings) process.stderr.write('  [' + f.Kind + '] ' + f.Gate + ' - ' + f.Detail + '\n');
    for (const f of report.Failures) process.stderr.write('  [' + f.Reason + '] ' + f.Detail + '\n');
    process.stderr.write(({ Valid: 'Report is valid.', Invalid: 'Report is malformed. Do not copy it into a pull request.', NotEvaluated: 'Incomplete: the report could not be read at all. This is NOT a valid result.' } as Record<string, string>)[report.State] + '\n');
  }
  writeJson(report);
  process.exitCode = verifyReportExitCode(report.State);
});
