import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync, mkdtempSync } from 'node:fs';
import { resolve, join, dirname, parse, relative, isAbsolute } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { findExecutable } from './lib/executable.ts';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';
import { stableTags } from './get-agentkit-skill.ts';

export const options = {
  version: { type: 'string' }, source: { type: 'string' }, hosts: { type: 'string', multiple: true },
  prefix: { type: 'string' }, 'dry-run': { type: 'boolean' }, uninstall: { type: 'boolean' },
  force: { type: 'boolean' }, verify: { type: 'boolean' }, 'register-only': { type: 'boolean' },
  'previous-commit': { type: 'string' }, 'requested-version': { type: 'string' },
} as const;
export type Host = 'claude' | 'codex' | 'copilot';
export interface InstallOptions {
  version?: string; source?: string; hosts?: Host[]; prefix?: string; dryRun?: boolean;
  uninstall?: boolean; force?: boolean; verify?: boolean; registerOnly?: boolean;
  previousCommit?: string; requestedVersion?: string;
}
export interface Registration { host: Host; name: string; path: string; root: string; kind: string; files?: Record<string, string>; target?: string }
export interface Manifest {
  schemaVersion?: number; installRoot?: string; source?: string; requestedVersion?: string; version?: string;
  commit?: string; previousCommit?: string; registrations?: Registration[]; hooksManaged?: boolean;
  pointerBlocks?: Record<string, string>; hosts?: Partial<Record<Host, string[]>>; pointers?: Record<string, string>;
}
export interface InstallResult { State: string; Root: string; Collisions: string[]; Operations: string[]; [key: string]: unknown }
export const publicSource = 'https://github.com/The-Running-Dev/SubZeroDev.AgentKit.git';
export const pointerStart = '<!-- agentkit-pointer:start -->', pointerEnd = '<!-- agentkit-pointer:end -->';
export const pointer = `${pointerStart}\nAgentKit shared rules: read AGENTS.shared.md, resolved from AGENTKIT_HOME if set else the home directory's .agent-kit, only when running an AgentKit command; each command's own skill file names the exact reads it needs.\n${pointerEnd}`;
const forward = (path: string) => path.replaceAll('\\', '/');
export const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex').toUpperCase();
const stat = (path: string) => { try { return lstatSync(path); } catch { return undefined; } };
const read = (path: string) => readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
// PowerShell's pipeline serialized one hook group as an object in older releases.
const hookGroups = (value: unknown): unknown[] => value == null ? [] : Array.isArray(value) ? value : [value];
export function normalizeOrigin(value: string) {
  const m = /^(?:https:\/\/github\.com\/|git@github\.com:)(.+?)(?:\.git)?\/?$/i.exec(value);
  return m ? 'github:' + m[1].replace(/\/$/, '').toLowerCase() : existsSync(value) ? resolve(value).replace(/[\\/]+$/, '') : value.replace(/\/+$/, '');
}
export function owned(entry: Registration, root: string): boolean {
  if (entry.root !== root) return false;
  const item = stat(entry.path); if (!item) return false;
  if (entry.kind === 'link') return item.isSymbolicLink() && !!entry.target && resolve(dirname(entry.path), readlinkSync(entry.path)) === resolve(entry.target);
  if (item.isSymbolicLink() || !item.isDirectory() || !entry.files) return false;
  const files = readdirSync(entry.path, { withFileTypes: true });
  return files.length === Object.keys(entry.files).length && files.every(file => file.isFile() && Object.hasOwn(entry.files!, file.name) && hash(readFileSync(join(entry.path, file.name))) === entry.files![file.name]);
}
export function hook(root: string, legacy = false) {
  return { hooks: [{ type: 'command', command: legacy ? 'pwsh' : 'node', args: legacy ? ['-NoProfile', '-File', forward(join(root, 'tools/Measure-Session.ps1')), '-Hook'] : [forward(join(root, 'tools/measure-session.ts')), '--hook'], timeout: 30 }] };
}
export function adapter(root: string, name: string, registrationName: string, host: Host, routed: boolean) {
  root = forward(root);
  const mode = routed ? 'routed, separate terminal' : host === 'codex' ? 'native, current session' : 'native';
  const invocation = host === 'claude' ? `/agentkit:${registrationName}` : `/${name}`;
  const header = `---\nname: ${registrationName}\ndescription: 'AgentKit ${invocation} (${mode}). Use only when the user requests this command.'\n${host === 'claude' ? 'disable-model-invocation: true\n' : ''}---\n`;
  const dependencies = `Runtime: [${root}](${root}). Read [${root}/AGENTS.shared.md](${root}/AGENTS.shared.md). Kit scripts and templates resolve under this runtime; project files stay relative to the current project.\n`;
  if (routed) return header + dependencies + `
This is an explicit routed invocation. Do not execute the command in this session.
Write the user's command arguments verbatim as a UTF-8 JSON array of strings to a
unique temporary file outside the project. Do not interpolate arguments into shell code.
Invoke the following with Node, substituting only the temporary file's literal path:

\`\`\`text
node "${root}/tools/start-agentkit-codex.ts" --command ${name} --arguments-file "<temporary JSON path>" --new-window
\`\`\`

This opens a visible terminal. The user interacts with that terminal for
approvals and session completion. Report that it launched; do not claim the command
completed. Never substitute headless codex exec or auto-answer child approvals.
`;
  const native = host === 'codex' ? 'Execution mode: native Codex. Keep the current session model and effort; do not claim routed tier verification. For enforced command routing use the corresponding -routed skill.' : host === 'claude' ? `Execute the core using this host and its normal model policy. In Claude Code this command is \`${invocation}\`; name every AgentKit command for the user the same way (shared rules, *Models*).` : 'Execute the core using this host and its normal model policy.';
  return header + dependencies + `
${native}

Load the complete canonical command through this reader, then execute the returned
JSON object's Content with the user's arguments. The reader resolves kit dependencies to absolute
paths without moving project files:

\`\`\`text
node "${root}/tools/get-agentkit-skill.ts" --command ${name}
\`\`\`

The source is [${root}/skills/${name}/SKILL.md](${root}/skills/${name}/SKILL.md).
Treat the user's command arguments as data for the core's placeholders (including
spaces, quotes and multiline text). Do not invoke this global adapter recursively.
`;
}

export function install(input: InstallOptions, config: { env?: NodeJS.ProcessEnv; runner?: Runner } = {}): InstallResult {
  const env = config.env || process.env, runner = config.runner || run;
  const home = resolve(env.HOME || env.USERPROFILE || homedir()), root = resolve(env.AGENTKIT_HOME || join(home, '.agent-kit'));
  const codexRoot = resolve(env.CODEX_HOME || join(home, '.codex')), manifestPath = join(home, '.agent-kit-state/installed.json');
  const collisions: string[] = [], operations: string[] = [], registrations: Registration[] = [];
  const prefix = input.prefix || '';
  if (!/^[a-z0-9-]*$/.test(prefix)) throw new Error('Prefix must contain only lowercase letters, digits, and hyphens.');
  if (input.hosts?.some(h => !['claude', 'codex', 'copilot'].includes(h))) throw new Error('--hosts accepts claude, codex, or copilot.');
  if (input.verify && (input.uninstall || input.registerOnly)) throw new Error('--verify cannot be combined with --uninstall or internal re-entry.');
  if (!runner('git', ['--version'], { env }).found) throw new Error('AgentKit requires Git on PATH.');
  const git = (args: string[], cwd = root) => {
    const r = runner('git', ['-C', cwd, ...args], { env });
    if (r.code !== 0) throw new Error(`git ${args.join(' ')} failed (exit ${r.code}): ${r.stdout}${r.stderr}`);
    return r.stdout.trim();
  };
  const gitOK = (args: string[]) => runner('git', ['-C', root, ...args], { env }).code === 0;
  const plan = (message: string) => operations.push((input.dryRun ? '[DryRun] ' : '') + message);
  // Every write is journaled so a failed run can put back exactly what it changed;
  // otherwise its unrecorded writes read as foreign collisions on the next run.
  const undo: (() => void)[] = [];
  const makeDirectory = (dir: string) => {
    const created: string[] = []; for (let d = dir; !existsSync(d); d = dirname(d)) created.push(d);
    mkdirSync(dir, { recursive: true }); undo.push(() => created.forEach(d => rmdirSync(d)));
  };
  const write = (path: string, text: string | Buffer) => {
    makeDirectory(dirname(path));
    const before = existsSync(path) ? readFileSync(path) : undefined;
    writeFileSync(path, text); undo.push(() => before ? writeFileSync(path, before) : unlinkSync(path));
  };
  const rollback = () => {
    const failed: string[] = [];
    for (const step of undo.splice(0).reverse()) try { step(); } catch (error) { failed.push(error instanceof Error ? error.message : String(error)); }
    return failed;
  };
  const rolledBack = (failed: string[]) => failed.length ? ` Rollback was incomplete: ${failed.join('; ')}` : ' Changes from this run were rolled back.';
  const save = (path: string, text: string) => {
    if (input.dryRun || (existsSync(path) && readFileSync(path, 'utf8') === text)) return;
    write(path, text);
  };
  const collision = (path: string) => { if (!collisions.includes(path)) collisions.push(path); plan(`Foreign or modified entry '${path}' already exists - skipped and left unchanged.`); };
  const result = (State: string, details: Record<string, unknown> = {}): InstallResult => ({ State, Root: root, Collisions: collisions, Operations: operations, ...details });
  const manifest: Manifest = existsSync(manifestPath) ? JSON.parse(read(manifestPath)) : {};
  if (manifest.installRoot && manifest.installRoot !== root) throw new Error(`Manifest belongs to '${manifest.installRoot}', not '${root}'. Use that AGENTKIT_HOME first.`);
  const source = input.source || manifest.source || publicSource;
  if ([parse(root).root, home, codexRoot].includes(root)) throw new Error(`Unsafe install root '${root}'. Choose a dedicated AgentKit directory.`);
  const exists = stat(join(root, '.git'))?.isDirectory();
  if (existsSync(root)) {
    if (!exists) {
      if (!stat(root)?.isDirectory() || readdirSync(root).length) throw new Error(`Install root '${root}' is occupied and is not an AgentKit checkout.`);
    } else if ((!existsSync(join(root, 'tools/install-agentkit.ts')) && !existsSync(join(root, 'tools/Install-AgentKit.ps1'))) || !existsSync(join(root, 'AGENTS.shared.md'))) throw new Error(`Install root '${root}' is not an AgentKit checkout.`);
  }
  if (exists && !input.verify) {
    const origin = git(['remote', 'get-url', 'origin']);
    if (normalizeOrigin(origin) !== normalizeOrigin(source)) {
      if (!input.force || input.uninstall) throw new Error(`Wrong origin '${origin}'; expected '${source}'. Explicit --source and --force are required to re-point a checkout.`);
      plan(`Re-point origin '${origin}' to '${source}'.`); if (!input.dryRun) git(['remote', 'set-url', 'origin', source]);
    }
  }
  const hostRoot = (host: Host) => host === 'codex' ? codexRoot : join(home, '.' + host);
  const rulesPath = (host: Host) => join(hostRoot(host), { claude: 'CLAUDE.md', codex: 'AGENTS.md', copilot: 'copilot-instructions.md' }[host]);
  const pluginRoot = join(hostRoot('claude'), 'skills/agentkit');
  const oldRegistrations = [...(manifest.registrations || [])];
  if (!manifest.registrations && manifest.hosts) for (const [host, names] of Object.entries(manifest.hosts)) for (const name of names) {
    const path = join(hostRoot(host as Host), 'skills', name);
    if (stat(path)?.isSymbolicLink()) {
      const target = resolve(dirname(path), readlinkSync(path));
      if (dirname(target) === join(root, 'skills')) oldRegistrations.push({ host: host as Host, name, path, root, kind: 'link', target });
    }
  }
  const removeRegistration = (entry: Registration) => {
    if (!stat(entry.path)) return;
    if (!owned(entry, root)) { collision(entry.path); return; }
    plan(`Remove managed registration '${entry.path}'.`);
    if (input.dryRun) return;
    if (entry.kind === 'link') {
      const target = resolve(dirname(entry.path), readlinkSync(entry.path));
      unlinkSync(entry.path); undo.push(() => symlinkSync(target, entry.path, 'junction'));
    } else {
      const files = Object.keys(entry.files!).map(file => [join(entry.path, file), readFileSync(join(entry.path, file))] as const);
      for (const [path] of files) unlinkSync(path);
      rmdirSync(entry.path); undo.push(() => { mkdirSync(entry.path, { recursive: true }); for (const [path, bytes] of files) writeFileSync(path, bytes); });
    }
    const stop = join(hostRoot(entry.host), 'skills'); let parent = dirname(entry.path);
    while (parent !== stop && !relative(stop, parent).startsWith('..') && !isAbsolute(relative(stop, parent)) && stat(parent)?.isDirectory() && !readdirSync(parent).length) { const dir = parent; rmdirSync(dir); undo.push(() => mkdirSync(dir)); parent = dirname(parent); }
  };
  const pointerBlocks = { ...manifest.pointerBlocks };
  const pattern = /<!-- agentkit-pointer:start -->.*?<!-- agentkit-pointer:end -->/gs;
  const updatePointer = (path: string, remove = false) => {
    const text = existsSync(path) ? read(path) : '', matches = [...text.matchAll(pattern)];
    if (matches.length > 1 || text.includes(pointerStart) !== text.includes(pointerEnd)) { collision(path); return; }
    let updated: string;
    if (matches.length) {
      const block = matches[0][0];
      const legacy = `${pointerStart}\nAgentKit shared rules, installed at '${root}'. Regenerated by tools/Install-AgentKit.ps1 -\nedit outside this block, never inside it.\n\n@${forward(root)}/AGENTS.md\n${pointerEnd}`;
      if (block !== manifest.pointerBlocks?.[path] && block.replaceAll('\r\n', '\n') !== legacy) { collision(path); return; }
      updated = text.slice(0, matches[0].index) + (remove ? '' : pointer) + text.slice(matches[0].index! + block.length);
    } else { if (remove) return; updated = text + (text && !text.endsWith('\n') ? '\n' : '') + pointer + '\n'; }
    save(path, updated); if (!remove) pointerBlocks[path] = pointer;
  };
  const hooksPath = join(home, '.claude/settings.json');
  const updateHooks = (remove = false) => {
    const settings = existsSync(hooksPath) ? JSON.parse(read(hooksPath)) : {};
    settings.hooks ||= {};
    const signatures = [hook(root), hook(root, true)].map(h => JSON.stringify(h));
    const kept = hookGroups(settings.hooks.SessionEnd).filter(h => h && !signatures.includes(JSON.stringify(h)));
    settings.hooks.SessionEnd = remove ? kept : [...kept, hook(root)];
    if (settings.hooks.UserPromptSubmit) {
      const watch = hookGroups(settings.hooks.UserPromptSubmit).filter(h => { const text = JSON.stringify(h); return !(text.includes(forward(join(root, 'tools/Measure-Session.ps1'))) && text.includes('-Watch')); });
      if (watch.length) settings.hooks.UserPromptSubmit = watch; else delete settings.hooks.UserPromptSubmit;
    }
    const json = JSON.stringify(settings, null, 2);
    if (existsSync(hooksPath) && read(hooksPath) !== json && !input.dryRun) {
      const old = readFileSync(hooksPath, 'utf8'), backup = `${hooksPath}.agentkit-${hash(old)}.bak`;
      if (!existsSync(backup)) write(backup, old);
    }
    save(hooksPath, json);
  };
  if (input.verify) {
    const Issues: string[] = [], Notes: string[] = [];
    if (!Object.keys(manifest).length) return result('NotInstalled', { Issues: [`No AgentKit manifest found at '${manifestPath}'. Nothing installed for this profile.`], Notes });
    if (!exists) Issues.push(`Canonical checkout missing at '${root}'.`);
    else {
      const origin = git(['remote', 'get-url', 'origin']), sha = git(['rev-parse', 'HEAD']);
      if (normalizeOrigin(origin) !== normalizeOrigin(source)) Issues.push(`Origin '${origin}' does not match recorded source '${source}'.`);
      if (git(['status', '--porcelain'])) Issues.push('Checkout has uncommitted changes.');
      if (manifest.commit && manifest.commit !== sha) Issues.push(`HEAD (${sha}) does not match manifest recorded commit (${manifest.commit}).`);
    }
    if (!manifest.registrations?.length) Notes.push('No host registrations recorded.');
    for (const host of new Set(manifest.registrations?.map(r => r.host))) {
      const entries = manifest.registrations!.filter(r => r.host === host), ok = entries.filter(r => owned(r, root)).length;
      if (ok !== entries.length) Issues.push(`${host}: ${entries.length - ok} registration(s) changed outside AgentKit.`);
    }
    for (const [path, block] of Object.entries(pointerBlocks)) {
      if (!existsSync(path)) { Issues.push(`Pointer file missing: '${path}'.`); continue; }
      const match = [...read(path).matchAll(pattern)][0];
      if (!match) Issues.push(`Pointer block missing from '${path}'.`);
      else if (match[0] !== block) Notes.push(`Pointer block at '${path}' was customized after install (preserved, not an error).`);
    }
    if (manifest.hooksManaged) {
      if (!existsSync(hooksPath)) Issues.push(`Hooks are managed but '${hooksPath}' does not exist.`);
      else if (!hookGroups(JSON.parse(read(hooksPath)).hooks?.SessionEnd).some(h => JSON.stringify(h) === JSON.stringify(hook(root)))) Issues.push(`Expected SessionEnd hook entry missing from '${hooksPath}'.`);
    }
    return result(Issues.length ? 'Unhealthy' : 'OK', { Issues, Notes });
  }
  if (input.uninstall) {
    oldRegistrations.forEach(removeRegistration);
    if (manifest.hooksManaged) updateHooks(true);
    new Set([...Object.keys(pointerBlocks), ...Object.values(manifest.pointers || {})]).forEach(path => updatePointer(path, true));
    if (!input.dryRun && existsSync(manifestPath)) unlinkSync(manifestPath);
    if (input.force && exists) { plan(`Delete validated canonical checkout '${root}' (--force).`); if (!input.dryRun) rmSync(root, { recursive: true, force: true }); }
    return result('Uninstalled');
  }
  if (!input.registerOnly) {
    const previous = exists ? git(['rev-parse', 'HEAD']) : '';
    const previousBranch = exists ? runner('git', ['-C', root, 'symbolic-ref', '-q', '--short', 'HEAD'], { env }).stdout.trim() : '';
    if (exists) {
      if (git(['status', '--porcelain'])) {
        if (!input.force) throw new Error(`'${root}' has uncommitted changes. Commit, stash, or explicitly use --force to discard them.`);
        plan(`Discard uncommitted changes at '${root}' (--force).`);
        if (!input.dryRun) { git(['reset', '--hard', 'HEAD']); git(['clean', '-fd']); }
      }
      plan(`Fetch tags and branches at '${root}'.`);
      if (!input.dryRun) git(['fetch', 'origin', '--tags', '--prune', '+refs/heads/*:refs/remotes/origin/*']);
    } else {
      plan(`Clone '${source}' into '${root}'.`);
      if (!input.dryRun) { mkdirSync(dirname(root), { recursive: true }); git(['clone', '--origin', 'origin', source, root], dirname(root)); }
    }
    if (input.dryRun && !exists) return result('DryRun', { RequestedVersion: input.version || 'latest stable', Detail: 'Tags unresolved until clone. No files written.' });
    const tags = () => input.dryRun ? git(['tag', '--list']).split(/\r?\n/) : git(['ls-remote', '--tags', '--refs', 'origin']).split(/\r?\n/).map(l => l.split(/\s+/, 2)[1]?.replace(/^refs\/tags\//, '') || '');
    const version = input.version || stableTags(tags())[0];
    if (!version) throw new Error('No valid stable release tag exists. Use --version main only to opt into unreleased work.');
    if (version.startsWith('-')) throw new Error('Version must be a tag, branch, or SHA, not a Git option.');
    const isTag = gitOK(['show-ref', '--verify', '--quiet', `refs/tags/${version}`]);
    const isBranch = !isTag && gitOK(['show-ref', '--verify', '--quiet', `refs/remotes/origin/${version}`]);
    const ref = isTag ? `refs/tags/${version}` : isBranch ? `refs/remotes/origin/${version}` : version;
    const sha = git(['rev-parse', '--verify', `${ref}^{commit}`]);
    const nodeTarget = gitOK(['cat-file', '-e', `${sha}:setup.ts`]);
    if (!nodeTarget && !gitOK(['cat-file', '-e', `${sha}:setup.ps1`])) throw new Error(`Version '${version}' (${sha}) predates the global front door. Publish a release containing this change after merge, or explicitly use --version main for unreleased work.`);
    // Probe BEFORE checkout: a rollback must not leave a PowerShell-only runtime on a Node-only machine.
    const legacyShell = nodeTarget ? null : findExecutable('pwsh', env);
    if (!nodeTarget && !legacyShell) throw new Error(`Version '${version}' requires missing pwsh on PATH. Install PowerShell to roll back to this older release; checkout and registrations were not changed.`);
    if (isBranch && gitOK(['show-ref', '--verify', '--quiet', `refs/heads/${version}`]) && !gitOK(['merge-base', '--is-ancestor', `refs/heads/${version}`, sha])) throw new Error(`Local branch '${version}' has unpublished or divergent commits; not resetting it. Previous commit: ${previous}.`);
    plan(`Requested: ${input.version || 'latest stable'}; resolved: ${version} (${sha}).`);
    if (input.dryRun) return result('DryRun', { Version: version, Commit: sha, Detail: 'Checkout and refresh selected managed registrations, hooks and shared pointers; no files written.' });
    const branchTip = isBranch && gitOK(['show-ref', '--verify', '--quiet', `refs/heads/${version}`]) ? git(['rev-parse', `refs/heads/${version}`]) : '';
    // Puts HEAD, and any local branch this run created or advanced, back where they were.
    const restore = () => {
      git(['checkout', '--detach', previous]);
      if (isBranch) { if (branchTip) git(['update-ref', `refs/heads/${version}`, branchTip]); else git(['branch', '-D', version]); }
      if (previousBranch) git(['checkout', previousBranch]);
    };
    if (isBranch) { git(['checkout', version]); git(['merge', '--ff-only', sha]); } else git(['checkout', '--detach', sha]);
    const selected: InstallOptions = { version, source, prefix, registerOnly: true, previousCommit: previous, requestedVersion: input.version || 'latest stable', ...(input.hosts ? { hosts: input.hosts } : {}) };
    try {
      let child;
      if (nodeTarget) child = runner(process.execPath, [join(root, 'tools/install-agentkit.ts'), ...installArguments(selected)], { env });
      else {
        // Older installers cannot recognize the Node hook. Retire our owned
        // entry before letting that release register its own runtime hooks.
        if (manifest.hooksManaged) updateHooks(true);
        // A constant loader and JSON data preserve Hosts arrays and quotes at the process boundary.
        const temp = mkdtempSync(join(tmpdir(), 'agentkit-rollback-')), payload = join(temp, 'arguments.json'), loader = join(temp, 'load.ps1');
        writeFileSync(payload, JSON.stringify({ root, home, selected }));
        writeFileSync(loader, `$ErrorActionPreference = 'Stop'\n$data = Get-Content -LiteralPath $env:AGENTKIT_ROLLBACK_ARGUMENTS -Raw | ConvertFrom-Json\nSet-Variable HOME -Value $data.home -Force\n$p = @{Version=$data.selected.version; Source=$data.selected.source; Prefix=$data.selected.prefix; RegisterOnly=$true; PreviousCommit=$data.selected.previousCommit; RequestedVersion=$data.selected.requestedVersion}\nif ($data.selected.hosts) { $p.Hosts = [string[]]$data.selected.hosts }\n& (Join-Path $data.root 'tools/Install-AgentKit.ps1') @p\nif (-not $?) { exit 1 }\n`);
        try { child = runner(legacyShell!, ['-NoProfile', '-File', loader], { env: { ...env, AGENTKIT_ROLLBACK_ARGUMENTS: payload } }); }
        finally { rmSync(temp, { recursive: true, force: true }); }
      }
      if (child.code !== 0) throw new Error(child.stderr || child.stdout || `Selected installer exited ${child.code}.`);
      if (child.stderr) process.stderr.write(child.stderr);
      if (!nodeTarget) return result('Installed', { Version: version, Commit: sha, LegacyOutput: child.stdout });
      const installed: InstallResult = JSON.parse(child.stdout);
      return { ...installed, Operations: [...operations, ...installed.Operations] };
    } catch (error) {
      // The selected installer rolls back its own writes (from this release on); this process undoes its own and the checkout.
      const failed = rollback(), detail = `${failed.length ? rolledBack(failed).trim() + ' ' : ''}Error: ${error instanceof Error ? error.message : error}`;
      if (!previous) throw new Error(`Setup failed after cloning ${sha}. The new checkout stays at '${root}' and a re-run reuses it. ${detail}`);
      try { restore(); } catch (failure) {
        throw new Error(`Setup failed after selecting ${sha}, and restoring previous commit ${previous} also failed: ${failure instanceof Error ? failure.message : failure} Restore it by hand with: git -C "${forward(root)}" checkout --detach ${previous}. ${detail}`);
      }
      throw new Error(`Setup failed after selecting ${sha}; restored the checkout to previous commit ${previous}. ${detail}`);
    }
  }
  try {
    for (const path of ['AGENTS.shared.md', 'templates', 'tools/invoke-codex-command.ts', 'tools/start-agentkit-codex.ts', 'tools/get-agentkit-skill.ts']) if (!existsSync(join(root, path))) throw new Error(`Incomplete runtime: missing '${path}'.`);
    const skills = readdirSync(join(root, 'skills'), { withFileTypes: true }).filter(s => s.isDirectory() && existsSync(join(root, 'skills', s.name, 'SKILL.md'))).map(s => s.name).sort();
    const hosts = [...new Set(input.hosts?.length ? input.hosts : (['claude', 'codex', 'copilot'] as Host[]).filter(h => existsSync(hostRoot(h)) || findExecutable(h, env) || (h === 'copilot' && existsSync(join(home, '.agents')))))];
    if (!hosts.length) plan('No supported host detected. Pass --hosts claude, codex, or copilot explicitly.');
    registrations.push(...oldRegistrations.filter(r => !hosts.includes(r.host)));
    const registerFiles = (host: Host, name: string, path: string, content: Record<string, string>) => {
      const files = { ...content, '.agentkit-owner': `AgentKit registration\nRoot: ${root}\nHost: ${host}\nName: ${name}\n` };
      plan(`Register ${host}/${name} -> ${root}`);
      for (const [name, text] of Object.entries(files)) save(join(path, name), text);
      registrations.push({ host, name, path, root, kind: 'files', files: Object.fromEntries(Object.entries(files).map(([name, text]) => [name, hash(text)])) });
    };
    for (const host of hosts) {
      const desired: string[] = [];
      if (host === 'claude') {
        const path = join(pluginRoot, '.claude-plugin'), old = oldRegistrations.find(r => r.path === path);
        if (existsSync(pluginRoot) && !(old && owned(old, root))) {
          collision(pluginRoot); registrations.push(...oldRegistrations.filter(r => r.host === host)); updatePointer(rulesPath(host)); continue;
        }
        desired.push(path);
        registerFiles(host, 'agentkit', path, { 'plugin.json': JSON.stringify({ name: 'agentkit', description: "AgentKit commands, namespaced /agentkit:<command> so they never reach Claude Code's own commands. Generated by tools/install-agentkit.ts; edit the canonical kit, not these files." }, null, 2) + '\n' });
      }
      for (const skill of skills) for (const routed of host === 'codex' ? [false, true] : [false]) {
        const name = prefix + skill + (routed ? '-routed' : ''), path = join(host === 'claude' ? pluginRoot : hostRoot(host), 'skills', name);
        desired.push(path); const old = oldRegistrations.find(r => r.path === path), item = stat(path);
        if (item && !(old && owned(old, root))) { collision(path); if (old) registrations.push(old); continue; }
        if (item && old?.kind === 'link') removeRegistration(old);
        registerFiles(host, name, path, { 'SKILL.md': adapter(root, skill, name, host, routed) });
      }
      oldRegistrations.filter(r => r.host === host && !desired.includes(r.path)).forEach(removeRegistration);
      updatePointer(rulesPath(host));
    }
    if (hosts.includes('claude')) updateHooks();
    const sha = git(['rev-parse', 'HEAD']);
    const next: Manifest = { schemaVersion: 2, installRoot: root, source, requestedVersion: input.requestedVersion || '', version: input.version || '', commit: sha, previousCommit: manifest.commit === sha ? manifest.previousCommit || '' : input.previousCommit || '', registrations, hooksManaged: hosts.includes('claude') || !!manifest.hooksManaged, pointerBlocks };
    save(manifestPath, JSON.stringify(next, null, 2));
    if (!input.dryRun) for (const entry of registrations) if (!collisions.includes(entry.path) && !owned(entry, root)) throw new Error(`Registration verification failed: ${entry.path}`);
    return result(input.dryRun ? 'DryRun' : 'Installed', { Source: source, RequestedVersion: next.requestedVersion, Version: next.version, Commit: sha, Hosts: hosts, Registrations: registrations, Verified: 'Canonical runtime dependencies and owned registration bytes. Restart hosts for discovery; host execution is not claimed by setup.' });
  } catch (error) { throw new Error(`${error instanceof Error ? error.message : error}${rolledBack(rollback())}`); }
}
export function installArguments(input: InstallOptions): string[] {
  const args: string[] = [];
  for (const [key, flag] of [['version', 'version'], ['source', 'source'], ['prefix', 'prefix'], ['previousCommit', 'previous-commit'], ['requestedVersion', 'requested-version']] as const) if (input[key] !== undefined) args.push('--' + flag, input[key]!);
  for (const [key, flag] of [['dryRun', 'dry-run'], ['uninstall', 'uninstall'], ['force', 'force'], ['verify', 'verify'], ['registerOnly', 'register-only']] as const) if (input[key]) args.push('--' + flag);
  for (const host of input.hosts || []) args.push('--hosts', host);
  return args;
}
export function cli(args = process.argv.slice(2)) {
  try {
    const v = parseOptions(options, args);
    const result = install({ version: v.version, source: v.source, hosts: v.hosts?.flatMap(h => h.split(',')) as Host[] | undefined, prefix: v.prefix, dryRun: v['dry-run'], uninstall: v.uninstall, force: v.force, verify: v.verify, registerOnly: v['register-only'], previousCommit: v['previous-commit'], requestedVersion: v['requested-version'] });
    writeJson(result); if (['NotInstalled', 'Unhealthy'].includes(result.State)) process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : error}\n`); process.exitCode = 1; }
}
if (isMain(import.meta.url)) await main(() => cli());
