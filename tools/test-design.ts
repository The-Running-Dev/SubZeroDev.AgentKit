import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveKitRoot } from './lib/kit-root.ts';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = { 'repo-root': { type: 'string' }, quiet: { type: 'boolean' } } as const;
const hostCommands = ['add-dir', 'agents', 'bug', 'clear', 'code-review', 'compact', 'config', 'context', 'cost',
  'doctor', 'exit', 'export', 'fast', 'help', 'hooks', 'ide', 'init', 'login', 'logout', 'mcp', 'memory', 'model',
  'permissions', 'plugin', 'pr-comments', 'release-notes', 'resume', 'review', 'rewind', 'security-review', 'status', 'statusline', 'ultrareview', 'usage'];
const scriptsHeading = /^## Scripts \(`tools\/`\)[ \t]*\r?$/m;
const commandsHeading = /^## Commands \(`skills\/<name>\/SKILL\.md`\)[ \t]*\r?$/m;
const lineNumber = (text: string, index: number) => text.slice(0, index).split('\n').length;
export function livePart(text: string) {
  const m = /^## Landed[ \t]*\r?$/m.exec(text); return m ? text.slice(0, m.index) : text;
}
function section(text: string, heading: RegExp) {
  const m = heading.exec(text); if (!m) return undefined;
  const start = m.index + m[0].length, rest = text.slice(start), next = /^## /m.exec(rest);
  return { start, text: next ? rest.slice(0, next.index) : rest };
}
function rows(text: string, s: { start: number; text: string }) {
  let seen = false;
  return [...s.text.matchAll(/^\|.*$/gm)].flatMap(m => {
    if (/^\|\s*:?-{3,}/.test(m[0])) return [];
    if (!seen) { seen = true; return []; }
    return [{ cells: m[0].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()), line: lineNumber(text, s.start + m.index!) }];
  });
}
function skills(root: string) {
  const dir = join(root, 'skills');
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(dir, d.name, 'SKILL.md'))).map(d => d.name).sort((a, b) => a.localeCompare(b)) : [];
}
// Read the exported literal as text. Never import a command to inspect its options.
export function declaredOptions(text: string): string[] {
  const start = /export\s+const\s+options\s*=\s*\{/.exec(text);
  if (!start) return [];
  const rest = text.slice(start.index + start[0].length);
  const end = rest.search(/\}\s*(?:as const)?\s*;/);
  const literal = end < 0 ? rest : rest.slice(0, end);
  return [...literal.matchAll(/(?:^|[,\n])\s*(?:'([^']+)'|"([^"]+)"|([\w-]+))\s*:\s*\{/g)].map(m => m[1] ?? m[2] ?? m[3]);
}
export interface Finding { Check: string; File: string; Line: number; Message: string }
export function designCheck(repoRoot = process.cwd(), kitRoot = resolveKitRoot(import.meta.url)) {
  const root = realpathSync(repoRoot), findings: Finding[] = [];
  if (!existsSync(join(root, 'design')) || !statSync(join(root, 'design')).isDirectory()) return { State: 'NotEvaluated', Findings: [], Checked: [] };
  const files = ['AGENTS.shared.md', 'AGENTS.md', ...skills(root).map(s => `skills/${s}/SKILL.md`),
    'design/00-brief.md', 'design/10-design.md', 'design/20-contract.md', 'design/30-slices.md'].filter(f => existsSync(join(root, f)));
  const add = (Check: string, File: string, Line: number, Message: string) => findings.push({ Check, File, Line, Message });
  const known = new Set([...skills(root), ...skills(kitRoot), ...hostCommands]);
  for (const file of files) {
    const text = livePart(readFileSync(join(root, file), 'utf8'));
    for (const m of text.matchAll(/(?<![\w./-])tools\/[A-Za-z0-9._/-]*[A-Za-z0-9_/-]/g)) {
      if (!existsSync(join(root, m[0])) && !existsSync(join(kitRoot, m[0]))) add('MissingTool', file, lineNumber(text, m.index!), `${m[0]} exists neither in the repository nor in the kit`);
    }
    for (const m of text.matchAll(/`\/(?:agentkit:)?([a-z][a-z0-9-]*)(?=[`\s:\]])/g)) {
      if (m[1] !== 'agentkit' && !known.has(m[1])) add('UnknownCommand', file, lineNumber(text, m.index!), `${m[0].slice(1)} is neither a skill nor a host command`);
    }
  }
  const contractFile = 'design/20-contract.md';
  if (existsSync(join(root, contractFile))) {
    const text = readFileSync(join(root, contractFile), 'utf8');
    const scriptSection = section(text, scriptsHeading);
    if (scriptSection) {
      const listed: string[] = [];
      for (const row of rows(text, scriptSection)) {
        if (row.cells.length < 2) continue;
        const exempt = /see the script/i.test(row.cells[1]);
        const params = [...new Set([...row.cells[1].matchAll(/`[^`]*`/g)].flatMap(m => [...m[0].matchAll(/(?<![\w-])--?([A-Za-z][A-Za-z0-9-]*)/g)].map(p => p[1])))];
        for (const m of row.cells[0].matchAll(/`([A-Za-z0-9._-]+\.(?:ps1|ts))`/g)) {
          const name = m[1]; listed.push(name);
          const path = [join(root, 'tools', name), join(root, name)].find(p => existsSync(p));
          if (!path) { add('MissingScript', contractFile, row.line, `${name} is listed but exists in neither tools/ nor the repository root`); continue; }
          if (exempt) continue;
          // Transitional PowerShell rows stay inspectable until the installer port removes them.
          const source = readFileSync(path, 'utf8');
          const declared = name.endsWith('.ts') ? declaredOptions(source)
            : [...(source.match(/\bparam\(([\s\S]*?)\n\)/i)?.[1] ?? '').matchAll(/\]\s*\$([A-Za-z][A-Za-z0-9]*)/g)].map(p => p[1]);
          const prefix = name.endsWith('.ts') ? '--' : '-';
          for (const p of params) if (!declared.some(d => d.toLowerCase() === p.toLowerCase())) add('UnknownParameter', contractFile, row.line, `${name} does not declare ${prefix}${p}`);
          for (const d of declared) if (!params.some(p => p.toLowerCase() === d.toLowerCase())) add('UnlistedParameter', contractFile, row.line, `${name} declares ${prefix}${d}, which its row does not list`);
        }
      }
      const dir = join(root, 'tools');
      if (existsSync(dir)) for (const file of readdirSync(dir).filter(n => /\.(ps1|ts)$/i.test(n) && !/\.(tests\.ps1|test\.ts)$/i.test(n)).sort((a, b) => a.localeCompare(b))) {
        // Library/test entry modules do not declare command options.
        if (file.endsWith('.ts') && !/export\s+const\s+options\s*=/.test(readFileSync(join(dir, file), 'utf8'))) continue;
        if (!listed.some(n => n.toLowerCase() === file.toLowerCase())) add('UnlistedScript', contractFile, lineNumber(text, scriptSection.start), `tools/${file} is not listed in the Scripts table`);
      }
    }
    const commandSection = section(text, commandsHeading);
    if (commandSection) {
      const names = skills(root), listed: string[] = [];
      for (const row of rows(text, commandSection)) {
        const m = /^`([a-z][a-z0-9-]*)`$/.exec(row.cells[0]); if (!m) continue;
        listed.push(m[1]);
        if (!names.includes(m[1])) add('MissingCommand', contractFile, row.line, `${m[1]} is listed but skills/${m[1]}/SKILL.md does not exist`);
      }
      for (const name of names) if (!listed.includes(name)) add('UnlistedCommand', contractFile, lineNumber(text, commandSection.start), `skills/${name}/SKILL.md has no row in the Commands table`);
    }
  }
  const file = 'design/30-slices.md';
  if (existsSync(join(root, file))) {
    const text = readFileSync(join(root, file), 'utf8'), live = livePart(text);
    const headings = [...live.matchAll(/^## S(\d+)\b/gm)];
    const ids = [...headings.map(h => Number(h[1])), ...[...text.slice(live.length).matchAll(/\bS(\d+)\b/g)].map(m => Number(m[1]))];
    const seen = new Map<number, number>();
    for (const h of headings) {
      const id = Number(h[1]), line = lineNumber(live, h.index!), body = live.slice(h.index! + h[0].length).split(/^#{1,2} /m)[0];
      if (seen.has(id)) add('DuplicateSlice', file, line, `S${id} is already used at line ${seen.get(id)}`); else seen.set(id, line);
      if (!/^Status:[ \t]*(todo|done)[ \t]*\r?$/mi.test(body)) add('MissingStatus', file, line, `S${id} has no 'Status: todo' or 'Status: done' line`);
      for (const d of (body.match(/^Depends on:(.*)$/m)?.[1] ?? '').matchAll(/\bS?(\d+)\b/g)) if (!ids.includes(Number(d[1]))) add('UnknownDependency', file, line, `S${id} depends on S${Number(d[1])}, which is neither a slice heading nor in the Landed index`);
    }
  }
  return { State: findings.length ? 'Failed' : 'Passed', Findings: findings, Checked: files };
}
export const designExitCode = (state: string) => state === 'Passed' ? 0 : state === 'Failed' ? 1 : 2;
if (isMain(import.meta.url)) await main(() => {
  const o = parseOptions(options); const r = designCheck(o['repo-root']);
  if (!o.quiet) process.stderr.write(`Design check: ${r.State} - ${r.Findings.length} finding(s).\n`);
  writeJson(r); process.exitCode = designExitCode(r.State);
});
