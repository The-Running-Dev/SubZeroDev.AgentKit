import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { getSkill, saveState, setAutoUpdate } from './get-agentkit-skill.ts';
import { git, put, repo, temp } from './lib/fixtures.ts';

function fixture(version = 'v2026.09.17', requestedVersion = 'latest stable') {
  const origin = repo(), home = temp(), root = join(home, '.agent-kit');
  put(origin, 'skills/next/SKILL.md', 'Read AGENTS.shared.md then node tools/get-next-slice.ts. Keep design/ relative.');
  git(origin, 'add', 'skills/next/SKILL.md'); git(origin, 'commit', '-qm', 'initial skill'); git(origin, 'tag', 'v2026.09.17'); git(home, 'clone', '-q', origin, root); git(root, 'checkout', '-q', version);
  saveState(join(home, '.agent-kit-state/installed.json'), { schemaVersion: 2, installRoot: root, source: origin, version, requestedVersion });
  const read = (session = 'one', extra: NodeJS.ProcessEnv = {}) => getSkill('next', { root, home, env: { ...process.env, AGENTKIT_AUTO_UPDATE: '', CODEX_THREAD_ID: session, CLAUDE_CODE_SESSION_ID: '', CODEX_SESSION_ID: '', ...extra } });
  return { origin, root, home, read };
}
function newer(origin: string) { git(origin, 'commit', '--allow-empty', '-qm', 'first change'); git(origin, 'commit', '--allow-empty', '-qm', 'second change'); git(origin, 'tag', 'v2026.09.18'); git(origin, 'commit', '--allow-empty', '-qm', 'unreleased change'); }
function body(text: string) { assert.match(text, /AgentKit canonical runtime:/); assert.match(text, /node ".*\/tools\/get-next-slice\.ts"/); assert.match(text, /Keep design\/ relative/); }
test('offers a newer stable release with changelog and leaves HEAD unchanged', () => { const f = fixture(); newer(f.origin); const head = git(f.root, 'rev-parse', 'HEAD'), text = f.read(); body(text); assert.match(text, /update available/); assert.match(text, /first change/); assert.match(text, /second change/); assert.doesNotMatch(text, /unreleased change/); assert.match(text, /node ".*\/setup.ts"/); assert.equal(git(f.root, 'rev-parse', 'HEAD'), head); });
test('checks once per session and checks again in a new session', () => { const f = fixture(); newer(f.origin); assert.match(f.read(), /update available/); assert.doesNotMatch(f.read(), /update available/); assert.match(f.read('two'), /update available/); });
test('defaults on and honors environment and persisted off and on settings', () => { const f = fixture(); newer(f.origin); assert.doesNotMatch(f.read('env', { AGENTKIT_AUTO_UPDATE: '0' }), /update available/); setAutoUpdate('Off', f.home); assert.doesNotMatch(f.read('off'), /update available/); setAutoUpdate('On', f.home); assert.match(f.read('on'), /update available/); });
test('keeps a current install silent', () => { const f = fixture(); const text = f.read(); body(text); assert.doesNotMatch(text, /update available/); });
test('keeps explicit tag pins silent', () => { const f = fixture('v2026.09.17', 'v2026.09.17'); newer(f.origin); assert.doesNotMatch(f.read(), /update available/); });
test('tracks a branch and offers the same branch on upgrade', () => { const f = fixture('main', 'main'); newer(f.origin); const text = f.read(); assert.match(text, /Available: origin\/main/); assert.match(text, /--version "main"/); });
test('does not check an unrecorded development root', () => { const f = fixture(); newer(f.origin); saveState(join(f.home, '.agent-kit-state/installed.json'), { installRoot: f.origin }); body(f.read()); assert.equal(existsSync(join(f.home, '.agent-kit-state/update-check.json')), false); });
test('still returns the canonical body when origin is unreachable', () => { const f = fixture(); git(f.root, 'remote', 'set-url', 'origin', join(f.home, 'missing')); body(f.read()); assert.doesNotMatch(f.read('two'), /update available/); });
