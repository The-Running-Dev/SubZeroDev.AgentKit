import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from './lib/process.ts';
import { findExecutable } from './lib/executable.ts';

test('fresh dry run and real install work with PowerShell removed from PATH', {
  skip: process.platform !== 'linux' || process.env.AGENTKIT_PROVE_NO_PWSH !== '1',
}, () => {
  const temp = mkdtempSync(join(tmpdir(), 'agentkit-no-pwsh-'));
  try {
    const home = join(temp, 'home'), root = join(home, '.agent-kit'), bin = join(temp, 'bin');
    mkdirSync(home); mkdirSync(bin);
    const git = findExecutable('git')!;
    assert.ok(git);
    symlinkSync(git, join(bin, 'git')); symlinkSync(process.execPath, join(bin, 'node'));
    const env = { ...process.env, PATH: bin, HOME: home, USERPROFILE: home, CODEX_HOME: join(home, '.codex'), AGENTKIT_HOME: root, GIT_EXEC_PATH: run(git, ['--exec-path']).stdout.trim() };
    assert.equal(findExecutable('pwsh', env), undefined);
    const repo = resolve(import.meta.dirname, '..'), sha = run(git, ['-C', repo, 'rev-parse', 'HEAD']).stdout.trim();
    const args = [join(repo, 'setup.ts'), '--source', repo, '--version', sha, '--hosts', 'claude,codex,copilot'];
    const invoke = (extra: string[]) => {
      const result = run(process.execPath, [...args, ...extra], { env });
      assert.equal(result.code, 0, result.stderr || result.stdout);
      return JSON.parse(result.stdout);
    };
    assert.equal(invoke(['--dry-run']).State, 'DryRun');
    assert.equal(existsSync(root), false);
    const installed = invoke([]);
    assert.equal(installed.State, 'Installed'); assert.deepEqual(installed.Collisions, []);
    assert.equal(invoke(['--verify']).State, 'OK');
    const settings = JSON.parse(readFileSync(join(home, '.claude/settings.json'), 'utf8'));
    assert.equal(settings.hooks.SessionEnd[0].hooks[0].command, 'node');
    assert.equal(invoke(['--uninstall']).State, 'Uninstalled');
    assert.equal(existsSync(join(home, '.agent-kit-state/installed.json')), false);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
