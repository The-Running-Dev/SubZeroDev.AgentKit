import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { getSkill } from './get-agentkit-skill.ts';
import { parseOptions } from './lib/options.ts';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { resolveExecutable } from './lib/executable.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  command: { type: 'string' },
  effort: { type: 'string' },
  list: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  'arguments-file': { type: 'string' },
  'codex-arg': { type: 'string', multiple: true },
} as const;
export const commandProfiles = { brief: 'architect', interview: 'author', design: 'author', plan: 'author', redteam: 'architect', align: 'author', next: 'builder', fix: 'builder', install: 'builder', 'install-all': 'builder', 'install-review': 'builder', sync: 'builder' } as const;
export const profileConfig = {
  architect: { Model: 'gpt-5.6-sol', Effort: 'high', Approval: 'on-request', Sandbox: 'read-only' },
  author: { Model: 'gpt-5.6-sol', Effort: 'high', Approval: 'on-request', Sandbox: 'workspace-write' },
  builder: { Model: 'gpt-5.6-terra', Effort: 'medium', Approval: 'on-request', Sandbox: 'workspace-write' },
  quick: { Model: 'gpt-5.3-codex-spark', Effort: 'medium', Approval: 'on-request', Sandbox: 'workspace-write' },
} as const;
export const profileTiers = { architect: 'Deep reasoning', author: 'Deep reasoning', builder: 'Implementation', quick: 'Implementation' } as const;
export function listCommands() { return Object.entries(commandProfiles).map(([name, profile]) => ({ Command: '/' + name, Profile: profile, ...profileConfig[profile], Tier: profileTiers[profile] })); }
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
export interface LaunchInput { command: string; effort?: string; skillArguments?: string[]; codexArgs?: string[]; cwd?: string; skill?: string }
export function buildInvocation(input: LaunchInput) {
  const normalized = input.command.replace(/^\/+/, '').toLowerCase();
  if (!Object.hasOwn(commandProfiles, normalized)) throw new Error(`No profile mapping for '/${normalized}'. Known commands: ${Object.keys(commandProfiles).sort().map(c => '/' + c).join(', ')}. Pass --profile to codex directly for anything else.`);
  const profile = commandProfiles[normalized as keyof typeof commandProfiles], config = profileConfig[profile], effort = input.effort || config.Effort;
  if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) throw new Error('Invalid effort. Use low, medium, high, xhigh, or max.');
  const args = ['-m', config.Model, '-c', `model_reasoning_effort=${effort}`, '-c', `project_doc_max_bytes=${projectDocByteBudget(input.cwd)}`, '-a', config.Approval, '-s', config.Sandbox];
  if (input.skillArguments !== undefined) args.push(skillPrompt(normalized, input.skillArguments, input.skill)); else args.push(...input.codexArgs || []);
  return { Command: 'codex', Arguments: args, Environment: { AGENTKIT_TIER: profileTiers[profile], AGENTKIT_MODEL: config.Model, AGENTKIT_EFFORT: effort, AGENTKIT_COMMAND: '/' + normalized, AGENTKIT_PROFILE: profile } };
}
export function invokeCodex(input: LaunchInput, runner: Runner = run, env = process.env): number {
  const invocation = buildInvocation(input), executable = resolveExecutable('codex', env);
  const result = runner(executable.command, [...executable.args, ...invocation.Arguments], { cwd: input.cwd, env: { ...env, ...invocation.Environment }, stdio: 'inherit', windowsHide: false });
  if (!result.found) throw new Error('codex not found on PATH.');
  return result.code;
}
if (isMain(import.meta.url)) await main(() => {
  const v = parseOptions(options);
  if (v.list) { writeJson({ Commands: listCommands() }); return; }
  if (!v.command) throw new Error('No command given. Pass --command (e.g. next) or --list to see the table.');
  const input = { command: v.command, effort: v.effort, ...(v['arguments-file'] ? { skillArguments: readArgumentsFile(v['arguments-file']) } : {}), codexArgs: v['codex-arg'] };
  if (v['dry-run']) writeJson(buildInvocation(input)); else { const code = invokeCodex(input); writeJson({ ExitCode: code }); process.exitCode = code; }
});
