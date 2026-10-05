import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildInvocation, commandProfiles, readArgumentsFile } from './invoke-codex-command.ts';
import { startWindow, windowFiles, windowsStartArgs } from './start-agentkit-codex.ts';
import { put, temp } from './lib/fixtures.ts';
import { run } from './lib/process.ts';
const argsFile = (value: unknown) => put(temp(), 'arguments.json', JSON.stringify(value));
test('preserves JSON argument values including switches and newlines', () => { const values = ['a b', 'quote"', "single'", '-switch', 'line\nbreak']; assert.deepEqual(readArgumentsFile(argsFile(values)), values); });
test('rejects scalar and mixed JSON arguments', () => { for (const value of ['text', {}, [1], ['ok', null]]) assert.throws(() => readArgumentsFile(argsFile(value)), /array of strings|only strings/); });
test('preserves an empty arguments array', () => assert.deepEqual(readArgumentsFile(argsFile([])), []));
test('keeps command and user data out of executable loader source', () => { const f = windowFiles('next', argsFile(['unique secret argument'])); const source = readFileSync(f.loader, 'utf8'); assert.doesNotMatch(source, /unique secret argument/); assert.match(source, /payload.json/); assert.match(source, /readArgumentsFile/); });
test('preserves metacharacters as payload data and keeps the working directory', () => { const command = "next'; Start-Process calc; '", cwd = temp(), path = argsFile([]), f = windowFiles(command, path, cwd); assert.equal(JSON.parse(readFileSync(f.payload, 'utf8')).command, command); assert.equal(JSON.parse(readFileSync(f.payload, 'utf8')).cwd, cwd); assert.doesNotMatch(readFileSync(f.loader, 'utf8'), /Start-Process/); });
test('opens a visible Windows terminal with only controlled paths in its command', () => { const calls: any[] = []; startWindow('next', argsFile(['injection & calc']), { platform: 'win32', node: 'C:\\Program Files\\nodejs\\node.exe', runner: (cmd, args, options) => { calls.push({ cmd, args, options }); return { code: 0, found: true, stdout: '', stderr: '' }; } }); assert.equal(calls[0].options.windowsHide, false); assert.equal(calls[0].options.windowsVerbatimArguments, true); assert.match(calls[0].args.at(-1), /^"start "" "C:\\Program Files\\nodejs\\node\.exe" ".+launch\.cjs""$/); assert.doesNotMatch(calls[0].args.join(' '), /injection|next/); });
test('cmd.exe parses the real start command line for paths with spaces', { skip: process.platform !== 'win32' }, () => {
  // /b /wait keeps the same quoting and parsing but runs in this console, so the test can observe the result.
  const directory = mkdtempSync(join(tmpdir(), 'agentkit start ')), marker = join(directory, 'started.txt'), loader = join(directory, 'launch (x86).cjs');
  try {
    writeFileSync(loader, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ok');`);
    const r = run(process.env.ComSpec || 'cmd.exe', windowsStartArgs(process.execPath, loader, ['/b', '/wait']), { windowsVerbatimArguments: true });
    assert.equal(r.code, 0, r.stderr);
    assert.ok(existsSync(marker), r.stderr || 'start did not run the loader');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('resolves every command in dry-run mode without starting Codex', () => { for (const command of Object.keys(commandProfiles)) { const r = run(process.execPath, ['tools/start-agentkit-codex.ts', '--command', command, '--arguments-file', argsFile([]), '--new-window', '--dry-run'], { env: { ...process.env, AGENTKIT_AUTO_UPDATE: '0' } }); assert.equal(r.code, 0, r.stderr); const value = JSON.parse(r.stdout); assert.equal(value.WouldStartNewWindow, true); assert.equal(value.Environment.AGENTKIT_COMMAND, '/' + command); } });
test('supports macOS and Linux terminals and refuses unavailable terminals with foreground guidance', () => { for (const platform of ['darwin', 'linux'] as const) { assert.throws(() => startWindow('next', argsFile([]), { platform, env: { PATH: '' } }), /foreground mode/); const r = temp(), name = platform === 'darwin' ? 'open' : 'x-terminal-emulator'; chmodSync(put(r, name, '#!/bin/sh\n'), 0o755); let captured: string[] = []; startWindow('next', argsFile([]), { platform, terminal: join(r, name), env: { PATH: r }, runner: (_cmd, args) => { captured = args; return { code: 0, found: true, stdout: '', stderr: '' }; } }); assert.equal(captured[0], platform === 'darwin' ? '-a' : '-e'); if (platform === 'darwin') assert.match(readFileSync(captured[2], 'utf8'), /^#!\/bin\/sh\nexec /); } assert.throws(() => buildInvocation({ command: 'unknown', skillArguments: [] }), /No profile mapping/); });
