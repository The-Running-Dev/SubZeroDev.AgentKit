# Behavioral pilot suite report validation

The read-only suite reporter adds explicit selection, fixed C2 slot/criterion
counts, byte-exact trial deduplication, conflict refusal and cohort separation
around the existing #515 verifier. It makes no model call and assigns no grades.
See the [selection and output contract](../docs/behavioral-pilot-suite.md).

## Retained native capture check — 2026-10-29

Implementation started from AgentKit main
`f9c4633b6e3136a0197a5472eaa88f6ce5a207b6` after checking current main,
open issues and open PRs. No existing issue or PR implemented this report.
The end-to-end report check reused the six private #515 two-phase native Codex
captures, not newly executed model trials. Their packet source is
`13983c616f9291a06efaf07db843654f39d95ac7`; their recorded producer and exact
host/model/settings attestations form one cohort. The report records the current
verifier/reporter byte hashes separately and does not relabel the captures as
executions of current main.

Both JSON and Markdown CLI calls exited **1**, correctly reporting `unverified`:

| Evidence | Result |
| --- | --- |
| Expected/received slots | 6/6, one trial per slot |
| Human criterion grades | 0 pass, 0 fail, 20 unverified |
| Invalid/duplicate/conflicting receipts | 0/0/0 |
| Usage coverage | 6 observed, 0 partial/unavailable/unattached/reused |
| Session input/output/total tokens | 930,464 / 6,528 / 936,992 |
| Cached input tokens (subset of input) | 523,520 |
| Reasoning output tokens (subset of output) | 225 |
| Cache-write input tokens | 0, observed |
| Original capture/packet files | All 174 byte digests unchanged |
| Reversed receipt order | Identical JSON report |

These are sums of six independent final session cumulative snapshots. They are
not incremental per-phase measurements, billed cost, or evidence of savings.
Elapsed times were omitted because the retained run includes hibernation.
Private selections/captures remain outside Git. No human review was fabricated;
there is still no behavioral pass or comparative improvement claim.

## Regression proof

Temporarily removing the session-reuse suppression condition made the targeted
`reused sessions across slots or cohorts` regression fail: a shared cumulative
session incorrectly contributed to a cohort total. The condition was restored
before the passing checks and independent review. Synthetic fixtures also test
failed/unverified grades, missing and excess slots, invalid/tampered receipts,
same-identity conflicts, deterministic ordering, incompatible metadata, null/
zero/partial usage, counter overflow, output privacy and evidence non-mutation.

Local verification passed: typecheck, no-runtime-dependency check and the full
repository suite (587 tests: 565 passed, 22 existing optional/platform skips,
zero failures). The focused verifier and new suite tests had no skips. Independent
review found no issues and separately passed all 12 new tests.
