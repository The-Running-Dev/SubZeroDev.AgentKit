import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { getSkill } from './get-agentkit-skill.ts';
import { parseOptions } from './lib/options.ts';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { resolveExecutable } from './lib/executable.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';
import { readPolicy, resolveAndValidate } from './model-profile.ts';
import type { Policy } from './model-profile.ts';

export const options = {
  command: { type: 'string' },
  effort: { type: 'string' },
  model: { type: 'string' },
  list: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  'arguments-file': { type: 'string' },
  'codex-arg': { type: 'string', multiple: true },
} as const;
export const commandProfiles = { brief: 'architect', interview: 'author', design: 'author', plan: 'author', redteam: 'architect', align: 'author', next: 'builder', fix: 'builder', install: 'builder', 'install-all': 'builder', 'install-review': 'builder', 'setup-project': 'builder', sync: 'builder', memory: 'builder', conversation: 'builder' } as const;
export const profileConfig = {
  architect: { Model: 'gpt-5.6-sol', Effort: 'high', Approval: 'on-request', Sandbox: 'read-only' },
  author: { Model: 'gpt-5.6-sol', Effort: 'high', Approval: 'on-request', Sandbox: 'workspace-write' },
  builder: { Model: 'gpt-5.6-terra', Effort: 'medium', Approval: 'on-request', Sandbox: 'workspace-write' },
  quick: { Model: 'gpt-5.3-codex-spark', Effort: 'medium', Approval: 'on-request', Sandbox: 'workspace-write' },
} as const;
export const profileTiers = { architect: 'Deep reasoning', author: 'Deep reasoning', builder: 'Implementation', quick: 'Implementation' } as const;
export function listCommands() { return Object.entries(commandProfiles).map(([name, profile]) => ({ Command: '/' + name, Profile: profile, ...profileConfig[profile], Tier: profileTiers[profile] })); }
// Task commands take their model and effort from the shared policy (policy/model-profiles.json),
// not from the tier profiles above, so changing one never moves /next or /fix.
export function listTaskCommands(policy: Policy = readPolicy()) { return Object.entries(policy.profiles).map(([name, p]) => ({ Command: '/' + name, Profile: name, Model: p.openai.model, Effort: p.openai.effort, Approval: 'on-request', Sandbox: p.openai.sandbox, Expensive: !!p.expensive })); }
export function readArgumentsFile(path: string): string[] {
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Arguments file '${path}' does not exist or is not a file.`);
  let value: unknown; try { value = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')); } catch (error) { throw new Error(`Arguments file '${path}' is not valid JSON: ${error}`); }
  if (!Array.isArray(value)) throw new Error(`Arguments file '${path}' must contain a JSON array of strings.`);
  if (value.some(item => typeof item !== 'string')) throw new Error(`Arguments file '${path}' must contain only strings.`);
  return value;
}
export function skillPrompt(name: string, args: string[], skill = getSkill(name)): string {
  return `Execute the canonical /${name} procedure below directly in this routed session. Do not invoke\nanother AgentKit wrapper, skill-dispatch command, or global adapter.\n\n--- canonical skills/${name}/SKILL.md ---\n${skill}\n--- end canonical skill ---\n\nUser arguments (JSON array; preserve each element exactly):\n${JSON.stringify(args)}`;
}
export function projectDocByteBudget(start = process.cwd()): number {
  const cwd = resolve(start); let walk = cwd, root = cwd;
  while (true) { if (existsSync(join(walk, '.git'))) { root = walk; break; } const parent = dirname(walk); if (parent === walk) break; walk = parent; }
  const dirs = []; let d = cwd; while (true) { dirs.unshift(d); if (d === root) break; d = dirname(d); }
  return dirs.reduce((sum, dir) => { const override = join(dir, 'AGENTS.override.md'), file = existsSync(override) ? override : join(dir, 'AGENTS.md'); return sum + (existsSync(file) ? statSync(file).size : 0); }, 0);
}
export interface LaunchInput { command: string; effort?: string; model?: string; skillArguments?: string[]; codexArgs?: string[]; cwd?: string; skill?: string; policy?: Policy; home?: string; env?: NodeJS.ProcessEnv }
export function buildInvocation(input: LaunchInput) {
  const normalized = input.command.replace(/^\/+/, '').toLowerCase();
  if (!Object.hasOwn(commandProfiles, normalized)) {
    const policy = input.policy || readPolicy();
    if (Object.hasOwn(policy.profiles, normalized)) return buildTaskInvocation(normalized, input, policy);
    throw new Error(`No profile mapping for '/${normalized}'. Known commands: ${[...Object.keys(commandProfiles), ...Object.keys(policy.profiles)].sort().map(c => '/' + c).join(', ')}. Pass --profile to codex directly for anything else.`);
  }
  if (input.model) throw new Error(`--model applies to task-profile commands only; /${normalized} keeps its '${commandProfiles[normalized as keyof typeof commandProfiles]}' profile model. Use --effort to change its effort.`);
  const profile = commandProfiles[normalized as keyof typeof commandProfiles], config = profileConfig[profile], effort = (input.effort || config.Effort).toLowerCase();
  if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) throw new Error('Invalid effort. Use low, medium, high, xhigh, or max.');
  const args = ['-m', config.Model, '-c', `model_reasoning_effort=${effort}`, '-c', `project_doc_max_bytes=${projectDocByteBudget(input.cwd)}`, '-a', config.Approval, '-s', config.Sandbox];
  if (input.skillArguments !== undefined) args.push(skillPrompt(normalized, input.skillArguments, input.skill)); else args.push(...input.codexArgs || []);
  return { Command: 'codex', Arguments: args, Environment: { AGENTKIT_TIER: profileTiers[profile], AGENTKIT_MODEL: config.Model, AGENTKIT_EFFORT: effort, AGENTKIT_COMMAND: '/' + normalized, AGENTKIT_PROFILE: profile } };
}
function buildTaskInvocation(name: string, input: LaunchInput, policy: Policy) {
  const r = resolveAndValidate({ profile: name, provider: 'openai', model: input.model, effort: input.effort, policy, home: input.home, env: input.env });
  if (r.Validation === 'refused') throw new Error(`Model profile '${name}' refused ${r.Resolved.model} · ${r.Resolved.effort}: ${r.Detail}`);
  const { model, effort } = r.Resolved, sandbox = r.Sandbox || 'workspace-write';
  const args = ['-m', model, '-c', `model_reasoning_effort=${effort}`, '-c', `project_doc_max_bytes=${projectDocByteBudget(input.cwd)}`, '-a', 'on-request', '-s', sandbox];
  if (input.skillArguments !== undefined) args.push(skillPrompt(name, input.skillArguments, input.skill)); else args.push(...input.codexArgs || []);
  return { Command: 'codex', Arguments: args, Environment: { AGENTKIT_TIER: 'Task profile', AGENTKIT_MODEL: model, AGENTKIT_EFFORT: effort, AGENTKIT_COMMAND: '/' + name, AGENTKIT_PROFILE: name }, ModelProfile: { Requested: r.Resolved, Policy: r.Policy, Source: r.Source, Validation: r.Validation, Detail: r.Detail, Expensive: r.Expensive } };
}
export function invokeCodex(input: LaunchInput, runner: Runner = run, env = process.env): number {
  const invocation = buildInvocation({ env, ...input }), executable = resolveExecutable('codex', env);
  if ('ModelProfile' in invocation) process.stderr.write(`Model profile /${invocation.Environment.AGENTKIT_PROFILE}: requested ${invocation.Environment.AGENTKIT_MODEL} · ${invocation.Environment.AGENTKIT_EFFORT} (${invocation.ModelProfile.Validation}). ${invocation.ModelProfile.Detail}\n`);
  const result = runner(executable.command, [...executable.args, ...invocation.Arguments], { cwd: input.cwd, env: { ...env, ...invocation.Environment }, stdio: 'inherit', windowsHide: false });
  if (!result.found) throw new Error('codex not found on PATH.');
  return result.code;
}
if (isMain(import.meta.url)) await main(() => {
  const v = parseOptions(options);
  if (v.list) { writeJson({ Commands: listCommands(), TaskCommands: listTaskCommands() }); return; }
  if (!v.command) throw new Error('No command given. Pass --command (e.g. next) or --list to see the table.');
  const input = { command: v.command, effort: v.effort, model: v.model, ...(v['arguments-file'] ? { skillArguments: readArgumentsFile(v['arguments-file']) } : {}), codexArgs: v['codex-arg'] };
  if (v['dry-run']) writeJson(buildInvocation(input)); else { const code = invokeCodex(input); writeJson({ ExitCode: code }); process.exitCode = code; }
});
