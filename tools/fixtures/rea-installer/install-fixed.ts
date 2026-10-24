import { auditArgs, ciArgs, npmCliPath, rebuildArgs } from './helpers.ts';
import type { Runner } from './helpers.ts';

export function install(nodeDir: string, nodeExe: string, run: Runner): number {
  const npmCli = npmCliPath(nodeDir);
  for (const args of [ciArgs(), rebuildArgs(['frida']), auditArgs()]) {
    const code = run(nodeExe, [npmCli, ...args]);
    if (code) return code;
  }
  return 0;
}
