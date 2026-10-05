import { cli } from './tools/install-agentkit.ts';
import { isMain, main } from './tools/lib/runtime.ts';

// One machine-wide runtime; re-entry loads the selected commit in a fresh process.
if (isMain(import.meta.url)) await main(() => cli());
