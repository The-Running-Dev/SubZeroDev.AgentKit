import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { doneHousekeeping } from './invoke-done-housekeeping.ts';
import type { HousekeepingInput } from './invoke-done-housekeeping.ts';
import { temp, repo, put, git, merged, unmerged, fakeGh } from './lib/fixtures.ts';
import { run } from './lib/process.ts';
const done = (root: string, extra: HousekeepingInput = {}, runner = fakeGh()) => doneHousekeeping({ repoRoot: root, defaultBranch: 'main', skipPull: true, ...extra }, runner);
test('lists a merged branch in another worktree by its bare name', () => { const r = repo(), wt = join(temp(), 'wt'); merged(r, 'feature/foo', wt); const d = done(r); assert.equal(d.Stopped, false); assert.deepEqual(d.Candidates.map(c => c.Branch), ['feature/foo']); });
test('names the blocking worktree in a delete refusal', () => { const r = repo(), wt = join(temp(), 'wt'); merged(r, 'feature/foo', wt); const d = done(r, { deleteBranches: ['feature/foo'] }); assert.deepEqual(d.Deleted, []); const registered = git(r, 'worktree', 'list', '--porcelain').split('\n\n').find(block => block.includes('branch refs/heads/feature/foo'))!.split('\n')[0].slice('worktree '.length); assert.ok(d.Refused[0].Reason.replaceAll('\\', '/').includes(registered.replaceAll('\\', '/')), d.Refused[0].Reason); assert.doesNotMatch(d.Refused[0].Reason, /Not in --merged/); });
test('deletes after the blocking worktree is removed', () => { const r = repo(), wt = join(temp(), 'wt'); merged(r, 'feature/foo', wt); git(r, 'worktree', 'remove', '--force', wt); const d = done(r, { deleteBranches: ['feature/foo'] }); assert.deepEqual(d.Deleted, ['feature/foo']); assert.deepEqual(d.Refused, []); });
test('offers force delete only when the local tip equals the merged head', () => { const r = repo(), tip = unmerged(r, 'fix/squashed'); const d = done(r, {}, fakeGh('fix/squashed', tip)); assert.deepEqual(d.SquashMergeCandidates.map(c => c.Branch), ['fix/squashed']); assert.deepEqual(d.TipAheadOfMergedPr, []); });
test('keeps branches with commits beyond the merged head', () => { const r = repo(), tip = unmerged(r, 'fix/squashed'); git(r, 'switch', '-q', 'fix/squashed'); git(r, 'commit', '--allow-empty', '-qm', 'later'); git(r, 'switch', '-q', 'main'); const d = done(r, {}, fakeGh('fix/squashed', tip)); assert.deepEqual(d.SquashMergeCandidates, []); assert.equal(d.TipAheadOfMergedPr[0].MergedHead, tip); assert.match(d.TipAheadOfMergedPr[0].Reason, /no merged PR accounts for/); });
test('refuses requested force deletion of a tip ahead of the merged head', () => { const r = repo(), tip = unmerged(r, 'fix/squashed'); git(r, 'switch', '-q', 'fix/squashed'); git(r, 'commit', '--allow-empty', '-qm', 'later'); git(r, 'switch', '-q', 'main'); const d = done(r, { forceDeleteBranches: ['fix/squashed'] }, fakeGh('fix/squashed', tip)); assert.deepEqual(d.Deleted, []); assert.equal(d.Refused[0].Branch, 'fix/squashed'); assert.ok(git(r, 'rev-parse', '--verify', 'fix/squashed')); });
test('stops when main is checked out in another worktree', () => { const r = repo(), wt = join(temp(), 'wt'); git(r, 'worktree', 'add', '-qb', 'fix/foo', wt, 'main'); const d = done(wt); assert.equal(d.Reason, 'CheckoutFailed'); assert.match(d.Detail!, /used by worktree/); assert.equal(git(wt, 'branch', '--show-current'), 'fix/foo'); });
test('keep-dirty preserves edits without a stash', () => { const r = repo(); put(r, 'dirty.txt', 'uncommitted'); const d = done(r, { keepDirty: true }); assert.equal(d.Stopped, false); assert.equal(d.Stashed, false); assert.ok(existsSync(join(r, 'dirty.txt'))); assert.equal(git(r, 'stash', 'list'), ''); });
test('stops on dirt without keep-dirty', () => { const r = repo(); put(r, 'dirty.txt', 'uncommitted'); assert.equal(done(r).Reason, 'DirtyTree'); });
test('reports the stash even when default branch resolution throws', () => { const r = repo(); put(r, 'dirty.txt', 'uncommitted'); const d = doneHousekeeping({ repoRoot: r, autoStash: true }, fakeGh()); assert.equal(d.Stopped, true); assert.equal(d.Stashed, true); assert.ok(d.StashRef); assert.match(git(r, 'stash', 'list'), /Invoke-DoneHousekeeping auto-stash/); });
test('records a stash SHA that an intervening stash from another worktree cannot move', () => {
  const r = repo(), wt = join(temp(), 'wt'); git(r, 'worktree', 'add', '-qb', 'other', wt, 'main'); put(r, 'dirty.txt', 'mine');
  let intervened = false;
  const d = doneHousekeeping({ repoRoot: r, defaultBranch: 'main', skipPull: true, autoStash: true }, (cmd, args, opts) => {
    const out = run(cmd, args, opts);
    if (!intervened && cmd === 'git' && args.includes('stash') && args.includes('push')) { intervened = true; put(wt, 'theirs.txt', 'theirs'); git(wt, 'stash', 'push', '-u', '-m', 'another worktree'); }
    return out;
  });
  assert.equal(intervened, true); assert.equal(d.Stashed, true);
  git(r, 'stash', 'apply', d.StashRef!);
  assert.equal(existsSync(join(r, 'theirs.txt')), false, `restoring '${d.StashRef}' brought back the other worktree's stash`);
  assert.equal(readFileSync(join(r, 'dirty.txt'), 'utf8'), 'mine');
  assert.match(d.StashRef!, /^[0-9a-f]{40}$/);
  assert.match(git(r, 'show', '-s', '--format=%s', d.StashRef!), /^On main: Invoke-DoneHousekeeping auto-stash [0-9a-f-]{36}$/);
});
test('gives every auto-stash its own message', () => { const tags = [0, 1].map(() => { const r = repo(); put(r, 'dirty.txt', 'x'); const d = doneHousekeeping({ repoRoot: r, defaultBranch: 'main', skipPull: true, autoStash: true }, fakeGh()); return git(r, 'show', '-s', '--format=%s', d.StashRef!); }); assert.notEqual(tags[0], tags[1]); });
test('scopes every gh query to the target repository remote', () => { const r = repo(); merged(r); unmerged(r, 'fix/other'); git(r, 'remote', 'add', 'origin', 'https://github.com/target/repo.git'); const calls: string[][] = []; done(r, {}, (cmd, args, opts) => { if (cmd === 'gh') { calls.push(args); return { code: 0, stdout: '[]', stderr: '', found: true }; } if (args.includes('fetch')) return { code: 0, stdout: '', stderr: '', found: true }; return run(cmd, args, opts); }); assert.ok(calls.length >= 2); for (const args of calls) assert.equal(args[args.indexOf('-R') + 1], 'target/repo'); });

// These fixtures use actual Git histories; only GitHub's PR metadata is substituted.
function commitFile(r: string, file: string, content: string) {
  put(r, file, content); git(r, 'add', file); git(r, 'commit', '-qm', content);
  return git(r, 'rev-parse', 'HEAD');
}
function pr(head: string, number = 1, merge = head) {
  return { number, url: `https://example.invalid/pr/${number}`, headRefOid: head, mergeCommit: { oid: merge }, isCrossRepository: false };
}
function github(entries: ReturnType<typeof pr>[]): typeof run {
  return (cmd, args, opts) => cmd === 'gh' ? { code: 0, found: true, stderr: '', stdout: JSON.stringify(entries) } : run(cmd, args, opts);
}
function patchHistory() {
  const r = repo(); git(r, 'switch', '-qc', 'feature');
  const tip = commitFile(r, 'feature.txt', 'feature patch');
  git(r, 'switch', '-q', 'main'); commitFile(r, 'main.txt', 'main patch');
  git(r, 'switch', '-qc', 'rebased'); git(r, 'cherry-pick', tip);
  const head = git(r, 'rev-parse', 'HEAD'); git(r, 'switch', '-q', 'main');
  return { r, tip, head };
}
function kept(d: ReturnType<typeof done>, r: string, branch = 'feature') {
  assert.deepEqual(d.Deleted, []); assert.ok(git(r, 'rev-parse', '--verify', branch));
  assert.ok(!d.SquashMergeCandidates.some(c => c.Branch === branch));
}
test('an ancestor of a merged PR head is contained and eligible', () => {
  const r = repo(), tip = unmerged(r, 'feature'); git(r, 'switch', '-q', 'feature');
  git(r, 'commit', '--allow-empty', '-qm', 'remote review fix'); const head = git(r, 'rev-parse', 'HEAD');
  git(r, 'switch', '-q', 'main'); git(r, 'branch', '-f', 'feature', tip);
  const d = done(r, {}, github([pr(head)]));
  assert.deepEqual(d.TipAheadOfMergedPr, []); assert.deepEqual(d.UnknownMergedPrEvidence, []);
  assert.equal(d.SquashMergeCandidates.find(c => c.Branch === 'feature')?.MergedHead, head);
});
test('reused names examine every merged PR regardless of ordering', () => {
  for (const reversed of [false, true]) {
    const { r, tip, head } = patchHistory(); const unrelated = git(r, 'rev-parse', 'main');
    const entries = [pr(unrelated), pr(head, 2)]; if (reversed) entries.reverse();
    const d = done(r, {}, github(entries));
    assert.equal(d.SquashMergeCandidates.find(c => c.Branch === 'feature')?.MergedPr, pr(head, 2).url);
    assert.deepEqual(d.TipAheadOfMergedPr, []); assert.notEqual(tip, head);
  }
});
test('git cherry proves rebased patches contained despite different hashes', () => {
  const { r, head } = patchHistory(); const d = done(r, {}, github([pr(head)]));
  assert.ok(d.SquashMergeCandidates.some(c => c.Branch === 'feature')); assert.deepEqual(d.TipAheadOfMergedPr, []);
});
test('an actual multi-commit squash accounts for the complete local patch', () => {
  const r = repo(); git(r, 'switch', '-qc', 'feature');
  commitFile(r, 'a.txt', 'first patch'); commitFile(r, 'b.txt', 'second patch');
  const local = git(r, 'rev-parse', 'HEAD'); git(r, 'switch', '-q', 'main');
  git(r, 'merge', '--squash', 'feature'); git(r, 'commit', '-qm', 'squashed'); const squash = git(r, 'rev-parse', 'HEAD');
  // Model a rewritten PR head: the local commits only match its aggregate squash patch.
  const d = done(r, {}, github([pr(squash, 1, squash)]));
  assert.notEqual(local, squash); assert.deepEqual(d.TipAheadOfMergedPr, []);
  assert.ok(d.SquashMergeCandidates.some(c => c.Branch === 'feature'));
});
test('an extra patch beyond a patch-equivalent head remains protected', () => {
  const { r, head } = patchHistory(); git(r, 'switch', '-q', 'feature');
  const extra = commitFile(r, 'extra.txt', 'unmerged patch'); git(r, 'switch', '-q', 'main');
  const d = done(r, { forceDeleteBranches: ['feature'] }, github([pr(head)])); kept(d, r);
  assert.match(d.TipAheadOfMergedPr.find(c => c.Branch === 'feature')!.Reason, new RegExp(extra));
});
test('a missing PR object is fetched by SHA without changing refs or FETCH_HEAD', () => {
  const remote = repo(); git(remote, 'switch', '-qc', 'feature'); const tip = commitFile(remote, 'a', 'local');
  git(remote, 'switch', '-q', 'main'); const r = join(temp(), 'clone'); git(remote, 'clone', '-q', '--no-local', remote, r);
  git(remote, 'switch', '-q', 'feature'); const head = commitFile(remote, 'b', 'remote only');
  git(r, 'branch', 'feature', tip); const before = git(r, 'show-ref');
  const fetchHead = put(r, '.git/FETCH_HEAD', 'sentinel'); const calls: string[][] = [];
  const runner: typeof run = (cmd, args, opts) => {
    if (cmd === 'git' && args.includes('--prune')) return { code: 0, found: true, stderr: '', stdout: '' };
    if (cmd === 'git' && args.includes('fetch')) calls.push(args);
    return github([pr(head)])(cmd, args, opts);
  };
  const d = done(r, {}, runner);
  assert.ok(d.SquashMergeCandidates.some(c => c.Branch === 'feature'));
  assert.ok(calls.some(a => a.includes(head) && a.includes('--no-tags') && a.includes('--no-write-fetch-head')));
  assert.equal(git(r, 'show-ref'), before); assert.equal(readFileSync(fetchHead, 'utf8'), 'sentinel');
});
test('unfetchable objects produce uncertainty and never authorize deletion', () => {
  const r = repo(); unmerged(r, 'feature'); const d = done(r, { forceDeleteBranches: ['feature'] }, github([pr('a'.repeat(40))]));
  kept(d, r); assert.deepEqual(d.TipAheadOfMergedPr, []);
  assert.match(d.UnknownMergedPrEvidence[0].Reason, /could not be fetched/);
});
test('GitHub failure, malformed data, absent head and truncated results remain uncertain', () => {
  for (const mode of ['failed', 'malformed', 'missing-head', 'truncated']) {
    const r = repo(); unmerged(r, 'feature'); const base = git(r, 'rev-parse', 'main');
    const runner: typeof run = (cmd, args, opts) => cmd !== 'gh' ? run(cmd, args, opts) : {
      code: mode === 'failed' ? 1 : 0, found: true, stderr: 'unavailable', stdout: mode === 'malformed' ? '{' :
        JSON.stringify(mode === 'missing-head' ? [{ ...pr(base), headRefOid: null }] : Array.from({ length: mode === 'truncated' ? 1000 : 0 }, () => pr(base))),
    };
    const d = done(r, { forceDeleteBranches: ['feature'] }, runner); kept(d, r);
    assert.deepEqual(d.TipAheadOfMergedPr, []); assert.equal(d.UnknownMergedPrEvidence.length, 1, mode);
  }
});
test('a same-name fork PR cannot authorize local deletion', () => {
  const r = repo(), head = unmerged(r, 'feature'); const runner: typeof run = (cmd, args, opts) => cmd !== 'gh' ? run(cmd, args, opts)
    : { code: 0, found: true, stderr: '', stdout: JSON.stringify([{ ...pr(head), isCrossRepository: true }]) };
  const d = done(r, { forceDeleteBranches: ['feature'] }, runner); kept(d, r);
});
test('shallow history and failed ancestry/patch commands cannot authorize deletion', () => {
  for (const failure of ['shallow', 'merge-base', 'cherry', 'patch-id']) {
    const { r, head } = patchHistory();
    // Force aggregate comparison for patch-id errors by making cherry report unmatched patches.
    const runner: typeof run = (cmd, args, opts) => {
      if (cmd === 'git' && failure === 'shallow' && args.includes('--is-shallow-repository')) return { code: 0, found: true, stderr: '', stdout: 'true' };
      if (cmd === 'git' && args.includes(failure)) return { code: 2, found: true, stderr: 'injected failure', stdout: '' };
      if (cmd === 'git' && failure === 'patch-id' && args.includes('cherry')) return { code: 0, found: true, stderr: '', stdout: '' };
      return github([pr(head)])(cmd, args, opts);
    };
    const d = done(r, { forceDeleteBranches: ['feature'] }, runner); kept(d, r);
    assert.deepEqual(d.TipAheadOfMergedPr, []); assert.ok(d.UnknownMergedPrEvidence.length, failure);
  }
});
test('patch-equivalent candidates retain worktree deletion protection', () => {
  const { r, head } = patchHistory(), wt = join(temp(), 'wt'); git(r, 'worktree', 'add', '-q', wt, 'feature');
  const d = done(r, { forceDeleteBranches: ['feature'] }, github([pr(head)]));
  assert.deepEqual(d.Deleted, []); assert.match(d.Refused[0].Reason, /another worktree/); assert.ok(git(r, 'rev-parse', 'feature'));
});
test('whitespace differences in code or strings never count as equivalent patches', () => {
  for (const contents of [
    ['if enabled:\n    cleanup()\n', 'if enabled:\ncleanup()\n'],
    ['const label = "a b";\n', 'const label = "ab";\n'],
  ]) {
    const r = repo(); git(r, 'switch', '-qc', 'feature'); const local = commitFile(r, 'code.txt', contents[0]);
    git(r, 'switch', '-q', 'main'); git(r, 'switch', '-qc', 'remote-head'); const head = commitFile(r, 'code.txt', contents[1]);
    git(r, 'switch', '-q', 'main');
    assert.match(git(r, 'cherry', head, local), /^- /, 'fixture must reproduce whitespace-insensitive cherry match');
    const d = done(r, { forceDeleteBranches: ['feature'] }, github([pr(head)])); kept(d, r);
    assert.equal(d.TipAheadOfMergedPr.find(c => c.Branch === 'feature')?.LocalTip, local);
  }
});
test('aggregate squash comparison also preserves significant whitespace', () => {
  const r = repo(); git(r, 'switch', '-qc', 'feature');
  commitFile(r, 'code.py', 'if enabled:\n    cleanup()\n'); commitFile(r, 'other', 'second patch');
  git(r, 'switch', '-q', 'main'); git(r, 'switch', '-qc', 'remote-head');
  put(r, 'other', 'second patch'); git(r, 'add', 'other'); const head = commitFile(r, 'code.py', 'if enabled:\ncleanup()\n');
  git(r, 'switch', '-q', 'main');
  const d = done(r, { forceDeleteBranches: ['feature'] }, github([pr(head)])); kept(d, r);
  assert.ok(d.TipAheadOfMergedPr.some(c => c.Branch === 'feature'));
});
test('diff configuration cannot hide genuinely different submodule commits', () => {
  for (const config of ['ignore', 'log', 'both']) {
    for (const aggregate of [false, true]) {
      const r = repo(), linkA = git(r, 'rev-parse', 'HEAD');
      git(r, 'commit', '--allow-empty', '-qm', 'second gitlink target'); const linkB = git(r, 'rev-parse', 'HEAD');
      git(r, 'switch', '-qc', 'feature'); git(r, 'update-index', '--add', '--cacheinfo', `160000,${linkA},vendor`);
      commitFile(r, 'app', 'same application patch'); if (aggregate) commitFile(r, 'other', 'second patch');
      git(r, 'switch', '-q', 'main'); git(r, 'switch', '-qc', 'remote-head');
      git(r, 'update-index', '--add', '--cacheinfo', `160000,${linkB},vendor`);
      if (aggregate) { put(r, 'other', 'second patch'); git(r, 'add', 'other'); }
      const head = commitFile(r, 'app', 'same application patch'); git(r, 'switch', '-q', 'main');
      if (config !== 'log') git(r, 'config', 'diff.ignoreSubmodules', 'all');
      if (config !== 'ignore') git(r, 'config', 'diff.submodule', 'log');
      const d = done(r, { forceDeleteBranches: ['feature'] }, github([pr(head)])); kept(d, r);
      assert.ok(d.TipAheadOfMergedPr.some(c => c.Branch === 'feature'), `${config}, aggregate=${aggregate}`);
    }
  }
});
test('a reused branch genuinely ahead of every merged PR stays protected', () => {
  const { r, head } = patchHistory(); const other = git(r, 'rev-parse', 'main');
  git(r, 'switch', '-q', 'feature'); const extra = commitFile(r, 'extra', 'new work'); git(r, 'switch', '-q', 'main');
  const d = done(r, { forceDeleteBranches: ['feature'] }, github([pr(other), pr(head, 2)])); kept(d, r);
  assert.match(d.TipAheadOfMergedPr.find(c => c.Branch === 'feature')!.Reason, new RegExp(extra));
});
test('one unavailable reused-name PR makes a negative classification uncertain', () => {
  const r = repo(), head = unmerged(r, 'feature'); git(r, 'switch', '-q', 'feature');
  commitFile(r, 'extra', 'new work'); git(r, 'switch', '-q', 'main');
  const d = done(r, { forceDeleteBranches: ['feature'] }, github([pr(head), pr('a'.repeat(40), 2)])); kept(d, r);
  assert.deepEqual(d.TipAheadOfMergedPr, []); assert.ok(d.UnknownMergedPrEvidence.some(c => c.Branch === 'feature'));
});
test('a branch that gains work during discovery is rechecked before force deletion', () => {
  const r = repo(), head = unmerged(r, 'feature'); let reads = 0;
  const runner: typeof run = (cmd, args, opts) => {
    if (cmd === 'git' && args.includes('rev-parse') && args.at(-1) === 'feature' && ++reads === 2) {
      const tree = git(r, 'rev-parse', `${head}^{tree}`);
      const extra = git(r, 'commit-tree', tree, '-p', head, '-m', 'concurrent unmerged work');
      git(r, 'branch', '-f', 'feature', extra);
    }
    return github([pr(head)])(cmd, args, opts);
  };
  const d = done(r, { forceDeleteBranches: ['feature'] }, runner);
  assert.deepEqual(d.Deleted, []); assert.match(d.Refused[0].Reason, /could not be reconfirmed/);
  assert.ok(git(r, 'rev-parse', 'feature'));
});
test('a feature rebased locally onto newer default-branch commits is still contained', () => {
  const r = repo(); git(r, 'switch', '-qc', 'feature'); const head = commitFile(r, 'f.txt', 'feature patch');
  git(r, 'switch', '-q', 'main'); commitFile(r, 'm.txt', 'main patch');
  git(r, 'switch', '-q', 'feature'); git(r, 'rebase', '-q', 'main'); git(r, 'switch', '-q', 'main');
  git(r, 'merge', '--squash', 'feature'); git(r, 'commit', '-qm', 'squashed'); const squash = git(r, 'rev-parse', 'HEAD');
  const d = done(r, { forceDeleteBranches: ['feature'] }, github([pr(head, 1, squash)]));
  assert.deepEqual(d.TipAheadOfMergedPr, []); assert.ok(d.SquashMergeCandidates.some(c => c.Branch === 'feature'));
  assert.deepEqual(d.Deleted, ['feature']);
});
test('default-branch commits are never reported as unaccounted work, and real extras stay protected', () => {
  const r = repo(); git(r, 'switch', '-qc', 'feature'); const head = commitFile(r, 'f.txt', 'feature patch');
  git(r, 'switch', '-q', 'main'); const mainOnly = commitFile(r, 'm.txt', 'main patch');
  git(r, 'merge', '--squash', 'feature'); git(r, 'commit', '-qm', 'squashed'); const squash = git(r, 'rev-parse', 'HEAD');
  git(r, 'switch', '-q', 'feature'); git(r, 'merge', '-q', '--no-edit', 'main'); const extra = commitFile(r, 'x.txt', 'unmerged patch');
  git(r, 'switch', '-q', 'main');
  const d = done(r, { forceDeleteBranches: ['feature'] }, github([pr(head, 1, squash)])); kept(d, r);
  const reason = d.TipAheadOfMergedPr.find(c => c.Branch === 'feature')!.Reason;
  assert.match(reason, new RegExp(extra)); assert.doesNotMatch(reason, new RegExp(`${mainOnly}|${squash}`));
});
