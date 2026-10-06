// Plain JavaScript on purpose, loaded as CommonJS (the root package.json has no "type"):
// a Node that cannot strip types still runs these checks before any .ts import resolves.
{
  const version = process.versions.node;
  const [major, minor] = version.split('.').map(Number);
  let refusal = '';
  if (!(major > 22 || (major === 22 && minor >= 18))) refusal = `AgentKit requires Node >= 22.18; found ${version}.`;
  else if (process.features.typescript === false) refusal = `AgentKit needs Node's TypeScript type stripping, which a --no-strip-types or --no-experimental-strip-types flag (directly or in NODE_OPTIONS) disabled; found ${version}.`;
  if (refusal) {
    process.stderr.write(refusal + '\n');
    process.exitCode = 2;
  } else {
    // One machine-wide runtime; re-entry loads the selected commit in a fresh process.
    Promise.all([import('./tools/install-agentkit.ts'), import('./tools/lib/runtime.ts')])
      .then(([installer, runtime]) => runtime.main(() => installer.cli()))
      .catch(error => { process.stderr.write(`${error instanceof Error ? error.message : error}\n`); process.exitCode = 2; });
  }
}
