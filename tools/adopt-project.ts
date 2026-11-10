import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { designIsOccupied, ensureProjectFiles } from './ensure-project-files.ts';
import { getSlicePlan } from './get-next-slice.ts';
import { resolveKitRoot } from './lib/kit-root.ts';
import { run } from './lib/process.ts';
import { parseOptions } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

export const options = {
  'repo-root': { type: 'string' }, plan: { type: 'string' },
  brief: { type: 'string' }, design: { type: 'string' }, contract: { type: 'string' },
} as const;
export interface AdoptionInput { repoRoot: string; plan: string; brief?: string; design?: string; contract?: string }

// Inputs are prepared project documents, not private source transcripts. This tool never
// publishes them, overwrites a divergent document, or decides which historical slices landed.
export function adoptProject(input: AdoptionInput, kitRoot: string) {
  const root = resolve(input.repoRoot), source = readFileSync(resolve(input.plan), 'utf8').replace(/^\uFEFF/, '');
  const plan = getSlicePlan(source), ids = plan.Slices.map(s => s.Id);
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('The prepared plan needs unique ## S<n> headings; reconcile the source before adoption.');
  const branch = run('git', ['-C', root, 'branch', '--show-current']);
  const head = run('git', ['-C', root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (branch.code || !branch.stdout.trim() || head.code || !head.stdout.trim().startsWith('origin/')) throw new Error('Adoption needs a feature branch and a resolved origin/HEAD.');
  if (branch.stdout.trim() === head.stdout.trim().slice(7)) throw new Error('Branch off the default branch before adopting project files.');
  if (designIsOccupied(root, kitRoot)) throw new Error('Preserving occupied design/; reconcile its purpose before adoption.');
  const documents = [
    ['30-slices.md', source],
    ...([['00-brief.md', input.brief], ['10-design.md', input.design], ['20-contract.md', input.contract]] as const)
      .filter((entry): entry is [typeof entry[0], string] => !!entry[1])
      .map(([name, path]) => [name, readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '')]),
  ];
  // Validate all collisions before writing anything. Existing project decisions win.
  for (const [name, content] of documents) {
    const path = join(root, 'design', name);
    if (existsSync(path) && readFileSync(path, 'utf8') !== content) throw new Error(`Preserving divergent design/${name}; reconcile it before adoption.`);
  }
  const written: string[] = [];
  mkdirSync(join(root, 'design'), { recursive: true });
  for (const [name, content] of documents) {
    const path = join(root, 'design', name);
    if (!existsSync(path)) { writeFileSync(path, content); written.push(`design/${name}`); }
  }
  const project = ensureProjectFiles(root, kitRoot, { design: ['90-decisions.md'], pointer: true, hook: true });
  return {
    State: 'Publish', Branch: branch.stdout.trim(), Written: [...written, ...project.Written], Project: project,
    Detail: 'Preparation is local. Verify project gates, commit named files, open a non-draft PR, review and merge through tools/merge-pull-request.ts. Then fetch and rerun tools/get-next-slice.ts in the same assignment.',
  };
}

if (isMain(import.meta.url)) await main(() => {
  const o = parseOptions(options);
  if (!o.plan) throw new Error('--plan must name the prepared, reconciled project plan.');
  writeJson(adoptProject({ repoRoot: o['repo-root'] ?? '.', plan: o.plan, brief: o.brief, design: o.design, contract: o.contract }, resolveKitRoot(import.meta.url)));
});
