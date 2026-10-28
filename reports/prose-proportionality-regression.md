# Prose proportionality and Git-state evidence regression

The prose-only exception now replaces the broad impact assessment and full PR
evidence checklist with short Criteria/Verified paragraphs. It applies only when
spelling or wording changes no command, path, installation instruction, shared
rule or design meaning. Required repository gates still run, and their real
outcomes remain reportable. Semantic instruction changes such as this patch do
not qualify for that exception.

`AGENTS.shared.md` also requires successful tool output or explicitly supplied
evidence before asserting a branch, detached HEAD, clean/dirty tree or commit
history. Missing Git metadata leaves these facts unknown. Reconciliation must
explicitly withdraw a previous unsupported claim.

## Cause and implementation evidence

The broad impact instructions and full PR template remained unconditional after
the earlier small-edit allowance. The shared evidence rule also did not name the
missing-Git-state case. The baseline planning replay at
`20822b51d6250f3a9e1fa4d9ce1eee32c6269335` exhibited oversized prose assessments
in both commands and an unsupported `/fix` assertion of detached HEAD, a clean
tree and no commits, without supplied Git state or candidate tools.

The first patch, `a29688aa665522848242a51cd3f2ba908f887f22`, made the prose
exception explicit but still allowed `/next` to reproduce the full PR checklist.
That attempt is retained locally, including its original responses. The final
guidance commit, `7b127b00a4296248be9170ff03ff2ea2895af73a`, explicitly makes the
shortcut replace the full checklist. Neither the C2 oracle nor the pilot
generator, prompts, criterion IDs or verifier changed.

`tools/workflow-guidance.test.ts` checks the shared evidence contract and reads
each real canonical skill through `getSkill` before wrapping it with `skillPrompt`.
It guards delivery of the instructions, not model compliance or the wrapper's
default-reader integration. All three tests failed with main's instructions and
passed after the patch; reverting the guidance reproduced the failures. The two
shortcut guards were also seen failing before the final checklist clarification
and passing afterward.

The actual reader CLI ran for both `next` and `fix`, and the routed `next` dry-run
entry point produced the revised shortcut and preserved arguments. No live
autonomous `/next` or `/fix` engineering run, installation or merge was performed.

## Behavioral rerun

Rerun on 27 October 2026 against guidance commit
`7b127b00a4296248be9170ff03ff2ea2895af73a`, using Claude Code 2.1.302,
`claude-opus-5-5`, high effort. Tools, MCP servers and slash commands were empty;
built-in plugins remained listed by the host. The unchanged C2 acceptance report,
pilot prompts and evaluator were used. Twelve phases completed in six separate
case conversations, with phase B resumed only after phase A completed.

| Command / case | Provisional criteria passed | Formal receipt |
| --- | ---: | --- |
| next / caller | 3/3 | unverified |
| next / scope-growth | 4/4 | unverified |
| next / prose | 3/3 | unverified |
| fix / caller | 3/3 | unverified |
| fix / scope-growth | 4/4 | unverified |
| fix / prose | 3/3 | unverified |

The provisional assessment improved from 17/20 baseline criteria to 20/20, with
no observed C2 caller or scope-growth regression in this sample. Both scope cases
identified the unchanged installer, selected its existing multi-tag test and
rejected the unrelated `stableTags` change. Caller cases identified the
injected-body coverage gap. These are assessments of complete planning responses,
not passing human-graded receipts or executed hypothetical changes.

| Prose response | Baseline words, A / B | Revised words, A / B |
| --- | ---: | ---: |
| next | 635 / 467 | 149 / 137 |
| fix | 428 / 531 | 193 / 131 |

Both revised prose cases use short Criteria/Verified paragraphs and mark checks
as unrun. The baseline fix response asserted "detached `HEAD`, clean tree, no
commits listed" without evidence; neither revised prose response asserts Git
state. Both also correct an initially assumed README location after learning
that the supplied sentence is synthetic. This sample did not elicit a new
unsupported Git claim requiring withdrawal; the explicit withdrawal instruction
is covered by the delivery guard, not demonstrated by such a behavioral case.

The local capture audit accepted all six packets: pinned source and packet hashes,
delivered prompts, complete response captures, same-conversation phase order,
positive timings and absence of candidate tool events were consistent. The
unchanged verifier accepted completeness/integrity and deliberately returned exit
1, `unverified`, for every receipt: all 20 human grades are unverified, with zero
passing human receipts. This is a local consistency audit, not independent
attestation of host execution. Token and cost usage remain unknown. Completed
phase durations sum to 559,339 ms, excluding preparation, retries and review.

An interrupted next/scope-growth capture and a recovery that incorrectly reused
its packet are preserved locally and are not credited. The credited replacement
used a newly prepared packet, trial ID and session; all other completed cases
were retained. The earlier patch's unsuccessful prose attempt is also preserved.

[The review evidence](prose-proportionality-evidence.json) contains all twelve
complete clean responses, byte digests, packet/session IDs, per-criterion literal
excerpts, provisional assessments and unverified receipt summaries. Raw host
streams and complete packet bundles remain local because they include host
metadata; their hashes are recorded. The evidence file is a review export, not a
replacement for the evaluator's packet/result verification.

## Local validation and limits

- `npm ci`, typecheck and the no-runtime-dependency check passed.
- Full suite: 501 tests, 479 passed, 22 skipped, zero failures. The skips are 14
  optional real-MemoryKit checks without `MEMORYKIT_CLI`, seven shell-hook checks
  without `sh`, and the Linux-only no-PowerShell installation check. The latter
  is covered by the existing Linux CI job; this Windows run did not exercise it.
- Videos: clean dependency install, TypeScript check and Biome lint passed.
- The no-attribution commit-range gate and `git diff --check` passed.
- The advisory design check reports the same four findings with main's guidance
  restored: missing contract entries for `publish-release.ts --skip-unready`,
  `tools/conversation-memory.ts`, `tools/conversation.ts`, and the `conversation`
  command. These are existing findings, outside this fix.

The replay uses an injected pinned skill body and a partial source snapshot.
Reader CLI and dry-run checks cover instruction delivery separately; none of
these checks proves model reliability across hosts, real engineering execution,
CI or merge behavior. One sample per command/case is insufficient for a
reliability estimate or causal attribution of every difference to this patch.
