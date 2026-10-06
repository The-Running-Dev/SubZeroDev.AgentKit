import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { integerOption, parseOptions } from './lib/options.ts';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  project: { type: 'string' },
  'transcript-path': { type: 'string' },
  'session-id': { type: 'string' },
  detail: { type: 'boolean' },
  human: { type: 'boolean' },
  hook: { type: 'boolean' },
  'idle-threshold-minutes': { type: 'string' },
} as const;
export const usageSum = () => ({ calls: 0, input: 0, cacheCreate: 0, cacheRead: 0, output: 0, completionCalls: 0, completionOutput: 0, textChars: 0, completionTextChars: 0, toolResultChars: 0, peakContext: 0 });
export type Usage = ReturnType<typeof usageSum>;
type Segment = Usage & { label: string };
function add(sum: Usage, usage: Usage): void { for (const key of Object.keys(sum) as (keyof Usage)[]) sum[key] = key === 'peakContext' ? Math.max(sum[key], usage[key]) : sum[key] + usage[key]; }
function records(file: string): any[] {
  return readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(line => { try { return JSON.parse(line); } catch { return null; } });
}
export function transcriptVendor(file: string): string {
  let shape = 'unknown';
  for (const record of records(file).slice(0, 50)) {
    if (!record || typeof record !== 'object') continue;
    if ('payload' in record || record.type === 'session_meta') return 'codex';
    if (record.message) { if ('usage' in record.message) return 'claude'; shape = 'claude'; }
  }
  return shape;
}
export function projectSlug(path: string): string { return path.replace(/[\\/]+$/, '').replace(/[^A-Za-z0-9]/g, '-'); }
export function resolveTranscriptDirectory(project: string, home = process.env.HOME || process.env.USERPROFILE || homedir()): string {
  const root = join(home, '.claude/projects');
  if (!existsSync(root)) throw new Error(`No transcript store at ${root}. Nothing to measure.`);
  if (!existsSync(project)) throw new Error(`Cannot find path '${project}' because it does not exist.`);
  const full = resolve(project).replace(/[\\/]+$/, ''), derived = join(root, projectSlug(full));
  if (existsSync(derived)) return derived;
  const leaf = basename(full).replace(/[^A-Za-z0-9]/g, '-');
  const candidates = readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && e.name.toLowerCase().endsWith(leaf.toLowerCase()));
  if (candidates.length === 1) { process.stderr.write(`Derived path not found; matched '${candidates[0].name}' on leaf name.\n`); return join(root, candidates[0].name); }
  if (candidates.length > 1) throw new Error(`Ambiguous: ${candidates.length} transcript directories match '${leaf}'. Pass --project explicitly.`);
  throw new Error(`No transcript directory for ${full}. Expected ${derived}.`);
}
function assertNotCopilot(path: string): void {
  if (existsSync(join(path, 'session-store.db')) || /github\.copilot-chat/i.test(path) || /^(chatSessions|chatEditingSessions)$/i.test(basename(path))) throw new Error(`${path} is a GitHub Copilot store. Copilot records no token usage - its 'turns' table has no usage column, and it meters premium requests rather than tokens. There is nothing here to measure; see the VS Code quota indicator instead.`);
}
export function readSession(file: string, idleThresholdMinutes = 5) {
  let current: Segment = { label: '(no command)', ...usageSum() }, pending: string | null = null;
  const segments = [current], stamps: number[] = [], models = new Set<string>(), seen = new Set<string>();
  for (const record of records(file)) {
    if (!record) continue;
    if (record.timestamp) { const stamp = Date.parse(record.timestamp); if (!Number.isFinite(stamp)) throw new Error(`Invalid timestamp: ${record.timestamp}`); stamps.push(stamp); }
    const message = record.message; if (!message) continue;
    if (typeof message.content === 'string') {
      const command = /<command-name>([^<]+)<\/command-name>/i.exec(message.content);
      if (command) pending = command[1].trim(); else if (/<local-command-(stdout|caveat)>/i.test(message.content)) pending = null;
      continue;
    }
    const blocks = Array.isArray(message.content) ? message.content : message.content ? [message.content] : [];
    for (const block of blocks) if (block?.type === 'tool_result') {
      const content = block.content;
      current.toolResultChars += typeof content === 'string' ? content.length : (Array.isArray(content) ? content : content ? [content] : []).reduce((sum: number, item: any) => sum + (item?.text?.length || 0), 0);
    }
    const usage = message.usage; if (!usage) continue;
    if (pending) { current = { label: pending, ...usageSum() }; segments.push(current); pending = null; }
    if (message.model) models.add(message.model);
    for (const block of blocks) if (block?.type === 'text' && block.text) { current.textChars += block.text.length; if (message.stop_reason === 'end_turn') current.completionTextChars += block.text.length; }
    if (message.id) { if (seen.has(String(message.id))) continue; seen.add(String(message.id)); }
    current.calls++;
    current.input += Number(usage.input_tokens || 0); current.cacheCreate += Number(usage.cache_creation_input_tokens || 0); current.cacheRead += Number(usage.cache_read_input_tokens || 0); current.output += Number(usage.output_tokens || 0);
    current.peakContext = Math.max(current.peakContext, Number(usage.input_tokens || 0) + Number(usage.cache_creation_input_tokens || 0) + Number(usage.cache_read_input_tokens || 0));
    if (message.stop_reason === 'end_turn') { current.completionCalls++; current.completionOutput += Number(usage.output_tokens || 0); }
  }
  stamps.sort((a, b) => a - b);
  let active = 0; for (let i = 1; i < stamps.length; i++) { const gap = stamps[i] - stamps[i - 1]; if (gap <= idleThresholdMinutes * 60000) active += gap; }
  return { id: basename(file, '.jsonl'), started: stamps.length ? new Date(stamps[0]).toISOString().slice(0, 19) : null, span: stamps.length >= 2 ? (stamps.at(-1)! - stamps[0]) / 1000 : 0, active: active / 1000, models: [...models].sort((a, b) => a.localeCompare(b)), segments: segments.filter(s => s.calls > 0) };
}
function total(segments: Usage[]): Usage { const sum = usageSum(); for (const segment of segments) add(sum, segment); return sum; }
// Like Get-ChildItem in the PowerShell original, a path to one .jsonl file lists just that file.
function jsonlFiles(directory: string): string[] {
  if (statSync(directory).isFile()) return /\.jsonl$/i.test(directory) ? [directory] : [];
  return readdirSync(directory, { withFileTypes: true }).filter(e => e.isFile() && /\.jsonl$/i.test(e.name)).map(e => join(directory, e.name));
}
function subagents(directory: string, id: string, threshold: number): Usage {
  const path = join(directory, id, 'subagents'), sum = usageSum();
  if (existsSync(path)) for (const file of jsonlFiles(path)) if (transcriptVendor(file) === 'claude') add(sum, total(readSession(file, threshold).segments));
  return sum;
}
// .NET Math.Round defaults to ties-to-even; JSON parity includes fractional timestamps.
function round(value: number): number { const floor = Math.floor(value); return value - floor === 0.5 ? floor + floor % 2 : Math.round(value); }
// PowerShell formatted the human report from the unrounded span, so keep it out of the JSON.
const rawTimes = new WeakMap<object, { span: number; active: number }>();
type ReportSession = { id: string; started: string | null; spanSeconds: number; activeSeconds: number; models: string[]; total: Usage; subagents: Usage; segments?: Segment[] };
export interface SessionReport { idleThresholdMinutes: number; sessions: ReportSession[]; allSessions?: Usage; allSubagents?: Usage }
export function measureSession(input: { project?: string; transcriptPath?: string; sessionId?: string; detail?: boolean; idleThresholdMinutes?: number } = {}): SessionReport {
  const directory = input.transcriptPath || resolveTranscriptDirectory(input.project || process.cwd()), threshold = input.idleThresholdMinutes ?? 5;
  if (!existsSync(directory)) throw new Error(`No such transcript directory: ${directory}`);
  assertNotCopilot(directory);
  const files = jsonlFiles(directory).filter(f => !input.sessionId || basename(f, '.jsonl').toLowerCase().startsWith(input.sessionId.toLowerCase())).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  if (!files.length) throw new Error(`No transcripts matched in ${directory}.`);
  const report: SessionReport = { idleThresholdMinutes: threshold, sessions: [] }, totals = usageSum(), subs = usageSum();
  for (const file of files) {
    const vendor = transcriptVendor(file);
    if (vendor !== 'claude') throw new Error(`${basename(file)} is not a Claude Code transcript (detected: ${vendor}). ${vendor === 'codex' ? "Codex records usage as 'token_count' events under payload.info, not as 'message.usage'. No Codex reader is implemented, and its per-turn counts are not the same unit as Claude's per-call ones." : 'No known agent writes this shape.'}`);
    const session = readSession(file, threshold); if (!session.segments.length) continue;
    const sum = total(session.segments), sub = subagents(directory, session.id, threshold); add(totals, sum); add(subs, sub);
    const entry: ReportSession = { id: session.id.slice(0, 8), started: session.started, spanSeconds: round(session.span), activeSeconds: round(session.active), models: session.models, total: sum, subagents: sub, ...(input.detail ? { segments: session.segments } : {}) };
    rawTimes.set(entry, { span: session.span, active: session.active });
    report.sessions.push(entry);
  }
  if (!report.sessions.length) throw new Error('No Claude Code usage records found in the matched transcripts. Nothing to measure.');
  if (files.length > 1) { report.allSessions = totals; report.allSubagents = subs; }
  return report;
}
function duration(seconds: number): string { return [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60].map(v => String(v).padStart(2, '0')).join(':'); }
export function costLogPath(root = process.env.CLAUDE_PROJECT_DIR || dirname(dirname(fileURLToPath(import.meta.url))), runner: Runner = run): string {
  const r = runner('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir']);
  return join(r.code === 0 && r.stdout.trim() ? dirname(r.stdout.trim()) : root, '.claude/session-costs.tsv');
}
export function sessionHook(payload: string, root?: string, threshold = 5): void {
  const file = JSON.parse(payload).transcript_path, vendor = transcriptVendor(file);
  if (vendor !== 'claude') throw new Error(`${basename(file)} is not a Claude Code transcript (detected: ${vendor}).`);
  const session = readSession(file, threshold), sum = total(session.segments); if (!sum.calls) return;
  const log = costLogPath(root), row = [session.started || '', session.id, session.models.join(', '), sum.calls, duration(session.span), duration(session.active), sum.input, sum.cacheCreate, sum.cacheRead, sum.output].join('\t');
  let existing = existsSync(log) ? readFileSync(log, 'utf8').split(/\r?\n/).filter(l => l && l.split('\t')[1] !== session.id) : [];
  if (!existing.length) existing = ['started\tsession\tmodels\tcalls\tspan\tactive\tinput\tcache_create\tcache_read\toutput'];
  mkdirSync(dirname(log), { recursive: true }); writeFileSync(log, [...existing, row, ''].join('\n'));
}
export function humanReport(report: SessionReport, threshold = 5): string {
  const rows: string[] = [], row = (label: string, s: Usage) => `${label.padEnd(28)} ${String(s.calls).padStart(6)} ${s.input.toLocaleString('en-US').padStart(10)} ${s.cacheCreate.toLocaleString('en-US').padStart(12)} ${s.cacheRead.toLocaleString('en-US').padStart(13)} ${s.output.toLocaleString('en-US').padStart(10)}`;
  const header = row('Segment', { calls: 'calls', input: 'input', cacheCreate: 'cache_new', cacheRead: 'cache_read', output: 'output' } as unknown as Usage);
  for (const s of report.sessions) {
    const raw = rawTimes.get(s) ?? { span: s.spanSeconds, active: s.activeSeconds };
    rows.push('', `Session ${s.id}   ${s.models.join(', ')}`, `  started ${(s.started || '').replace('T', ' ').slice(0, 16)}   span ${duration(raw.span)}   active ${duration(raw.active)} (gaps over ${threshold} min excluded)`, '', header, '-'.repeat(header.length));
    for (const segment of s.segments || []) rows.push(row(segment.label, segment));
    if (s.segments) rows.push('-'.repeat(header.length));
    const n = (value: number) => value.toLocaleString('en-US');
    rows.push(row('session total', s.total), `  completions ${n(s.total.completionCalls)} (${n(s.total.completionOutput)} output) · text ${n(s.total.textChars)} chars (${n(s.total.completionTextChars)} in completions) · tool results ${n(s.total.toolResultChars)} chars · peak context ${n(s.total.peakContext)}`);
    if (s.subagents.calls) rows.push(row('subagents (separate cost)', s.subagents));
  }
  if (report.allSessions) rows.push('', '='.repeat(header.length), row(`all sessions (${report.sessions.length})`, report.allSessions));
  if (report.allSubagents?.calls) rows.push(row('all subagents (separate cost)', report.allSubagents));
  rows.push('', 'cache_read is the term that grows with conversation length. If it dominates,', 'the lever is session boundaries, not per-command waste.', ''); return rows.join('\n');
}
if (isMain(import.meta.url)) await main(() => {
  const v = parseOptions(options), threshold = integerOption(v['idle-threshold-minutes'], 'idle-threshold-minutes', 5);
  if (v.hook) { try { sessionHook(readFileSync(0, 'utf8'), undefined, threshold); } catch (error) { process.stderr.write(`Measure-Session: ${error instanceof Error ? error.message : error}\n`); process.exitCode = 1; } return; }
  const report = measureSession({ project: v.project, transcriptPath: v['transcript-path'], sessionId: v['session-id'], detail: v.detail, idleThresholdMinutes: threshold });
  if (v.human) process.stdout.write(humanReport(report, threshold)); else writeJson(report);
});
