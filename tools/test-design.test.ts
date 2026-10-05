import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { designCheck } from './test-design.ts';
import { temp, put, git } from './lib/fixtures.ts';
import { run } from './lib/process.ts';

const base: Record<string, string> = {
  'AGENTS.md': '# Rules\n\nUse `/compact`.\n',
  'design/00-brief.md': '# Brief\n',
  'design/20-contract.md': '# Contract\n\n## Commands (`skills/<name>/SKILL.md`)\n\n| Command | Does | Writes |\n|---|---|---|\n| `next` | Builds the plan | code |\n\n## Scripts (`tools/`)\n\n| Script | Parameters | Result |\n|---|---|---|\n| `do-thing.ts` | `--name`, `[--quiet]` | a thing |\n| `other.ts` | see the script | another |\n',
  'design/30-slices.md': '# Slices\n\n## S2 — Two\nStatus: todo\nDepends on: S1\n\n## Landed\n\n| Slice | Name |\n|---|---|\n| **S1** | One |\n',
  'skills/next/SKILL.md': 'Run `tools/do-thing.ts`, then `/next` or `/agentkit:next`.\n',
  'tools/do-thing.ts': "export const options = { name: { type: 'string' }, quiet: { type: 'boolean' } } as const;\n",
  'tools/do-thing.test.ts': '// not a command\n',
  'tools/other.ts': "export const options = { anything: { type: 'string' } } as const;\n",
};
function fixture(overrides: Record<string, string> = {}, remove: string[] = []) { const root = temp(); for (const [file, text] of Object.entries({ ...base, ...overrides })) if (!remove.includes(file)) put(root, file, text); return root; }
const check = (root: string, kit = temp()) => designCheck(root, kit);
const checks = (root: string, kit?: string) => check(root, kit).Findings.map(f => f.Check);
const child = (root: string) => run(process.execPath, [fileURLToPath(new URL('./test-design.ts', import.meta.url)), '--repo-root', root, '--quiet']);
test('passes when every stated fact is true', () => { const r = check(fixture()); assert.equal(r.State, 'Passed'); assert.deepEqual(r.Findings, []); });
test('reports missing tool with file and line', () => { const f = check(fixture({ 'skills/next/SKILL.md': 'First `/next`.\nThen `tools/gone.ts`.\n' })).Findings.filter(f => f.Check === 'MissingTool'); assert.equal(f.length, 1); assert.equal(f[0].File, 'skills/next/SKILL.md'); assert.equal(f[0].Line, 2); assert.match(f[0].Message, /tools\/gone.ts/); });
test('accepts a tool found only in the kit', () => { const kit = temp(); put(kit, 'tools/kit-only.ts', ''); assert.ok(!checks(fixture({ 'AGENTS.md': 'Run `tools/kit-only.ts`.' }), kit).includes('MissingTool')); });
test('ignores stale tools below Landed', () => assert.ok(!checks(fixture({ 'design/30-slices.md': base['design/30-slices.md'] + '\n- **S1** — `tools/retired.ts`\n' })).includes('MissingTool')));
test('reports unknown bare commands', () => { const f = check(fixture({ 'AGENTS.md': 'Then `/track`.' })).Findings.filter(f => f.Check === 'UnknownCommand'); assert.equal(f.length, 1); assert.match(f[0].Message, /\/track/); });
test('reports unknown namespaced commands', () => assert.ok(checks(fixture({ 'AGENTS.md': 'Then `/agentkit:slice`.' })).includes('UnknownCommand')));
test('accepts host and skill commands', () => assert.ok(!checks(fixture({ 'AGENTS.md': '`/compact`, `/code-review:code-review --comment`, `/next`, `/agentkit:next`, `/agentkit:<name>`.' })).includes('UnknownCommand')));
test('reports missing listed script', () => { const f = check(fixture({}, ['tools/other.ts'])).Findings.filter(f => f.Check === 'MissingScript'); assert.equal(f.length, 1); assert.match(f[0].Message, /other.ts/); assert.equal(f[0].File, 'design/20-contract.md'); });
test('reports unknown listed option', () => { const f = check(fixture({ 'tools/do-thing.ts': "export const options = { name: { type: 'string' } } as const;" })).Findings.filter(f => f.Check === 'UnknownParameter'); assert.equal(f.length, 1); assert.match(f[0].Message, /--quiet/); });
test('reports unlisted declared option', () => { const f = check(fixture({ 'tools/do-thing.ts': "export const options = { name: { type: 'string' }, quiet: { type: 'boolean' }, retries: { type: 'string' } } as const;" })).Findings.filter(f => f.Check === 'UnlistedParameter'); assert.equal(f.length, 1); assert.match(f[0].Message, /--retries/); });
test('exempts see the script rows from options checks', () => assert.deepEqual(checks(fixture({ 'tools/other.ts': "export const options = { one: { type: 'string' }, two: { type: 'boolean' } } as const;" })), []));
test('reports unlisted command scripts and ignores test files', () => { const f = check(fixture({ 'tools/new-thing.ts': 'export const options = {};', 'tools/new-thing.test.ts': '' })).Findings.filter(f => f.Check === 'UnlistedScript'); assert.equal(f.length, 1); assert.match(f[0].Message, /new-thing.ts/); });
test('skips tables without kit-shaped headings', () => assert.deepEqual(checks(fixture({ 'design/20-contract.md': '# Contract\n\n## Scripts\n\n| Script | Parameters |\n|---|---|\n| `gone.ts` | `--x` |\n' })), []));
test('reports a skill without a command row', () => { const f = check(fixture({ 'skills/fix/SKILL.md': 'Fix it.' })).Findings.filter(f => f.Check === 'UnlistedCommand'); assert.equal(f.length, 1); assert.match(f[0].Message, /\bfix\b/); });
test('reports a command row without a skill', () => { const f = check(fixture({ 'design/20-contract.md': base['design/20-contract.md'].replace('| `next` | Builds the plan | code |', '| `next` | Builds the plan | code |\n| `align` | Reconciles | design |') })).Findings.filter(f => f.Check === 'MissingCommand'); assert.equal(f.length, 1); assert.match(f[0].Message, /\balign\b/); });
test('reports missing slice status with heading line', () => { const f = check(fixture({ 'design/30-slices.md': '# Slices\n\n## S2 — Two\nDepends on: none\n' })).Findings.filter(f => f.Check === 'MissingStatus'); assert.equal(f.length, 1); assert.equal(f[0].Line, 3); });
test('reports duplicate slice ids', () => assert.ok(checks(fixture({ 'design/30-slices.md': '# Slices\n\n## S2 — Two\nStatus: done\n\n## S2 — Again\nStatus: todo\n' })).includes('DuplicateSlice')));
test('reports unknown dependencies', () => { const f = check(fixture({ 'design/30-slices.md': '# Slices\n\n## S2 — Two\nStatus: todo\nDepends on: S9\n' })).Findings.filter(f => f.Check === 'UnknownDependency'); assert.equal(f.length, 1); assert.match(f[0].Message, /S9/); });
test('accepts Landed dependencies and ignores headings below it', () => assert.deepEqual(checks(fixture({ 'design/30-slices.md': base['design/30-slices.md'] + '\n## S1 — Old body\nNo status here.\n' })), []));
test('CLI exits zero and preserves git status', () => { const root = fixture({ 'skills/next/SKILL.md': 'Run `/next`.' }); git(root, 'init', '-q'); git(root, 'add', 'AGENTS.md', 'design', 'skills', 'tools'); git(root, 'commit', '-qm', 'fixture'); put(root, 'scratch.txt', 'uncommitted'); const before = git(root, 'status', '--porcelain'); const r = child(root); assert.equal(r.code, 0, r.stderr + r.stdout); assert.equal(JSON.parse(r.stdout).State, 'Passed'); assert.equal(git(root, 'status', '--porcelain'), before); });
test('CLI exits one with findings', () => { const r = child(fixture({ 'AGENTS.md': '`/track`\n' })); assert.equal(r.code, 1); assert.equal(JSON.parse(r.stdout).State, 'Failed'); });
test('CLI exits two without design', () => assert.equal(child(temp()).code, 2));
