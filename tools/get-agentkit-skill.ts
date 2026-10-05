import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { resolveKitRoot } from './lib/kit-root.ts';
import { parseOptions } from './lib/options.ts';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  command: { type: 'string' },
  'set-auto-update': { type: 'string' },
} as const;
export function readState(path: string): Record<string, any> {
  try { const value = JSON.parse(readFileSync(path, 'utf8')); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
export function saveState(path: string, value: object): void {
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}
export function setAutoUpdate(value: string, home = process.env.HOME || process.env.USERPROFILE || homedir()) {
  if (!/^(on|off)$/i.test(value)) throw new Error('--set-auto-update must be On or Off.');
  const path = join(home, '.agent-kit-state/config.json'), config = readState(path);
  config.autoUpdate = value.toLowerCase() === 'on'; saveState(path, config);
  return { Message: `AgentKit auto-update: ${config.autoUpdate ? 'On' : 'Off'} (${path})` };
}
export function sessionKey(env = process.env, runner: Runner = run): string {
  for (const name of ['CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID']) if (env[name]) return `${name}:${env[name]}`;
  // Node has no portable process ancestry API. POSIX exposes it through ps; on
  // Windows the launching parent's PID is the stable fallback, without PowerShell.
  let pid = process.ppid;
  if (process.platform !== 'win32') for (let i = 0; i < 8; i++) {
    const result = runner('ps', ['-p', String(pid), '-o', 'ppid=', '-o', 'comm=', '-o', 'lstart=']);
    const match = /^\s*(\d+)\s+(\S+)\s+(.+)$/.exec(result.stdout.trim());
    if (result.code !== 0 || !match) break;
    if (!/(?:^|\/)(?:pwsh|powershell|cmd|bash|sh|zsh|dash|fish|conhost|wsl)$/.test(match[2])) return `pid:${pid}:${match[3]}`;
    pid = Number(match[1]); if (!pid) break;
  }
  return `pid:${pid || process.ppid}`;
}
export function stableTags(tags: string[]): string[] {
  return tags.map(name => {
    const m = /^v(\d{4})\.(\d{2})\.(\d{2})(?:\.(\d+))?$/.exec(name);
    if (!m) return null;
    const date = `${m[1]}-${m[2]}-${m[3]}`, parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) return null;
    return { name, date, revision: BigInt(m[4] || '0') };
  }).filter(v => v !== null).sort((a, b) => b.date.localeCompare(a.date) || (a.revision === b.revision ? a.name.localeCompare(b.name) : a.revision > b.revision ? -1 : 1)).map(v => v.name);
}
export function updateNotice(root: string, home: string, env = process.env, runner: Runner = run): string {
  if (/^(0|off|false|no)$/i.test(env.AGENTKIT_AUTO_UPDATE || '')) return '';
  const state = join(home, '.agent-kit-state'), config = readState(join(state, 'config.json')), manifest = readState(join(state, 'installed.json'));
  if (Object.hasOwn(config, 'autoUpdate') && !config.autoUpdate) return '';
  if (!manifest.installRoot || resolve(manifest.installRoot).toLowerCase() !== resolve(root).toLowerCase()) return '';
  const path = join(state, 'update-check.json'), seen = readState(path), key = sessionKey(env, runner);
  const sessions: string[] = Array.isArray(seen.sessions) ? seen.sessions.map(String) : [];
  if (sessions.includes(key)) return '';
  try { saveState(path, { sessions: [...sessions, key].slice(-50) }); } catch { /* A read remains usable if state cannot be saved. */ }
  const git = (args: string[], timeout = 20000) => {
    const r = runner('git', ['-C', root, ...args], { env: { ...env, GIT_TERMINAL_PROMPT: '0' }, timeout });
    if (!r.found || r.code !== 0) throw new Error(r.stderr || 'git update check failed');
    return r.stdout.trim();
  };
  const installed = git(['rev-parse', 'HEAD']), version = String(manifest.version || ''), requested = String(manifest.requestedVersion || '');
  let target = '', targetName = '', upgradeArgs = '';
  if (requested === 'latest stable') {
    targetName = stableTags(git(['ls-remote', '--tags', '--refs', 'origin']).split(/\r?\n/).map(l => l.split(/\s+/, 2)[1]?.replace(/^refs\/tags\//, '') || ''))[0] || '';
    if (targetName) { git(['fetch', '--quiet', 'origin', `+refs/tags/${targetName}:refs/tags/${targetName}`], 60000); target = git(['rev-parse', '--verify', `refs/tags/${targetName}^{commit}`]); }
  } else if (version && !version.startsWith('-') && !/^[0-9a-f]{7,40}$/i.test(version) && !/^v\d{4}\.\d{2}\.\d{2}/.test(version)) {
    git(['fetch', '--quiet', 'origin', `+refs/heads/${version}:refs/remotes/origin/${version}`], 60000);
    targetName = `origin/${version}`; target = git(['rev-parse', '--verify', `refs/remotes/origin/${version}^{commit}`]); upgradeArgs = ` --version ${JSON.stringify(version)}`;
  }
  if (!target || target === installed || runner('git', ['-C', root, 'merge-base', '--is-ancestor', installed, target]).code !== 0) return '';
  const changes = git(['log', '--no-merges', '--format=%h %s', `${installed}..${target}`]).split(/\r?\n/).filter(Boolean);
  return ['=== AgentKit update available ===', `Installed: ${version ? `${version} (${installed.slice(0, 7)})` : installed.slice(0, 7)}`, `Available: ${targetName} (${target.slice(0, 7)})`, `What changed (${changes.length} commit${changes.length === 1 ? '' : 's'}):`, ...changes.slice(0, 25).map(c => `  - ${c}`), ...(changes.length > 25 ? [`  ... and ${changes.length - 25} more`] : []), '', 'Agent: do not stop to ask about this. Carry on with the command body below, and in the final', 'report add one line under Next: that an AgentKit update is available and is applied with:', `  node ${JSON.stringify(root + '/setup.ts')}${upgradeArgs}`, `This check runs once per session. Disable it with: node ${JSON.stringify(root + '/tools/get-agentkit-skill.ts')} --set-auto-update Off`, '=== end AgentKit update notice ===', '', ''].join('\n');
}
export function getSkill(command: string, config: { root?: string; home?: string; env?: NodeJS.ProcessEnv; runner?: Runner } = {}): string {
  if (!/^[a-z][a-z0-9-]*$/.test(command)) throw new Error('Invalid AgentKit command name.');
  const env = config.env || process.env, home = config.home || env.HOME || env.USERPROFILE || homedir();
  const root = (config.root || resolveKitRoot(import.meta.url, env, home)).replaceAll('\\', '/'), path = join(root, `skills/${command}/SKILL.md`);
  if (!existsSync(path)) throw new Error(`Unknown AgentKit command '${command}': '${path}' is missing.`);
  let text = readFileSync(path, 'utf8');
  text = text.replace(/node (?:\.\/)?tools\/([\w-]+\.ts)/g, (_, name) => `node ${JSON.stringify(`${root}/tools/${name}`)}`);
  if (command !== 'install-all') for (const relative of ['AGENTS.shared.md', 'INSTALL.md', 'tools/', 'templates/']) text = text.replace(new RegExp('(?<![\\w/\\\\.])(?:\\./)?' + relative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), () => root + '/' + relative);
  text = text.replace(/(?<![\w/\\.])skills\/([a-z0-9-]+)\/SKILL\.md/g, match => root + '/' + match);
  let notice = ''; try { notice = updateNotice(root, home, env, config.runner); } catch { /* Update discovery must never prevent reading a skill. */ }
  return notice + `AgentKit canonical runtime: ${root}\nShared rules: ${root}/AGENTS.shared.md\nKit script root: ${root}/tools/\nKit template root: ${root}/templates/\nProject files remain relative to the calling project. In\n/install-all, old-copy classification and deletion paths are TARGET project paths,\nnever canonical runtime paths. Keep the project working directory when running tools.\nQuote absolute paths when executing commands.\n\n${text}\n`;
}
if (isMain(import.meta.url)) await main(() => {
  const v = parseOptions(options);
  if (v['set-auto-update']) { if (v.command) throw new Error('--command and --set-auto-update are mutually exclusive.'); writeJson(setAutoUpdate(v['set-auto-update'])); }
  else writeJson({ Content: getSkill(v.command || '') });
});
