import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { temp, put } from './lib/fixtures.ts';
import { run } from './lib/process.ts';
import { sessionHook } from './measure-session.ts';
import { readCodexSession, humanCodexReport } from './lib/codex-session-usage.ts';
import { scanTranscript, sniffTranscriptVendor, transcriptLimits } from './lib/transcript-jsonl.ts';

const fixture = fileURLToPath(new URL('./fixtures/codex-session/usage.jsonl', import.meta.url));
const cli = fileURLToPath(new URL('./measure-session.ts', import.meta.url));
const meta = { type: 'session_meta', payload: { id: 'fixture-session' } };
const usage = (input = 100, output = 30) => ({ input_tokens: input, cached_input_tokens: 0, output_tokens: output, reasoning_output_tokens: 0, total_tokens: input + output });
const event = (total: unknown = usage(), last: unknown = usage()) => ({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: total, last_token_usage: last } } });
const transcript = (records: unknown[], suffix = '') => put(temp(), 'rollout.jsonl', records.map(r => JSON.stringify(r)).join('\n') + '\n' + suffix);

test('Codex uses the latest cumulative snapshot, without summing repeats, last usage or response records', () => {
  const r = readCodexSession(fixture);
  assert.deepEqual(r.totals, { inputTokens: 180, cachedInputTokens: 120, cacheWriteInputTokens: null, outputTokens: 50, reasoningOutputTokens: 15, totalTokens: 230 });
  assert.equal(r.lastUsage!.totalTokens, 100);
  assert.equal(r.tokenCountEvents, 3); assert.equal(r.cumulativeSnapshots, 3); assert.equal(r.responseUsageRecords, 1);
  assert.equal(r.coverage, 'observed'); assert.equal(r.sessionId, 'fixture-session');
  assert.deepEqual(r.source.cliVersions, ['0.0.0-fixture']); assert.deepEqual(r.models, ['gpt-fixture']);
  assert.equal(r.source.sha256, createHash('sha256').update(readFileSync(fixture)).digest('hex'));
  assert.equal(r.source.bytes, readFileSync(fixture).length);
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE_/);
  assert.ok(r.unavailable.includes('calls')); assert.ok(r.unavailable.includes('subagents'));
});

test('CLI measures the pinned Codex fixture using the shared entry point', () => {
  const result = run(process.execPath, [cli, '--transcript-path', fixture, '--detail']);
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.provider, 'codex'); assert.equal(report.schema, 'agentkit.codex-usage.v1');
  assert.equal(report.totals.totalTokens, 230); assert.equal(report.sessions, undefined);
  assert.equal(report.calls, undefined); assert.equal(report.segments, undefined);
});

test('Codex human CLI names the accounting and unavailable metrics', () => {
  const r = run(process.execPath, [cli, '--transcript-path', fixture, '--human']);
  assert.equal(r.code, 0, r.stderr); assert.match(r.stdout, /latest-observed-cumulative/);
  assert.match(r.stdout, /totalTokens: 230/); assert.match(r.stdout, /subsets, not additional/);
  assert.match(r.stdout, /Unavailable: calls/); assert.doesNotMatch(r.stdout, /PRIVATE_/);
});

test('Codex CLI refuses directory discovery, session filters and the Claude hook', () => {
  const dir = temp(); put(dir, 'rollout.jsonl', readFileSync(fixture, 'utf8'));
  const directory = run(process.execPath, [cli, '--transcript-path', dir]);
  assert.notEqual(directory.code, 0); assert.match(directory.stderr, /one explicit --transcript-path file/);
  const filter = run(process.execPath, [cli, '--transcript-path', fixture, '--session-id', 'fixture']);
  assert.notEqual(filter.code, 0); assert.match(filter.stderr, /without --session-id/);
  assert.throws(() => sessionHook(JSON.stringify({ transcript_path: fixture }), dir), /not a Claude Code transcript/);
});

test('missing or null usage stays unavailable; observed zero is distinct', () => {
  for (const records of [[meta], [meta, event(null, null)], [meta, { type: 'event_msg', payload: { type: 'token_count', info: null } }]]) {
    const r = readCodexSession(transcript(records));
    assert.equal(r.totals, null); assert.equal(r.coverage, 'unavailable');
    assert.match(humanCodexReport(r), /Usage totals: unavailable/);
  }
  const zero = readCodexSession(transcript([meta, event(usage(0, 0), null)]));
  assert.equal(zero.totals!.totalTokens, 0); assert.equal(zero.coverage, 'observed'); assert.equal(zero.lastUsage, null);
});

test('last-only usage is not substituted for cumulative usage', () => {
  const r = readCodexSession(transcript([meta, { type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: usage(50) } } }]));
  assert.equal(r.totals, null); assert.equal(r.lastUsage!.inputTokens, 50); assert.equal(r.coverage, 'unavailable');
});

test('a later missing snapshot preserves observed totals with partial coverage', () => {
  const r = readCodexSession(transcript([meta, event(), event(null, null)]));
  assert.equal(r.totals!.totalTokens, 130); assert.equal(r.coverage, 'partial');
  assert.ok(r.warnings.includes('missing-cumulative-usage'));
});

test('response-record-only schema is unavailable rather than a free session', () => {
  const r = readCodexSession(transcript([meta, { type: 'token_usage_record', payload: { thread_token_usage: usage() } }]));
  assert.equal(r.totals, null); assert.equal(r.coverage, 'unavailable');
  assert.ok(r.warnings.includes('response-usage-records-without-supported-token-count-totals'));
});

test('response records after the last snapshot flag partial coverage rather than an up-to-date total', () => {
  const r = readCodexSession(transcript([meta, event(), { type: 'token_usage_record', payload: { thread_token_usage: usage(200) } }]));
  assert.equal(r.coverage, 'partial'); assert.equal(r.totals!.totalTokens, 130);
  assert.ok(r.warnings.includes('response-usage-after-last-cumulative-snapshot'));
});

test('resume with the same identity works; mixed identities, missing metadata and mixed vendors fail', () => {
  assert.equal(readCodexSession(transcript([meta, event(), meta, event(usage(200, 60))])).totals!.totalTokens, 260);
  assert.throws(() => readCodexSession(transcript([meta, event(), { type: 'session_meta', payload: { id: 'other' } }])), /Multiple Codex session identities/);
  assert.throws(() => readCodexSession(transcript([{ ...meta, payload: { id: 'same', session_id: 'root-one' } }, { ...meta, payload: { id: 'same', session_id: 'root-two' } }])), /Multiple Codex logical session identities/);
  assert.throws(() => readCodexSession(transcript([event()])), /session_meta/);
  assert.throws(() => readCodexSession(transcript([{ type: 'session_meta', payload: {} }])), /session id/);
  assert.throws(() => readCodexSession(transcript([meta, { type: 'assistant', message: { usage: {} } }])), /Mixed Claude\/Codex/);
});

test('decreasing cumulative counters fail instead of inventing a reset/resume total', () => {
  assert.throws(() => readCodexSession(transcript([meta, event(usage(200)), event(usage(100))])), /cumulative counters decreased/);
  assert.throws(() => readCodexSession(transcript([meta, event({ ...usage(), cached_input_tokens: 40 }), event({ ...usage(200), cached_input_tokens: 20 })])), /cumulative counters decreased/);
});

test('counter validation rejects missing, negative, fractional, string, unsafe and impossible subset values', () => {
  for (const value of [undefined, null, -1, 1.5, '100', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => readCodexSession(transcript([meta, event({ ...usage(), input_tokens: value })])), /usage counter/);
  }
  for (const bad of [{ ...usage(), cached_input_tokens: 101 }, { ...usage(), reasoning_output_tokens: 31 }])
    assert.throws(() => readCodexSession(transcript([meta, event(bad)])), /exceeds its parent/);
  assert.throws(() => readCodexSession(transcript([meta, event(usage(), { ...usage(), output_tokens: -1 })])), /usage counter/);
});

test('optional cache-write counts retain their native value; absent remains unknown', () => {
  const r = readCodexSession(transcript([meta, event({ ...usage(), cache_write_input_tokens: 10 })]));
  assert.equal(r.totals!.cacheWriteInputTokens, 10); assert.equal(r.totals!.totalTokens, 130);
});

test('synthetic non-additive context-window totals are labeled partial rather than treated as billed usage', () => {
  const r = readCodexSession(transcript([meta, event({ ...usage(0, 0), total_tokens: 200000 }, null)]));
  assert.equal(r.coverage, 'partial'); assert.equal(r.totals!.totalTokens, 200000);
  assert.ok(r.warnings.includes('non-additive-cumulative-total'));
});

test('truncated final JSON preserves prior totals as partial; malformed interior JSON fails without text leakage', () => {
  const file = transcript([meta, event()], '{"PRIVATE_SECRET');
  const r = readCodexSession(file); assert.equal(r.coverage, 'partial'); assert.equal(r.totals!.totalTokens, 130);
  assert.ok(r.warnings.includes('truncated-final-record')); assert.doesNotMatch(JSON.stringify(r), /PRIVATE_SECRET/);
  assert.throws(() => readCodexSession(transcript([meta], '{"PRIVATE_SECRET\n')), /Malformed Codex JSON at line 2/);
});

test('BOM, CRLF, multibyte chunk boundaries and a valid final line without newline are supported', () => {
  const text = '\uFEFF' + [meta, { type: 'response_item', payload: { text: 'é'.repeat(40000) } }, event()].map(r => JSON.stringify(r)).join('\r\n');
  const file = put(temp(), 'large-line.jsonl', text);
  assert.equal(readCodexSession(file).totals!.totalTokens, 130);
  assert.equal(sniffTranscriptVendor(file), 'codex');
  assert.equal(readCodexSession(file).source.sha256, createHash('sha256').update(text).digest('hex'));
});

test('bounded scanning rejects excessive file/line input and closes handles after errors', () => {
  const path = transcript([meta, event()]);
  assert.throws(() => scanTranscript(path, () => {}, { fileBytes: 1, lineBytes: 1000 }), /file limit/);
  assert.throws(() => scanTranscript(path, () => {}, { fileBytes: 1000, lineBytes: 10 }), /line exceeds/);
  assert.throws(() => scanTranscript(path, () => { throw new Error('callback failed'); }), /callback failed/);
  assert.equal(readCodexSession(path).totals!.totalTokens, 130);
  const oversized = put(temp(), 'oversized.jsonl', 'x'.repeat(transcriptLimits.lineBytes + 1));
  assert.throws(() => readCodexSession(oversized), /line exceeds/);
});

test('prefix sniffing is bounded and does not mistake a large Claude transcript for Codex', () => {
  const path = put(temp(), 'claude.jsonl', JSON.stringify({ message: { usage: {} } }) + '\n' + 'x'.repeat(transcriptLimits.lineBytes + 1));
  assert.equal(sniffTranscriptVendor(path), 'claude');
  const unknown = put(temp(), 'unknown.jsonl', '{}\n'.repeat(50) + JSON.stringify(meta));
  assert.equal(sniffTranscriptVendor(unknown), 'unknown');
});
