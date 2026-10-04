import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run } from './process.ts';
import { integerOption, parseOptions, requiredOption } from './options.ts';
import { isMain, requireNode, supportedNode } from './runtime.ts';
import { resolveKitRoot } from './kit-root.ts';

test('runs an argument array without interpreting shell metacharacters', () => {
  const values = ['two words', '"quoted"', "single'quote", '$(echo unsafe)', '& echo unsafe', '%PATH%', '日本語'];
  const result = run(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', ...values]);
  assert.deepEqual(JSON.parse(result.stdout), values);
  assert.equal(result.code, 0);
  assert.equal(result.found, true);
});
test('distinguishes a missing executable from a nonzero exit', () => {
  assert.equal(run('agentkit-command-that-does-not-exist', []).found, false);
  const failure = run(process.execPath, ['-e', 'process.stderr.write("failed"); process.exit(4)']);
  assert.deepEqual(failure, { code: 4, stdout: '', stderr: 'failed', found: true });
});
test('passes cwd, environment and input without contaminating stdout', () => {
  const result = run(process.execPath, ['-e', 'process.stdout.write(process.env.AGENTKIT_TEST); process.stdin.pipe(process.stdout)'], {
    cwd: tmpdir(), env: { ...process.env, AGENTKIT_TEST: 'prefix:' }, input: 'input',
  });
  assert.equal(result.stdout, 'prefix:input');
  assert.equal(result.stderr, '');
});
test('strict option parsing keeps switches and string values separate', () => {
  const values = parseOptions({ quiet: { type: 'boolean' }, 'head-sha': { type: 'string' } }, ['--quiet', '--head-sha', 'abc']);
  assert.equal(values.quiet, true);
  assert.equal(values['head-sha'], 'abc');
});
test('rejects unknown options and positional arguments', () => {
  assert.throws(() => parseOptions({}, ['--unknown']));
  assert.throws(() => parseOptions({}, ['unexpected']));
});
test('validates integer parameters without silently truncating', () => {
  assert.equal(integerOption(undefined, 'timeout', 900), 900);
  assert.equal(integerOption('20', 'timeout'), 20);
  for (const value of ['2x', '1.5', '9007199254740992', '']) assert.throws(() => integerOption(value, 'timeout'));
});
test('required strings preserve their original contents', () => {
  assert.equal(requiredOption(' a b ', 'name'), ' a b ');
  assert.throws(() => requiredOption(' ', 'name'), /--name is required/);
});
test('version floor accepts 22.18 and newer and rejects older versions', () => {
  for (const version of ['22.18.0', '22.19.0', '24.0.0', '25.3.0']) assert.equal(supportedNode(version), true);
  for (const version of ['20.20.0', '22.17.0', 'invalid']) assert.equal(supportedNode(version), false);
  assert.throws(() => requireNode('22.17.0'), /requires Node >= 22.18; found 22.17.0/);
});
test('main detection works without import.meta.main', () => {
  assert.equal(isMain(import.meta.url, new URL(import.meta.url).pathname + '-missing'), false);
  assert.equal(isMain(import.meta.url, ''), false);
});

function roots() {
  const root = mkdtempSync(join(tmpdir(), 'agentkit-root-'));
  const own = join(root, 'checkout');
  const home = join(root, 'home');
  const installed = join(root, 'installed');
  mkdirSync(join(own, 'tools'), { recursive: true });
  mkdirSync(home);
  mkdirSync(installed);
  return { root, own, home, installed, url: pathToFileURL(join(own, 'tools', 'entry.ts')).href };
}
test('prefers its own checkout, including a linked worktree', t => {
  const fixture = roots();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  writeFileSync(join(fixture.own, '.git'), 'gitdir: elsewhere');
  assert.equal(resolveKitRoot(fixture.url, { AGENTKIT_HOME: fixture.installed }, fixture.home), fixture.own);
});
test('falls back to AGENTKIT_HOME and then HOME/.agent-kit', t => {
  const fixture = roots();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  assert.equal(resolveKitRoot(fixture.url, { AGENTKIT_HOME: fixture.installed }, fixture.home), fixture.installed);
  const fallback = join(fixture.home, '.agent-kit');
  mkdirSync(fallback);
  assert.equal(resolveKitRoot(fixture.url, {}, fixture.home), fallback);
});
test('root resolution reports every checked location on failure', t => {
  const fixture = roots();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  assert.throws(() => resolveKitRoot(fixture.url, {}, fixture.home), error => {
    const message = String(error);
    return message.includes(fixture.own) && message.includes('$AGENTKIT_HOME') && message.includes(join(fixture.home, '.agent-kit'));
  });
});
test('type stripping and diagnostics leave stdout as exactly one JSON object', () => {
  const runtime = new URL('./runtime.ts', import.meta.url).href;
  const result = run(process.execPath, ['--input-type=module', '-e', `import { main, writeJson } from ${JSON.stringify(runtime)}; await main(() => writeJson({ State: 'Ready' }));`]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '{"State":"Ready"}\n');
  assert.ok(result.stderr === '' || result.stderr.includes('ExperimentalWarning'), result.stderr);
});
test('entry failures are diagnostics on stderr with exit code 2', () => {
  const runtime = new URL('./runtime.ts', import.meta.url).href;
  const result = run(process.execPath, ['--input-type=module', '-e', `import { main } from ${JSON.stringify(runtime)}; await main(() => { throw new Error('bad option'); });`]);
  assert.equal(result.code, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /bad option/);
});
