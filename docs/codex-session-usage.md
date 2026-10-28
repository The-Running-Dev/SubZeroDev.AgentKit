# Codex session measurement

The existing meter can read one explicitly selected native Codex rollout without
launching a provider, writing a log, registering hooks, or finding other sessions:

```sh
node tools/measure-session.ts --transcript-path /path/to/rollout.jsonl
node tools/measure-session.ts --transcript-path /path/to/rollout.jsonl --human
```

Default project/directory discovery and `--hook` remain Claude-only. Codex does
not support `--session-id` filtering. `--detail` adds no Codex command segments:
those and the idle-threshold option are Claude-only measurements. The existing
Claude JSON/human report and its separate subagent accounting retain their units.
Programmatic callers use `measureTranscript` for provider dispatch;
`measureSession` retains its Claude report type.

## Accounting contract

Codex JSON has schema `agentkit.codex-usage.v1` and provider `codex`. It reports:

- Source byte count, SHA-256 of the entire observed file, observed CLI versions,
  metadata session identity and models. The file path and conversation text are
  not copied into the report. A digest identifies input; it does not attest execution.
- `totals`: the latest observed `payload.info.total_token_usage` from an
  `event_msg` whose payload type is `token_count`. Cumulative snapshots are
  replaced, never added. Repeated snapshots do not increase totals.
- `lastUsage`: the last observed token-count info's `last_token_usage`, kept
  separate and never used as a fallback cumulative total. Missing last usage
  remains null. Event/snapshot counts are observations, not calls or turns.
- Native input/output/total counters, with cached input and reasoning output
  retained as subsets. Missing optional cache-write input is null, not zero.
- `coverage`: `observed` means supported snapshots were found without detected
  gaps; it does **not** prove a complete session or billing accuracy. `partial`
  retains observed totals with explicit warnings. `unavailable` has null totals.
  An explicitly recorded zero remains distinguishable from missing usage.
- Unavailable calls, command segments, completions, text-character metrics,
  peak context, subagent attribution and billed cost. They are not fabricated
  from Codex events or combined with Claude metrics.

Newer `token_usage_record` response records are counted but not added to this
ledger. A file containing only those records is unavailable. A response record
after the last cumulative snapshot makes coverage partial. Reading that newer
ledger would require its own identity, replay and accounting contract.

Negative, fractional, unsafe, missing required or nonnumeric counters fail.
Impossible cache/reasoning subsets fail. A cumulative counter decrease fails
because a reset, reorder or mixed history cannot be reconciled safely here.
Repeated metadata with the same identity is accepted for resume; different
thread or logical-session identities fail. Codex's synthetic non-additive
context-limit totals are preserved with a partial-coverage warning.

## Input and privacy boundaries

The reader streams 64 KiB chunks, with a 256 MiB file limit and an 8 MiB line
limit. Excessive input fails. It accepts UTF-8 BOM, CRLF and valid final JSON
without a newline. Malformed interior JSON fails without echoing its text;
an incomplete final JSON record yields partial/unavailable coverage. A file
still being written represents only the bytes observed during that read.

There is no network access, home-directory scan, persistent report cache,
price table or transcript mutation. Reading this file does not independently
verify its provenance or establish savings. Validate real usage against a
chosen producer/version before relying on a new transcript schema.

## Source and regression evidence

The native counter and event shapes are based on pinned upstream
[Codex protocol.rs](https://github.com/openai/codex/blob/c62e9df39f3bc2e1eae124a79075e9bc5555fe1a/codex-rs/protocol/src/protocol.rs),
including `TokenUsageInfo::new_or_append`, optional usage and synthetic
context-window totals. Upstream's
[rollout persistence policy](https://github.com/openai/codex/blob/c62e9df39f3bc2e1eae124a79075e9bc5555fe1a/codex-rs/rollout/src/policy.rs)
persists token-count events and response usage records.

[ECC's cumulative snapshot reader](https://github.com/affaan-m/ECC/blob/25278e7d7b6cf6e6a4e7a6c8e10f14ff22f0eb5b/scripts/lib/session-cost-snapshot.js)
is a reference for bounded reads and avoiding cumulative-row summation. The
implementation here is a native Codex adapter; ECC's Claude cost hook is not
used or installed.

`tools/fixtures/codex-session/usage.jsonl` is synthetic, including its
`0.0.0-fixture` producer label. It is not a captured or certified CLI version.
Its repeated cumulative 130-token snapshot followed by a 230-token snapshot
must report **230**, with last usage **100** and no added cache/reasoning subset.
`tools/codex-session-usage.test.ts` exercises that fixture through both JSON and
human CLI entry points, missing/partial usage, identity/reset failures,
counter validation, malformed/oversized input and chunk boundaries.
