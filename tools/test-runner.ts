import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { main } from './lib/runtime.ts';

// npm test names this file explicitly: directory discovery differs across Node versions.
// Select only .test.ts files ourselves, including nested tests, without shell globs.
await main(async () => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const tests = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map(entry => join(entry.parentPath, entry.name)).sort();
  for (const path of tests) await import(pathToFileURL(path).href);
});
