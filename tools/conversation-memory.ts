import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { atomic, inside } from './conversation.ts';
import type { Branch } from './conversation.ts';
import { configPath, createContext, KINDS, MemoryFailure, prepareCorrect, prepareRemember, submitPrepared } from './memorykit.ts';
import type { PreparedWrite } from './memorykit.ts';
import { parseOptions, requiredOption } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = { 'archive-root': { type: 'string' }, 'request-file': { type: 'string' }, project: { type: 'string' }, namespace: { type: 'string' } } as const;
interface ProposalInput {
  id: string; kind: string; statementIndex: number; statement: 'source' | 'generated'; content?: string;
  corrects?: { id: string; expectedRevision: number };
}
interface Request {
  schemaVersion: 1; action: 'propose' | 'store'; branchId: string; reviewId: string;
  expectedRevision?: number; proposals?: ProposalInput[]; selected?: string[];
}
interface Proposal extends ProposalInput {
  content: string; attribution: { role: string; kind: string }; evidence: { ref: string; sha256: string; startByte: number; endByte: number }[];
  warnings: string[]; eligible: boolean;
}
interface Review {
  schemaVersion: 1; requestHash: string; branchHash: string; branchRevision: number; branchId: string; reviewId: string;
  proposals: Proposal[]; untrusted: true;
}
interface Writes {
  schemaVersion: 1; reviewHash: string; target: { cli: string; store: string; namespace: string };
  host: string;
  // Only selected proposals are prepared. These are retry receipts, not a memory store.
  requests: Record<string, PreparedWrite>; results: Record<string, unknown>;
}
type Settings = Parameters<typeof createContext>[0];
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
function fail(code: string, message: string): never { throw new MemoryFailure({ code, message }); }
function object(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) fail('InvalidRequest', label);
  return value as Record<string, unknown>;
}
function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) fail('InvalidRequest', 'IDs require 1–64 lowercase letters, digits or hyphens.');
}
function positive(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) fail('InvalidRequest', 'Expected a positive revision.');
}
function parse(value: unknown): Request {
  const r = object(value, ['schemaVersion', 'action', 'branchId', 'reviewId', 'expectedRevision', 'proposals', 'selected'], 'request');
  if (r.schemaVersion !== 1 || !['propose', 'store'].includes(String(r.action))) fail('InvalidRequest', 'Use schemaVersion 1 and action propose or store.');
  id(r.branchId); id(r.reviewId);
  if (r.action === 'store') {
    object(r, ['schemaVersion', 'action', 'branchId', 'reviewId', 'selected'], 'store');
    if (!Array.isArray(r.selected) || !r.selected.length) fail('InvalidRequest', 'Explicit, nonempty selected proposal IDs are required.');
    r.selected.forEach(id);
    if (new Set(r.selected).size !== r.selected.length) fail('InvalidRequest', 'Duplicate selected ID.');
  } else {
    object(r, ['schemaVersion', 'action', 'branchId', 'reviewId', 'expectedRevision', 'proposals'], 'propose');
    positive(r.expectedRevision);
    if (!Array.isArray(r.proposals) || !r.proposals.length) fail('InvalidRequest', 'Select individual handoff statements to propose.');
    const ids = new Set<string>();
    for (const value of r.proposals) {
      const p = object(value, ['id', 'kind', 'statementIndex', 'statement', 'content', 'corrects'], 'proposal');
      id(p.id); if (ids.has(p.id)) fail('InvalidRequest', 'Duplicate proposal ID.'); ids.add(p.id);
      if (!KINDS.includes(String(p.kind)) || !['source', 'generated'].includes(String(p.statement)) || !Number.isSafeInteger(p.statementIndex) || Number(p.statementIndex) < 0) fail('InvalidRequest', 'Invalid kind, statement or handoff index.');
      if (p.content !== undefined && (typeof p.content !== 'string' || !p.content.trim())) fail('InvalidRequest', 'content must be nonempty.');
      if (p.corrects !== undefined) {
        const c = object(p.corrects, ['id', 'expectedRevision'], 'corrects');
        if (typeof c.id !== 'string' || !c.id.trim()) fail('InvalidRequest', 'Memory ID is required.');
        positive(c.expectedRevision);
      }
    }
  }
  return r as unknown as Request;
}

// Detect common credentials before even preparing a selected write. This is a backstop;
// the human review still decides whether content is appropriate for the configured store.
const credential = /-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b|\b(?:password|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']?[^\s"']{8,}/i;
function branchAt(root: string, branchId: string) {
  const path = inside(root, `Journal/raw/conversation-${branchId}/branch.json`), bytes = readFileSync(path);
  const b = JSON.parse(bytes.toString('utf8')) as Branch;
  if (b.schemaVersion !== 1 || b.branchId !== branchId || !Number.isSafeInteger(b.revision) || b.revision < 1 || !Array.isArray(b.sources) || !Array.isArray(b.handoff)) fail('InvalidArchive', 'Expected a version 1 branch package.');
  const ids = new Set<string>();
  for (const s of b.sources) {
    id(s.id);
    if (ids.has(s.id) || typeof s.path !== 'string' || !/^[a-f0-9]{64}$/.test(s.sha256) || !Number.isSafeInteger(s.bytes) || s.bytes < 0 || typeof s.coverage !== 'string' || ![s.missing, s.uncertainty].every(a => Array.isArray(a) && a.every(v => typeof v === 'string'))) fail('InvalidArchive', 'Invalid source metadata.');
    ids.add(s.id);
    // Even a missing source may not name a path outside this archive.
    inside(root, s.path);
  }
  return { branch: b, branchHash: hash(bytes) };
}
function proposals(root: string, branch: Branch, inputs: ProposalInput[]): Proposal[] {
  return inputs.map(input => {
    const s = branch.handoff[input.statementIndex];
    if (!s || !['user', 'assistant', 'unknown'].includes(s.role) || !['exact', 'summary', 'suggestion', 'unavailable'].includes(s.kind) || typeof s.text !== 'string' || !Array.isArray(s.refs)) fail('InvalidArchive', 'Invalid handoff statement.');
    const content = input.content ?? s.text, warnings: string[] = [], evidence: Proposal['evidence'] = [];
    let eligible = s.kind !== 'unavailable' && s.role !== 'unknown' && s.refs.length > 0;
    const spans: Buffer[] = [];
    for (const ref of s.refs) {
      const source = branch.sources.find(v => v.id === ref.sourceId);
      if (!source || !Number.isSafeInteger(ref.startByte) || !Number.isSafeInteger(ref.endByte) || ref.startByte < 0 || ref.endByte <= ref.startByte || ref.endByte > source.bytes) fail('InvalidSpan', 'Invalid evidence span.');
      warnings.push(...source.missing.map(v => `Missing: ${v}`), ...source.uncertainty.map(v => `Uncertain: ${v}`), `Coverage: ${source.coverage}`);
      const path = inside(root, source.path);
      evidence.push({ ref: `transcript:${path}`, sha256: source.sha256, startByte: ref.startByte, endByte: ref.endByte });
      if (!existsSync(path)) { eligible = false; warnings.push(`Missing source file: ${source.id}`); continue; }
      const bytes = readFileSync(path);
      if (bytes.length !== source.bytes || hash(bytes) !== source.sha256) fail('SourceChanged', source.id);
      spans.push(bytes.subarray(ref.startByte, ref.endByte));
    }
    if (s.kind === 'exact' && spans.length === s.refs.length && (spans.length !== 1 || !spans[0].equals(Buffer.from(s.text)))) fail('QuoteMismatch', 'Archived exact statement differs from its source span.');
    if (input.statement === 'source' && (s.kind !== 'exact' || content !== s.text || content !== content.replace(/\r\n/g, '\n').trim())) fail('InvalidStatement', 'Source proposals require an unchanged, adapter-safe verbatim exact statement. Use generated for paraphrases.');
    if (!eligible) warnings.push('Ineligible: attribution or source evidence is unavailable.');
    if (credential.test(content)) { eligible = false; warnings.push('Ineligible: possible credential; do not send this content to memory.'); }
    return { ...input, content, attribution: { role: s.role, kind: s.kind }, evidence, warnings: [...new Set(warnings)], eligible };
  });
}

/** Private review + explicit selection. No transcript body is read by or sent to MemoryKit. */
export function conversationMemory(archiveRoot: string, value: unknown, settings: Settings = {}) {
  const request = parse(value), root = realpathSync(resolve(archiveRoot));
  const folder = `Journal/raw/conversation-${request.branchId}`;
  const reviewPath = inside(root, `${folder}/${request.reviewId}.memory-review.json`);
  const writesPath = inside(root, `${folder}/${request.reviewId}.memory-writes.json`);
  // Off stays off, including retries. Private proposal preparation itself needs no store.
  const ctx = request.action === 'store' ? createContext(settings) : null;
  if (request.action === 'store' && !ctx) return { State: 'NotConfigured', Config: configPath(settings.env), Guidance: 'Use the existing /memory configuration workflow to explicitly select a CLI and store, then retry. No configuration or memory was written.' };
  const lock = inside(root, '.conversation-lock');
  try { mkdirSync(lock); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    return fail('ArchiveLocked', 'Inspect .conversation-lock/owner.json and confirm its process is gone before removing a stale lock.');
  }
  try {
    writeFileSync(join(lock, 'owner.json'), json({ pid: process.pid, branchId: request.branchId, reviewId: request.reviewId }));
    if (existsSync(inside(root, '.conversation-pending.json'))) fail('IncompleteWrite', 'Complete the pending conversation request first.');
    const { branch, branchHash } = branchAt(root, request.branchId);
    const save = (path: string, data: unknown) => atomic(path, Buffer.from(json(data)));
    if (request.action === 'propose') {
      if (branch.revision !== request.expectedRevision) fail('RevisionConflict', 'Read the branch and review its current revision before proposing.');
      const review: Review = { schemaVersion: 1, requestHash: hash(json(request)), branchHash, branchRevision: branch.revision, branchId: request.branchId, reviewId: request.reviewId, proposals: proposals(root, branch, request.proposals!), untrusted: true };
      if (existsSync(reviewPath) && readFileSync(reviewPath, 'utf8') !== json(review)) fail('ReviewConflict', 'Review IDs are immutable; use a new review ID after explicit re-review.');
      if (!existsSync(reviewPath)) save(reviewPath, review);
      return { State: 'Proposed', Review: reviewPath, Persistence: 'WrittenUncommitted', ...review };
    }
    const reviewBytes = readFileSync(reviewPath, 'utf8'), review = JSON.parse(reviewBytes) as Review;
    if (review.schemaVersion !== 1 || review.branchId !== request.branchId || review.reviewId !== request.reviewId || !Array.isArray(review.proposals)) fail('InvalidArchive', 'Invalid review.');
    const savedWrites: Writes | undefined = existsSync(writesPath) ? JSON.parse(readFileSync(writesPath, 'utf8')) : undefined;
    // A later attachment blocks new selections, but must not strand an uncertain write.
    // Already-prepared selections can replay with their original revision and identity.
    if (review.branchHash !== branchHash && !request.selected!.every(id => savedWrites?.requests?.[id])) fail('RevisionConflict', 'The branch changed; prepare a new review for new selections. Retry already-prepared selections with their original review ID.');
    // Recompute eligibility and provenance from the package, never trust saved eligibility flags.
    const inputs = review.proposals.map(({ id, kind, statementIndex, statement, content, corrects }) => ({ id, kind, statementIndex, statement, content, ...(corrects ? { corrects } : {}) }));
    parse({ schemaVersion: 1, action: 'propose', branchId: request.branchId, reviewId: request.reviewId, expectedRevision: review.branchRevision, proposals: inputs });
    const current = proposals(root, branch, inputs), selected = request.selected!.map(id => {
      const p = current.find(p => p.id === id);
      if (!p || !p.eligible) return fail('IneligibleProposal', `Proposal ${id} is missing or ineligible. No new writes were attempted.`);
      if (!isDeepStrictEqual(p, review.proposals.find(p => p.id === id))) fail('ReviewConflict', 'Selected source attribution or evidence changed; preserve the original review and reconcile before retrying.');
      return p;
    });
    const target = { cli: ctx!.config.cli, store: ctx!.config.store, namespace: ctx!.namespace };
    const writes: Writes = savedWrites ?? { schemaVersion: 1, reviewHash: hash(reviewBytes), target, host: ctx!.host, requests: {}, results: {} };
    if (writes.schemaVersion !== 1 || writes.reviewHash !== hash(reviewBytes) || typeof writes.host !== 'string' || !writes.requests || !writes.results || json(writes.target) !== json(target)) fail('RequestConflict', 'Review or MemoryKit target changed; restore the original request/target before retrying.');
    // Save every selected request before the first mutation; subsequent retries reuse exact args.
    for (const p of selected) {
      const input = { kind: p.kind, content: p.content, statement: p.statement, evidence: p.evidence.map(e => e.ref), extra: { conversation: { branchId: request.branchId, revision: review.branchRevision, reviewId: request.reviewId, proposalId: p.id, attribution: p.attribution, evidence: p.evidence.map(({ sha256, startByte, endByte }) => ({ sha256, startByte, endByte })) } } };
      const originalHost = { ...ctx!, host: writes.host };
      const prepared = p.corrects ? prepareCorrect(originalHost, p.corrects.id, p.corrects.expectedRevision, input) : prepareRemember(originalHost, input);
      if (writes.requests[p.id] && json(writes.requests[p.id]) !== json(prepared)) fail('RequestConflict', 'Saved request differs from the selected proposal. Do not overwrite its retry identity.');
      writes.requests[p.id] = prepared;
    }
    save(writesPath, writes);
    const results: Record<string, unknown> = {};
    for (const p of selected) {
      try { results[p.id] = submitPrepared(ctx!, writes.requests[p.id]); }
      catch (error) {
        if (!(error instanceof MemoryFailure)) throw error;
        results[p.id] = { State: 'Failed', ...error.failure };
      }
      writes.results[p.id] = results[p.id]; save(writesPath, writes);
      // The caller sees partial progress explicitly. Stop on failure; never refresh a correction revision.
      if ((results[p.id] as { State: string }).State === 'Failed') return { State: 'Failed', Results: results, Receipts: writesPath, Persistence: 'WrittenUncommitted' };
    }
    return { State: 'Stored', Results: results, Receipts: writesPath, Persistence: 'WrittenUncommitted' };
  } finally { rmSync(lock, { recursive: true }); }
}

if (isMain(import.meta.url)) await main(() => {
  const v = parseOptions(options);
  try {
    const result = conversationMemory(requiredOption(v['archive-root'], 'archive-root'), JSON.parse(readFileSync(requiredOption(v['request-file'], 'request-file'), 'utf8').replace(/^\uFEFF/, '')), { project: v.project, namespace: v.namespace });
    writeJson(result); if (result.State === 'NotConfigured') process.exitCode = 2; else if (result.State === 'Failed') process.exitCode = 1;
  } catch (error) {
    if (!(error instanceof MemoryFailure)) throw error;
    writeJson({ State: 'Failed', ...error.failure }); process.exitCode = 1;
  }
});
