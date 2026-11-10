# MemoryKit Browse-and-Select Cost Benchmark

This benchmark addresses the missing multi-page cost evidence in [#529](https://github.com/The-Running-Dev/SubZeroDev.AgentKit/issues/529), following [#528](https://github.com/The-Running-Dev/SubZeroDev.AgentKit/pull/528). It measures AgentKit's existing `context`, `browse` and `select` adapters against a real MemoryKit CLI. It changes no retrieval or injection behavior.

## Reproduce

Use Node >= 22.18 and Git. From an AgentKit checkout, build the exact MemoryKit source used for the committed results in a sibling directory:

```sh
git clone https://github.com/The-Running-Dev/SubZeroDev.MemoryKit.git ../MemoryKit
git -C ../MemoryKit checkout f5a951c41e2f0276e810b55165bedf866e8bf8e8
npm --prefix ../MemoryKit ci
npm --prefix ../MemoryKit run build
node tools/memorykit-benchmark.ts --cli ../MemoryKit/dist/cli/main.js --records 12,120 --repeats 3 > memorykit-benchmark.json
```

`--cli` may instead be supplied through `MEMORYKIT_CLI`, matching the existing tests. It must name a built JavaScript CLI entry point. The command fails if it is missing, unsupported or unsuccessful; it never substitutes a fake implementation. No package publication or global installation is needed. The results record Node/OS/architecture, CLI version, CLI entry-point SHA-256, harness SHA-256 and AgentKit checkout commit. The CLI hash covers its entry point; use the pinned source commit to reproduce its imported modules and lockfile.

The command creates a separate temporary store for each record count, using normal `init` and default Git history. Every fixture write uses the real CLI through AgentKit; the benchmark never reads installed configuration, accepts a store path or accesses personal memories. It removes only the temporary directories it created. Setup, writes, source identification and postflight checks are excluded from measured retrieval costs. Expect seeding to take minutes on some hosts.

## Workload And Comparison

- Each store contains 12 or 120 primary accepted records, plus one accepted replacement: 13 or 121 eligible records. Candidate, foreign, superseded and archived controls reproduce the previous test's eligibility setup.
- Primary content uses the previous test's `Kept <ordinal>. ` prefix, kind mix and 40–480 character body distribution. The larger fixture repeats that distribution, avoiding a confound from ever-growing record sizes.
- Three fixed targets are designated before retrieval: primary ordinals 0, floor(count/2), and count−1. They stand for relevant records in this synthetic task. IDs and revisions come from fixture creation, but selections are constructed only from revisions actually discovered by browsing. There is no learned relevance model or inference call.
- Automatic retrieval calls the existing task-agnostic `context` function. Explicit retrieval exhaustively enumerates unfiltered browse pages, then selects those three targets, in fixed ordinal order. It does not stop early or exploit target IDs to skip pages. Every eligible ID must appear exactly once; missing, duplicate, non-progressing or repeated pages fail the run. Negative controls must not appear in the enumeration.
- Browse uses 20 items, 8,192 bytes and zero preview characters per page. Continuations preserve the same filters and bounds. Individual gets are counted separately from browse pages.
- Both paths use the same context budget in a pair. `default` uses 8,192 bytes. `all-fit` uses a fixture-derived, generous common budget and asserts automatic context includes all eligible records and all three targets. The latter compares successful target delivery, though automatic output includes additional records by design. The default comparison reports any target coverage difference rather than treating omitted context as a saving.
- Three repeats share an immutable store. Order alternates automatic-first, browse-first, automatic-first. There is no warmup, cache reset or cold-cache claim. Every retrieval starts real CLI child processes; repeats may benefit from OS caches. Timing on a shared host is diagnostic.

The benchmark asserts browse/select leaves automatic context unchanged with a separate, unmetered retrieval. This validation must not inflate the measured automatic call count.

## Metrics

| JSON Field | Meaning |
| --- | --- |
| `rawCliStdoutBytes` / `rawCliStderrBytes` | Sum of UTF-8 bytes emitted by real MemoryKit child processes, including JSON envelopes and newlines. These are adapter transport costs, not necessarily model-visible output. |
| `agentkitResponseBytes` | Sum of UTF-8 bytes of each returned AgentKit result serialized as JSON plus one newline, matching its command output format. Explicit cost includes every browse result and the select result. This is calculated from measured return values; outer AgentKit process startup/serialization is not timed. |
| `legacyOutputBytes` | The old diagnostic's metric: automatic context `Bytes`, versus the sum of MemoryKit-reported browse `Bytes` plus selected context `Bytes`. It mixes page envelopes and formatted text; it is neither raw transport nor complete AgentKit response size. |
| `contextTextBytes` | UTF-8 size of the final fenced automatic or selected context text alone. Explicit summaries are excluded here and included in the other output metrics. |
| `cliCalls` | Retrieval child-process invocations only. Fixture creation, capability probing and postflight validation are excluded. |
| `elapsedMs` | Wall time around each adapter flow, including CLI startup, I/O, JSON parsing and adapter validation; excludes setup, postflight and model thinking time. Per-call times are retained too. |
| `recordsInspected` | Record rows returned to the adapter: automatic search items; explicit browse summaries plus selected get results. Repeated get rows count again. This is not provider scan work, human attention or model inspection. |
| `distinctRecordsInspected` | Unique returned record IDs across that flow. |
| `pageCount` | Search pages for automatic retrieval; browse pages for explicit retrieval. Individual get calls are not pages. |
| `targetHits` / `targetCount` | Fixed synthetic target markers present in the final context text. Not a general retrieval-quality score. |

No actual model is invoked. `actualModelTokens` and `tokenEstimates` are explicitly null. Bytes cannot establish actual token consumption, billing or inference efficiency; tokenizer, host wrapping and which results reach a model would need a separate measurement. No token or general retrieval-efficiency saving is claimed.

## Earlier Diagnostic Correction

The earlier 12-primary-memory diagnostic reported 4,807 automatic context bytes and two automatic CLI calls. Its spy was read **after** a second `context` call checking invariance. The reported automatic call count therefore included verification; the elapsed measurement and byte total did not. The test now snapshots the counter immediately after retrieval. One automatic search call is expected for this fixture. The old browse-plus-three-selects figure of 4,654 bytes also selected the first three browse results; this benchmark's fixed targets differ, so its explicit byte total need not match that number.

## Regression Coverage

```sh
npm ci
npm run typecheck
node --test tools/memorykit-benchmark.test.ts
MEMORYKIT_CLI=../MemoryKit/dist/cli/main.js node --test tools/memorykit-benchmark.test.ts
```

For PowerShell, set `$env:MEMORYKIT_CLI` to the absolute CLI path before the last command. Without that environment variable, the real-CLI test is explicitly skipped. The two always-on tests use a labeled in-process synthetic runner for deterministic continuation and accounting regression coverage; their timings and byte counts are never presented as real-CLI evidence.

The optional real-CLI test enumerates item-limited and byte-limited pages, checks all 13 eligible IDs and all three targets, and verifies the postflight search is excluded. The always-on continuation test was also run with cursor forwarding temporarily removed from `browse`: it failed on a duplicated first-page record. Forwarding was restored before validation.

## Recorded Results

The measured results and their interpretation appear below; the complete per-repeat and per-call evidence is in [the JSON result](evidence/memorykit-benchmark-2026-11-10.json).

Measured November 10, 2026 on Linux x64, Node v24.22.1, MemoryKit 0.2.0-rc.1 at the pinned commit above. Each row summarizes three real-CLI repeats. Byte and count metrics were identical across repeats; latency is median [minimum–maximum] in milliseconds. These are observations from this synthetic workload.

| Primary Records / Budget | Path | Raw CLI stdout bytes | AgentKit JSON bytes | Legacy Output Bytes | Context Text Bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| 12 / default | Automatic | 13,762 | 4,979 | 4,807 | 4,807 |
| 12 / default | Browse + Select | 5,951 | 4,120 | 4,528 | 1,402 |
| 12 / all-fit | Automatic | 13,762 | 4,981 | 4,808 | 4,808 |
| 12 / all-fit | Browse + Select | 5,951 | 4,122 | 4,529 | 1,403 |
| 120 / default | Automatic | 128,063 | 8,299 | 8,118 | 8,118 |
| 120 / default | Browse + Select | 33,305 | 25,258 | 31,876 | 1,164 |
| 120 / all-fit | Automatic | 128,063 | 44,928 | 44,645 | 44,645 |
| 120 / all-fit | Browse + Select | 33,305 | 25,260 | 31,877 | 1,165 |

| Primary Records / Budget | Path | CLI Calls | Pages | Rows Inspected | Distinct IDs | Targets Included | Elapsed ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 12 / default | Automatic | 1 | 1 | 13 | 13 | 3/3 | 356.3 [325.9–435.3] |
| 12 / default | Browse + Select | 4 | 1 | 16 | 13 | 3/3 | 1426.9 [1324.9–3054.0] |
| 12 / all-fit | Automatic | 1 | 1 | 13 | 13 | 3/3 | 471.5 [367.0–540.3] |
| 12 / all-fit | Browse + Select | 4 | 1 | 16 | 13 | 3/3 | 1792.6 [1685.6–3187.6] |
| 120 / default | Automatic | 2 | 2 | 121 | 121 | 1/3 | 644.3 [637.4–1251.2] |
| 120 / default | Browse + Select | 10 | 7 | 124 | 121 | 3/3 | 3303.3 [3303.0–3689.0] |
| 120 / all-fit | Automatic | 2 | 2 | 121 | 121 | 3/3 | 617.9 [598.6–629.6] |
| 120 / all-fit | Browse + Select | 10 | 7 | 124 | 121 | 3/3 | 3598.5 [3594.6–4214.0] |

All measured CLI stderr sizes were zero. The default limits were 8,192 bytes; the all-fit limits were 11,939 and 96,307 bytes for 12 and 120 primary records respectively. Automatic context included 13/13 eligible records in both small scenarios, 20/121 in the larger default scenario, and 121/121 in the larger all-fit scenario. Its search returned all eligible rows in every case; no 500-item truncation occurred.

The larger browse walk returned page counts `[20, 20, 20, 20, 20, 20, 1]`, passed six continuation cursors, and then made three get calls. It inspected 121 distinct summary IDs and fetched the three targets again, accounting for 124 returned rows. The small walk returned one page of 13 summaries plus three gets.

The corrected small baseline reproduces the earlier 4,807 automatic text bytes with **one retrieval CLI call**, not two. Its explicit byte total differs because the three targets are fixed by fixture ordinal instead of taking the first three provider-ordered results.

In the larger default scenario, raw CLI transport was smaller for browsing, while the complete AgentKit response was larger (25,258 versus 8,299 bytes) and included more target content (3/3 versus 1/3). Comparing those as equivalent retrieval outcomes would hide the coverage difference. In the larger all-fit scenario, both paths included all targets; explicit browsing produced fewer raw CLI and AgentKit response bytes, while requiring ten versus two CLI calls and a higher median elapsed time. Automatic context deliberately included many additional records, so these results support only the stated workload tradeoff, not general retrieval efficiency or token savings.

No production-scale, ranking-quality, model-attention, model-token, cold-cache, remote-provider or cross-platform conclusion follows from these measurements. The zero-preview, exhaustive policy also differs from an interactive user stopping early or changing filters. Issue #529's separate wording and capability-detection follow-ups remain outside this PR.
