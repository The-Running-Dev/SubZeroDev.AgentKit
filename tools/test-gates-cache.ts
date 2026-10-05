import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  'repo-root': { type: 'string' }, write: { type: 'boolean' }, 'gates-json': { type: 'string' },
} as const;
export function manifestHash(root: string): string {
  const parts: string[] = [];
  const workflows = join(root, '.github/workflows');
  if (existsSync(workflows)) for (const f of readdirSync(workflows, { withFileTypes: true }).filter(f => f.isFile() && /\.yml$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    parts.push(`workflow:${f.name}:${readFileSync(join(workflows, f.name), 'utf8').replace(/^\uFEFF/, '')}`);
  }
  if (existsSync(join(root, 'package.json'))) parts.push(`package.json:${readFileSync(join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, '')}`);
  for (const p of ['build/Test-Documentation.ps1', 'build/Test-DocumentationArtifact.ps1', 'docs.ps1']) parts.push(`exists:${p}:${existsSync(join(root, p)) ? 'True' : 'False'}`);
  const projects: string[] = [];
  function walk(dir: string, depth: number) {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      if (f.name.startsWith('.')) continue;
      const path = join(dir, f.name);
      if (f.isFile() && /\.(sln|csproj)$/i.test(f.name)) projects.push(path.slice(root.length));
      else if (f.isDirectory() && depth < 2) walk(path, depth + 1);
    }
  }
  walk(root, 0);
  parts.push(`projects:${projects.sort((a, b) => a.localeCompare(b)).join('|')}`);
  return createHash('sha256').update(parts.join('\n---\n')).digest('hex');
}
export function validGates(gates: unknown): gates is { name: string; command: string }[] {
  return Array.isArray(gates) && gates.length > 0 && gates.every(g => g && !Array.isArray(g) &&
    ['name', 'command'].every(p => typeof g[p] === 'string' && g[p].trim()));
}
export function testGatesCache(repoRoot = process.cwd(), write = false, gatesJson?: string) {
  if (write && !gatesJson) throw new Error('--write requires --gates-json.');
  const root = realpathSync(repoRoot); const path = join(root, '.claude/gates.json'); const hash = manifestHash(root);
  if (write) {
    const gates = JSON.parse(gatesJson!);
    if (!validGates(gates)) throw new Error('--gates-json must be a nonempty array of objects with nonblank string name and command.');
    const now = new Date(); const generated = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ manifestHash: hash, generated, gates }, null, 2));
    return { Status: 'Written', ManifestHash: hash, GateCount: gates.length };
  }
  const stale = { Status: existsSync(path) ? 'Stale' : 'Missing', ManifestHash: hash, Gates: [] };
  if (!existsSync(path)) return stale;
  let cache;
  try { cache = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')); } catch { return stale; }
  if (cache && cache.manifestHash === hash && Object.hasOwn(cache, 'generated') && validGates(cache.gates)) return {
    Status: 'Fresh', ManifestHash: hash, Generated: cache.generated, Gates: cache.gates,
  };
  return stale;
}
if (isMain(import.meta.url)) await main(() => {
  const o = parseOptions(options); writeJson(testGatesCache(o['repo-root'], o.write, o['gates-json']));
});
