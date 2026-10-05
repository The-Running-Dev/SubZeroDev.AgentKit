import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildInvocation, invokeCodex, readArgumentsFile } from './invoke-codex-command.ts';
import { findExecutable } from './lib/executable.ts';
import { parseOptions, requiredOption } from './lib/options.ts';
import { run } from './lib/process.ts';
import type { Runner } from './lib/process.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  command: { type: 'string' },
  'arguments-file': { type: 'string' },
  'new-window': { type: 'boolean' },
  'dry-run': { type: 'boolean' },
} as const;
export function windowFiles(command: string, argumentsFile: string, cwd = process.cwd(), directory = mkdtempSync(join(tmpdir(), 'agentkit-launch-'))) {
  const payload = join(directory, 'payload.json'), loader = join(directory, 'launch.cjs');
  writeFileSync(payload, JSON.stringify({ command, argumentsFile: resolve(argumentsFile), cwd, launcher: new URL('./invoke-codex-command.ts', import.meta.url).href }), { mode: 0o600 });
  writeFileSync(loader, `const fs = require('node:fs');\nconst path = require('node:path');\n(async () => {\n  const p = JSON.parse(fs.readFileSync(path.join(__dirname, 'payload.json'), 'utf8'));\n  process.chdir(p.cwd);\n  const m = await import(p.launcher);\n  process.exitCode = m.invokeCodex({command:p.command, skillArguments:m.readArgumentsFile(p.argumentsFile), cwd:p.cwd});\n})().catch(e => { console.error(e.message); process.exitCode = 2; });\n`, { mode: 0o600 });
  return { payload, loader, directory };
}
export function startWindow(command: string, argumentsFile: string, config: { cwd?: string; platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv; runner?: Runner; node?: string; terminal?: string } = {}) {
  const platform = config.platform || process.platform, env = config.env || process.env, runner = config.runner || run, node = config.node || process.execPath;
  const terminal = config.terminal || (platform === 'win32' ? env.ComSpec || 'cmd.exe' : platform === 'darwin' ? findExecutable('open', env, platform) : platform === 'linux' ? findExecutable('x-terminal-emulator', env, platform) : undefined);
  if (!terminal) throw new Error(`No supported terminal available on ${platform}. Run without --new-window for foreground mode.`);
  const files = windowFiles(command, argumentsFile, config.cwd);
  let args: string[];
  if (platform === 'win32') {
    // cmd start is necessary to create a visible console. Its command contains
    // only controlled, quoted executable/file paths; refuse shell metacharacters.
    for (const path of [node, files.loader]) if (/["%!\r\n&|<>^]/.test(path)) throw new Error('Terminal launch paths contain shell metacharacters. Run without --new-window for foreground mode.');
    args = ['/d', '/s', '/c', `start "" "${node}" "${files.loader}"`];
  } else if (platform === 'darwin') {
    const quote = (path: string) => "'" + path.replaceAll("'", "'\\''") + "'", script = join(files.directory, 'launch.command');
    writeFileSync(script, `#!/bin/sh\nexec ${quote(node)} ${quote(files.loader)}\n`, { mode: 0o700 }); chmodSync(script, 0o700);
    args = ['-a', 'Terminal', script];
  } else args = ['-e', node, files.loader];
  const result = runner(terminal, args, { cwd: config.cwd, env, windowsHide: false });
  if (!result.found || result.code !== 0) throw new Error(`Could not open terminal: ${result.stderr || terminal}. Run without --new-window for foreground mode.`);
  return { Started: true, Payload: files.payload };
}
if (isMain(import.meta.url)) await main(() => {
  const v = parseOptions(options), command = requiredOption(v.command, 'command'), file = requiredOption(v['arguments-file'], 'arguments-file'), args = readArgumentsFile(file);
  if (v['dry-run']) { writeJson({ ...buildInvocation({ command, skillArguments: args }), WouldStartNewWindow: !!v['new-window'] }); return; }
  if (v['new-window']) { buildInvocation({ command }); writeJson(startWindow(command, file)); }
  else { const code = invokeCodex({ command, skillArguments: args }); writeJson({ ExitCode: code }); process.exitCode = code; }
});
