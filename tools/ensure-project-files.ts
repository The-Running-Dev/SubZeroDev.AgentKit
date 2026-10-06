import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseOptions } from './lib/options.ts';
import { resolveKitRoot } from './lib/kit-root.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';
import { run } from './lib/process.ts';

// Each command creates the repository files it needs on first use, so a repository never needs
// an install step before its first command. Nothing here overwrites content it did not write.
export const options = {
  'repo-root': { type: 'string' }, design: { type: 'string', multiple: true }, pointer: { type: 'boolean' },
  hook: { type: 'boolean' }, 'kit-root': { type: 'string' }, quiet: { type: 'boolean' },
} as const;

export const pointerText = '**Read `AGENTS.shared.md` completely before this file.** It holds the rules every repository using the kit shares, resolved from the `AGENTKIT_HOME` environment variable if set, else `.agent-kit` in the home directory.';
const pointerSection = `## Shared contract\n\n${pointerText}\n`;

export interface Entry { Path: string; Status: string; Detail?: string }
export interface Report { Design: Entry[]; Pointer: Entry | null; Hook: Entry | null; Written: string[] }

const read = (path: string) => readFileSync(path, 'utf8').replace(/^﻿/, '');

export function ensureDesign(root: string, kitRoot: string, names: string[]): Entry[] {
  const templateDir = join(kitRoot, 'templates/design');
  const seeds = readdirSync(templateDir).filter(f => /\.md$/i.test(f));
  for (const name of names) if (!seeds.includes(name)) throw new Error(`'${name}' is not a design seed. Seeds: ${seeds.join(', ')}.`);
  const designDir = join(root, 'design');
  if (existsSync(designDir)) {
    const occupied = !statSync(designDir).isDirectory()
      || (readdirSync(designDir).length > 0 && !readdirSync(designDir).some(e => seeds.includes(e)));
    if (occupied) return names.map(n => ({ Path: `design/${n}`, Status: 'Occupied', Detail: 'design/ holds something other than the kit\'s documents' }));
  }
  return names.map(name => {
    const dest = join(designDir, name);
    if (existsSync(dest)) return { Path: `design/${name}`, Status: 'Present' };
    mkdirSync(designDir, { recursive: true });
    copyFileSync(join(templateDir, name), dest);
    return { Path: `design/${name}`, Status: 'Created' };
  });
}

// A short file that names the other one is a pointer, not a contract.
const isPointer = (text: string, other: string) => text.trim().length < 1000 && text.includes(other);

export function ensurePointer(root: string): { entry: Entry; written: string[] } {
  const agents = join(root, 'AGENTS.md'), claude = join(root, 'CLAUDE.md');
  const a = existsSync(agents) ? read(agents) : null, c = existsSync(claude) ? read(claude) : null;
  for (const [name, text] of [['AGENTS.md', a], ['CLAUDE.md', c]] as const) {
    if (text?.includes('AGENTS.shared.md')) return { entry: { Path: name, Status: 'Present' }, written: [] };
  }
  if (a === null && c === null) {
    writeFileSync(agents, `# Agent contract\n\n${pointerSection}`);
    writeFileSync(claude, '@AGENTS.md\n');
    return { entry: { Path: 'AGENTS.md', Status: 'Created', Detail: 'with CLAUDE.md importing it' }, written: ['AGENTS.md', 'CLAUDE.md'] };
  }
  let target: string;
  if (a === null) target = 'CLAUDE.md';
  else if (c === null || isPointer(c, 'AGENTS.md')) target = 'AGENTS.md';
  else if (isPointer(a, 'CLAUDE.md')) target = 'CLAUDE.md';
  else return { entry: { Path: 'AGENTS.md', Status: 'Ambiguous', Detail: 'AGENTS.md and CLAUDE.md both hold content; the pointer section belongs in one, and which is a decision' }, written: [] };
  const path = join(root, target), text = target === 'AGENTS.md' ? a! : c!;
  // After the title when there is one, so the file still opens with its own name.
  const title = /^# .*\n(?:[ \t]*\n)?/.exec(text);
  const updated = title
    ? `${title[0]}${title[0].endsWith('\n\n') ? '' : '\n'}${pointerSection}\n${text.slice(title[0].length)}`
    : `${pointerSection}\n${text}`;
  writeFileSync(path, updated.replace(/\n*$/, '\n'));
  return { entry: { Path: target, Status: 'Inserted' }, written: [target] };
}

const kitHookMarker = /AI attribution/;

export function ensureHook(root: string, kitRoot: string): Entry {
  const rev = run('git', ['-C', root, 'rev-parse', '--git-common-dir']);
  if (rev.code !== 0) return { Path: '.git/hooks/commit-msg', Status: 'Skipped', Detail: 'not a git repository' };
  const hooksDir = resolve(root, rev.stdout.trim(), 'hooks');
  const configured = run('git', ['-C', root, 'config', '--get', 'core.hooksPath']).stdout.trim();
  if (configured && resolve(root, configured) !== hooksDir) return { Path: configured, Status: 'Skipped', Detail: `core.hooksPath names ${configured}` };
  const dest = join(hooksDir, 'commit-msg'), source = read(join(kitRoot, 'tools/git-hooks/commit-msg'));
  let status = 'Created';
  if (existsSync(dest)) {
    const current = read(dest);
    if (current === source) return { Path: '.git/hooks/commit-msg', Status: 'Present' };
    if (!kitHookMarker.test(current)) return { Path: '.git/hooks/commit-msg', Status: 'Occupied', Detail: 'a commit-msg hook the kit did not write' };
    status = 'Updated';
  }
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(dest, source);
  chmodSync(dest, 0o755);
  return { Path: '.git/hooks/commit-msg', Status: status };
}

export function ensureProjectFiles(root: string, kitRoot: string, wanted: { design?: string[]; pointer?: boolean; hook?: boolean }): Report {
  const design = ensureDesign(root, kitRoot, wanted.design ?? []);
  const pointer = wanted.pointer ? ensurePointer(root) : null;
  return {
    Design: design,
    Pointer: pointer?.entry ?? null,
    Hook: wanted.hook ? ensureHook(root, kitRoot) : null,
    Written: [...design.filter(d => d.Status === 'Created').map(d => d.Path), ...(pointer?.written ?? [])],
  };
}

if (isMain(import.meta.url)) await main(() => {
  const o = parseOptions(options);
  const root = resolve(o['repo-root'] ?? '.');
  const report = ensureProjectFiles(root, o['kit-root'] ? resolve(o['kit-root']) : resolveKitRoot(import.meta.url), {
    design: o.design, pointer: o.pointer, hook: o.hook,
  });
  if (!o.quiet) {
    for (const e of [...report.Design, report.Pointer, report.Hook]) {
      if (e) process.stderr.write(`${e.Path}: ${e.Status}${e.Detail ? ` (${e.Detail})` : ''}\n`);
    }
  }
  writeJson(report);
});
