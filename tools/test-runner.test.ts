import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { run } from './lib/process.ts';

function fixture(t: TestContext, fail = false) {
  // Spaces also exercise file-URL imports and command arguments on Windows.
  const root = mkdtempSync(join(tmpdir(), 'agentkit test runner '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tools', 'lib', 'nested'), { recursive: true });
  // Exercise the real package test command and runner, not a second discovery implementation.
  copyFileSync(new URL('../package.json', import.meta.url), join(root, 'package.json'));
  copyFileSync(new URL('./package.json', import.meta.url), join(root, 'tools', 'package.json'));
  copyFileSync(new URL('./test-runner.ts', import.meta.url), join(root, 'tools', 'test-runner.ts'));
  copyFileSync(new URL('./lib/runtime.ts', import.meta.url), join(root, 'tools', 'lib', 'runtime.ts'));
  const log = join(root, 'executed.jsonl');
  for (const [path, name, fails] of [
    ['tools/root.test.ts', 'root', false],
    ['tools/lib/nested/child.test.ts', 'nested', fail],
  ] as const) {
    writeFileSync(join(root, path), `
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
test(${JSON.stringify(name)}, () => {
  appendFileSync(${JSON.stringify(log)}, JSON.stringify(${JSON.stringify(name)}) + '\\n');
  assert.equal(process.versions.node, ${JSON.stringify(process.versions.node)});
  assert.equal(${fails}, false, 'intentional nested test failure');
});
`);
  }
  // These are legitimate CLIs, not tests; default test-* discovery would execute them.
  for (const name of ['test-no-attribution.ts', 'test-review-ledger.ts', 'helper.ts', 'ignored.test.ts.txt']) {
    writeFileSync(join(root, 'tools', name), `throw new Error(${JSON.stringify(`CLI must not run: ${name}`)});\n`);
  }
  const env = { ...process.env };
  // A child test process must not inherit its parent's node:test execution context.
  delete env.NODE_TEST_CONTEXT;
  // Keep the same runtime even when this test was launched by an absolute Node path.
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') ?? 'PATH';
  env[pathKey] = dirname(process.execPath) + delimiter + (env[pathKey] ?? '');
  // --run exists at the Node floor and runs the copied npm script without an npm shim.
  const result = run(process.execPath, ['--run', 'test'], { cwd: root, env, timeout: 30_000 });
  const executed = readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line) as string).sort();
  return { result, executed };
}

test('package test command runs root and nested tests exactly once and excludes standalone CLIs', t => {
  const { result, executed } = fixture(t);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.deepEqual(executed, ['nested', 'root']);
  assert.doesNotMatch(result.stdout + result.stderr, /CLI must not run/);
});

test('package test command propagates a genuine nested test failure', t => {
  const { result, executed } = fixture(t, true);
  assert.equal(result.code, 1, result.stdout + result.stderr);
  assert.deepEqual(executed, ['nested', 'root']);
  assert.match(result.stdout + result.stderr, /intentional nested test failure/);
});
