import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  'target-repo': { type: 'string' }, 'kit-root': { type: 'string' }, force: { type: 'boolean' }, quiet: { type: 'boolean' },
} as const;
export function resolveDesignKitRoot(url = import.meta.url, env = process.env, home = env.HOME || env.USERPROFILE || homedir()) {
  const own = dirname(dirname(fileURLToPath(url))), fallback = join(home, '.agent-kit');
  for (const root of [own, env.AGENTKIT_HOME, fallback]) if (root && existsSync(join(root, 'templates/design'))) return realpathSync(root);
  throw new Error(`Could not find templates/design/ under '${own}', $AGENTKIT_HOME (${env.AGENTKIT_HOME ?? 'not set'}), or '${fallback}'. Pass --kit-root explicitly.`);
}
export function newDesignDocs(targetRepo = process.cwd(), kitRoot = resolveDesignKitRoot(), force = false) {
  const templateDir = join(realpathSync(kitRoot), 'templates/design');
  if (!existsSync(templateDir)) throw new Error(`templates/design/ not found under '${kitRoot}'.`);
  const designDir = join(realpathSync(targetRepo), 'design');
  const seeds = readdirSync(templateDir, { withFileTypes: true }).filter(f => f.isFile() && /\.md$/i.test(f.name));
  if (!seeds.length) throw new Error(`templates/design/ under '${kitRoot}' has no .md files - nothing to seed.`);
  if (existsSync(designDir)) {
    if (!statSync(designDir).isDirectory()) throw new Error(`'${designDir}' exists and is not a directory. Occupied - resolve by hand.`);
    const entries = readdirSync(designDir);
    if (entries.length && !entries.some(e => seeds.some(s => s.name.toLowerCase() === e.toLowerCase()))) throw new Error(`'${designDir}' is occupied - it holds none of the five seed files, only: ${entries.join(', ')}. Stopping without writing anything; relocating design/ is a decision, not something this script makes for you.`);
  } else mkdirSync(designDir);
  return seeds.map(seed => {
    const src = join(templateDir, seed.name), dest = join(designDir, seed.name);
    let status: string;
    if (!existsSync(dest)) { copyFileSync(src, dest); status = 'Created'; }
    else if (readFileSync(src, 'utf8').replace(/^\uFEFF/, '') === readFileSync(dest, 'utf8').replace(/^\uFEFF/, '')) status = 'AlreadyInstalled';
    else if (force) { copyFileSync(src, dest); status = 'Overwritten'; }
    else status = 'Divergent-Skipped';
    return { Name: seed.name, Status: status };
  });
}
if (isMain(import.meta.url)) await main(() => {
  const o = parseOptions(options); const report = newDesignDocs(o['target-repo'], o['kit-root'], o.force);
  if (!o.quiet) process.stderr.write(report.map(r => `${r.Name}: ${r.Status}`).join('\n') + '\n');
  const divergent = report.filter(r => r.Status === 'Divergent-Skipped').length;
  if (divergent) process.stderr.write(`${divergent} file(s) have real content and were left alone. Re-run with --force only if you mean to discard it.\n`);
  writeJson({ Report: report });
});
