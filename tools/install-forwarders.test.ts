import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { findExecutable } from './lib/executable.ts';
import { run } from './lib/process.ts';

const shell = findExecutable('pwsh') || findExecutable('powershell');
for (const file of ['setup.ps1', 'tools/Install-AgentKit.ps1']) test(`${file} forwards every option and Hosts array without joining arguments`, { skip: !shell }, () => {
  const temp = mkdtempSync(join(tmpdir(), 'agentkit forwarder '));
  try {
    mkdirSync(join(temp, 'tools'));
    writeFileSync(join(temp, file), readFileSync(resolve(import.meta.dirname, '..', file)));
    const target = file === 'setup.ps1' ? 'setup.ts' : 'tools/install-agentkit.ts';
    writeFileSync(join(temp, target), 'process.stdout.write(JSON.stringify(process.argv.slice(2)));');
    const loader = join(temp, 'invoke.ps1');
    writeFileSync(loader, "$ErrorActionPreference='Stop'\n& $env:FORWARDER_ENTRY -Version 'release with space' -Source 'source with space' -Prefix 'ak-' -PreviousCommit 'abc' -RequestedVersion 'latest stable' -Hosts claude,codex,copilot -DryRun -Uninstall -Force -Verify -RegisterOnly\n");
    const r = run(shell!, ['-NoProfile', '-File', loader], { env: { ...process.env, FORWARDER_ENTRY: join(temp, file) } });
    assert.equal(r.code, 0, r.stderr);
    const args: string[] = JSON.parse(r.stdout);
    for (const [flag, value] of [['version', 'release with space'], ['source', 'source with space'], ['prefix', 'ak-'], ['previous-commit', 'abc'], ['requested-version', 'latest stable']]) assert.equal(args[args.indexOf('--' + flag) + 1], value);
    for (const flag of ['dry-run','uninstall','force','verify','register-only']) assert.ok(args.includes('--' + flag));
    assert.deepEqual(args.filter((_, i) => args[i-1] === '--hosts'), ['claude','codex','copilot']);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
