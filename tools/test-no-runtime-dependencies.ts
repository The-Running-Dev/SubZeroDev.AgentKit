import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, main } from './lib/runtime.ts';

// The kit runs on Node's own library alone, so package.json declares devDependencies only.
export function getRuntimeDependencies(repoRoot: string): string[] {
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
  return Object.keys(manifest.dependencies ?? {});
}
if (isMain(import.meta.url)) await main(() => {
  const names = getRuntimeDependencies(process.cwd());
  if (names.length) throw new Error('Runtime dependencies are forbidden: ' + names.join(', '));
  process.stderr.write('RESULT=PASSED - package.json declares no runtime dependencies.\n');
});
