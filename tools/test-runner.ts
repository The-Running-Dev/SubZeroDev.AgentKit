import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { main } from './lib/runtime.ts';

// An explicit directory argument is resolved as a module by node --test.
// tools/package.json points here so the same command works at the 22.18 floor.
await main(async () => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const tests = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map(entry => join(entry.parentPath, entry.name)).sort();
  for (const path of tests) await import(pathToFileURL(path).href);
});
