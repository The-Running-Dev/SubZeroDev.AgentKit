import { ciArgs, npmCliPath, rebuildArgs } from './helpers.ts';
import type { Runner } from './helpers.ts';

// The shape of the defect: each step pasted the npm script and its arguments into one
// string, so node was asked to run '<npm-cli.js>rebuild' — a file that does not exist.
export function install(nodeDir: string, nodeExe: string, run: Runner): number {
  const npmCli = npmCliPath(nodeDir);
  for (const args of [[`${npmCli}${ciArgs().join(' ')}`], [`${npmCli}rebuild`, ...rebuildArgs(['frida']).slice(1)], [`${npmCli}audit`]]) {
    const code = run(nodeExe, args);
    if (code) return code;
  }
  return 0;
}
