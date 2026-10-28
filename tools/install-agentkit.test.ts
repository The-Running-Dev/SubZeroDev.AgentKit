import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync, rmSync, rmdirSync, symlinkSync, readlinkSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { temp, put, git } from './lib/fixtures.ts';
import { run } from './lib/process.ts';
import { getSkill } from './get-agentkit-skill.ts';
import { install, installArguments, pointer, pointerStart, pointerEnd, hook, hash, memoryHook, CODEX_TRUST_NOTE } from './install-agentkit.ts';
import type { InstallOptions, InstallResult, Manifest } from './install-agentkit.ts';

const kit = resolve(dirname(fileURLToPath(import.meta.url)), '..'), front = join(kit, 'setup.ts');
const read = (path: string) => readFileSync(path, 'utf8');
const json = (path: string) => JSON.parse(read(path));
function fixture() {
  const base = temp(), origin = join(base, 'local origin'), home = join(base, 'temporary home'), project = join(base, 'project'), codex = join(base, 'custom codex home'), root = join(home, '.agent-kit');
  for (const dir of [origin, home, project]) mkdirSync(dir, { recursive: true });
  const files = ['setup.ts', 'package.json', 'tools/package.json', 'AGENTS.shared.md', 'policy/model-profiles.json'];
  for (const dir of ['tools', 'tools/lib']) for (const name of readdirSync(join(kit, dir))) if (name.endsWith('.ts') && !name.endsWith('.test.ts')) files.push(dir + '/' + name);
  for (const name of ['next', 'fix', 'align', 'small-edit']) files.push(`skills/${name}/SKILL.md`);
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
it('a task skill gets its Claude model and effort as frontmatter and only a recommendation elsewhere', f => {
  success(f); const claude = read(join(f.plugin, 'skills/small-edit/SKILL.md')), codex = read(cskill(f, 'small-edit')), routed = read(cskill(f, 'small-edit-routed')), copilot = read(join(f.home, '.copilot/skills/small-edit/SKILL.md'));
  assert.match(claude, /^disable-model-invocation: true\nmodel: haiku\neffort: medium\n---/m); assert.match(claude, /--verify-active --profile small-edit --model haiku --effort medium/); assert.match(claude, /requested, resolved and verified active separately/);
  for (const text of [codex, copilot]) { assert.doesNotMatch(text, /^model:/m); assert.match(text, /recommendation, not applied/); }
  assert.match(routed, /gpt-6-luna at low effort/); assert.match(routed, /only when the user explicitly/);
  assert.doesNotMatch(read(join(f.plugin, 'skills/next/SKILL.md')), /^model:|Model profile/m);
});
it('regenerating adapters is idempotent, keeps unrelated config and picks up an override', f => {
  success(f); const config = join(f.home, '.agent-kit-state/config.json'), settings = { ...(existsSync(config) ? json(config) : {}), updatePolicy: 'manual', unrelated: { keep: true } };
  writeFileSync(config, JSON.stringify(settings, null, 2)); success(f); const before = snapshot(f); success(f); assert.deepEqual(snapshot(f), before);
  assert.deepEqual(json(config), settings);
  const set = run(process.execPath, [join(f.root, 'tools/model-profile.ts'), '--set-override', '--profile', 'small-edit', '--provider', 'anthropic', '--model', 'sonnet', '--effort', 'low'], { env: f.env, cwd: f.project }); assert.equal(set.code, 0, set.stderr);
  assert.match(read(join(f.plugin, 'skills/small-edit/SKILL.md')), /^model: haiku$/m); success(f);
  assert.match(read(join(f.plugin, 'skills/small-edit/SKILL.md')), /^model: sonnet\neffort: low$/m);
  assert.deepEqual({ ...json(config), modelProfiles: undefined }, { ...settings, modelProfiles: undefined }); assert.deepEqual(json(config).modelProfiles, { 'small-edit': { anthropic: { model: 'sonnet', effort: 'low' } } });
});
it('every adapter has valid frontmatter and absolute runtime paths despite spaces', f => {
  success(f); for (const entry of state(f).registrations!.filter(r => r.files?.['SKILL.md'])) { const text = read(join(entry.path, 'SKILL.md')); assert.match(text, /^---\nname: [\w-]+\ndescription: '[^\n]+'\n(?:disable-model-invocation: true\n)?(?:model: [\w.-]+\neffort: [a-z]+\n)?---/); assert.ok(text.includes(f.root.replaceAll('\\', '/'))); assert.doesNotMatch(text, /(?<![\w/\\])(?:AGENTS[.]shared[.]md|tools\/|templates\/)/); }
});
it('all pointers name shared rules, resolve at read time and bake in no machine-specific path', f => { success(f); for (const path of Object.keys(state(f).pointerBlocks!)) { const text = read(path); assert.match(text, /AGENTS\.shared\.md/); assert.match(text, /AGENTKIT_HOME/); assert.ok(!text.includes(f.root.replaceAll('\\', '/'))); assert.doesNotMatch(text, /PROJECT-ONLY/); } });
it('upgrades a previously installed resolved-path pointer without collision', f => {
  success(f); const path = join(f.codex, 'AGENTS.md'), s = state(f), old = `${pointerStart}\nAgentKit shared rules: read [${f.root}/AGENTS.shared.md](${f.root}/AGENTS.shared.md) only when running an AgentKit command.\n${pointerEnd}`;
  writeFileSync(path, old); s.pointerBlocks![path] = old; saveState(f, s); assert.deepEqual(success(f).Collisions, []); assert.match(read(path), /AGENTKIT_HOME/); assert.ok(!read(path).includes(f.root));
});
it('foreign same-named skill survives byte-for-byte and is reported', f => { put(f.codex, 'skills/next/SKILL.md', 'foreign bytes'); assert.ok(success(f).Collisions.includes(dirname(cskill(f)))); assert.equal(read(cskill(f)), 'foreign bytes'); assert.ok(!existsSync(join(dirname(cskill(f)), '.agentkit-owner'))); });
it('edited managed skills survive refresh and uninstall', f => { success(f); writeFileSync(cskill(f), 'my edited core'); success(f); assert.equal(read(cskill(f)), 'my edited core'); success(f, { uninstall: true }); assert.equal(read(cskill(f)), 'my edited core'); });
it('prefix change removes only unchanged previous managed registrations', f => { success(f); writeFileSync(cskill(f), 'keep customized'); success(f, { prefix: 'ak-' }); assert.ok(existsSync(cskill(f))); assert.ok(!existsSync(cskill(f, 'fix'))); assert.ok(existsSync(cskill(f, 'ak-fix'))); assert.ok(existsSync(cskill(f, 'ak-fix-routed'))); });
it('removes the legacy PowerShell SessionEnd hooks for this install and keeps foreign ones', f => {
  success(f); const settings = json(f.settings), script = join(f.root, 'tools/Measure-Session.ps1').replaceAll('\\', '/');
  const legacy = [{ hooks: [{ type: 'command', command: `pwsh -NoProfile -File ${script} -Hook`, timeout: 30 }] }, { hooks: [{ type: 'command', command: 'pwsh', args: ['-NoProfile', '-File', script, '-Hook'], timeout: 30 }] }];
  const foreign = { hooks: [{ type: 'command', command: 'pwsh -File "tools/Measure-Session.ps1"' }] };
  settings.hooks.SessionEnd = [...legacy, foreign, ...settings.hooks.SessionEnd]; writeFileSync(f.settings, JSON.stringify(settings));
  success(f); assert.deepEqual(json(f.settings).hooks.SessionEnd, [foreign, hook(f.root)]);
});
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
// The Claude end state of rolling back to v2026.09.24 (checked against that tag's own setup.ps1, #450):
// it registers bare ~/.claude/skills/<name> folders, deletes each plugin registration's files and
// folder without pruning parents, and rewrites the manifest with only the bare registrations.
function rollBack(f: Fixture) {
  const s = state(f), claude = s.registrations!.filter(r => r.host === 'claude');
  for (const r of claude) { for (const file of Object.keys(r.files!)) rmSync(join(r.path, file)); rmdirSync(r.path); }
  const bare = claude.filter(r => r.files?.['SKILL.md']).map(r => {
    const path = join(f.home, '.claude/skills', r.name), files = { 'SKILL.md': `legacy ${r.name}\n`, '.agentkit-owner': `AgentKit registration\nRoot: ${f.root}\nHost: claude\nName: ${r.name}\n` };
    for (const [name, text] of Object.entries(files)) put(path, name, text);
    return { ...r, path, files: Object.fromEntries(Object.entries(files).map(([name, text]) => [name, hash(text)])) };
  });
  saveState(f, { ...s, registrations: [...s.registrations!.filter(r => r.host !== 'claude'), ...bare] });
}
const marker = (f: Fixture) => join(f.plugin, '.agentkit-owner');
it('re-upgrades after a rollback that left an empty owned plugin container, then uninstalls it', f => {
  success(f); rollBack(f);
  assert.deepEqual(readdirSync(f.plugin).sort(), ['.agentkit-owner', 'skills']); assert.deepEqual(readdirSync(join(f.plugin, 'skills')), []);
  const r = success(f); assert.deepEqual(r.Collisions, []); assert.ok(r.Operations.some(o => o.startsWith('Adopt plugin container')));
  for (const name of ['next', 'fix', 'align']) { assert.ok(existsSync(join(f.plugin, 'skills', name, 'SKILL.md'))); assert.ok(!existsSync(join(f.home, '.claude/skills', name))); }
  assert.equal(success(f, { verify: true }).State, 'OK');
  success(f, { uninstall: true }); assert.ok(!existsSync(f.plugin)); assert.ok(existsSync(join(f.home, '.claude/skills')));
});
for (const [name, foreign] of [['a foreign file in the container', 'notes.md'], ['a foreign skill in its skills folder', 'skills/mine/SKILL.md'], ['a link instead of its skills folder', '']] as const) {
  it(`a rolled-back plugin container holding ${name} still collides and is left unchanged`, f => {
    success(f); rollBack(f);
    if (foreign) put(f.plugin, foreign, 'my own bytes');
    else { const target = join(f.base, 'elsewhere'); mkdirSync(target); rmSync(join(f.plugin, 'skills'), { recursive: true }); symlinkSync(target, join(f.plugin, 'skills'), process.platform === 'win32' ? 'junction' : 'dir'); }
    const before = snapshot(f); assert.ok(success(f).Collisions.includes(f.plugin));
    assert.ok(!existsSync(join(f.plugin, '.claude-plugin'))); if (foreign) assert.equal(read(join(f.plugin, foreign)), 'my own bytes');
    for (const [path, value] of Object.entries(before)) if (path.startsWith(f.plugin)) assert.equal(snapshot(f)[path], value, path);
    success(f, { uninstall: true }); assert.ok(existsSync(f.plugin)); if (foreign) assert.equal(read(join(f.plugin, foreign)), 'my own bytes');
  });
}
it('an empty plugin container without this runtime\'s owner marker still collides and is left in place', f => {
  success(f); rollBack(f); writeFileSync(marker(f), 'AgentKit plugin container\nRoot: /some/other/runtime\n');
  assert.ok(success(f).Collisions.includes(f.plugin)); assert.equal(read(marker(f)), 'AgentKit plugin container\nRoot: /some/other/runtime\n');
  rmSync(marker(f)); const r = success(f);
  assert.ok(r.Collisions.includes(f.plugin)); assert.ok(r.Operations.some(o => /only an empty skills folder and no AgentKit owner marker/.test(o)));
  assert.deepEqual(readdirSync(f.plugin), ['skills']); success(f, { uninstall: true }); assert.deepEqual(readdirSync(f.plugin), ['skills']);
});
it('a foreign owner marker in an owned plugin container is reported and kept', f => {
  success(f); writeFileSync(marker(f), 'mine'); const r = success(f);
  assert.deepEqual(r.Collisions, [marker(f)]); assert.equal(read(marker(f)), 'mine'); assert.ok(existsSync(join(f.plugin, '.claude-plugin/plugin.json')));
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

// MemoryKit hooks: a synthetic CLI file and store directory; the installer only checks they exist.
function memoryKit(f: Fixture) { return { memorykitCli: put(f.base, 'memorykit/dist/cli/main.js', '// stand-in'), memorykitStore: join(f.base, 'memory store') }; }
const memoryConfig = (f: Fixture) => join(f.home, '.agent-kit-state/memorykit.json'), codexHooks = (f: Fixture) => join(f.codex, 'hooks.json');
it('MemoryKit hooks are written only on opt-in, kept on rerun, verified and removed by uninstall', f => {
  success(f); assert.ok(!existsSync(memoryConfig(f))); assert.ok(!existsSync(codexHooks(f))); assert.equal(json(f.settings).hooks.SessionStart, undefined); assert.equal(state(f).memoryKitHooks, undefined);
  const mk = memoryKit(f); mkdirSync(mk.memorykitStore); put(f.home, '.agent-kit-state/memorykit.json', JSON.stringify({ cli: 'old', store: 'old', capture: false, contextBytes: 4096 }));
  const r = success(f, mk); assert.deepEqual(r.Notes, [CODEX_TRUST_NOTE]);
  assert.deepEqual(json(memoryConfig(f)), { cli: resolve(mk.memorykitCli), store: resolve(mk.memorykitStore), capture: false, contextBytes: 4096 });
  const foreign = { hooks: [{ type: 'command', command: 'node /foreign/start.js' }] };
  for (const event of ['SessionStart', 'PreCompact'] as const) {
    assert.deepEqual(json(f.settings).hooks[event], [memoryHook(f.root, 'claude', event)]);
    assert.deepEqual(json(codexHooks(f)).hooks[event], [memoryHook(f.root, 'codex', event)]);
  }
  assert.deepEqual((memoryHook(f.root, 'claude', 'PreCompact').hooks[0] as { args: string[] }).args.slice(1), ['--action', 'checkpoint', '--hook', '--host', 'claude-code']);
  assert.match(memoryHook(f.root, 'codex', 'SessionStart').hooks[0].command, /^node ".+\/tools\/memorykit\.ts" --action context --hook --host codex$/);
  assert.deepEqual(state(f).memoryKitHooks, ['claude', 'codex']);
  const settings = json(f.settings), codex = json(codexHooks(f)); settings.hooks.SessionStart.unshift(foreign); codex.hooks.SessionStart.unshift(foreign);
  writeFileSync(f.settings, JSON.stringify(settings, null, 2)); writeFileSync(codexHooks(f), JSON.stringify(codex, null, 2));
  success(f); const before = snapshot(f); success(f); assert.deepEqual(snapshot(f), before, 'a rerun without the flags keeps the hooks and changes nothing');
  assert.equal(success(f, { verify: true }).State, 'OK');
  const broken = json(codexHooks(f)); delete broken.hooks.PreCompact; writeFileSync(codexHooks(f), JSON.stringify(broken));
  failure(f, /MemoryKit SessionStart and PreCompact hook entries missing from .+hooks.json/, { verify: true });
  success(f, { uninstall: true });
  assert.deepEqual(json(f.settings).hooks.SessionStart, [foreign]); assert.equal(json(f.settings).hooks.PreCompact, undefined, 'an event left empty is pruned');
  assert.deepEqual(json(codexHooks(f)).hooks, { SessionStart: [foreign] });
  assert.equal(json(memoryConfig(f)).store, resolve(mk.memorykitStore), 'the config is the user\'s and stays');
});
it('MemoryKit opt-in fails before any change without both paths or with one missing', f => {
  const mk = memoryKit(f);
  failure(f, /given together/, { memorykitCli: mk.memorykitCli });
  failure(f, /store '.+memory store' does not exist or is not a directory. Create it with the MemoryKit CLI's init command/, mk);
  mkdirSync(mk.memorykitStore); failure(f, /CLI '.+absent.js' does not exist/, { ...mk, memorykitCli: join(f.base, 'absent.js') });
  assert.ok(!existsSync(f.root)); assert.ok(!existsSync(memoryConfig(f))); assert.ok(!existsSync(f.settings));
});
it('a MemoryKit dry run writes no config or hooks', f => { const mk = memoryKit(f); mkdirSync(mk.memorykitStore); success(f); const before = snapshot(f); success(f, { ...mk, dryRun: true }); assert.deepEqual(snapshot(f), before); });
it('the registered MemoryKit hook commands run against the installed config', f => {
  const mk = memoryKit(f); mkdirSync(mk.memorykitStore); success(f, mk);
  const claude = json(f.settings).hooks.SessionStart[0].hooks[0], codex = /^node "(.+?)" (.+)$/.exec(json(codexHooks(f)).hooks.PreCompact[0].hooks[0].command)!;
  for (const args of [claude.args, [codex[1], ...codex[2].split(' ')]]) {
    const r = run(process.execPath, args, { env: f.env, input: JSON.stringify({ cwd: f.project, session_id: 's' }) });
    assert.deepEqual([r.code, r.stdout, r.stderr], [0, '', ''], args.join(' '));
  }
  assert.deepEqual(read(join(f.home, '.agent-kit-state/memorykit.log')).trim().split('\n').map(l => JSON.parse(l).outcome), ['NoProject', 'NoProject']);
});
it('MemoryKit options against a release that predates them fail before the checkout moves', f => {
  success(f); const head = git(f.root, 'rev-parse', 'HEAD'), mk = memoryKit(f); mkdirSync(mk.memorykitStore);
  put(f.origin, 'tools/install-agentkit.ts', read(join(f.origin, 'tools/install-agentkit.ts')).replaceAll("'memorykit-cli'", "'memorykit-x'"));
  git(f.origin, 'commit', '-qam', 'older installer'); git(f.origin, 'tag', 'v2026.09.18');
  failure(f, /predates the MemoryKit hooks. Nothing was changed/, mk);
  assert.equal(git(f.root, 'rev-parse', 'HEAD'), head); assert.ok(!existsSync(memoryConfig(f)));
});
it('a malformed settings file stops the install before anything is written', f => {
  const mk = memoryKit(f); mkdirSync(mk.memorykitStore); success(f);
  for (const [path, text] of [[codexHooks(f), '{ not json'], [f.settings, '{"hooks": []}'], [memoryConfig(f), '[1]']] as const) {
    const old = existsSync(path) ? read(path) : undefined; put(dirname(path), basename(path), text);
    const before = snapshot(f); failure(f, /Fix or move it, then run setup again/, mk); assert.deepEqual(snapshot(f), before);
    if (old === undefined) rmSync(path); else writeFileSync(path, old);
  }
  put(f.codex, 'hooks.json', '{ not json'); saveState(f, { ...state(f), memoryKitHooks: ['codex'] });
  const r = failure(f, /Unhealthy/, { verify: true }); assert.match(r.stdout, /hooks.json' is not valid JSON/);
});
it('MemoryKit hooks are recognized after a rewrite and keep their place among foreign hooks', f => {
  const mk = memoryKit(f); mkdirSync(mk.memorykitStore); success(f, mk);
  const foreign = { matcher: '', hooks: [{ command: 'node /foreign/after.js', type: 'command' }] };
  const sorted = (value: unknown): unknown => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => [k, sorted(v)])) : value;
  const codex = sorted(json(codexHooks(f))) as any; codex.hooks.SessionStart.push(foreign); writeFileSync(codexHooks(f), JSON.stringify(codex, null, 2));
  const claude = json(f.settings); claude.hooks.PreCompact.push(foreign); claude.hooks.PreCompact[0].hooks[0].statusMessage = 'Saving'; writeFileSync(f.settings, JSON.stringify(claude, null, 2));
  const codexBytes = read(codexHooks(f)), r = success(f);
  assert.equal(read(codexHooks(f)), codexBytes, 'a key-sorted copy of the same hooks is not rewritten'); assert.equal(r.Notes, undefined, 'no trust note when nothing changed');
  assert.deepEqual(json(f.settings).hooks.PreCompact, [memoryHook(f.root, 'claude', 'PreCompact'), foreign], 'replaced in place, never duplicated');
  assert.equal(success(f, { verify: true }).State, 'OK');
  success(f, { uninstall: true });
  assert.deepEqual(json(codexHooks(f)).hooks, { SessionStart: [foreign] }); assert.deepEqual(json(f.settings).hooks.PreCompact, [foreign]);
});
it('a rerun keeps the MemoryKit opt-in to the hosts that chose it', f => {
  const mk = memoryKit(f); mkdirSync(mk.memorykitStore);
  failure(f, /add --hosts claude or codex/, { ...mk, hosts: ['copilot'] });
  success(f, { ...mk, hosts: ['claude'] }); assert.deepEqual(state(f).memoryKitHooks, ['claude']);
  success(f); assert.ok(!existsSync(codexHooks(f)), 'a later rerun with Codex does not opt it in'); assert.deepEqual(state(f).memoryKitHooks, ['claude']);
  const claude = read(f.settings); success(f, { hosts: ['codex'] });
  assert.equal(read(f.settings), claude); assert.deepEqual(state(f).memoryKitHooks, ['claude'], 'a host outside the run keeps its hooks');
});
it('Codex without a home gets no MemoryKit hooks unless it is named', f => {
  const mk = memoryKit(f); mkdirSync(mk.memorykitStore); mkdirSync(join(f.home, '.claude'));
  success(f, { ...mk, hosts: undefined }); assert.ok(!existsSync(codexHooks(f))); assert.ok(json(f.settings).hooks.SessionStart);
});
it('verify reports a MemoryKit store or CLI that no longer exists', f => {
  const mk = memoryKit(f); mkdirSync(mk.memorykitStore); success(f, mk); assert.equal(success(f, { verify: true }).State, 'OK');
  rmSync(mk.memorykitStore, { recursive: true });
  const r = failure(f, /Unhealthy/, { verify: true }); assert.match(r.stdout, /MemoryKit store '.+memory store' named in '.+memorykit.json' does not exist/);
  writeFileSync(mk.memorykitStore, 'a file'); failure(f, /store '.+memory store' does not exist or is not a directory/, mk);
});
