import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export function resolveKitRoot(
  scriptUrl: string,
  env = process.env,
  home = env.HOME || env.USERPROFILE || homedir(),
): string {
  const checked: string[] = [];
  let own = dirname(fileURLToPath(scriptUrl));
  // Entry scripts live at the root or in tools/; library callers live in tools/lib/.
  if (own.endsWith(`${process.platform === 'win32' ? '\\' : '/'}lib`)) own = dirname(own);
  if (own.endsWith(`${process.platform === 'win32' ? '\\' : '/'}tools`)) own = dirname(own);
  checked.push(own);
  // Worktrees have a .git file instead of a directory. Both are checkouts.
  if (existsSync(join(own, '.git'))) return own;
  if (env.AGENTKIT_HOME) {
    checked.push(env.AGENTKIT_HOME);
    if (existsSync(env.AGENTKIT_HOME)) return resolve(env.AGENTKIT_HOME);
  } else checked.push('$AGENTKIT_HOME (not set)');
  const fallback = join(home, '.agent-kit');
  checked.push(fallback);
  if (existsSync(fallback)) return fallback;
  throw new Error(`AgentKit root not found. Checked: ${checked.join('; ')}`);
}
