import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync, rmSync, symlinkSync, readlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { temp, put, git } from './lib/fixtures.ts';
import { run } from './lib/process.ts';
import { getSkill } from './get-agentkit-skill.ts';
import { install, installArguments, pointer, pointerStart, pointerEnd, hook, hash } from './install-agentkit.ts';
import type { InstallOptions, InstallResult, Manifest } from './install-agentkit.ts';

const kit = resolve(dirname(fileURLToPath(import.meta.url)), '..'), front = join(kit, 'setup.ts');
const read = (path: string) => readFileSync(path, 'utf8');
const json = (path: string) => JSON.parse(read(path));
function fixture() {
  const base = temp(), origin = join(base, 'local origin'), home = join(base, 'temporary home'), project = join(base, 'project'), codex = join(base, 'custom codex home'), root = join(home, '.agent-kit');
  for (const dir of [origin, home, project]) mkdirSync(dir, { recursive: true });
  const files = ['setup.ts', 'package.json', 'tools/package.json', 'AGENTS.shared.md'];
  for (const dir of ['tools', 'tools/lib']) for (const name of readdirSync(join(kit, dir))) if (name.endsWith('.ts') && !name.endsWith('.test.ts')) files.push(dir + '/' + name);
  for (const name of ['next', 'fix', 'align']) files.push(`skills/${name}/SKILL.md`);
  for (const path of files) put(origin, path, read(join(kit, path)));
  put(origin, 'templates/example.md', 'template'); put(origin, 'AGENTS.md', 'PROJECT-ONLY-RULE-MUST-NOT-LOAD-GLOBALLY'); put(project, 'keep.txt', 'project stays unchanged');
  git(origin, 'init', '-q', '-b', 'main'); git(origin, 'add', ...files, 'templates/example.md', 'AGENTS.md'); git(origin, 'commit', '-qm', 'fixture'); git(origin, 'tag', 'v2026.09.17');
  const env = { ...process.env, HOME: home, USERPROFILE: home, AGENTKIT_HOME: root, CODEX_HOME: codex, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.autocrlf', GIT_CONFIG_VALUE_0: 'false', AGENTKIT_AUTO_UPDATE: 'off' };
  return { base, origin, home, project, codex, root, env, manifest: join(home, '.agent-kit-state/installed.json'), settings: join(home, '.claude/settings.json'), plugin: join(home, '.claude/skills/agentkit') };
}
type Fixture = ReturnType<typeof fixture>;
const setup = (f: Fixture, input: InstallOptions = {}) => run(process.execPath, [front, ...installArguments({ source: f.origin, hosts: ['claude', 'codex', 'copilot'], ...input })], { env: f.env, cwd: f.project });
function success(f: Fixture, input: InstallOptions = {}): InstallResult { const r = setup(f, input); assert.equal(r.code, 0, r.stderr + r.stdout); return JSON.parse(r.stdout); }
function failure(f: Fixture, pattern: RegExp, input: InstallOptions = {}) { const r = setup(f, input); assert.notEqual(r.code, 0); assert.match(r.stderr + r.stdout, pattern); return r; }
const state = (f: Fixture): Manifest => json(f.manifest);
const saveState = (f: Fixture, value: Manifest) => put(f.home, '.agent-kit-state/installed.json', JSON.stringify(value));
const cskill = (f: Fixture, name = 'next') => join(f.codex, 'skills', name, 'SKILL.md');
function snapshot(f: Fixture) {
  const files: Record<string, string> = {};
  const walk = (path: string) => { if (!existsSync(path)) return; for (const item of readdirSync(path, { withFileTypes: true })) { const p = join(path, item.name); if (item.isDirectory()) { files[p + '/'] = 'dir'; walk(p); } else if (item.isFile()) files[p] = hash(readFileSync(p)); } };
  for (const path of [join(f.home, '.claude'), join(f.home, '.copilot'), join(f.home, '.agent-kit-state'), f.codex, f.project]) walk(path);
  if (existsSync(join(f.root, '.git'))) { files.HEAD = git(f.root, 'rev-parse', 'HEAD'); files.status = git(f.root, 'status', '--porcelain'); }
  return files;
}
function it(name: string, action: (f: Fixture) => void) { test(name, () => { const f = fixture(); try { action(f); } finally { rmSync(f.base, { recursive: true, force: true }); } }); }

// One case for each of the original 38 Pester It blocks.
it('fresh setup uses selected installer and registers all hosts without changing the project', f => {
  assert.equal(success(f).State, 'Installed'); const s = state(f);
  assert.equal(s.registrations!.length, 13); assert.equal(s.requestedVersion, 'latest stable'); assert.equal(s.version, 'v2026.09.17');
  assert.equal(read(join(f.project, 'keep.txt')), 'project stays unchanged'); assert.deepEqual(readdirSync(f.project), ['keep.txt']);
  assert.ok(s.registrations!.every(r => r.root === f.root)); assert.doesNotMatch(read(join(f.codex, 'AGENTS.md')), /PROJECT-ONLY/);
});
it('reruns with identical registration bytes and no backup churn', f => { success(f); const before = snapshot(f), manifest = read(f.manifest); success(f); assert.equal(read(f.manifest), manifest); assert.deepEqual(snapshot(f), before); });
it('adopts the existing correct canonical clone', f => { git(f.origin, 'clone', '-q', f.origin, f.root); assert.ok(!success(f).Operations.some(s => s.startsWith('Clone '))); });
it('refuses occupied non-repository root without deleting its contents', f => { put(f.root, 'mine.txt', 'mine'); failure(f, /occupied/); assert.equal(read(join(f.root, 'mine.txt')), 'mine'); });
it('clones into a pre-existing empty root rather than refusing it as occupied', f => { mkdirSync(f.root); success(f); assert.ok(existsSync(join(f.root, '.git'))); });
it('refuses wrong origin unless Force explicitly repoints the correct runtime clone', f => { success(f); git(f.root, 'remote', 'set-url', 'origin', 'https://example.invalid/foreign.git'); failure(f, /Wrong origin/); success(f, { force: true }); assert.equal(git(f.root, 'remote', 'get-url', 'origin'), f.origin); });
it('refuses dirty checkout and preserves changes without Force', f => { success(f); writeFileSync(join(f.root, 'AGENTS.shared.md'), 'local edit'); failure(f, /uncommitted changes/); assert.equal(read(join(f.root, 'AGENTS.shared.md')), 'local edit'); success(f, { force: true }); });
it('orders annotated and lightweight date tags by date and numeric revision rather than creation', f => {
  git(f.origin, 'tag', '-a', 'v2026.09.19.2', '-m', 'annotated'); for (const tag of ['v2026.09.19.10', 'v2026.09.18', 'v2026.99.99', 'v2027.01.01-rc1']) git(f.origin, 'tag', tag);
  success(f); assert.equal(state(f).version, 'v2026.09.19.10'); success(f, { version: 'v2026.09.19.2' }); assert.equal(state(f).commit, git(f.origin, 'rev-parse', 'v2026.09.19.2^{commit}'));
});
it('never falls back to main when stable releases are absent', f => { git(f.origin, 'tag', '-d', 'v2026.09.17'); failure(f, /No valid stable release/); success(f, { version: 'main' }); });
it('does not mistake an unpublished local tag for the newest stable release', f => { success(f); git(f.root, 'tag', 'v2099.01.01'); success(f); assert.equal(state(f).version, 'v2026.09.17'); });
it('selects unreleased branch and SHA only explicitly and rolls back to the stable tag', f => {
  writeFileSync(join(f.origin, 'AGENTS.shared.md'), 'unreleased'); git(f.origin, 'commit', '-qam', 'unreleased'); const sha = git(f.origin, 'rev-parse', 'HEAD');
  success(f); assert.notEqual(state(f).commit, sha); for (const version of ['main', sha]) { success(f, { version }); assert.equal(state(f).commit, sha); }
  success(f, { version: 'v2026.09.17' }); assert.notEqual(state(f).commit, sha);
});
it('does not silently reset a locally diverged branch', f => { success(f, { version: 'main' }); writeFileSync(join(f.root, 'AGENTS.shared.md'), 'local commit'); git(f.root, 'commit', '-qam', 'local'); const before = git(f.root, 'rev-parse', 'HEAD'); failure(f, /unpublished or divergent/, { version: 'main' }); assert.equal(git(f.root, 'rev-parse', 'HEAD'), before); });
it('reports fetch failure as Git failure rather than divergence and preserves HEAD', f => { success(f); const before = git(f.root, 'rev-parse', 'HEAD'); const r = failure(f, /git fetch/, { source: join(f.base, 'missing-origin'), force: true }); assert.doesNotMatch(r.stderr, /unpublished or divergent/); assert.equal(git(f.root, 'rev-parse', 'HEAD'), before); });
it('fresh and existing dry runs write no host or checkout changes', f => { success(f, { dryRun: true }); assert.ok(!existsSync(f.root)); success(f); const before = snapshot(f); success(f, { dryRun: true, prefix: 'ak-' }); assert.deepEqual(snapshot(f), before); });
it('every adapter has valid frontmatter and absolute runtime paths despite spaces', f => {
  success(f); for (const entry of state(f).registrations!.filter(r => r.files?.['SKILL.md'])) { const text = read(join(entry.path, 'SKILL.md')); assert.match(text, /^---\nname: [\w-]+\ndescription: '[^\n]+'\n(?:disable-model-invocation: true\n)?---/); assert.ok(text.includes(f.root.replaceAll('\\', '/'))); assert.doesNotMatch(text, /(?<![\w/\\])(?:AGENTS[.]shared[.]md|tools\/|templates\/)/); }
});
it('all pointers name shared rules, resolve at read time and bake in no machine-specific path', f => { success(f); for (const path of Object.keys(state(f).pointerBlocks!)) { const text = read(path); assert.match(text, /AGENTS\.shared\.md/); assert.match(text, /AGENTKIT_HOME/); assert.ok(!text.includes(f.root.replaceAll('\\', '/'))); assert.doesNotMatch(text, /PROJECT-ONLY/); } });
it('upgrades a previously installed resolved-path pointer without collision', f => {
  success(f); const path = join(f.codex, 'AGENTS.md'), s = state(f), old = `${pointerStart}\nAgentKit shared rules: read [${f.root}/AGENTS.shared.md](${f.root}/AGENTS.shared.md) only when running an AgentKit command.\n${pointerEnd}`;
  writeFileSync(path, old); s.pointerBlocks![path] = old; saveState(f, s); assert.deepEqual(success(f).Collisions, []); assert.match(read(path), /AGENTKIT_HOME/); assert.ok(!read(path).includes(f.root));
});
it('foreign same-named skill survives byte-for-byte and is reported', f => { put(f.codex, 'skills/next/SKILL.md', 'foreign bytes'); assert.ok(success(f).Collisions.includes(dirname(cskill(f)))); assert.equal(read(cskill(f)), 'foreign bytes'); assert.ok(!existsSync(join(dirname(cskill(f)), '.agentkit-owner'))); });
it('edited managed skills survive refresh and uninstall', f => { success(f); writeFileSync(cskill(f), 'my edited core'); success(f); assert.equal(read(cskill(f)), 'my edited core'); success(f, { uninstall: true }); assert.equal(read(cskill(f)), 'my edited core'); });
it('prefix change removes only unchanged previous managed registrations', f => { success(f); writeFileSync(cskill(f), 'keep customized'); success(f, { prefix: 'ak-' }); assert.ok(existsSync(cskill(f))); assert.ok(!existsSync(cskill(f, 'fix'))); assert.ok(existsSync(cskill(f, 'ak-fix'))); assert.ok(existsSync(cskill(f, 'ak-fix-routed'))); });
it('uninstall removes managed entries and leaves unrelated hooks and rules text', f => {
  success(f); const settings = json(f.settings), foreign = { hooks: [{ type: 'command', command: 'node', args: ['/foreign/hook.js'] }] }; settings.hooks.SessionEnd.push(foreign); writeFileSync(f.settings, JSON.stringify(settings));
  writeFileSync(join(f.codex, 'AGENTS.md'), read(join(f.codex, 'AGENTS.md')) + 'keep user rules'); success(f, { uninstall: true });
  for (const path of [dirname(cskill(f)), f.plugin, join(f.home, '.copilot/skills/next'), f.manifest]) assert.ok(!existsSync(path));
  assert.ok(existsSync(f.root)); assert.deepEqual(json(f.settings).hooks.SessionEnd, [foreign]); assert.match(read(join(f.codex, 'AGENTS.md')), /keep user rules/);
});
it('uninstall Force removes only the validated canonical checkout', f => { success(f); success(f, { uninstall: true, force: true }); assert.ok(!existsSync(f.root)); assert.ok(existsSync(join(f.project, 'keep.txt'))); });
it('updating after a removed core cleans stale managed registrations', f => { success(f); git(f.origin, 'rm', 'skills/next/SKILL.md'); git(f.origin, 'commit', '-qm', 'remove next'); git(f.origin, 'tag', 'v2026.09.18'); success(f); for (const path of [cskill(f), cskill(f, 'next-routed'), join(f.plugin, 'skills/next')]) assert.ok(!existsSync(path)); });
it('retargeted legacy manifest links survive refresh and uninstall', f => {
  git(f.origin, 'clone', '-q', f.origin, f.root); saveState(f, { installRoot: f.root, source: f.origin, hosts: { claude: ['next'] } });
  const foreign = join(f.base, 'foreign skill target'), link = join(f.home, '.claude/skills/next'); put(foreign, 'SKILL.md', 'foreign skill'); mkdirSync(dirname(link), { recursive: true }); symlinkSync(foreign, link, process.platform === 'win32' ? 'junction' : 'dir');
  success(f); assert.equal(resolve(readlinkSync(link)), foreign); success(f, { uninstall: true }); assert.equal(read(join(foreign, 'SKILL.md')), 'foreign skill'); assert.ok(existsSync(link));
});
it('preserves edited pointer blocks instead of refreshing or deleting them', f => { success(f); const path = join(f.codex, 'AGENTS.md'), text = read(path).replace('AgentKit shared rules:', 'User customized shared rules:'); writeFileSync(path, text); success(f); assert.equal(read(path), text); success(f, { uninstall: true }); assert.equal(read(path), text); });
it('a selected-host update retains ownership of other installed hosts', f => { success(f); success(f, { hosts: ['codex'] }); assert.equal(state(f).registrations!.length, 13); success(f, { uninstall: true }); assert.ok(!existsSync(f.plugin)); });
it('Verify reports OK and changes nothing after a healthy install', f => { success(f); const before = snapshot(f); assert.equal(success(f, { verify: true }).State, 'OK'); assert.deepEqual(snapshot(f), before); });
it('Verify reports a foreign-modified registration without repairing it', f => { success(f); const path = join(f.plugin, 'skills/next/SKILL.md'); writeFileSync(path, 'tampered outside AgentKit'); failure(f, /changed outside AgentKit/, { verify: true }); assert.equal(read(path), 'tampered outside AgentKit'); });
it('Verify reports nothing installed when no manifest exists', f => { failure(f, /Nothing installed for this profile/, { verify: true }); });
it('ships Claude commands as the agentkit skills-directory plugin', f => { success(f); assert.equal(json(join(f.plugin, '.claude-plugin/plugin.json')).name, 'agentkit'); assert.ok(!existsSync(join(f.plugin, 'SKILL.md'))); const text = read(join(f.plugin, 'skills/align/SKILL.md')); assert.match(text, /description: 'AgentKit \/agentkit:align \(native\)/); assert.match(text, /`\/agentkit:align`/); assert.doesNotMatch(read(cskill(f, 'align')), /agentkit:/); assert.deepEqual(readdirSync(dirname(f.plugin)), ['agentkit']); });
it('migrates bare Claude skill registrations from an earlier install into the plugin', f => {
  success(f, { hosts: ['claude'] }); const s = state(f); s.registrations = s.registrations!.filter(r => r.files?.['SKILL.md']).map(r => { const path = join(f.home, '.claude/skills', r.name); cpSync(r.path, path, { recursive: true }); return { ...r, path }; });
  rmSync(f.plugin, { recursive: true }); saveState(f, s); assert.deepEqual(success(f, { hosts: ['claude'] }).Collisions, []);
  for (const name of ['next', 'fix', 'align']) { assert.ok(!existsSync(join(f.home, '.claude/skills', name))); assert.ok(existsSync(join(f.plugin, 'skills', name, 'SKILL.md'))); } success(f, { verify: true });
});
it('leaves a foreign agentkit folder and earlier Claude registrations untouched', f => {
  const path = put(f.plugin, 'SKILL.md', 'my own agentkit skill'); assert.ok(success(f).Collisions.includes(f.plugin)); assert.equal(read(path), 'my own agentkit skill'); assert.ok(!existsSync(join(f.plugin, '.claude-plugin'))); assert.equal(state(f).registrations!.filter(r => r.host === 'claude').length, 0); success(f, { uninstall: true }); assert.equal(read(path), 'my own agentkit skill');
});
test('resolves kit-owned dependencies of every shipped skill', () => {
  for (const name of readdirSync(join(kit, 'skills'))) {
    if (!existsSync(join(kit, 'skills', name, 'SKILL.md'))) continue;
    const body = getSkill(name, { root: kit, env: { AGENTKIT_AUTO_UPDATE: 'off' } });
    if (name !== 'install-all') assert.doesNotMatch(body, /(?<![\w/\\])(?:AGENTS[.]shared[.]md|tools\/|templates\/)/, name);
    else { assert.match(body, /^- `tools\/\*\.ps1`/m); assert.match(body, /^- `AGENTS\.shared\.md`/m); }
  }
});


test('setup refuses with the AgentKit message when Node cannot load TypeScript', () => {
  const r = run(process.execPath, ['--no-experimental-strip-types', front, '--verify']);
  assert.equal(r.code, 2, r.stderr); assert.equal(r.stdout, ''); assert.match(r.stderr, /^AgentKit needs Node's TypeScript type stripping/);
});
