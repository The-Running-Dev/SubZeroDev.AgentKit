# Optional usage evidence in behavioral pilot receipts

Inspected main: `13983c616f9291a06efaf07db843654f39d95ac7` (#514).
The implementation reuses its native Codex reader and C2's existing three cases
through both `/next` and `/fix`. It adds no runtime dependency, candidate executor,
automatic session discovery, hook, cost estimate or new workflow gate.

`tools/evaluate-workflow.ts --verify` accepts either the existing `usage: null`
or an explicit Codex source reference. See the
[receipt instructions](behavioral-regression-pilot.md#optional-native-codex-session-evidence)
for its four fields. The verifier resolves the source inside the result directory,
checks its original-byte digest, session ID, CLI version and model, then returns
the existing meter's report under session-scoped usage evidence. Operator-supplied
totals are refused. Coverage, warnings, unknown counters and observed zero retain
their existing meanings. Behavioral grading remains independent of usage.

## Real producer smoke check

On 2026-10-29, Codex CLI `0.158.0` ran a fresh read-only smoke session with
`--ignore-user-config --skip-git-repo-check --sandbox read-only --json` and a
request to reply with `USAGE_CAPTURE_OK` without tools. Its recorded model was
`gpt-6-astra`; the observed agent response was exactly that string and no tool
execution appeared in the event capture.

The explicitly selected native rollout had SHA-256
`2447c1c46473b48bcd22570397370956068629cb324bf04655f2673e57d8fd7f`
and 61,051 bytes. Running the real `tools/measure-session.ts --transcript-path`
entry point produced:

| Counter | Native reader | CLI completion event |
|---|---:|---:|
| Input | 16,681 | 16,681 |
| Cached input | 0 | 0 |
| Cache write input | 0 | 0 |
| Output | 8 | 8 |
| Reasoning output | 0 | 0 |
| Total | 16,689 | 16,681 + 8 |

Coverage was `observed`, with no warnings: one cumulative `token_count` event
and one `token_usage_record`. The response record preceded the cumulative
snapshot; it was not added again. This verifies one real producer shape, not all
versions or every possible record sequence. It establishes no billed cost.

## C2 receipt validation

Six deterministic integration cases exercise all three C2 cases through both
commands. They verify source-derived totals, coverage and digest retention,
privacy of successful output, and unchanged behavioral fail/unverified outcomes.
Additional tests reject changed/missing/escaping sources, directory junction
escapes, supplied totals, provider/session/version/model conflicts, malformed
JSON and decreasing cumulative counters. Partial, unavailable and observed zero
remain distinct. The CLI entry point is exercised as well as the library.

The six-case regression was also run with the implementation temporarily
replaced by inspected main's verifier. It failed with
`Pilot usage must be null (unavailable); no usage reader is implemented.`
The implementation was restored afterwards.

## Six live C2 captures

On the same date, all six command/case combinations were prepared against the
inspected main SHA above and run in fresh Codex CLI `0.158.0` sessions with model
`gpt-6-astra`. Phase A used `exec --ignore-user-config --skip-git-repo-check
--sandbox read-only --json`; phase B used `exec --ignore-user-config
--skip-git-repo-check --json resume` with that trial's session ID. Each phase's
canonical prompt was supplied verbatim; phase A also received the complete pinned
workspace inline, without the oracle or phase B. Tools were available, with an
instruction not to call them. Every observed item in both phases was an
`agent_message`; no tool execution appeared in the CLI event captures.

Packet preparation used this implementation's working-tree generator with
SHA-256 `9d32dc439c07bee17aff2fb3a3050f959e09a8d56d52985b5bdca4470de31f76`,
recorded consistently in all six manifests. This identifies the generator bytes
separately from the pinned main source snapshot; it does not claim the generator
was run from a committed revision. Each completed native rollout was copied
unchanged to its private result directory and explicitly referenced by the result.

| Command | C2 case | Input tokens | Output tokens | Total tokens | Rollout SHA-256 |
|---|---|---:|---:|---:|---|
| next | caller | 155,634 | 1,350 | 156,984 | `a84c20225deeb27ef3de67e0019aa70f831b0685cd12e04045784632ee8fa481` |
| next | scope-growth | 161,240 | 1,701 | 162,941 | `14fc3142badaccb94c0803ceea679dd21ba2d7a5219a4aff37a187ca6711e620` |
| next | prose | 154,909 | 242 | 155,151 | `555a7366f2a7c61c7bfcf0c33336661ec53810593a2aa56ba828179a892ec926` |
| fix | caller | 156,980 | 1,555 | 158,535 | `5d1c91d904cc5eb3ac51c8ad75d7108368d94d3fb2a6ffbdb76bada6a11c5181` |
| fix | scope-growth | 151,112 | 1,440 | 152,552 | `0fdb1ad1f293b5ca06daa105c0b15219e45aaf20b28af4e6f12846b7cd4d8f91` |
| fix | prose | 150,589 | 240 | 150,829 | `a4a6f7ad58ad3d104b90192454462efd6e00aa64f5acc7bc7016d20e81ba6a05` |

For every trial, the standalone meter report equalled the receipt's derived
report, coverage was `observed`, warnings were empty, and there were two
`token_count` snapshots and two `token_usage_record` records. All five available
counter categories matched the final CLI completion event, including cached
input and reasoning output. The resumed completion event was cumulative; adding
the two CLI events would double-count phase A. Total tokens equal input plus
output; cached input and reasoning are subsets, not extra tokens.

All six receipts remained `unverified` and their verifier commands exited 1,
because every semantic criterion was explicitly left unverified pending human
review. This validates capture-to-receipt accounting and the grading boundary;
it is not a behavioral pass or a no-regressions finding. Elapsed values were
captured but are excluded from comparisons because the machine hibernated during
the run. These trials establish neither comparative savings nor billed cost.

## Local verification

- `npm run typecheck` and `npm run check:no-runtime-dependencies` passed.
- The focused verifier/reader tests passed 45/45 with no skips.
- `npm test` passed: 553 passed, 22 skipped, zero failures (575 total).
- The independent MEDIUM-risk review found no findings; its scope and the
  five verification levels are recorded in the [review ledger](../reviews/usage-evidence-integration.md).

## Limits

Digest and identity consistency bind source bytes to a receipt. They do not
prove that a session executed the intended packet, started fresh, contained only
that trial, or emitted the captured phases in order. Session membership remains
an operator attestation; semantic criteria require human review. No phase-level
token allocation, regression verdict, comparative savings or billing claim can
be inferred from a usage receipt alone.

Raw producer rollouts and CLI captures remain outside the checkout because they
can contain prompts, responses, paths and other private source material. This
report publishes only selected counters and digests, not the raw captures.
