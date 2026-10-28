import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { conversation } from './conversation.ts';
import { conversationMemory } from './conversation-memory.ts';
import { accept, context, createContext, show } from './memorykit.ts';
import { put, temp } from './lib/fixtures.ts';
import { run } from './lib/process.ts';

// Executable stand-in follows the adapter tests' CLI protocol (JSON, exit codes,
// operation identity, revisions). Disk persistence lets the actual entry point restart.
const stub = `
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [verb,...args] = process.argv.slice(2), flags = {}, pos = [];
for (let i=0;i<args.length;i++) { const m=/^--([^=]+)=([^]*)$/.exec(args[i]); if(m) flags[m[1]]=m[2]; else if(args[i].startsWith('--')) flags[args[i].slice(2)]=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:'true'; else pos.push(args[i]); }
const file=join(flags.store,'db.json'), fault=join(flags.store,'fault');
const db=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{records:[],ops:{}};
const ok=(value,code=0)=>{process.stdout.write(JSON.stringify(value));process.exit(code);};
const problem=(code)=>{process.stderr.write(JSON.stringify({code,title:code,retryable:code==='StoreBusy'}));process.exit(1);};
const mode=existsSync(fault)?readFileSync(fault,'utf8'):'';
const record=db.records.find(r=>r.id===pos[0]);
if(verb==='get') record?ok(record):problem('NotFound');
if(verb==='search') {const all=db.records.filter(r=>r.namespace===flags.namespace&&r.state===flags.state&&(!flags.metadata||Object.entries(JSON.parse(flags.metadata)).every(([k,v])=>r.metadata[k]===v)));const from=Number(flags.cursor||0),n=Number(flags.limit);ok({items:all.slice(from,from+n),nextCursor:from+n<all.length?String(from+n):null});}
if(mode==='busy') problem('StoreBusy');
const identity=flags['operation-id'], input=JSON.stringify([verb,pos,flags]);
if(db.ops[identity]) db.ops[identity].input===input?ok(db.ops[identity].out):problem('IdempotencyMismatch');
if(verb!=='create'&&(!record||record.revision!==Number(flags['expected-revision']))) problem('RevisionConflict');
let memory;
if(verb==='update') {record.metadata=JSON.parse(flags.metadata);record.revision++;memory=record;}
else if(verb==='create'||verb==='supersede') {memory={id:'M'+(db.records.length+1),namespace:verb==='create'?flags.namespace:record.namespace,kind:flags.kind,content:flags.content,metadata:JSON.parse(flags.metadata),provenance:JSON.parse(flags.provenance),revision:1,state:'active',supersededBy:[],updatedAt:new Date().toISOString()};db.records.push(memory);if(record){record.state='superseded';record.supersededBy=[memory.id];record.revision++;}}
else problem('InvalidCommand');
memory.updatedAt=new Date().toISOString();
const out={operationId:identity,memory,history:mode==='history-pending'?'pending':'persisted'};
db.ops[identity]={input,out};writeFileSync(file,JSON.stringify(db));
if(mode==='unknown-once'){writeFileSync(fault,'');process.stderr.write('simulated lost response');process.exit(4);}
ok(out,mode==='history-pending'?3:0);
`;
const script = join(import.meta.dirname, 'conversation-memory.ts');
const raw = 'user: Use plain text.\nassistant: Try JSON.\nassistant: Preserve attribution.\nuser: password=synthetic-only-credential\nUNSELECTED_SYNTHETIC_PRIVATE_MATERIAL\n';
function fixture(realCli?: string) {
  const base = temp(), archive = join(base, 'private Notes'), store = join(base, 'memory-store');
  put(archive, 'INDEX.md', '# Notes\n<!-- notes -->\n');
  if (realCli) { const initialized = run(process.execPath, [realCli, 'init', store]); assert.equal(initialized.code, 0, initialized.stderr); }
  put(store, 'fault', '');
  const cli = realCli ?? put(base, 'stub.mjs', stub), config = { cli, store };
  const configFile = put(base, 'memorykit.json', JSON.stringify(config));
  const env = { ...process.env, AGENTKIT_MEMORYKIT_CONFIG: configFile };
  const span = (quote: string) => { const startByte = Buffer.byteLength(raw.slice(0, raw.indexOf(quote))); return { sourceId: 'excerpt', startByte, endByte: startByte + Buffer.byteLength(quote) }; };
  const fork = {
    schemaVersion: 1, action: 'fork', branchId: 'synthetic', operationId: 'fork-1', date: '2026-10-27',
    parent: { uri: null, bookmark: 'PRIVATE_PARENT_BOOKMARK', question: 'PRIVATE_RAW_PROMPT' },
    sources: [{ id: 'excerpt', file: put(base, 'excerpt.txt', raw), coverage: 'Excerpt only', missing: ['Earlier turns'], uncertainty: ['Date unknown'] }],
    handoff: [
      { role: 'user', kind: 'exact', text: 'Use plain text.', refs: [span('Use plain text.')] },
      { role: 'assistant', kind: 'suggestion', text: 'Try JSON.', refs: [span('Try JSON.')] },
      { role: 'assistant', kind: 'summary', text: 'The summary recommends preserving attribution.', refs: [span('Preserve attribution.')] },
      { role: 'unknown', kind: 'unavailable', text: 'Earlier turns unavailable.', refs: [] },
      { role: 'user', kind: 'exact', text: 'password=synthetic-only-credential', refs: [span('password=synthetic-only-credential')] },
    ],
  };
  const result = conversation(archive, fork);
  const propose = { schemaVersion: 1, action: 'propose', branchId: 'synthetic', reviewId: 'review-1', expectedRevision: 1, proposals: [
    { id: 'decision', kind: 'decision', statementIndex: 0, statement: 'source' },
    { id: 'suggestion', kind: 'lesson', statementIndex: 1, statement: 'generated' },
    { id: 'summary', kind: 'handoff', statementIndex: 2, statement: 'generated' },
    { id: 'missing', kind: 'handoff', statementIndex: 3, statement: 'generated' },
    { id: 'credential', kind: 'decision', statementIndex: 4, statement: 'source' },
  ] };
  const storing = (selected = ['decision', 'summary']) => ({ schemaVersion: 1, action: 'store', branchId: 'synthetic', reviewId: 'review-1', selected });
  const invoke = (request: unknown, overrides = {}) => {
    const requestFile = put(base, 'request.json', JSON.stringify(request));
    const r = run(process.execPath, [script, '--archive-root', archive, '--request-file', requestFile, '--project', base, '--namespace', 'project/example/synthetic'], { env: { ...env, ...overrides } });
    assert.ok(r.stdout, r.stderr); return { code: r.code, value: JSON.parse(r.stdout), stderr: r.stderr };
  };
  const ctx = createContext({ project: base, namespace: 'project/example/synthetic', host: 'test-host', config })!;
  const db = () => JSON.parse(readFileSync(join(store, 'db.json'), 'utf8'));
  return { base, archive, store, config, env, configFile, fork, result, propose, storing, invoke, ctx, db };
}
type Fixture = ReturnType<typeof fixture>;
function it(name: string, fn: (f: Fixture) => void) { test(name, () => { const f = fixture(); try { fn(f); } finally { rmSync(f.base, { recursive: true, force: true }); } }); }

it('MEM cleanup: CLI retries transient lock errors, preserves replay and reports permanent failures', f => {
  const attempts = join(f.base, 'cleanup-attempts');
  const preload = put(f.base, 'cleanup-errors.cjs', `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const original = fs.rmSync;
let attempts = 0;
fs.rmSync = function(target, options) {
  if (String(target) === fs.realpathSync(process.env.TEST_LOCK) && options?.recursive) {
    fs.writeFileSync(process.env.TEST_ATTEMPTS, String(++attempts));
    const code = process.env.TEST_ERROR;
    if (attempts <= Number(process.env.TEST_FAILURES)) throw Object.assign(new Error('synthetic cleanup ' + code), {code});
  }
  return original(target, options);
};
syncBuiltinESMExports();
`);
  const lock = join(f.archive, '.conversation-lock');
  const invoke = (code: string, failures: number) => run(process.execPath, ['--require', preload, script,
    '--archive-root', f.archive, '--request-file', put(f.base, 'cleanup-request.json', JSON.stringify(f.propose))], {
    timeout: 20000, env: { ...f.env, TEST_LOCK: lock, TEST_ATTEMPTS: attempts, TEST_ERROR: code, TEST_FAILURES: String(failures) },
  });
  const review = join(f.archive, 'Journal/raw/conversation-synthetic/review-1.memory-review.json');
  for (const code of ['EPERM', 'ENOTEMPTY']) {
    const result = invoke(code, 2);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).State, 'Proposed');
    assert.equal(readFileSync(attempts, 'utf8'), '3');
    assert.equal(existsSync(lock), false);
  }
  const before = readFileSync(review);
  for (const [code, expectedAttempts] of [['EPERM', '11'], ['EIO', '1']]) {
    const failed = invoke(code, 99);
    assert.equal(failed.code, 1); assert.equal(failed.stdout, '');
    assert.match(failed.stderr, new RegExp('synthetic cleanup ' + code));
    assert.equal(readFileSync(attempts, 'utf8'), expectedAttempts);
    assert.ok(existsSync(lock)); assert.deepEqual(readFileSync(review), before);
    // A later invocation must not remove a lock it did not acquire.
    const blocked = invoke(code, 0);
    assert.equal(JSON.parse(blocked.stdout).code, 'ArchiveLocked');
    assert.ok(existsSync(lock));
    rmSync(lock, { recursive: true });
  }
  assert.equal(f.invoke(f.propose).value.State, 'Proposed');
  assert.deepEqual(readFileSync(review), before);
  assert.equal(existsSync(join(f.store, 'db.json')), false);
  assert.equal(existsSync(join(f.archive, 'Journal/raw/conversation-synthetic/review-1.memory-writes.json')), false);
});

test('MEM cleanup: Windows proposer releases a real held directory and returns its saved review', { skip: process.platform !== 'win32' }, () => {
  const f = fixture(), ready = join(f.base, 'holder-ready'), pidFile = join(f.base, 'holder-pid');
  const preload = put(f.base, 'hold-cleanup.cjs', `
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const original = fs.rmSync;
let held = false;
fs.rmSync = function(target, options) {
  if (!held && String(target).endsWith('.conversation-lock') && options?.recursive) {
    held = true;
    const child = spawn(process.execPath, ['-e',
      'require("node:fs").writeFileSync(process.argv[1], "ready"); setTimeout(() => process.exit(), 300);', process.env.TEST_READY],
      { cwd: target, stdio: 'ignore', windowsHide: true });
    fs.writeFileSync(process.env.TEST_PID, String(child.pid));
    const deadline = Date.now() + 10000;
    while (!fs.existsSync(process.env.TEST_READY)) {
      if (Date.now() > deadline) throw new Error('Holder never became ready');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
    child.unref();
  }
  return original(target, options);
};
syncBuiltinESMExports();
`);
  try {
    const result = run(process.execPath, ['--require', preload, script, '--archive-root', f.archive,
      '--request-file', put(f.base, 'held-request.json', JSON.stringify(f.propose))], {
      timeout: 20000, env: { ...f.env, TEST_READY: ready, TEST_PID: pidFile },
    });
    assert.equal(result.code, 0, result.stderr);
    const review = JSON.parse(result.stdout);
    assert.equal(review.State, 'Proposed'); assert.ok(existsSync(review.Review));
    assert.equal(existsSync(join(f.archive, '.conversation-lock')), false);
    assert.equal(existsSync(join(f.store, 'db.json')), false);
    assert.equal(f.invoke(f.propose).value.State, 'Proposed');
  } finally {
    if (existsSync(pidFile)) {
      const pid = Number(readFileSync(pidFile, 'utf8'));
      try { process.kill(pid); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
      const deadline = Date.now() + 5000;
      for (;;) {
        try { process.kill(pid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') break; throw error; }
        if (Date.now() > deadline) throw new Error('Holder did not exit');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      }
    }
    rmSync(f.base, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

it('MEM-1/2: entry point proposes attributed items privately and stores only selected candidates', f => {
  const p = f.invoke(f.propose); assert.equal(p.code, 0); assert.equal(p.value.State, 'Proposed');
  assert.equal(existsSync(join(f.store, 'db.json')), false);
  assert.equal(p.value.untrusted, true);
  assert.deepEqual(p.value.proposals[0].attribution, { role: 'user', kind: 'exact' });
  assert.deepEqual(p.value.proposals[1].attribution, { role: 'assistant', kind: 'suggestion' });
  assert.ok(p.value.proposals[0].warnings.includes('Missing: Earlier turns'));
  assert.equal(p.value.proposals[3].eligible, false); assert.equal(p.value.proposals[4].eligible, false);
  assert.equal(f.invoke(f.propose).value.State, 'Proposed');
  const stored = f.invoke(f.storing()); assert.equal(stored.code, 0); assert.equal(stored.value.State, 'Stored');
  assert.equal(f.db().records.length, 2);
  for (const r of Object.values(stored.value.Results) as any[]) {
    assert.equal(r.Memory.status, 'candidate'); assert.equal(r.Memory.verification, 'unverified'); assert.equal(r.Memory.evidenceStatus, 'resolved');
  }
  const serialized = JSON.stringify(f.db());
  for (const forbidden of ['PRIVATE_RAW_PROMPT', 'PRIVATE_PARENT_BOOKMARK', 'UNSELECTED_SYNTHETIC_PRIVATE_MATERIAL', 'Try JSON.', 'synthetic-only-credential', 'Earlier turns']) assert.ok(!serialized.includes(forbidden), forbidden);
  assert.equal(f.db().records[0].metadata.statement, 'source');
  assert.equal(f.db().records[1].metadata.statement, 'generated');
  assert.deepEqual(f.db().records[1].metadata.conversation.attribution, { role: 'assistant', kind: 'summary' });
  assert.equal(context(f.ctx).State, 'Empty');
  const first = stored.value.Results.decision.Memory;
  accept(f.ctx, first.id, first.revision);
  assert.equal(context(f.ctx).Items, 1); assert.match(context(f.ctx).Text, /untrusted="true"/);
  const replay = f.invoke(f.storing(['decision']));
  assert.equal(replay.value.Results.decision.State, 'Replayed'); assert.equal(replay.value.Results.decision.Memory.status, 'accepted');
  assert.equal(f.db().records.length, 2);
});

it('MEM-2/4: inherited object names are valid proposal IDs, with only prepared selections replayable', f => {
  const proposal = { ...f.propose.proposals[0], id: 'constructor' };
  assert.equal(f.invoke({ ...f.propose, proposals: [proposal] }).code, 0);
  const stored = f.invoke(f.storing(['constructor']));
  assert.equal(stored.code, 0); assert.equal(stored.value.Results.constructor.Memory.status, 'candidate');
  assert.equal(f.db().records.length, 1);
  conversation(f.archive, { schemaVersion: 1, action: 'attach', branchId: 'synthetic', operationId: 'later', expectedRevision: 1, handoff: [f.fork.handoff[0]] });
  assert.equal(f.invoke(f.storing(['constructor'])).code, 0);
  assert.equal(f.db().records.length, 1);
});

it('MEM-4: inherited request properties cannot authorize a new selection after attachment', f => {
  assert.equal(f.invoke({ ...f.propose, proposals: [...f.propose.proposals, { ...f.propose.proposals[0], id: 'constructor' }] }).code, 0);
  assert.equal(f.invoke(f.storing(['decision'])).code, 0);
  conversation(f.archive, { schemaVersion: 1, action: 'attach', branchId: 'synthetic', operationId: 'later', expectedRevision: 1, handoff: [f.fork.handoff[0]] });
  assert.equal(f.invoke(f.storing(['constructor'])).value.code, 'RevisionConflict');
  assert.equal(f.db().records.length, 1);
});

it('MEM-3: missing configuration returns safe guidance and neither config nor writes are created', f => {
  f.invoke(f.propose);
  const absent = join(f.base, 'absent.json'), r = f.invoke(f.storing(), { AGENTKIT_MEMORYKIT_CONFIG: absent });
  assert.equal(r.code, 2); assert.equal(r.value.State, 'NotConfigured'); assert.equal(r.value.Config, absent); assert.match(r.value.Guidance, /explicitly/);
  assert.equal(existsSync(absent), false); assert.equal(existsSync(join(f.store, 'db.json')), false);
  assert.equal(existsSync(join(f.archive, 'Journal/raw/conversation-synthetic/review-1.memory-writes.json')), false);
});

it('MEM-1/2: rejects paraphrases marked source, secrets, missing attribution and missing/changed evidence before writes', f => {
  const wrong = structuredClone(f.propose); wrong.proposals[0].statementIndex = 2;
  assert.equal(f.invoke(wrong).value.code, 'InvalidStatement');
  f.invoke(f.propose);
  for (const selected of [['decision', 'missing'], ['credential'], ['unknown']]) assert.equal(f.invoke(f.storing(selected)).value.code, 'IneligibleProposal');
  assert.equal(existsSync(join(f.store, 'db.json')), false);
  const source = join(f.archive, f.result.Sources[0].path); rmSync(source);
  const missing = f.invoke({ ...f.propose, reviewId: 'missing-source' });
  assert.equal(missing.value.proposals[0].eligible, false); assert.match(missing.value.proposals[0].warnings.join('\n'), /Missing source file/);
  assert.equal(f.invoke(f.storing()).value.code, 'IneligibleProposal');
  writeFileSync(source, raw + 'tampered'); assert.equal(f.invoke(f.storing()).value.code, 'SourceChanged');
});

it('MEM-4: unknown write outcome survives restart and host change using the saved operation identity', f => {
  f.invoke(f.propose); put(f.store, 'fault', 'unknown-once');
  const failed = f.invoke(f.storing(['decision'])); assert.equal(failed.code, 1); assert.equal(failed.value.State, 'Failed');
  assert.equal(failed.value.Results.decision.code, 'CliFailed'); assert.deepEqual(failed.value.Results.decision.details, { written: 'unknown' });
  const before = f.db(); assert.equal(before.records.length, 1);
  conversation(f.archive, { schemaVersion: 1, action: 'attach', branchId: 'synthetic', operationId: 'later', expectedRevision: 1, handoff: [f.fork.handoff[0]] });
  assert.equal(f.invoke(f.storing(['summary'])).value.code, 'RevisionConflict');
  const retry = f.invoke(f.storing(['decision']), { CLAUDECODE: '1' }); assert.equal(retry.code, 0);
  assert.equal(f.db().records.length, 1); assert.deepEqual(Object.keys(f.db().ops), Object.keys(before.ops));
  assert.equal(retry.value.Results.decision.OperationId, Object.keys(before.ops)[0]);
  const writes = JSON.parse(readFileSync(retry.value.Receipts, 'utf8'));
  assert.equal(writes.requests.decision.args.at(-1), '--operation-id=' + Object.keys(before.ops)[0]);
});

it('MEM-4: preserves adapter failures, history-pending confirmation and target/request conflict', f => {
  f.invoke(f.propose); put(f.store, 'fault', 'busy');
  const failed = f.invoke(f.storing(['decision'])); assert.equal(failed.code, 1); assert.equal(failed.value.Results.decision.code, 'StoreBusy'); assert.equal(failed.value.Results.decision.retryable, true);
  put(f.store, 'fault', 'history-pending');
  const stored = f.invoke(f.storing(['decision'])); assert.equal(stored.value.Results.decision.HistoryPending, true);
  const receipts = JSON.parse(readFileSync(stored.value.Receipts, 'utf8'));
  const args: string[] = receipts.requests.decision.args;
  args[args.findIndex(v => v.startsWith('--metadata='))] = '--metadata={"status":"accepted"}';
  writeFileSync(stored.value.Receipts, JSON.stringify(receipts));
  assert.equal(f.invoke(f.storing(['decision'])).value.code, 'RequestConflict');
  put(f.base, 'memorykit.json', JSON.stringify({ ...f.config, store: f.base }));
  assert.equal(f.invoke(f.storing(['decision'])).value.code, 'RequestConflict');
});

it('MEM-4: corrections keep history, use the reviewed revision and stop on conflict without automatic retry', f => {
  f.invoke(f.propose); const initial = f.invoke(f.storing(['decision'])).value.Results.decision.Memory;
  accept(f.ctx, initial.id, initial.revision);
  const correction = { ...f.propose, reviewId: 'correction', proposals: [{ id: 'fix', kind: 'decision', statementIndex: 2, statement: 'generated', corrects: { id: initial.id, expectedRevision: initial.revision } }] };
  f.invoke(correction);
  const store = { ...f.storing(['fix']), reviewId: 'correction' };
  const conflict = f.invoke(store); assert.equal(conflict.value.Results.fix.code, 'RevisionConflict'); assert.equal(f.db().records.length, 1);
  assert.equal(f.invoke(store).value.Results.fix.code, 'RevisionConflict');
  const reviewed = structuredClone(correction); reviewed.reviewId = 'correction-reviewed'; reviewed.proposals[0].corrects.expectedRevision = show(f.ctx, initial.id).Memory.revision;
  f.invoke(reviewed);
  const corrected = f.invoke({ ...store, reviewId: reviewed.reviewId }); assert.equal(corrected.code, 0);
  assert.equal(corrected.value.Results.fix.Memory.status, 'candidate');
  assert.equal(show(f.ctx, initial.id).Memory.state, 'superseded');
  assert.equal(context(f.ctx).State, 'Empty');
  assert.equal(f.db().records.length, 2);
  assert.equal(f.invoke({ ...store, reviewId: reviewed.reviewId }).code, 0); assert.equal(f.db().records.length, 2);
});

it('MEM-5: generated Unicode proposals keep existing UTF-8 budgets and accepted-only context', f => {
  const request = { ...f.propose, proposals: [0, 1, 2].map(i => ({ id: 'unicode-' + i, kind: 'lesson', statementIndex: 2, statement: 'generated', content: `${i}: ${'Ї😀é<&'.repeat(45)}` })) };
  f.invoke(request);
  const result = f.invoke(f.storing(request.proposals.map(p => p.id)));
  assert.equal(result.code, 0); assert.equal(context(f.ctx).Items, 0);
  for (const r of Object.values(result.value.Results) as any[]) accept(f.ctx, r.Memory.id, r.Memory.revision);
  assert.equal(context(f.ctx).LimitBytes, 8192);
  const c = context(f.ctx, 1200); assert.ok(c.Bytes <= 1200); assert.equal(c.Bytes, Buffer.byteLength(c.Text));
  assert.equal(c.Items + c.Omitted, 3); assert.ok(c.Items > 0 && c.Omitted > 0); assert.equal(c.Truncated, false);
  assert.match(c.Text, /&lt;&amp;/); assert.ok(!c.Text.includes('\uFFFD'));
});

it('MEM-1/4: review immutability, branch revision, pending writes and archive lock fail closed', f => {
  const p = f.invoke(f.propose).value;
  const changed = structuredClone(f.propose); changed.proposals[0].kind = 'lesson';
  assert.equal(f.invoke(changed).value.code, 'ReviewConflict');
  put(f.archive, '.conversation-lock/owner.json', '{"pid":0}');
  assert.equal(f.invoke(f.storing()).value.code, 'ArchiveLocked');
  rmSync(join(f.archive, '.conversation-lock'), { recursive: true });
  put(f.archive, '.conversation-pending.json', '{}'); assert.equal(f.invoke(f.storing()).value.code, 'IncompleteWrite');
  rmSync(join(f.archive, '.conversation-pending.json'));
  conversation(f.archive, { schemaVersion: 1, action: 'attach', branchId: 'synthetic', operationId: 'later', expectedRevision: 1, handoff: [f.fork.handoff[0]] });
  assert.equal(f.invoke(f.storing()).value.code, 'RevisionConflict');
  assert.equal(existsSync(join(f.store, 'db.json')), false);
  assert.equal(readFileSync(p.Review, 'utf8').includes('PRIVATE_RAW_PROMPT'), false);
});

it('MEM-2: strict entry contract refuses acceptance, verification, raw refs and unsupported memory kinds', f => {
  for (const proposal of [
    { ...f.propose.proposals[0], accept: true }, { ...f.propose.proposals[0], verification: 'verified' },
    { ...f.propose.proposals[0], kind: 'story' }, { ...f.propose.proposals[0], evidence: ['raw-prompt'] },
  ]) assert.equal(f.invoke({ ...f.propose, proposals: [proposal] }).value.code, 'InvalidRequest');
  assert.equal(f.invoke({ ...f.storing(), accept: true }).value.code, 'InvalidRequest');
  assert.throws(() => conversationMemory(f.archive, { ...f.propose, reviewId: '../escape' }), /InvalidRequest/);
});

test('MEM-6: real MemoryKit CLI runs the extraction entry point with isolated candidate, accept and correction flows', { skip: !process.env.MEMORYKIT_CLI }, () => {
  const f = fixture(process.env.MEMORYKIT_CLI);
  try {
    assert.equal(f.invoke(f.propose).code, 0);
    const stored = f.invoke(f.storing()); assert.equal(stored.code, 0);
    const decision = stored.value.Results.decision.Memory;
    assert.equal(decision.status, 'candidate'); assert.equal(decision.verification, 'unverified'); assert.equal(context(f.ctx).Items, 0);
    accept(f.ctx, decision.id, decision.revision); assert.equal(context(f.ctx).Items, 1);
    assert.equal(f.invoke(f.storing(['decision'])).value.Results.decision.State, 'Replayed');
    const revision = show(f.ctx, decision.id).Memory.revision;
    assert.equal(f.invoke({ ...f.propose, reviewId: 'real-correction', proposals: [{ id: 'fix', kind: 'decision', statementIndex: 2, statement: 'generated', corrects: { id: decision.id, expectedRevision: revision } }] }).code, 0);
    assert.equal(f.invoke({ ...f.storing(['fix']), reviewId: 'real-correction' }).code, 0);
    assert.equal(show(f.ctx, decision.id).Memory.state, 'superseded');
    assert.equal(context(f.ctx).State, 'Empty');
    assert.equal(f.invoke({ ...f.storing(['fix']), reviewId: 'real-correction' }).code, 0);
  } finally { rmSync(f.base, { recursive: true, force: true }); }
});
