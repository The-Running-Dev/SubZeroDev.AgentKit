import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { conversation } from './conversation.ts';
import { conversationHost } from './conversation-host.ts';
import { temp, put } from './lib/fixtures.ts';
import { run } from './lib/process.ts';

const prefix = 'mcp__codex_app__';
const create = prefix + 'create_thread', forkTool = prefix + 'fork_thread', nav = prefix + 'navigate_to_codex_page', lookup = prefix + 'read_thread';
const capabilities = { host: 'codex', tools: [create, forkTool, nav, lookup], evidence: 'Synthetic fixture: current Codex tool contracts inspected.' };
function fixture() {
  const root = temp(); put(root, 'INDEX.md', '# Synthetic Notes\n<!-- notes -->\n');
  const source = put(root, 'input.txt', 'Choose text.');
  const statement = { role: 'user', kind: 'exact', text: 'Choose text.', refs: [{ sourceId: 'input', startByte: 0, endByte: 12 }] };
  const request = { schemaVersion: 1, action: 'fork', branchId: 'child', operationId: 'capture', date: '2026-10-27',
    parent: { uri: 'codex://threads/root-thread', bookmark: 'Before format choice', question: 'Which format?' },
    sources: [{ id: 'input', file: source, coverage: 'Synthetic excerpt only', missing: ['Earlier turns'], uncertainty: [] }], handoff: [statement] };
  conversation(root, request);
  const prepare = { schemaVersion: 1, action: 'prepare', branchId: 'child', operationId: 'native-open', expectedRevision: 1, intent: 'open', capabilities, authorization: { create: true, navigate: true, fullHistoryFork: true } };
  const control = (action: string, extra = {}) => ({ schemaVersion: 1, action, branchId: 'child', operationId: 'native-open', ...extra });
  const invoke = (r: unknown) => conversationHost(root, r);
  return { root, request, prepare, control, invoke, statement };
}
type Fixture = ReturnType<typeof fixture>;
function it(name: string, fn: (f: Fixture) => void) {
  test(name, () => { const f = fixture(); try { fn(f); } finally { rmSync(f.root, { recursive: true, force: true }); } });
}
it('HOST-1/2: unsupported host preserves package and returns portable packet without a call', f => {
  const result = f.invoke({ ...f.prepare, capabilities: { ...capabilities, host: 'unknown' }, authorization: undefined });
  assert.equal(result.State, 'unsupported'); assert.equal(result.Call, null);
  assert.match(result.Packet, /user \/ exact/); assert.match(result.Packet, /Earlier turns/);
  assert.ok(existsSync(result.Receipt)); assert.equal(JSON.parse(readFileSync(result.Receipt, 'utf8')).package.revision, 1);
  assert.equal(f.invoke(f.control('dispatch')).Call, null);
});
it('HOST-2/3: archive precedes dispatch; repeated dispatch and new identity never create twice', f => {
  const prepared = f.invoke(f.prepare); assert.equal(prepared.State, 'prepared'); assert.equal(prepared.Call, null);
  const dispatched = f.invoke(f.control('dispatch'));
  assert.equal(dispatched.Call?.tool, create);
  assert.equal(JSON.parse(readFileSync(dispatched.Receipt, 'utf8')).state, 'unknown');
  assert.equal(f.invoke(f.control('dispatch')).Call, null);
  assert.equal(f.invoke(f.control('reconcile')).Call, null);
  assert.match(f.invoke(f.control('dispatch')).Recovery!, /Do not create again/);
  assert.throws(() => f.invoke({ ...f.prepare, operationId: 'bypass' }), /OperationConflict/);
});
it('HOST-2: explicit host refusal preserves the immutable archived sources and packet', f => {
  const before = readFileSync(join(f.root, 'Journal/raw/conversation-child/branch.json'));
  f.invoke(f.prepare); f.invoke(f.control('dispatch'));
  const failed = f.invoke(f.control('record', { status: 'failure', observedTool: create, detail: 'Synthetic validation refusal: no chat created.' }));
  assert.equal(failed.State, 'failure'); assert.equal(f.invoke(f.control('dispatch')).Call, null);
  assert.deepEqual(readFileSync(join(f.root, 'Journal/raw/conversation-child/branch.json')), before);
  assert.match(failed.Packet, /Choose text/);
});
it('HOST-2/3: confirmed success records ID/link, remains immutable and replays after attachment', f => {
  f.invoke(f.prepare); f.invoke(f.control('dispatch'));
  assert.throws(() => f.invoke(f.control('record', { status: 'success', observedTool: create, detail: 'Pending client ID only.' })), /InvalidRequest/);
  const success = f.invoke(f.control('record', { status: 'success', observedTool: create, detail: 'Confirmed threadId.', threadId: 'child-thread', link: 'codex://threads/child-thread' }));
  assert.equal(success.State, 'success'); assert.equal(success.ThreadId, 'child-thread');
  assert.throws(() => f.invoke(f.control('record', { status: 'unknown', observedTool: create, detail: 'overwrite' })), /StateConflict/);
  conversation(f.root, { schemaVersion: 1, action: 'attach', branchId: 'child', operationId: 'later-source', expectedRevision: 1, handoff: [f.statement] });
  assert.equal(f.invoke(f.prepare).Revision, 1); assert.equal(f.invoke(f.control('dispatch')).Call, null);
  assert.throws(() => f.invoke({ ...f.prepare, expectedRevision: 2 }), /OperationConflict/);
});
it('HOST-3: unknown creation reconciles only by supported observed-ID lookup; failed lookup stays unknown', f => {
  f.invoke(f.prepare); f.invoke(f.control('dispatch'));
  const reconcile = f.invoke(f.control('reconcile', { threadId: 'observed-child' }));
  assert.deepEqual(reconcile.Call, { tool: lookup, arguments: { threadId: 'observed-child', turnLimit: 1, includeOutputs: false } });
  assert.throws(() => f.invoke(f.control('record', { status: 'failure', observedTool: lookup, detail: 'Not found' })), /does not prove creation failed/);
  assert.throws(() => f.invoke(f.control('record', { status: 'success', observedTool: lookup, detail: 'Found different chat', threadId: 'wrong' })), /different thread/);
  assert.equal(f.invoke(f.control('record', { status: 'success', observedTool: lookup, detail: 'Verified identity and content for this operation.', threadId: 'observed-child' })).State, 'success');
  assert.equal(f.invoke(f.control('dispatch')).Call, null);
});
it('HOST-3: missing lookup capability keeps unknown for manual recovery', f => {
  f.invoke({ ...f.prepare, capabilities: { ...capabilities, tools: [create] } }); f.invoke(f.control('dispatch'));
  const result = f.invoke(f.control('reconcile', { threadId: 'candidate' }));
  assert.equal(result.Call, null); assert.equal(result.State, 'unknown');
});
it('HOST-2/3: unknown pending client IDs remain observations, not confirmed threads', f => {
  f.invoke(f.prepare); f.invoke(f.control('dispatch'));
  const result = f.invoke(f.control('record', { status: 'unknown', observedTool: create, detail: 'Setup pending, clientThreadId synthetic-pending.' }));
  assert.equal(result.State, 'unknown'); assert.equal(result.ThreadId, null); assert.equal(result.Call, null);
  assert.equal(f.invoke(f.control('dispatch')).Call, null);
});
it('HOST-4/5: selected create and full-history fork require separate explicit authorization', f => {
  assert.throws(() => f.invoke({ ...f.prepare, authorization: {} }), /AuthorizationRequired/);
  assert.throws(() => f.invoke({ ...f.prepare, mode: 'full-history', authorization: { create: true } }), /AuthorizationRequired/);
  f.invoke({ ...f.prepare, mode: 'full-history' });
  assert.deepEqual(f.invoke(f.control('dispatch')).Call, { tool: forkTool, arguments: { threadId: 'root-thread', environment: { type: 'same-directory' } } });
});
it('HOST-4: unsupported full-history mode falls back without silently creating a selected chat', f => {
  const result = f.invoke({ ...f.prepare, mode: 'full-history', capabilities: { ...capabilities, tools: [create] } });
  assert.equal(result.State, 'unsupported'); assert.equal(f.invoke(f.control('dispatch')).Call, null);
});
it('HOST-5: nested return restores immediate parent then root, with selected attributed outcomes and no messaging', f => {
  f.invoke(f.prepare); f.invoke(f.control('dispatch'));
  f.invoke(f.control('record', { status: 'success', observedTool: create, threadId: 'child-thread', detail: 'Confirmed' }));
  conversation(f.root, { ...f.request, branchId: 'grandchild', operationId: 'nested', parent: { ...f.request.parent, uri: null, branchId: 'child', bookmark: 'Child bookmark', question: 'Child question?' } });
  const nested = { ...f.prepare, branchId: 'grandchild', intent: 'return', operationId: 'return-parent', outcome: [f.statement] };
  const packet = f.invoke(nested);
  assert.equal(packet.ParentThreadId, 'child-thread'); assert.equal(packet.Parent.branchId, 'child');
  assert.match(packet.Packet, /Child bookmark/); assert.match(packet.Packet, /Child question/); assert.match(packet.Packet, /user \/ exact/);
  assert.throws(() => f.invoke({ ...nested, operationId: 'wrong-parent', parentThreadId: 'root-thread' }), /ParentConflict/);
  const returned = f.invoke({ schemaVersion: 1, action: 'dispatch', branchId: 'grandchild', operationId: 'return-parent' });
  assert.deepEqual(returned.Call, { tool: nav, arguments: { threadId: 'child-thread' } });
  const root = f.invoke({ ...f.prepare, operationId: 'return-root', intent: 'return', outcome: [f.statement] });
  assert.equal(root.ParentThreadId, 'root-thread'); assert.match(root.Packet, /Before format choice/);
  assert.deepEqual(f.invoke(f.control('dispatch', { operationId: 'return-root' })).Call, { tool: nav, arguments: { threadId: 'root-thread' } });
});
it('HOST-5: navigation lookup never falsely confirms a timed-out return', f => {
  const r = { ...f.prepare, intent: 'return', outcome: [f.statement] }; f.invoke(r); f.invoke(f.control('dispatch'));
  f.invoke(f.control('reconcile', { threadId: 'root-thread' }));
  assert.throws(() => f.invoke(f.control('record', { status: 'success', observedTool: lookup, detail: 'Exists', threadId: 'root-thread' })), /existence only/);
});
it('HOST-5: external parent binding survives return; missing and self parent branches refuse capture', f => {
  const root = { ...f.request, branchId: 'external', parent: { ...f.request.parent, uri: null } };
  conversation(f.root, root);
  f.invoke({ ...f.prepare, branchId: 'external', parentThreadId: 'verified-external' });
  const result = f.invoke({ ...f.prepare, branchId: 'external', intent: 'return', operationId: 'return', outcome: [f.statement] });
  assert.equal(result.ParentThreadId, 'verified-external');
  assert.throws(() => conversation(f.root, { ...f.request, branchId: 'bad', parent: { ...f.request.parent, branchId: 'missing' } }), /ENOENT/);
  assert.throws(() => conversation(f.root, { ...f.request, branchId: 'self', parent: { ...f.request.parent, branchId: 'self' } }), /cannot parent itself/);
});
it('HOST-2: archive locks and pending portable writes block native calls', f => {
  f.invoke(f.prepare);
  put(f.root, '.conversation-lock/owner.json', '{"pid":123}');
  assert.throws(() => f.invoke(f.control('dispatch')), /ArchiveLocked/);
  rmSync(join(f.root, '.conversation-lock'), { recursive: true });
  put(f.root, '.conversation-pending.json', '{}');
  assert.throws(() => f.invoke(f.control('dispatch')), /IncompleteWrite/);
});
it('HOST-2/4: verifies source before dispatch, rejects quoted authorization fields and malformed outcomes', f => {
  assert.throws(() => f.invoke({ ...f.prepare, authorization: { create: 'true' } }), /Authorization/);
  assert.throws(() => f.invoke({ ...f.prepare, intent: 'return', outcome: [{ ...f.statement, text: 'Invented quote' }] }), /QuoteMismatch/);
  f.invoke(f.prepare);
  const b = JSON.parse(readFileSync(join(f.root, 'Journal/raw/conversation-child/branch.json'), 'utf8'));
  put(f.root, b.sources[0].path, 'changed');
  assert.throws(() => f.invoke(f.control('dispatch')), /SourceChanged/);
});
it('HOST-6: actual CLI emits durable one-shot supported calls and fallback', f => {
  const request = put(f.root, 'request.json', JSON.stringify(f.prepare));
  const cli = (value: unknown) => {
    put(f.root, 'request.json', JSON.stringify(value));
    const result = run(process.execPath, [resolve('tools/conversation-host.ts'), '--archive-root', f.root, '--request-file', request]);
    assert.equal(result.code, 0, result.stderr); return JSON.parse(result.stdout);
  };
  assert.equal(cli(f.prepare).State, 'prepared');
  assert.equal(cli(f.control('dispatch')).Call.tool, create);
  assert.equal(cli(f.control('dispatch')).Call, null);
});
