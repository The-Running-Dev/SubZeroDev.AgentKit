import { scanTranscript } from './transcript-jsonl.ts';

export interface CodexTokens {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number | null;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
}
export interface CodexSessionReport {
  schema: 'agentkit.codex-usage.v1';
  provider: 'codex';
  source: { format: 'codex-rollout-jsonl'; bytes: number; sha256: string; cliVersions: string[] };
  sessionId: string;
  models: string[];
  accounting: 'latest-observed-cumulative-snapshot';
  coverage: 'observed' | 'partial' | 'unavailable';
  tokenCountEvents: number;
  cumulativeSnapshots: number;
  responseUsageRecords: number;
  totals: CodexTokens | null;
  lastUsage: CodexTokens | null;
  warnings: string[];
  unavailable: string[];
}
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => !!value && typeof value === 'object' && !Array.isArray(value);

function tokens(value: unknown): CodexTokens {
  if (!object(value)) throw new Error('Unsupported Codex usage: expected a counter object.');
  const read = (key: string): number => {
    const n = value[key];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) throw new Error(`Unsupported Codex usage counter: ${key}. Expected a nonnegative safe integer.`);
    return n;
  };
  const result = {
    inputTokens: read('input_tokens'), cachedInputTokens: read('cached_input_tokens'),
    cacheWriteInputTokens: value.cache_write_input_tokens === undefined ? null : read('cache_write_input_tokens'),
    outputTokens: read('output_tokens'), reasoningOutputTokens: read('reasoning_output_tokens'), totalTokens: read('total_tokens'),
  };
  if (result.cachedInputTokens > result.inputTokens || result.reasoningOutputTokens > result.outputTokens)
    throw new Error('Inconsistent Codex usage: cached input/reasoning output exceeds its parent counter.');
  return result;
}

// TokenCountEvent / TokenUsageInfo from openai/codex protocol.rs. Keep the
// provider's counters separate from Claude calls, segments and peak context.
export function readCodexSession(file: string): CodexSessionReport {
  let id: string | null = null, totals: CodexTokens | null = null, lastUsage: CodexTokens | null = null;
  let logicalSessionId: string | null = null, responseAfterSnapshot = false;
  let tokenCountEvents = 0, cumulativeSnapshots = 0, responseUsageRecords = 0;
  const versions = new Set<string>(), models = new Set<string>(), warnings = new Set<string>();
  const source = scanTranscript(file, ({ text, number, terminated }) => {
    if (!text.trim()) return;
    let record: unknown;
    try { record = JSON.parse(text); } catch {
      if (!terminated) { warnings.add('truncated-final-record'); return; }
      throw new Error(`Malformed Codex JSON at line ${number}.`);
    }
    if (!object(record) || typeof record.type !== 'string') throw new Error(`Unsupported Codex record at line ${number}.`);
    if ('message' in record) throw new Error(`Mixed Claude/Codex transcript at line ${number}.`);
    const payload = record.payload;
    if (record.type === 'session_meta') {
      if (!object(payload) || typeof payload.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(payload.id))
        throw new Error('Codex session_meta requires a supported session id.');
      if (id !== null && id !== payload.id) throw new Error('Multiple Codex session identities in one transcript.');
      id = payload.id;
      if (payload.session_id !== undefined) {
        if (typeof payload.session_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(payload.session_id)) throw new Error('Unsupported Codex logical session id.');
        if (logicalSessionId !== null && logicalSessionId !== payload.session_id) throw new Error('Multiple Codex logical session identities in one transcript.');
        logicalSessionId = payload.session_id;
      }
      if (typeof payload.cli_version === 'string' && /^[0-9A-Za-z.+_-]{1,80}$/.test(payload.cli_version)) versions.add(payload.cli_version);
      return;
    }
    if (id === null) throw new Error('Codex transcript must start with session_meta before other records.');
    if (record.type === 'turn_context' && object(payload) && typeof payload.model === 'string' && /^[0-9A-Za-z._:/-]{1,120}$/.test(payload.model)) models.add(payload.model);
    // Newer rollouts may also persist per-response records. Never add them to
    // the cumulative token_count ledger or silently treat them as zero usage.
    if (record.type === 'token_usage_record') { responseUsageRecords++; responseAfterSnapshot = true; return; }
    if (record.type !== 'event_msg' || !object(payload) || payload.type !== 'token_count') return;
    tokenCountEvents++;
    if (payload.info === null || payload.info === undefined) { lastUsage = null; warnings.add('token-count-without-usage'); return; }
    if (!object(payload.info)) throw new Error('Unsupported Codex token_count info.');
    const info = payload.info;
    lastUsage = info.last_token_usage == null ? null : tokens(info.last_token_usage);
    if (info.total_token_usage == null) { warnings.add('missing-cumulative-usage'); return; }
    const next = tokens(info.total_token_usage);
    if (totals) for (const key of Object.keys(next) as (keyof CodexTokens)[]) {
      if (next[key] !== null && totals[key] !== null && next[key]! < totals[key]!)
        throw new Error('Codex cumulative counters decreased: reset or reordered history is ambiguous.');
    }
    // Codex can synthesize a full-window total after a context-limit error.
    // Preserve the reported values but do not present that as additive usage.
    if (!Number.isSafeInteger(next.inputTokens + next.outputTokens) || next.totalTokens !== next.inputTokens + next.outputTokens)
      warnings.add('non-additive-cumulative-total');
    totals = next;
    responseAfterSnapshot = false;
    cumulativeSnapshots++;
  });
  if (id === null) throw new Error('Codex transcript requires session_meta.');
  if (totals && responseAfterSnapshot) warnings.add('response-usage-after-last-cumulative-snapshot');
  if (!totals) warnings.add(responseUsageRecords ? 'response-usage-records-without-supported-token-count-totals' : 'no-cumulative-usage');
  return {
    schema: 'agentkit.codex-usage.v1', provider: 'codex',
    source: { format: 'codex-rollout-jsonl', ...source, cliVersions: [...versions].sort() },
    sessionId: id, models: [...models].sort(), accounting: 'latest-observed-cumulative-snapshot',
    coverage: totals ? (warnings.size ? 'partial' : 'observed') : 'unavailable',
    tokenCountEvents, cumulativeSnapshots, responseUsageRecords, totals, lastUsage, warnings: [...warnings].sort(),
    unavailable: ['calls', 'commandSegments', 'completions', 'textCharacters', 'peakContext', 'subagents', 'billedCost'],
  };
}

export function humanCodexReport(report: CodexSessionReport): string {
  const lines = [`Codex session ${report.sessionId}`, `Coverage: ${report.coverage}; ${report.accounting}`, `Source SHA-256: ${report.source.sha256}`];
  if (report.totals) for (const [key, value] of Object.entries(report.totals)) lines.push(`${key}: ${value === null ? 'unavailable' : value}`);
  else lines.push('Usage totals: unavailable');
  lines.push('Cached input and reasoning output are subsets, not additional tokens.', `Unavailable: ${report.unavailable.join(', ')}`);
  if (report.warnings.length) lines.push(`Warnings: ${report.warnings.join(', ')}`);
  return lines.join('\n') + '\n';
}
