import { join } from 'node:path';

// A reduced model of the REA installer's npm calls, kept as a regression fixture for the
// review budget: the helpers below were unit-tested and green while the entry point was broken.
export type Runner = (command: string, args: string[]) => number;

export function npmCliPath(nodeDir: string): string {
  return join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js');
}

export function ciArgs(): string[] { return ['ci', '--no-audit', '--no-fund']; }
export function rebuildArgs(packages: string[]): string[] { return ['rebuild', ...packages]; }
export function auditArgs(): string[] { return ['audit', '--omit=dev']; }
