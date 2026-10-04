import { spawnSync } from 'node:child_process';

export interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
  found: boolean;
}
export interface ProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
}
export type Runner = (command: string, args: string[], options?: ProcessOptions) => ProcessResult;

// Always pass arguments directly. In particular, user text must never become shell syntax.
export const run: Runner = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    ...options, encoding: 'utf8', shell: false, windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr || result.error?.message || '',
    found: (result.error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT',
  };
};
