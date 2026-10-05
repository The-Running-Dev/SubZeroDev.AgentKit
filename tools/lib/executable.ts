import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function findExecutable(name: string, env = process.env, platform = process.platform): string | undefined {
  const dirs = (env.PATH || env.Path || '').split(platform === 'win32' ? ';' : ':');
  const names = platform === 'win32' && !/\.(exe|cmd|bat)$/i.test(name) ? [name + '.exe', name + '.cmd', name + '.bat'] : [name];
  for (const dir of dirs) for (const leaf of names) {
    const path = join(dir.replace(/^"|"$/g, ''), leaf);
    try { if (statSync(path).isFile() && (platform === 'win32' || (statSync(path).mode & 0o111))) return resolve(path); } catch { /* Continue PATH lookup. */ }
  }
  return undefined;
}
export function resolveExecutable(name: string, env = process.env, platform = process.platform): { command: string; args: string[] } {
  const path = findExecutable(name, env, platform);
  if (!path) throw new Error(`Executable '${name}' not found on PATH.`);
  if (platform !== 'win32' || !/\.(cmd|bat)$/i.test(path)) return { command: path, args: [] };
  // Interpret only the npm shim's literal entry path, never execute its shell body.
  const match = /"%dp0%[\\/]([^"\r\n]+\.(?:c?js|mjs))"/i.exec(readFileSync(path, 'utf8'));
  if (!match) throw new Error(`Cannot safely resolve '${path}' to a JavaScript entry. Install a native executable or a standard npm shim.`);
  const entry = resolve(dirname(path), match[1].replaceAll('\\', '/'));
  if (!existsSync(entry)) throw new Error(`JavaScript entry '${entry}' from '${path}' does not exist.`);
  const localNode = join(dirname(path), 'node.exe');
  return { command: existsSync(localNode) ? localNode : process.execPath, args: [entry] };
}
