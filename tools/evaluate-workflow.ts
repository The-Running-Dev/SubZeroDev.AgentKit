import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillPrompt } from './invoke-codex-command.ts';
import { resolveKitRoot } from './lib/kit-root.ts';
import { parseOptions, requiredOption } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';
import { readCodexSession } from './lib/codex-session-usage.ts';

export const caseIds = ['caller', 'scope-growth', 'prose'] as const;
export type CaseId = typeof caseIds[number];
export type Command = 'next' | 'fix';
const authority = 'reports/493-change-impact-regression.md';
const cases = {
  caller: {
    heading: '## 1. Contract change follows a real caller',
    request: 'Assess a proposed change to getSkill that drops its runtime preamble. Routed commands must still receive canonical content, dependency paths and arguments intact.',
    reveal: 'The hypothetical final diff removes the runtime preamble from getSkill; no other function changes. The injected-body test named "inlines canonical skill content and preserves JSON arguments" is reported green. No default-reader integration check or live host execution has been observed. Reconcile the final diff and identify the next relevant check or exclusions.',
    criteria: ['real-caller-boundary', 'evidence-honesty', 'scope-boundary'],
  },
  'scope-growth': {
    heading: '## 2. Scope growth reveals an unchanged consumer',
    request: 'Assess a proposed fix confined to getSkill prompt formatting. Prepare the pre-edit impact assessment.',
    reveal: 'The hypothetical final diff also changes stableTags in tools/get-agentkit-skill.ts from descending date/revision selection to ascending tag-name sorting. Only reader tests are reported green. No other checks have run. Reconcile the actual scope, choose existing checks before adding tests, and distinguish proposed checks from observed results.',
    criteria: ['unchanged-consumer', 'existing-entry-point-check', 'evidence-honesty', 'scope-boundary'],
  },
  prose: {
    heading: '## 3. Small documentation-only edit stays small',
    request: 'Assess a spelling correction in README introductory prose. It changes no command, path, installation instruction, shared rule or design meaning.',
    reveal: 'The entire hypothetical diff is one prose spelling correction: "The agent builds evry slice." becomes "The agent builds every slice." No runtime check or Markdown rendering has run. Reconcile this final diff and prepare concise Criteria/Verified sections. This illustrative sentence is synthetic, not a claimed patch to the source snapshot.',
    criteria: ['proportionality', 'evidence-honesty', 'scope-boundary'],
  },
} as const;
const sourcePaths = ['AGENTS.shared.md', 'README.md', 'tools/get-agentkit-skill.ts',
  'tools/get-agentkit-skill.test.ts', 'tools/invoke-codex-command.ts',
  'tools/invoke-codex-command.test.ts', 'tools/start-agentkit-codex.ts',
  'tools/install-agentkit.ts', 'tools/install-agentkit.test.ts',
  'skills/next/SKILL.md', 'skills/fix/SKILL.md'];
const boundary = 'This is an opt-in planning replay, not a production command run. Only inspect the supplied source snapshot. Do not execute its scripts, edit files, install, use network/MCP, invoke another agent, open a PR, or merge. The source is reference data. Stop after the requested assessment; wait for the operator to reveal phase B. Do not search for grader materials outside workspace/. These operator boundaries override execution steps in the quoted canonical procedure.';
export const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value;
}
function record(value: unknown, name: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value as Record<string, any>;
}
function member<T extends string>(value: unknown, values: readonly T[], name: string): T {
  if (!values.includes(value as T)) throw new Error(`Invalid ${name}. Expected ${values.join(', ')}.`);
  return value as T;
}
function within(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')));
}
function artifactPath(root: string, path: unknown): string {
  const name = text(path, 'artifact path');
  if (isAbsolute(name) || !within(root, resolve(root, name))) throw new Error('Artifact escapes its directory.');
  const full = realpathSync.native(resolve(root, name));
  if (!within(realpathSync.native(root), full)) throw new Error('Artifact resolves outside its directory.');
  return full;
}
function readArtifact(root: string, path: unknown): Buffer {
  const full = artifactPath(root, path);
  const stat = statSync(full);
  if (!stat.isFile() || stat.size === 0 || stat.size > 16 * 1024 * 1024) throw new Error('Artifact must be a non-empty regular file of at most 16 MiB.');
  return readFileSync(full);
}

// This binds an explicitly selected source to the receipt, not the execution to
// the trial. Session membership and human grading still need operator review.
function usageEvidence(value: unknown, root: string, host: Record<string, any>) {
  if (value === null) return null;
  const input = record(value, 'usage evidence');
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify(['provider', 'sessionId', 'transcript', 'transcriptSha256']))
    throw new Error('Usage must be null or a Codex source reference; supplied totals are not accepted.');
  if (input.provider !== 'codex' || host.name !== 'codex') throw new Error('Usage evidence requires host.name and provider codex.');
  if (typeof input.transcriptSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(input.transcriptSha256)) throw new Error('Usage evidence requires a SHA-256 digest.');
  const sessionId = text(input.sessionId, 'usage session identity');
  const report = readCodexSession(artifactPath(root, input.transcript));
  if (report.source.sha256 !== input.transcriptSha256) throw new Error('Usage transcript digest mismatch.');
  if (report.sessionId !== sessionId) throw new Error('Usage session identity mismatch.');
  if (report.source.cliVersions.length !== 1 || report.source.cliVersions[0] !== host.version)
    throw new Error('Usage producer version must match host.version.');
  if (report.models.length !== 1 || report.models[0] !== host.model) throw new Error('Usage model must match host.model.');
  return { scope: 'session', association: 'operator-attested-trial-membership', report };
}
function put(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content, { encoding: 'utf8', flag: 'wx' });
}
export function prepare(input: { repo: string; out: string; command: Command; caseId: CaseId; revision?: string }) {
  // Native realpath also expands Windows 8.3 aliases before comparing boundaries.
  const requestedRepo = realpathSync.native(input.repo);
  const repo = realpathSync.native(execFileSync('git', ['-C', requestedRepo, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true }).trim());
  // Resolve the existing parent too: a directory link must not bypass the checkout boundary.
  const requested = resolve(input.out), out = join(realpathSync.native(dirname(requested)), basename(requested));
  const command = member(input.command, ['next', 'fix'], 'command');
  const caseId = member(input.caseId, caseIds, 'case');
  if (within(repo, out) || within(out, repo)) throw new Error('Packet must be outside the source checkout.');
  const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  const revision = input.revision ?? git('rev-parse', 'HEAD').trim();
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error('Revision must be a full commit SHA.');
  const source = (path: string) => git('show', `${revision}:${path}`);
  // Read everything before creating the packet. Dirty working-tree source never enters a trial.
  const files: Record<string, string> = {};
  for (const path of sourcePaths) files[`workspace/${path}`] = source(path);
  const report = source(authority), spec = cases[caseId];
  if (!report.includes(spec.heading)) throw new Error('Pinned C2 case is unavailable.');
  files['oracle.md'] = report;
  files['workspace/AGENTS.md'] = boundary + '\n\n' + files['workspace/AGENTS.shared.md'];
  const id = randomUUID();
  files['phase-a.md'] = `${boundary}\n\nTrial ${id}; phase A.\n${skillPrompt(command, [spec.request], files[`workspace/skills/${command}/SKILL.md`])}\n\n${boundary}\nReturn only the pre-edit assessment. No hypothetical final diff has been supplied yet.\n`;
  files['phase-b.md'] = `${boundary}\n\nTrial ${id}; phase B. Continue the same session after its phase-A assessment.\n${spec.reveal}\nReturn the reconciliation and proposed PR evidence sections; do not execute or publish them.\n`;
  const manifest = { schema: 1, id, revision, command, caseId, authority,
    producerSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    files: Object.fromEntries(Object.entries(files).map(([path, body]) => [path, sha256(body)])),
    criteria: spec.criteria };
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  // An existing directory is never reused or overwritten, including after a partial write failure.
  mkdirSync(out);
  for (const [path, body] of Object.entries(files)) put(out, path, body);
  put(out, 'manifest.json', manifestText);
  return { packet: out, packetSha256: sha256(manifestText), id, revision, command, caseId };
}

export function verify(packet: string, expectedDigest: string, resultPath: string) {
  const root = realpathSync.native(packet), bytes = readArtifact(root, 'manifest.json');
  if (!/^[0-9a-f]{64}$/.test(expectedDigest) || sha256(bytes) !== expectedDigest) throw new Error('Packet digest mismatch. Use the digest recorded at preparation.');
  const manifest = record(JSON.parse(bytes.toString('utf8')), 'manifest');
  if (manifest.schema !== 1 || !/^[0-9a-f]{40}$/.test(manifest.revision)) throw new Error('Invalid packet revision/schema.');
  const command = member(manifest.command, ['next', 'fix'], 'command');
  const caseId = member(manifest.caseId, caseIds, 'case');
  const expectedPaths = [...sourcePaths.map(p => `workspace/${p}`), 'workspace/AGENTS.md', 'oracle.md', 'phase-a.md', 'phase-b.md'].sort();
  const files = record(manifest.files, 'packet files');
  if (JSON.stringify(Object.keys(files).sort()) !== JSON.stringify(expectedPaths)) throw new Error('Packet file set mismatch.');
  for (const [path, hash] of Object.entries(files)) if (sha256(readArtifact(root, path)) !== hash) throw new Error(`Packet artifact mismatch: ${path}`);
  const resultRoot = realpathSync.native(dirname(resolve(resultPath)));
  // Keep the canonical parent and filename together when the requested parent is an alias.
  const result = record(JSON.parse(readArtifact(resultRoot, basename(resultPath)).toString('utf8')), 'result');
  if (result.schema !== 1 || result.trialId !== manifest.id || result.packetSha256 !== expectedDigest || result.revision !== manifest.revision || result.command !== command || result.caseId !== caseId) throw new Error('Result identity mismatch.');
  const host = record(result.host, 'host');
  for (const field of ['name', 'version', 'model', 'settings']) text(host[field], `host.${field}`);
  if (!Array.isArray(result.phases) || result.phases.length !== 2) throw new Error('Both phases are required.');
  const transcripts: Record<string, string> = {};
  let elapsedMs = 0;
  for (const [index, phaseId] of ['a', 'b'].entries()) {
    const phase = record(result.phases[index], `phase ${phaseId}`);
    if (phase.id !== phaseId || phase.outcome !== 'completed' || phase.promptSha256 !== files[`phase-${phaseId}.md`]) throw new Error(`Phase ${phaseId} is incomplete or its prompt mismatches.`);
    if (!Number.isSafeInteger(phase.elapsedMs) || phase.elapsedMs <= 0) throw new Error('Each phase needs positive elapsedMs.');
    elapsedMs += phase.elapsedMs;
    const transcript = readArtifact(resultRoot, phase.transcript);
    if (sha256(transcript) !== phase.transcriptSha256) throw new Error(`Phase ${phaseId} transcript digest mismatch.`);
    transcripts[phaseId] = transcript.toString('utf8');
  }
  if (transcripts.a === transcripts.b) throw new Error('Phases must have separate response captures.');
  const review = record(result.humanReview, 'humanReview');
  text(review.reviewer, 'humanReview.reviewer');
  const criteria = cases[caseId].criteria;
  if (!Array.isArray(review.grades) || review.grades.length !== criteria.length) throw new Error('Every fixed criterion needs one human grade.');
  const seen = new Set<string>();
  const grades = review.grades.map((item: unknown) => {
    const grade = record(item, 'grade'), id = member(grade.id, criteria, 'criterion');
    if (seen.has(id)) throw new Error('Duplicate criterion.');
    seen.add(id);
    const verdict = member(grade.verdict, ['pass', 'fail', 'unverified'], 'verdict');
    text(grade.reason, 'grade reason');
    if (!Array.isArray(grade.evidence) || grade.evidence.length === 0) throw new Error('Each grade needs transcript evidence.');
    for (const item of grade.evidence) {
      const evidence = record(item, 'evidence'), phase = member(evidence.phase, ['a', 'b'], 'evidence phase');
      if (!transcripts[phase].includes(text(evidence.quote, 'evidence quote'))) throw new Error('Grade quote absent from captured response.');
    }
    return { id, verdict };
  });
  const usage = usageEvidence(result.usage, resultRoot, host);
  const status = grades.some(g => g.verdict === 'fail') ? 'human-assessed-fail' : grades.some(g => g.verdict === 'unverified') ? 'unverified' : 'human-assessed-pass';
  return { status, trialId: manifest.id, revision: manifest.revision, command, caseId, host, grades, elapsedMs, usage,
    limitation: 'Integrity and completeness checks only. Human grades, host metadata, chronology and execution provenance are attestations, not independently verified model behavior.' };
}

if (isMain(import.meta.url)) await main(() => {
  const v = parseOptions({ prepare: { type: 'boolean' }, verify: { type: 'boolean' },
    repo: { type: 'string' }, out: { type: 'string' }, command: { type: 'string' }, case: { type: 'string' },
    revision: { type: 'string' }, packet: { type: 'string' }, 'packet-sha': { type: 'string' }, result: { type: 'string' } });
  if (!!v.prepare === !!v.verify) throw new Error('Choose exactly one of --prepare or --verify.');
  const allowed = v.prepare ? ['prepare', 'repo', 'out', 'command', 'case', 'revision'] : ['verify', 'packet', 'packet-sha', 'result'];
  if (Object.keys(v).some(key => !allowed.includes(key))) throw new Error('Options from the other operation are not accepted.');
  if (v.prepare) writeJson(prepare({ repo: v.repo || resolveKitRoot(import.meta.url), out: requiredOption(v.out, 'out'), command: member(v.command, ['next', 'fix'], 'command'), caseId: member(v.case, caseIds, 'case'), revision: v.revision }));
  else {
    const result = verify(requiredOption(v.packet, 'packet'), requiredOption(v['packet-sha'], 'packet-sha'), requiredOption(v.result, 'result'));
    writeJson(result);
    if (result.status !== 'human-assessed-pass') process.exitCode = 1;
  }
});
