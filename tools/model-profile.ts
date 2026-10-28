import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readState, saveState } from './get-agentkit-skill.ts';
import { resolveKitRoot } from './lib/kit-root.ts';
import { parseOptions, requiredOption } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

// One shared policy (policy/model-profiles.json) for the task skills. This script resolves a
// profile to a model and effort, checks it against what the host exposes, and reports requested,
// resolved and active separately. It never substitutes a fallback and never escalates on its own.
export const options = {
  profile: { type: 'string' },
  provider: { type: 'string' },
  model: { type: 'string' },
  effort: { type: 'string' },
  list: { type: 'boolean' },
  'set-override': { type: 'boolean' },
  'clear-override': { type: 'boolean' },
  'verify-active': { type: 'boolean' },
} as const;
export const efforts = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export const providers = ['openai', 'anthropic'] as const;
export type Provider = typeof providers[number];
export interface Setting { model: string; effort: string }
export interface Profile { purpose: string; expensive?: boolean; openai: Setting & { sandbox: string }; anthropic: Setting }
export interface Policy { version: number; reviewed: string; profiles: Record<string, Profile> }
type Overrides = Record<string, Partial<Record<Provider, Partial<Setting>>>>;
export const STALE_DAYS = 7;
const defaultHome = (env = process.env) => env.HOME || env.USERPROFILE || homedir();
const configPath = (home: string) => join(home, '.agent-kit-state/config.json');
const show = (s: Setting) => `${s.model} · ${s.effort}`;

export function effortProblem(effort: string): string | undefined {
  if (effort === 'ultra') return "Effort 'ultra' is not used by AgentKit task profiles: Codex describes it as maximum reasoning with automatic task delegation, which none of these profiles needs. Choose low, medium, high, xhigh or max.";
  if (!(efforts as readonly string[]).includes(effort)) return `Effort '${effort}' is not one of ${efforts.join(', ')}.`;
}
// The values that go into adapter frontmatter and Codex arguments: a model ID, never free text.
const modelPatterns: Record<Provider, RegExp> = { anthropic: /^[a-z][a-z0-9.-]*(\[1m\])?$/i, openai: /^[a-z0-9][a-z0-9._-]*$/i };
export function modelProblem(provider: Provider, model: string): string | undefined {
  if (!modelPatterns[provider].test(model)) return provider === 'anthropic'
    ? `'${model}' is not a Claude Code model value (an alias such as haiku, sonnet or opus, or a full claude-* ID).`
    : `'${model}' is not a Codex model ID (letters, digits, '.', '_' and '-').`;
}
export function settingProblem(provider: Provider, setting: Setting): string | undefined {
  return modelProblem(provider, setting.model) || effortProblem(setting.effort);
}
// Strict where the file is about to be rewritten: a missing file is empty, but one that does not
// parse stops the write, so a hand-edit typo never costs every other setting in it.
function readConfigForWrite(path: string): Record<string, any> {
  if (!existsSync(path)) return {};
  let value: unknown; try { value = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { throw new Error(`'${path}' is not valid JSON (${(error as Error).message}). Fix or remove it, then retry; nothing was written.`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`'${path}' does not hold a JSON object. Fix or remove it, then retry; nothing was written.`);
  return value as Record<string, any>;
}
const overridesIn = (config: Record<string, any>): Overrides => { const value = config.modelProfiles; return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}; };
export function readPolicy(root = resolveKitRoot(import.meta.url)): Policy {
  const path = join(root, 'policy/model-profiles.json');
  let value: any; try { value = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { throw new Error(`Model policy '${path}' is missing or not valid JSON: ${(error as Error).message}`); }
  if (!value?.profiles || typeof value.profiles !== 'object') throw new Error(`Model policy '${path}' has no profiles.`);
  for (const [name, p] of Object.entries<any>(value.profiles)) for (const provider of providers) {
    if (typeof p?.[provider]?.model !== 'string' || !p[provider].model) throw new Error(`Model policy profile '${name}' has no ${provider} model.`);
    const problem = effortProblem(p[provider].effort); if (problem) throw new Error(`Model policy profile '${name}' (${provider}): ${problem}`);
  }
  return value;
}
function profileOf(policy: Policy, name: string): Profile {
  if (!Object.hasOwn(policy.profiles, name)) throw new Error(`Unknown model profile '${name}'. Known: ${Object.keys(policy.profiles).join(', ')}.`);
  return policy.profiles[name];
}
function providerOf(value: string): Provider {
  if (!(providers as readonly string[]).includes(value)) throw new Error(`Unknown provider '${value}'. Use openai or anthropic.`);
  return value as Provider;
}
export function readOverrides(home = defaultHome()): Overrides {
  return overridesIn(readState(configPath(home)));
}
// The namespaced modelProfiles key only; every other setting in config.json is kept as it was.
export function setOverride(input: { profile: string; provider: string; model?: string; effort?: string; policy?: Policy; home?: string }) {
  const policy = input.policy || readPolicy(), provider = providerOf(input.provider); profileOf(policy, input.profile);
  const model = input.model?.trim(), effort = input.effort?.trim().toLowerCase();
  if (!model && !effort) throw new Error('--set-override needs --model, --effort or both.');
  const problem = (model && modelProblem(provider, model)) || (effort && effortProblem(effort)); if (problem) throw new Error(problem);
  const path = configPath(input.home || defaultHome()), config = readConfigForWrite(path), all = overridesIn(config);
  all[input.profile] = { ...all[input.profile], [provider]: { ...all[input.profile]?.[provider], ...(model ? { model } : {}), ...(effort ? { effort } : {}) } };
  config.modelProfiles = all; saveState(path, config);
  return { Profile: input.profile, Provider: provider, Override: all[input.profile][provider], Path: path, Note: applyNote(provider) };
}
export function clearOverride(input: { profile: string; provider?: string; policy?: Policy; home?: string }) {
  const policy = input.policy || readPolicy(); profileOf(policy, input.profile);
  const provider = input.provider ? providerOf(input.provider) : undefined, path = configPath(input.home || defaultHome()), config = readConfigForWrite(path), all = overridesIn(config);
  if (provider && all[input.profile]) { const rest = { ...all[input.profile] }; delete rest[provider]; all[input.profile] = rest; }
  if (!provider || !Object.keys(all[input.profile] || {}).length) delete all[input.profile];
  if (Object.keys(all).length) config.modelProfiles = all; else delete config.modelProfiles;
  saveState(path, config);
  return { Profile: input.profile, Provider: provider || 'all', Cleared: true, Path: path, Note: applyNote(provider) };
}
function applyNote(provider?: Provider) {
  const claude = 'Claude skills take their model from the adapter written at setup: rerun setup with --register-only to regenerate them, or the installed skill keeps its previous model.';
  const codex = 'The routed Codex launcher reads this on every launch.';
  return provider === 'anthropic' ? claude : provider === 'openai' ? codex : `${claude} ${codex}`;
}
// Explicit (this call) beats config (config.json modelProfiles) beats policy, per field.
export function resolveProfile(input: { profile: string; provider: string; model?: string; effort?: string; policy?: Policy; home?: string }) {
  const policy = input.policy || readPolicy(), p = profileOf(policy, input.profile), provider = providerOf(input.provider);
  const base = p[provider], override = readOverrides(input.home || defaultHome())[input.profile]?.[provider] || {};
  const pick = (key: keyof Setting, explicit?: string) => explicit?.trim() ? { value: key === 'effort' ? explicit.trim().toLowerCase() : explicit.trim(), source: 'explicit' } : override[key] ? { value: String(override[key]), source: 'config' } : { value: base[key], source: 'policy' };
  const model = pick('model', input.model), effort = pick('effort', input.effort);
  return {
    Profile: input.profile, Provider: provider, Expensive: !!p.expensive,
    Policy: { model: base.model, effort: base.effort }, Resolved: { model: model.value, effort: effort.value }, Source: { model: model.source, effort: effort.source },
    ...(provider === 'openai' ? { Sandbox: (base as Profile['openai']).sandbox } : {}),
  };
}
export function validateOpenAI(setting: Setting, env = process.env, now = Date.now()) {
  const problem = effortProblem(setting.effort); if (problem) return { Validation: 'refused', Detail: problem };
  const path = join(env.CODEX_HOME || join(defaultHome(env), '.codex'), 'models_cache.json');
  if (!existsSync(path)) return { Validation: 'unverified', Cache: { Path: path, State: 'missing' }, Detail: `No Codex model cache at ${path}, so '${show(setting)}' goes to Codex unchecked; Codex reports an unknown model when it starts.` };
  let cache: any; try { cache = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { return { Validation: 'unverified', Cache: { Path: path, State: 'unreadable' }, Detail: `The Codex model cache could not be read (${(error as Error).message}), so '${show(setting)}' goes to Codex unchecked.` }; }
  const fetched = Date.parse(cache?.fetched_at), age = Number.isNaN(fetched) ? undefined : Math.floor((now - fetched) / 86_400_000), stale = age === undefined || age > STALE_DAYS;
  const Cache = { Path: path, State: stale ? 'stale' : 'fresh', FetchedAt: cache?.fetched_at ?? null, AgeDays: age ?? null, ClientVersion: cache?.client_version ?? null };
  const staleNote = stale ? ` The cache is ${age === undefined ? 'undated' : `${age} days old`}; starting Codex refreshes it.` : '';
  const entry = Array.isArray(cache?.models) ? cache.models.find((m: any) => m?.slug === setting.model) : undefined;
  if (!entry) return { Validation: 'unverified', Cache, Detail: `'${setting.model}' is not in the Codex model cache. Absence from the cache alone does not prove the model was retired; Codex decides when it starts.${staleNote}` };
  const levels: string[] = (Array.isArray(entry.supported_reasoning_levels) ? entry.supported_reasoning_levels : []).map((l: any) => typeof l === 'string' ? l : l?.effort).filter(Boolean);
  if (!levels.length) return { Validation: 'unverified', Cache, Detail: `The Codex model cache lists '${setting.model}' but no reasoning levels for it.${staleNote}` };
  if (!levels.includes(setting.effort)) return stale
    ? { Validation: 'unverified', Cache, Detail: `The Codex model cache lists efforts ${levels.join(', ')} for '${setting.model}', not '${setting.effort}', but it is stale, so this may have changed.${staleNote}` }
    : { Validation: 'refused', Cache, Detail: `The Codex model cache lists efforts ${levels.join(', ')} for '${setting.model}', not '${setting.effort}'.` };
  return stale
    ? { Validation: 'unverified', Cache, Detail: `'${show(setting)}' is listed, but only in a stale cache.${staleNote}` }
    : { Validation: 'verified', Cache, Detail: `'${show(setting)}' is listed in the Codex model cache fetched ${cache.fetched_at}.` };
}
export function managedSettingsPath(platform = process.platform) {
  return platform === 'win32' ? 'C:/Program Files/ClaudeCode/managed-settings.json' : platform === 'darwin' ? '/Library/Application Support/ClaudeCode/managed-settings.json' : '/etc/claude-code/managed-settings.json';
}
export const family = (model: string) => /\b(?:claude-)?(haiku|sonnet|opus|fable)\b/i.exec(model)?.[1].toLowerCase();
// Claude Code keeps no model catalogue on disk, so a value that passes is still only unverified:
// the host decides when the skill loads, and --verify-active reads what it chose.
export function validateAnthropic(setting: Setting, env = process.env, platform = process.platform) {
  const problem = effortProblem(setting.effort) || modelProblem('anthropic', setting.model); if (problem) return { Validation: 'refused', Detail: problem };
  for (const path of [join(defaultHome(env), '.claude/settings.json'), managedSettingsPath(platform)]) {
    const allowed = readState(path).availableModels;
    if (Array.isArray(allowed) && !allowed.some((m: unknown) => typeof m === 'string' && (m === setting.model || (!!family(m) && family(m) === family(setting.model)))))
      return { Validation: 'refused', Detail: `'${setting.model}' is not in availableModels in ${path}; Claude Code would not use it.` };
  }
  return { Validation: 'unverified', Detail: 'Claude Code keeps no model catalogue on disk, and organisation policy, auto mode or effort caps can still change what runs. Verify after loading with --verify-active.' };
}
export function validate(provider: Provider, setting: Setting, env = process.env) {
  return provider === 'openai' ? validateOpenAI(setting, env) : validateAnthropic(setting, env);
}
function appliesThrough(provider: Provider, explicit: boolean) {
  if (provider === 'openai') return { Applicable: true, Through: 'The routed Codex launcher (/<profile>-routed, or start-agentkit-codex.ts --model/--effort) passes these as -m and model_reasoning_effort. A native Codex session keeps its own model and effort.' };
  return explicit
    ? { Applicable: false, Through: "A Claude skill's model and effort are fixed in its adapter frontmatter when setup generates it, so a per-call value cannot change a skill that is already loaded. Set it with --set-override and rerun setup with --register-only, or switch this session with /model." }
    : { Applicable: true, Through: "The skill adapter's model and effort frontmatter, written when setup generates it. It applies for the rest of the turn that invokes the skill, if the host accepts it." };
}
export function resolveAndValidate(input: { profile: string; provider: string; model?: string; effort?: string; policy?: Policy; home?: string; env?: NodeJS.ProcessEnv }) {
  const resolved = resolveProfile(input), explicit = resolved.Source.model === 'explicit' || resolved.Source.effort === 'explicit';
  return { ...resolved, ...validate(resolved.Provider, resolved.Resolved, input.env || process.env), ...appliesThrough(resolved.Provider, explicit) };
}
export function activeClaudeModel(sessionId: string, home = defaultHome()): { Transcript: string; Model: string } | undefined {
  const root = join(home, '.claude/projects'); if (!existsSync(root)) return;
  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = join(root, dir.name, `${sessionId}.jsonl`); if (!existsSync(file)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      let entry: any; try { entry = JSON.parse(lines[i]); } catch { continue; }
      const model = entry?.type === 'assistant' ? entry.message?.model : undefined;
      if (typeof model === 'string' && model && model !== '<synthetic>') return { Transcript: file, Model: model };
    }
    return;
  }
}
// Requested is what the invoking adapter carries; Resolved is what policy and config say now;
// Active is the model the transcript recorded. Effort is not recorded, so it is never verified.
export function verifyActive(input: { profile: string; model?: string; effort?: string; policy?: Policy; home?: string; env?: NodeJS.ProcessEnv }) {
  const env = input.env || process.env, home = input.home || defaultHome(env);
  const resolved = resolveProfile({ profile: input.profile, provider: 'anthropic', policy: input.policy, home });
  const requested = { model: input.model?.trim() || resolved.Resolved.model, effort: input.effort?.trim().toLowerCase() || resolved.Resolved.effort };
  const stale = requested.model !== resolved.Resolved.model || requested.effort !== resolved.Resolved.effort;
  const base = { Profile: input.profile, Provider: 'anthropic', Requested: requested, Resolved: resolved.Resolved, Source: resolved.Source, ...(stale ? { RegenerationNeeded: `The adapter requested '${show(requested)}' but policy and config now resolve to '${show(resolved.Resolved)}'. Rerun setup with --register-only to regenerate it.` } : {}) };
  const sessionId = env.CLAUDE_CODE_SESSION_ID;
  if (!sessionId) return { ...base, Active: null, ModelMatch: null, Detail: 'No CLAUDE_CODE_SESSION_ID: not running inside Claude Code, so the active model cannot be read.' };
  const active = activeClaudeModel(sessionId, home);
  if (!active) return { ...base, Active: null, ModelMatch: null, Detail: `No transcript with an assistant model for session ${sessionId} under ${join(home, '.claude/projects')}.` };
  const wanted = requested.model.toLowerCase(), got = active.Model.toLowerCase();
  const match = got === wanted || (['haiku', 'sonnet', 'opus'].includes(wanted) ? family(got) === wanted : ['inherit', 'default', 'best'].includes(wanted) ? null : false);
  const Detail = match === true ? `Active model ${active.Model} matches the request. Effort is not recorded in the transcript and stays unverified.`
    : match === false ? `Active model ${active.Model} does not match the requested '${requested.model}': the host did not apply the skill's model (availableModels, organisation policy or auto mode can cause this). Report it; do not claim the profile ran.`
    : `Active model ${active.Model}; the request '${requested.model}' names no fixed model, so there is nothing to match.`;
  return { ...base, Active: { model: active.Model, effort: 'not recorded' }, ModelMatch: match, Transcript: active.Transcript, Detail };
}
export function listProfiles(policy = readPolicy(), home = defaultHome()) {
  const overrides = readOverrides(home);
  return { Reviewed: policy.reviewed, Profiles: Object.entries(policy.profiles).map(([name, p]) => ({ Profile: name, Purpose: p.purpose, Expensive: !!p.expensive, OpenAI: show(p.openai), Anthropic: show(p.anthropic), ...(overrides[name] ? { Overrides: overrides[name] } : {}) })) };
}
if (isMain(import.meta.url)) await main(() => {
  const v = parseOptions(options);
  const modes = (['list', 'set-override', 'clear-override', 'verify-active'] as const).filter(name => v[name]);
  if (modes.length > 1) throw new Error(`--${modes.join(' and --')} are mutually exclusive.`);
  if (v.list) { writeJson(listProfiles()); return; }
  const profile = requiredOption(v.profile, 'profile');
  if (v['set-override']) writeJson(setOverride({ profile, provider: requiredOption(v.provider, 'provider'), model: v.model, effort: v.effort }));
  else if (v['clear-override']) writeJson(clearOverride({ profile, provider: v.provider }));
  else if (v['verify-active']) writeJson(verifyActive({ profile, model: v.model, effort: v.effort }));
  else {
    if (!v.provider && (v.model || v.effort)) throw new Error('--model and --effort apply to one provider: pass --provider openai or --provider anthropic.');
    const results = (v.provider ? [v.provider] : [...providers]).map(provider => resolveAndValidate({ profile, provider, model: v.model, effort: v.effort }));
    writeJson(results.length === 1 ? results[0] : { Profile: profile, Providers: results });
    if (results.some(r => r.Validation === 'refused')) process.exitCode = 1;
  }
});
