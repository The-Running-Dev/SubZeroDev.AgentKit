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
  'update-policy': { type: 'string' },
  'snooze-update': { type: 'boolean' },
  'set-auto-update': { type: 'string' },
} as const;
export type UpdatePolicy = 'ask' | 'auto' | 'off';
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const defaultHome = () => process.env.HOME || process.env.USERPROFILE || homedir();
export function readState(path: string): Record<string, any> {
  try { const value = JSON.parse(readFileSync(path, 'utf8')); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
// Passive reads may fall back to defaults. A read before a write must only treat
// ENOENT as empty: an existence probe can also fail for an unreadable file.
export function readStateForWrite(path: string): Record<string, any> {
  let text: string;
  try { text = readFileSync(path, 'utf8'); } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return {};
    throw new Error(`Cannot read '${path}' (${code || 'read error'}). Check its permissions and accessibility, then retry; nothing was written.`);
  }
  // JSON.parse errors can include source bytes; never echo them into diagnostics.
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error(`'${path}' is not valid JSON. Back up and fix it, or move it aside, then retry; nothing was written.`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`'${path}' does not hold a JSON object. Back up and fix it, or move it aside, then retry; nothing was written.`);
  return value as Record<string, any>;
}
export function saveState(path: string, value: object): void {
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}
// ask (the default) shows the update card, auto upgrades before the command, off never checks.
export function updatePolicy(home: string, env = process.env): UpdatePolicy {
  const fromEnv = (env.AGENTKIT_AUTO_UPDATE || '').toLowerCase();
  if (/^(0|off|false|no)$/.test(fromEnv)) return 'off';
  if (fromEnv === 'auto' || fromEnv === 'ask') return fromEnv;
  const config = readState(join(home, '.agent-kit-state/config.json'));
  if (['ask', 'auto', 'off'].includes(config.updatePolicy)) return config.updatePolicy;
  return Object.hasOwn(config, 'autoUpdate') && !config.autoUpdate ? 'off' : 'ask';
}
export function setUpdatePolicy(value: string, home = defaultHome()) {
  const policy = value.toLowerCase();
  if (!['ask', 'auto', 'off'].includes(policy)) throw new Error('--update-policy must be ask, auto or off.');
  const path = join(home, '.agent-kit-state/config.json'), config = readStateForWrite(path);
  delete config.autoUpdate; config.updatePolicy = policy; saveState(path, config);
  return { Message: `AgentKit update policy: ${policy} (${path})` };
}
// The older switch: On keeps the check (ask), Off turns it off.
export function setAutoUpdate(value: string, home = defaultHome()) {
  if (!/^(on|off)$/i.test(value)) throw new Error('--set-auto-update must be On or Off.');
  return setUpdatePolicy(value.toLowerCase() === 'on' ? 'ask' : 'off', home);
}
export function snoozeUpdate(home = defaultHome(), now = Date.now()) {
  const path = join(home, '.agent-kit-state/update-check.json'), until = new Date(now + SNOOZE_MS).toISOString();
  saveState(path, { ...readStateForWrite(path), snoozedUntil: until });
  return { Message: `AgentKit update card snoozed until ${until} (${path})` };
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
export type Upgrader = (root: string, args: string[], env: NodeJS.ProcessEnv) => { ok: boolean; output: string };
export function runSetup(runner: Runner = run): Upgrader {
  return (root, args, env) => {
    const r = runner(process.execPath, [join(root, 'setup.ts'), ...args], { env: { ...env, GIT_TERMINAL_PROMPT: '0' }, timeout: 300000 });
    return { ok: r.found && r.code === 0, output: (r.code === 0 ? r.stdout : r.stderr || r.stdout).trim() };
  };
}
export interface UpdateOptions { command?: string; now?: number; upgrade?: Upgrader }
export function updateNotice(root: string, home: string, env = process.env, runner: Runner = run, opts: UpdateOptions = {}): string {
  const policy = updatePolicy(home, env);
  if (policy === 'off') return '';
  const state = join(home, '.agent-kit-state'), manifest = readState(join(state, 'installed.json'));
  if (!manifest.installRoot || resolve(manifest.installRoot).toLowerCase() !== resolve(root).toLowerCase()) return '';
  const path = join(state, 'update-check.json'), seen = readState(path);
  // A snooze holds the card back without touching the network.
  if (policy === 'ask' && Date.parse(String(seen.snoozedUntil || '')) > (opts.now ?? Date.now())) return '';
  const key = sessionKey(env, runner), sessions: string[] = Array.isArray(seen.sessions) ? seen.sessions.map(String) : [];
  if (sessions.includes(key)) return '';
  try { saveState(path, { ...readStateForWrite(path), sessions: [...sessions, key].slice(-50) }); } catch { /* A read remains usable if state cannot be saved. */ }
  const git = (args: string[], timeout = 20000) => {
    const r = runner('git', ['-C', root, ...args], { env: { ...env, GIT_TERMINAL_PROMPT: '0' }, timeout });
    if (!r.found || r.code !== 0) throw new Error(r.stderr || 'git update check failed');
    return r.stdout.trim();
  };
  const installed = git(['rev-parse', 'HEAD']), version = String(manifest.version || ''), requested = String(manifest.requestedVersion || '');
  let target = '', targetName = '', upgradeArgs: string[] = [];
  if (requested === 'latest stable') {
    targetName = stableTags(git(['ls-remote', '--tags', '--refs', 'origin']).split(/\r?\n/).map(l => l.split(/\s+/, 2)[1]?.replace(/^refs\/tags\//, '') || ''))[0] || '';
    if (targetName) { git(['fetch', '--quiet', 'origin', `+refs/tags/${targetName}:refs/tags/${targetName}`], 60000); target = git(['rev-parse', '--verify', `refs/tags/${targetName}^{commit}`]); }
  } else if (version && !version.startsWith('-') && !/^[0-9a-f]{7,40}$/i.test(version) && !/^v\d{4}\.\d{2}\.\d{2}/.test(version)) {
    git(['fetch', '--quiet', 'origin', `+refs/heads/${version}:refs/remotes/origin/${version}`], 60000);
    targetName = `origin/${version}`; target = git(['rev-parse', '--verify', `refs/remotes/origin/${version}^{commit}`]); upgradeArgs = ['--version', version];
  }
  if (!target || target === installed || runner('git', ['-C', root, 'merge-base', '--is-ancestor', installed, target]).code !== 0) return '';
  const changes = git(['log', '--no-merges', '--format=%h %s', `${installed}..${target}`]).split(/\r?\n/).filter(Boolean);
  const installedName = version ? `${version} (${installed.slice(0, 7)})` : installed.slice(0, 7), available = `${targetName} (${target.slice(0, 7)})`;
  const head = [`Installed: ${installedName}`, `Available: ${available}`, `What changed (${changes.length} commit${changes.length === 1 ? '' : 's'}):`, ...changes.slice(0, 25).map(c => `  - ${c}`), ...(changes.length > 25 ? [`  ... and ${changes.length - 25} more`] : []), ''];
  const reader = `node ${JSON.stringify(root + '/tools/get-agentkit-skill.ts')}`, setup = [`node ${JSON.stringify(root + '/setup.ts')}`, ...upgradeArgs.map(a => a.startsWith('--') ? a : JSON.stringify(a))].join(' ');
  const end = ['=== end AgentKit update notice ===', '', ''];
  if (policy === 'auto') {
    const result = (opts.upgrade || runSetup(runner))(root, upgradeArgs, env);
    if (result.ok) return ['=== AgentKit updated ===', ...head, 'Automatic upgrades are on, so the command body below is already the new version.', 'Agent: do not stop for this. Mention the upgrade in one line of the final report.', `Back to asking first: ${reader} --update-policy ask`, ...end].join('\n');
    return ['=== AgentKit update available ===', ...head, 'The automatic upgrade failed, so this command runs on the installed version. Its error:', ...(result.output || 'setup.ts printed no error text.').split(/\r?\n/).map(l => `  ${l}`), '', 'Agent: do not stop for this. Carry on with the command body below, and in the final report', 'add one line under Next: with that error and the command that applies the update:', `  ${setup}`, ...end].join('\n');
  }
  return ['=== AgentKit update available ===', ...head,
    'Agent: before the command body below, ask the user this one question as a card',
    '(AGENTS.shared.md § Asking the user), run what the answer says, then carry on.',
    `  Question: AgentKit ${targetName} is available (you have ${version || installed.slice(0, 7)}). Upgrade now?`,
    '  Header: Update',
    '  Recommendation: Not now, so this session stays on the version it just loaded.',
    '  1. Not now (Recommended) — Snooze this for 24 hours and continue on the current version.',
    `     Runs: ${reader} --snooze-update`,
    "  2. Upgrade now — Upgrade before continuing; this command's instructions may change mid-session.",
    `     Runs: ${setup}`,
    '  3. Always keep me up to date — Turn on automatic upgrades, then upgrade now.',
    `     Runs: ${reader} --update-policy auto, then ${setup}`,
    '  4. Never ask again — Turn off update checks.',
    `     Runs: ${reader} --update-policy off`,
    `After an upgrade, reload: run ${reader} --command ${opts.command || '<this command>'}, re-read AGENTS.shared.md,`,
    'and follow the reloaded command body instead of the one below. If setup fails, give its error in full and',
    'carry on below with the installed version.',
    'Where the user cannot be asked — a non-interactive run — do not wait: carry on below, and in the final report',
    'add one line under Next: that this update is available and is applied with:',
    `  ${setup}`, ...end].join('\n');
}
export function getSkill(command: string, config: { root?: string; home?: string; env?: NodeJS.ProcessEnv; runner?: Runner; now?: number; upgrade?: Upgrader } = {}): string {
  if (!/^[a-z][a-z0-9-]*$/.test(command)) throw new Error('Invalid AgentKit command name.');
  const env = config.env || process.env, home = config.home || env.HOME || env.USERPROFILE || homedir();
  const root = (config.root || resolveKitRoot(import.meta.url, env, home)).replaceAll('\\', '/'), path = join(root, `skills/${command}/SKILL.md`);
  if (!existsSync(path)) throw new Error(`Unknown AgentKit command '${command}': '${path}' is missing.`);
  // Checked before the skill is read, so an automatic upgrade hands back the upgraded skill.
  let notice = ''; try { notice = updateNotice(root, home, env, config.runner, { command, now: config.now, upgrade: config.upgrade }); } catch { /* Update discovery must never prevent reading a skill. */ }
  let text = readFileSync(path, 'utf8');
  text = text.replace(/node (?:\.\/)?tools\/([\w-]+\.ts)/g, (_, name) => `node ${JSON.stringify(`${root}/tools/${name}`)}`);
  if (command !== 'install-all') for (const relative of ['AGENTS.shared.md', 'INSTALL.md', 'tools/', 'templates/']) text = text.replace(new RegExp('(?<![\\w/\\\\.])(?:\\./)?' + relative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), () => root + '/' + relative);
  text = text.replace(/(?<![\w/\\.])skills\/([a-z0-9-]+)\/SKILL\.md/g, match => root + '/' + match);
  return notice + `AgentKit canonical runtime: ${root}\nShared rules: ${root}/AGENTS.shared.md\nKit script root: ${root}/tools/\nKit template root: ${root}/templates/\nProject files remain relative to the calling project. In\n/install-all, old-copy classification and deletion paths are TARGET project paths,\nnever canonical runtime paths. Keep the project working directory when running tools.\nQuote absolute paths when executing commands.\n\n${text}\n`;
}
if (isMain(import.meta.url)) await main(() => {
  const v = parseOptions(options);
  const chosen = (['command', 'update-policy', 'snooze-update', 'set-auto-update'] as const).filter(name => v[name]);
  if (chosen.length > 1) throw new Error(`--${chosen.join(' and --')} are mutually exclusive.`);
  if (v['update-policy']) writeJson(setUpdatePolicy(v['update-policy']));
  else if (v['snooze-update']) writeJson(snoozeUpdate());
  else if (v['set-auto-update']) writeJson(setAutoUpdate(v['set-auto-update']));
  else writeJson({ Content: getSkill(v.command || '') });
});
