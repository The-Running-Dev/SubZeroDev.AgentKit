import { basename, dirname, resolve } from 'node:path';
import { caseCriteria, readArtifact, sha256, verify } from '../evaluate-workflow.ts';

export const assessmentSchema = 'agentkit.workflow-assessment.v1';
const maxBytes = 256 * 1024;
type ObjectValue = Record<string, unknown>;
function object(value: unknown, keys: string[]): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) throw new Error('Invalid assessment fields.');
  return value as ObjectValue;
}
function text(value: unknown, max = 4096): string {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > max) throw new Error('Invalid assessment text.');
  return value;
}
function member(value: unknown, values: string[]): string {
  if (typeof value !== 'string' || !values.includes(value)) throw new Error('Invalid assessment enum.');
  return value;
}
function digest(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new Error('Invalid assessment digest.');
  return value;
}
// Object order is immaterial; result/evidence array order is part of the payload.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
  return JSON.stringify(value);
}
export function readAssessment(path: string): unknown {
  const bytes = readArtifact(dirname(resolve(path)), basename(path));
  if (bytes.length > maxBytes) throw new Error('Assessment exceeds 256 KiB.');
  return JSON.parse(bytes.toString('utf8'));
}
export interface CaptureInput { packet: string; packetSha256: string; result: string }
export function serializeAssessment(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2) + '\n';
  if (Buffer.byteLength(serialized) > maxBytes) throw new Error('Sealed assessment exceeds 256 KiB.');
  return serialized;
}

/** Revalidate the original capture on both creation and attachment read. No grades are promoted. */
export function assessWorkflow(input: CaptureInput, value: unknown, sealed = false) {
  const verified = verify(input.packet, input.packetSha256, input.result);
  const bytes = readArtifact(dirname(resolve(input.result)), basename(input.result));
  if (sha256(bytes) !== verified.evidence.receiptSha256) throw new Error('Receipt changed during assessment.');
  const receipt = JSON.parse(bytes.toString('utf8'));
  const transcripts: Record<string, string> = {};
  const phaseDigests: Record<string, string> = {};
  for (const phase of receipt.phases) {
    const capture = readArtifact(dirname(resolve(input.result)), phase.transcript);
    if (sha256(capture) !== phase.transcriptSha256) throw new Error('Transcript changed during assessment.');
    transcripts[phase.id] = capture.toString('utf8');
    phaseDigests[phase.id] = phase.transcriptSha256;
  }
  if (Buffer.byteLength(JSON.stringify(value) ?? '') > maxBytes) throw new Error('Assessment exceeds 256 KiB.');
  const fields = ['schema', 'target', 'evaluator', 'execution', 'results', 'review'];
  const draft = object(value, sealed ? [...fields, 'assessmentSha256'] : fields);
  if (draft.schema !== assessmentSchema) throw new Error('Invalid assessment schema.');
  const target = object(draft.target, ['trialId', 'packetSha256', 'receiptSha256', 'transcripts']);
  const expected = { trialId: verified.trialId, packetSha256: input.packetSha256,
    receiptSha256: verified.evidence.receiptSha256, transcripts: phaseDigests };
  if (canonical(target) !== canonical(expected)) throw new Error('Assessment target does not match verified capture.');
  const evaluator = object(draft.evaluator, ['id', 'version', 'codeSha256', 'configSha256', 'rubricSha256', 'origin']);
  text(evaluator.id, 256); text(evaluator.version, 256);
  for (const key of ['codeSha256', 'configSha256', 'rubricSha256']) digest(evaluator[key]);
  member(evaluator.origin, ['human', 'model', 'deterministic', 'mock']);
  member(draft.execution, ['synthetic', 'replay', 'real-host']);
  // Review is a separate attestation, never the original receipt's human grade.
  const review = object(draft.review, ['status']);
  member(review.status, ['unreviewed', 'accepted', 'rejected']);
  const criteria = caseCriteria(verified.caseId);
  if (!Array.isArray(draft.results) || draft.results.length !== criteria.length) throw new Error('Assessment must cover each case criterion exactly once.');
  const seen = new Set<string>();
  for (const item of draft.results) {
    const result = object(item, ['id', 'verdict', 'reason', 'evidence']);
    const id = member(result.id, [...criteria]);
    if (seen.has(id)) throw new Error('Duplicate assessment criterion.');
    seen.add(id);
    const verdict = member(result.verdict, ['pass', 'fail', 'unverified', 'skipped']);
    text(result.reason);
    if (!Array.isArray(result.evidence) || result.evidence.length > 16 ||
        (verdict === 'skipped' ? result.evidence.length !== 0 : result.evidence.length === 0)) throw new Error('Invalid assessment evidence count.');
    for (const item of result.evidence) {
      const evidence = object(item, ['phase', 'quote', 'start']);
      const phase = member(evidence.phase, ['a', 'b']);
      const quote = text(evidence.quote);
      const start = evidence.start;
      if (typeof start !== 'number' || !Number.isSafeInteger(start) || start < 0 ||
          transcripts[phase].slice(start, start + quote.length) !== quote) throw new Error('Assessment evidence does not match phase capture.');
    }
  }
  const payload = { schema: assessmentSchema, target, evaluator, execution: draft.execution, results: draft.results, review };
  const assessmentSha256 = sha256(canonical(payload));
  if (sealed && digest(draft.assessmentSha256) !== assessmentSha256) throw new Error('Assessment identity mismatch.');
  const attachment = { ...payload, assessmentSha256 };
  serializeAssessment(attachment);
  return attachment;
}
