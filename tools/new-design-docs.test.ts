import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveDesignKitRoot } from './new-design-docs.ts';
import { temp } from './lib/fixtures.ts';
test('resolves AGENTKIT_HOME when no self-hosted templates exist', () => { const r = temp(), kit = join(r, 'kit'); mkdirSync(join(kit, 'templates/design'), { recursive: true }); assert.equal(resolveDesignKitRoot(pathToFileURL(join(r, 'tools/new-design-docs.ts')).href, { AGENTKIT_HOME: kit }, r), realpathSync(kit)); });
test('ignores AGENTKIT_HOME without templates and names the fallback on failure', () => { const r = temp(), kit = join(r, 'kit'); mkdirSync(kit); assert.throws(() => resolveDesignKitRoot(pathToFileURL(join(r, 'tools/new-design-docs.ts')).href, { AGENTKIT_HOME: kit }, r), /\.agent-kit/); });
