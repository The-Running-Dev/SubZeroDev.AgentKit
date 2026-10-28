import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearOverride, listProfiles, readOverrides, readPolicy, resolveAndValidate, resolveProfile, setOverride, validateAnthropic, validateOpenAI, verifyActive } from './model-profile.ts';
import type { Policy } from './model-profile.ts';
import { put, temp } from './lib/fixtures.ts';
import { run } from './lib/process.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const policy = readPolicy(root);
const now = Date.parse('2026-10-28T12:00:00Z');
const cache = (fetched = '2026-10-27T00:00:00Z') => JSON.stringify({ fetched_at: fetched, client_version: '0.165.0', models: [
  { slug: 'gpt-6-luna', supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }, { effort: 'high' }] },
  { slug: 'gpt-6-astra', supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }, { effort: 'high' }, { effort: 'ultra' }] },
] });
const codexEnv = (text?: string) => { const home = temp(); if (text !== undefined) put(home, '.codex/models_cache.json', text); return { HOME: home, USERPROFILE: home, CODEX_HOME: join(home, '.codex') }; };
const config = (home: string) => JSON.parse(readFileSync(join(home, '.agent-kit-state/config.json'), 'utf8'));

test('the shared policy defines the six task profiles for both providers, deep-debug marked expensive', () => {
  assert.deepEqual(Object.keys(policy.profiles).sort(), ['asset-craft', 'deep-debug', 'implement', 'model-fit', 'small-edit', 'visual-check']);
  assert.deepEqual(Object.entries(policy.profiles).filter(([, p]) => p.expensive).map(([n]) => n), ['deep-debug']);
  assert.deepEqual(policy.profiles['small-edit'].anthropic, { model: 'haiku', effort: 'medium' });
  assert.deepEqual(policy.profiles['model-fit'].openai, { model: 'gpt-6-luna', effort: 'low', sandbox: 'read-only' });
  for (const p of Object.values(policy.profiles)) for (const s of [p.openai, p.anthropic]) assert.notEqual(s.effort, 'ultra');
});
test('every task profile has a skill of the same name', () => {
  for (const name of Object.keys(policy.profiles)) assert.match(readFileSync(join(root, 'skills', name, 'SKILL.md'), 'utf8'), new RegExp(`^name: ${name}$`, 'm'), name);
});
test('a policy that names ultra is refused when read', () => {
  const kit = temp(), bad: Policy = JSON.parse(JSON.stringify(policy)); bad.profiles.implement.openai.effort = 'ultra';
  put(kit, 'policy/model-profiles.json', JSON.stringify(bad));
  assert.throws(() => readPolicy(kit), /implement.*openai.*automatic task delegation/);
});

test('resolution takes explicit over config over policy, field by field', () => {
  const home = temp();
  assert.deepEqual(resolveProfile({ profile: 'implement', provider: 'openai', policy, home }).Source, { model: 'policy', effort: 'policy' });
  setOverride({ profile: 'implement', provider: 'openai', effort: 'high', policy, home });
  const fromConfig = resolveProfile({ profile: 'implement', provider: 'openai', policy, home });
  assert.deepEqual(fromConfig.Resolved, { model: 'gpt-6.1-sol', effort: 'high' }); assert.deepEqual(fromConfig.Source, { model: 'policy', effort: 'config' });
  const explicit = resolveProfile({ profile: 'implement', provider: 'openai', model: 'gpt-6-astra', effort: 'LOW', policy, home });
  assert.deepEqual(explicit.Resolved, { model: 'gpt-6-astra', effort: 'low' }); assert.deepEqual(explicit.Source, { model: 'explicit', effort: 'explicit' });
  assert.deepEqual(explicit.Policy, { model: 'gpt-6.1-sol', effort: 'medium' });
});
test('unknown profiles and providers are refused, naming what is known', () => {
  assert.throws(() => resolveProfile({ profile: 'nope', provider: 'openai', policy, home: temp() }), /Unknown model profile 'nope'. Known: model-fit/);
  assert.throws(() => resolveProfile({ profile: 'implement', provider: 'google', policy, home: temp() }), /Use openai or anthropic/);
});

test('overrides live under modelProfiles and preserve every unrelated setting', () => {
  const home = temp(); put(home, '.agent-kit-state/config.json', JSON.stringify({ updatePolicy: 'auto', other: { keep: [1, 2] } }));
  setOverride({ profile: 'small-edit', provider: 'anthropic', model: 'sonnet', policy, home });
  setOverride({ profile: 'small-edit', provider: 'openai', effort: 'medium', policy, home });
  assert.deepEqual(config(home), { updatePolicy: 'auto', other: { keep: [1, 2] }, modelProfiles: { 'small-edit': { anthropic: { model: 'sonnet' }, openai: { effort: 'medium' } } } });
  clearOverride({ profile: 'small-edit', provider: 'anthropic', policy, home });
  assert.deepEqual(config(home).modelProfiles, { 'small-edit': { openai: { effort: 'medium' } } });
  clearOverride({ profile: 'small-edit', policy, home });
  assert.deepEqual(config(home), { updatePolicy: 'auto', other: { keep: [1, 2] } });
});
test('an override with ultra, no value, or an unknown profile is refused and writes nothing', () => {
  const home = temp(); put(home, '.agent-kit-state/config.json', '{"updatePolicy":"ask"}');
  assert.throws(() => setOverride({ profile: 'deep-debug', provider: 'openai', effort: 'ultra', policy, home }), /automatic task delegation/);
  assert.throws(() => setOverride({ profile: 'deep-debug', provider: 'openai', policy, home }), /needs --model, --effort or both/);
  assert.throws(() => setOverride({ profile: 'nope', provider: 'openai', effort: 'low', policy, home }), /Unknown model profile/);
  assert.deepEqual(config(home), { updatePolicy: 'ask' });
});
test('a config.json that does not parse stops an override write and is left byte-identical', () => {
  for (const text of ['{"updatePolicy":"auto",', '[1, 2]']) {
    const home = temp(), path = join(home, '.agent-kit-state/config.json'); put(home, '.agent-kit-state/config.json', text);
    assert.throws(() => setOverride({ profile: 'small-edit', provider: 'openai', effort: 'medium', policy, home }), /nothing was written/);
    assert.throws(() => clearOverride({ profile: 'small-edit', policy, home }), /nothing was written/);
    assert.equal(readFileSync(path, 'utf8'), text);
  }
});
test('an override model that is not a model ID is refused before it can reach adapter frontmatter', () => {
  const home = temp();
  assert.throws(() => setOverride({ profile: 'small-edit', provider: 'anthropic', model: 'sonnet\neffort: max', policy, home }), /not a Claude Code model value/);
  assert.throws(() => setOverride({ profile: 'small-edit', provider: 'openai', model: 'gpt 6', policy, home }), /not a Codex model ID/);
  assert.equal(readOverrides(home)['small-edit'], undefined);
});
test('the anthropic override note says setup must regenerate the adapters', () => {
  assert.match(setOverride({ profile: 'implement', provider: 'anthropic', model: 'opus', policy, home: temp() }).Note, /rerun setup with --register-only to regenerate/);
});

test('openai: a fresh cache listing the model and effort verifies it', () => {
  const r = validateOpenAI({ model: 'gpt-6-luna', effort: 'low' }, codexEnv(cache()), now);
  assert.equal(r.Validation, 'verified'); assert.equal(r.Cache?.State, 'fresh');
});
test('openai: a fresh cache that lists the model without that effort refuses it', () => {
  const r = validateOpenAI({ model: 'gpt-6-luna', effort: 'xhigh' }, codexEnv(cache()), now);
  assert.equal(r.Validation, 'refused'); assert.match(r.Detail, /lists efforts low, medium, high for 'gpt-6-luna', not 'xhigh'/);
});
test('openai: a model absent from the cache is unverified, not retired', () => {
  const r = validateOpenAI({ model: 'gpt-7-nova', effort: 'low' }, codexEnv(cache()), now);
  assert.equal(r.Validation, 'unverified'); assert.match(r.Detail, /does not prove the model was retired/);
});
test('openai: a stale cache never verifies or refuses, and says how old it is', () => {
  const env = codexEnv(cache('2026-09-01T00:00:00Z'));
  for (const effort of ['low', 'xhigh']) {
    const r = validateOpenAI({ model: 'gpt-6-luna', effort }, env, now);
    assert.equal(r.Validation, 'unverified', effort); assert.equal(r.Cache?.State, 'stale'); assert.match(r.Detail, /57 days old/);
  }
});
test('openai: a missing or unreadable cache is reported, not treated as a pass', () => {
  assert.deepEqual([validateOpenAI({ model: 'gpt-6-luna', effort: 'low' }, codexEnv(), now)].map(r => [r.Validation, r.Cache?.State]), [['unverified', 'missing']]);
  assert.deepEqual([validateOpenAI({ model: 'gpt-6-luna', effort: 'low' }, codexEnv('{not json'), now)].map(r => [r.Validation, r.Cache?.State]), [['unverified', 'unreadable']]);
});
test('openai: a model value that is not a model ID is refused before the cache is consulted', () => {
  for (const env of [codexEnv(cache()), codexEnv()]) {
    const r = validateOpenAI({ model: 'gpt 6', effort: 'low' }, env, now);
    assert.equal(r.Validation, 'refused'); assert.match(r.Detail, /not a Codex model ID/); assert.equal(r.Cache, undefined);
  }
});
test('ultra is refused even where the cache lists it', () => {
  const r = validateOpenAI({ model: 'gpt-6-astra', effort: 'ultra' }, codexEnv(cache()), now);
  assert.equal(r.Validation, 'refused'); assert.match(r.Detail, /automatic task delegation/);
});

test('anthropic: aliases and full IDs pass as unverified; malformed values are refused', () => {
  const env = { HOME: temp(), USERPROFILE: '' };
  for (const model of ['haiku', 'opus', 'claude-haiku-5-5', 'sonnet[1m]']) assert.equal(validateAnthropic({ model, effort: 'low' }, env, 'linux').Validation, 'unverified', model);
  assert.equal(validateAnthropic({ model: 'haiku; rm -rf', effort: 'low' }, env, 'linux').Validation, 'refused');
  assert.equal(validateAnthropic({ model: 'haiku', effort: 'ultra' }, env, 'linux').Validation, 'refused');
});
test('anthropic: availableModels refuses a model the host would not use, matching by family', () => {
  const home = temp(); put(home, '.claude/settings.json', JSON.stringify({ availableModels: ['claude-sonnet-5-5', 'opus'] }));
  const env = { HOME: home, USERPROFILE: home };
  assert.equal(validateAnthropic({ model: 'haiku', effort: 'low' }, env, 'linux').Validation, 'refused');
  assert.equal(validateAnthropic({ model: 'sonnet', effort: 'low' }, env, 'linux').Validation, 'unverified');
  assert.equal(validateAnthropic({ model: 'claude-opus-5-5', effort: 'low' }, env, 'linux').Validation, 'unverified');
});
test("anthropic: availableModels follows Claude Code's alias, version-prefix and full-ID rules", () => {
  const cases: [string[], string, boolean][] = [
    [['claude-sonnet-4-5'], 'claude-sonnet-4-6', false],
    [['claude-sonnet-4-5'], 'claude-sonnet-4-5', true],
    [['claude-sonnet-4-5'], 'claude-sonnet-4-5-20250929', true],
    [['claude-sonnet-4-5-20250929'], 'claude-sonnet-4-5', false],
    [['claude-fable-5'], 'claude-fable-5-1', true],
    [['claude-fable-5-1'], 'claude-fable-5', false],
    [['sonnet'], 'claude-sonnet-4-6', true],
    [['sonnet', 'claude-sonnet-4-5'], 'claude-sonnet-4-6', false],
    [['sonnet', 'claude-sonnet-4-5'], 'claude-sonnet-4-5-20250929', true],
    [['sonnet', 'claude-opus-4-6'], 'opus', true],
    [['sonnet', 'claude-opus-4-6'], 'claude-opus-4-7', false],
    [['sonnet'], 'haiku', false],
    [['Sonnet'], 'sonnet[1m]', true],
    [['claude-opus-4-6'], 'claude-opus-4-6[1m]', true],
    [[], 'sonnet', false],
  ];
  for (const [availableModels, model, allowed] of cases) {
    const home = temp(); put(home, '.claude/settings.json', JSON.stringify({ availableModels }));
    assert.equal(validateAnthropic({ model, effort: 'low' }, { HOME: home, USERPROFILE: home }, 'linux').Validation, allowed ? 'unverified' : 'refused', `${model} against ${JSON.stringify(availableModels)}`);
  }
});
test('an explicit Claude value is reported as not applicable to an already-loaded skill', () => {
  const env = { HOME: temp(), USERPROFILE: '' };
  const explicit = resolveAndValidate({ profile: 'small-edit', provider: 'anthropic', model: 'opus', policy, home: env.HOME, env });
  assert.equal(explicit.Applicable, false); assert.match(explicit.Through, /cannot change a skill that is already loaded/);
  assert.equal(resolveAndValidate({ profile: 'small-edit', provider: 'anthropic', policy, home: env.HOME, env }).Applicable, true);
  assert.equal(resolveAndValidate({ profile: 'small-edit', provider: 'openai', model: 'gpt-6-astra', policy, home: env.HOME, env: codexEnv(cache()) }).Applicable, true);
});

const transcript = (home: string, id: string, models: string[]) => put(home, `.claude/projects/D--proj/${id}.jsonl`, models.map(model => JSON.stringify({ type: 'assistant', message: { model } })).join('\n') + '\n{"type":"user"}\n');
test('verify-active reads the latest assistant model and matches it by family', () => {
  const home = temp(); transcript(home, 's1', ['claude-opus-5-5', 'claude-haiku-5-5', '<synthetic>']);
  const r = verifyActive({ profile: 'small-edit', model: 'haiku', effort: 'medium', policy, home, env: { CLAUDE_CODE_SESSION_ID: 's1' } });
  assert.deepEqual(r.Active, { model: 'claude-haiku-5-5', effort: 'not recorded' }); assert.equal(r.ModelMatch, true); assert.match(r.Detail, /Effort is not recorded/);
  assert.equal(r.RegenerationNeeded, undefined);
});
test('verify-active reports a host that ignored the requested model', () => {
  const home = temp(); transcript(home, 's2', ['claude-opus-5-5']);
  const r = verifyActive({ profile: 'small-edit', model: 'haiku', policy, home, env: { CLAUDE_CODE_SESSION_ID: 's2' } });
  assert.equal(r.ModelMatch, false); assert.match(r.Detail, /did not apply the skill's model/);
});
test('verify-active flags an adapter older than the current config, and a missing session', () => {
  const home = temp(); setOverride({ profile: 'small-edit', provider: 'anthropic', model: 'sonnet', policy, home });
  const r = verifyActive({ profile: 'small-edit', model: 'haiku', effort: 'medium', policy, home, env: {} });
  assert.match(r.RegenerationNeeded || '', /requested 'haiku · medium' but policy and config now resolve to 'sonnet · medium'/);
  assert.equal(r.Active, null); assert.match(r.Detail, /No CLAUDE_CODE_SESSION_ID/);
  assert.match(verifyActive({ profile: 'small-edit', policy, home, env: { CLAUDE_CODE_SESSION_ID: 'none' } }).Detail, /No transcript/);
});
test('list shows each profile with both providers and any overrides', () => {
  const home = temp(); setOverride({ profile: 'deep-debug', provider: 'openai', effort: 'high', policy, home });
  const list = listProfiles(policy, home), deep = list.Profiles.find(p => p.Profile === 'deep-debug');
  assert.equal(list.Profiles.length, 6); assert.equal(deep?.OpenAI, 'gpt-6-astra · medium'); assert.equal(deep?.Anthropic, 'opus · medium'); assert.equal(deep?.Expensive, true);
  assert.deepEqual(deep?.Overrides, { openai: { effort: 'high' } });
});

const cli = (args: string[], env: NodeJS.ProcessEnv) => run(process.execPath, [join(root, 'tools/model-profile.ts'), ...args], { env: { ...process.env, ...env } });
test('the CLI resolves a profile and exits non-zero only on a refusal', () => {
  const env = codexEnv(cache(new Date().toISOString()));
  const ok = cli(['--profile', 'small-edit', '--provider', 'openai'], env);
  assert.equal(ok.code, 0, ok.stderr); assert.equal(JSON.parse(ok.stdout).Validation, 'verified');
  const refused = cli(['--profile', 'small-edit', '--provider', 'openai', '--effort', 'ultra'], env);
  assert.equal(refused.code, 1); assert.equal(JSON.parse(refused.stdout).Validation, 'refused');
  const both = cli(['--profile', 'implement'], env);
  assert.equal(both.code, 0, both.stderr); assert.deepEqual(JSON.parse(both.stdout).Providers.map((p: any) => p.Provider), ['openai', 'anthropic']);
  const ambiguous = cli(['--profile', 'implement', '--model', 'opus'], env);
  assert.equal(ambiguous.code, 1); assert.match(ambiguous.stderr, /apply to one provider/);
});
