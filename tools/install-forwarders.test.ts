import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { findExecutable } from './lib/executable.ts';
import { run } from './lib/process.ts';

const shell = findExecutable('pwsh') || findExecutable('powershell');
const files = ['setup.ps1', 'tools/Install-AgentKit.ps1'];
// Copies a forwarder into a temp tree whose Node target is the given stub source.
function withForwarder(file: string, target: string, body: (temp: string, entry: string) => void) {
  const temp = mkdtempSync(join(tmpdir(), 'agentkit forwarder '));
  try {
    mkdirSync(join(temp, 'tools'));
    writeFileSync(join(temp, file), readFileSync(resolve(import.meta.dirname, '..', file)));
    writeFileSync(join(temp, file === 'setup.ps1' ? 'setup.ts' : 'tools/install-agentkit.ts'), target);
    body(temp, join(temp, file));
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
const pwshFile = (temp: string, script: string, env: NodeJS.ProcessEnv) => { const path = join(temp, 'invoke.ps1'); writeFileSync(path, script); return run(shell!, ['-NoProfile', '-File', path], { env: { ...process.env, ...env } }); };

for (const file of files) test(`${file} forwards every option and Hosts array without joining arguments`, { skip: !shell }, () => withForwarder(file, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));', (temp, entry) => {
  const r = pwshFile(temp, "$ErrorActionPreference='Stop'\n& $env:FORWARDER_ENTRY -Version 'release with space' -Source 'source with space' -Prefix 'ak-' -PreviousCommit 'abc' -RequestedVersion 'latest stable' -Hosts claude,codex,copilot -DryRun -Uninstall -Force -Verify -RegisterOnly\n", { FORWARDER_ENTRY: entry });
  assert.equal(r.code, 0, r.stderr);
  const args: string[] = JSON.parse(r.stdout);
  for (const [flag, value] of [['version', 'release with space'], ['source', 'source with space'], ['prefix', 'ak-'], ['previous-commit', 'abc'], ['requested-version', 'latest stable']]) assert.equal(args[args.indexOf('--' + flag) + 1], value);
  for (const flag of ['dry-run','uninstall','force','verify','register-only']) assert.ok(args.includes('--' + flag));
  assert.deepEqual(args.filter((_, i) => args[i-1] === '--hosts'), ['claude','codex','copilot']);
}));

for (const file of files) test(`${file} fails an in-process caller and passes the exit code to -File when Node fails`, { skip: !shell }, () => withForwarder(file, 'process.exit(3);', (temp, entry) => {
  // The v2026.09.24 installer calls tools/Install-AgentKit.ps1 with & inside try/catch and prints recovery steps from the catch.
  const caller = pwshFile(temp, "$ErrorActionPreference='Stop'\ntry { & $env:FORWARDER_ENTRY -Version v1 -RegisterOnly; 'returned' } catch { 'caught: ' + $_ }\n", { FORWARDER_ENTRY: entry });
  assert.equal(caller.code, 0, caller.stderr);
  assert.match(caller.stdout, /caught: AgentKit installer exited 3\./);
  assert.doesNotMatch(caller.stdout, /returned/);
  const direct = run(shell!, ['-NoProfile', '-File', entry, '-Version', 'v1']);
  assert.equal(direct.code, 3, direct.stderr);
}));

for (const file of files) test(`${file} refuses a Node older than 22.18 before running the installer`, { skip: !shell }, () => withForwarder(file, '', (temp, entry) => {
  const bin = join(temp, 'old node');
  mkdirSync(bin);
  if (process.platform === 'win32') writeFileSync(join(bin, 'node.cmd'), '@echo v20.11.1\r\n');
  else { writeFileSync(join(bin, 'node'), '#!/bin/sh\necho v20.11.1\n'); chmodSync(join(bin, 'node'), 0o755); }
  // Windows spells the key Path; a second PATH key would leave the lookup order undefined.
  const pathKey = Object.keys(process.env).find(key => key.toUpperCase() === 'PATH') || 'PATH';
  const r = run(shell!, ['-NoProfile', '-File', entry, '-Version', 'v1'], { env: { ...process.env, [pathKey]: bin + delimiter + process.env[pathKey] } });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr + r.stdout, /requires Node >= 22\.18 on PATH; found 20\.11\.1/);
}));
