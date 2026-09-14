# Cost

`tools/Measure-Session.ps1` reads real per-call usage from a Claude Code session's own
transcript. It measures; it does not estimate. **Claude Code only** — Codex writes a different
transcript schema this has no reader for, and Copilot records no token usage at all, so neither
is measured here (`tools/Measure-Session.ps1`, header comment).

## Before: a `/slice` session with no `design/state/` directory

Session `963e6aed`, this repository, `/slice S4` — measured partway through implementing that
slice. At the point this reading was taken, `design/state/` did not yet exist, so this is the
cost of a `/slice` session against a corpus with no state set to read.

```
$ ./tools/Measure-Session.ps1 -SessionId 963e6aed -Detail
{
  "idleThresholdMinutes": 5,
  "sessions": [
    {
      "id": "963e6aed",
      "started": "2026-08-19T07:26:11",
      "spanSeconds": 103.0,
      "activeSeconds": 103.0,
      "models": ["claude-sonnet-5"],
      "total": {
        "calls": 33,
        "input": 66,
        "cacheCreate": 192263,
        "cacheRead": 3320165,
        "output": 8850
      },
      "segments": [
        {
          "label": "/slice",
          "calls": 33,
          "input": 66,
          "cacheCreate": 192263,
          "cacheRead": 3320165,
          "output": 8850
        }
      ]
    }
  ]
}
```

33 calls, 192,263 cache-creation tokens, 3,320,165 cache-read tokens, 8,850 output tokens, over
103 seconds of active time — reached before `design/state/` was written, orienting on this
slice by reading `design/10-design.md` and `design/20-contract.md` directly.

## Closure sizes at S5, under the records-only definition (S5.12)

**Historical.** This reading predates S19, which made the closure count the unit's own artifact.
It is kept because it is the evidence that S19's change of definition — not corpus growth — is
what moved the ceiling from met to unmet. The current reading is the section after it, and it is
the one that describes the repository today.

`tools/Test-DesignState.ps1` names the largest closure on every run — clean or failing — never
predicted, always measured:

```
$ ./tools/Test-DesignState.ps1 -Quiet
Largest closure: unit/document/agents-md, 1671 bytes (ceiling 16384), largest contributor
decision/2026-08-10-frozen-md-marker
```

1,671 bytes against the 16,384-byte ceiling — 10% of the budget, with eight records in the
state set (`unit/command/track`, `unit/document/agents-md`, `I3`, `I4`, `I9`, `I28`, and two
decision records). Neither closure S4.6 wrote (`unit/command/track`'s or
`unit/document/agents-md`'s) exceeded the ceiling, so that slice proceeded rather than stopping
per the brief's abandonment line. That conclusion was correct under the definition then in
force and does not survive S19's.

## Closure sizes under the artifact-inclusive definition (S19)

The same command, at `15990d9`:

```
$ ./tools/Test-DesignState.ps1 -Quiet
Largest closure: unit/document/design-90-decisions, 296929 bytes (ceiling 16384), largest
contributor design/90-decisions.md
```

**Sixteen units exceed the ceiling, and every one of them exceeds it on its own artifact.** The
brief's *Abandonment* line is therefore live, and adjudicating it is reserved to the user
(`design/10-design.md` § *Whether the ceiling can be met*). No number below is predicted; each
is the difference between the checker's closure and the file's own size.

| Unit | Closure | Artifact | Records alone |
|---|---|---|---|
| `unit/document/design-90-decisions` | 296,929 | 295,452 | 1,477 |
| `unit/document/design-20-contract` | 99,902 | 84,003 | 15,899 |
| `unit/script/test-designstate` | 98,912 | 88,235 | 10,677 |
| `unit/document/design-10-design` | 70,054 | 60,565 | 9,489 |
| `unit/document/agents-md` | 62,927 | 43,720 | **19,207** |
| `unit/document/install-md` | 36,851 | 29,284 | 7,567 |

**One unit breaches on its records alone, and that is a different failure from the other
fifteen.** `unit/document/agents-md` carries 25 decisions in `Live` totalling 17,073 bytes —
89% of its record closure — and their terms are already written into named `AGENTS.md`
sections. They are executed decisions that were never given a `StatedIn` site, so a set the
design defines as *in flight* has become a history. Across the state set, 84 of 89 accepted
decisions sit in some unit's `Live` and 5 of 96 decision records carry a site.

That half is remediable by absorption and nothing on the closed list detects it; the other
fifteen are not remediable by anything the mechanism has. Both are recorded here rather than
in a running count, because this document is what the brief's *Cost* criteria are measured
against.

## Closure sizes under the records-bounded definition (S23, superseding the derived table above)

**Measured, not derived.** `tools/Test-DesignState.ps1` now implements the records-bounded
definition `design/00-brief.md` and I23 state — the closure is the sum of the unit's own record
plus every id it names directly, and the unit's own artifact is measured and reported separately,
never folded into the bound. The run below is `Get-DesignClosure` and `Get-UnitArtifactBytes`
against this repository at `c760cc9`, the commit S23 measured from — the first run of the amended
meter, replacing the arithmetic-derived table above.

**Two units breach on their records; five of the seven clear immediately.**

| Unit | Records alone (bounded) | Artifact (reported, not bounded) | Breaches |
|---|---|---|---|
| `unit/document/agents-md` | **19,207** | 43,930 | yes |
| `unit/document/design-20-contract` | **17,921** | 87,366 | yes |
| `unit/script/test-designstate` | 13,340 | 88,944 | no |
| `unit/document/design-10-design` | 8,519 | 63,489 | no |
| `unit/document/install-md` | 7,567 | 29,284 | no |
| `unit/command/track` | 6,836 | 15,974 | no |
| `unit/document/design-90-decisions` | 1,477 | 316,376 | no |

The two record-bounded figures match the arithmetic-derived table's exactly, which is the
evidence that the derivation was sound; the artifact figures differ from the derived ones because
the tree has moved since `fcef65b` — three fix commits (#197, #198, #199) and this slice's own
projection regeneration of I23's row all landed on `design/20-contract.md` and
`tools/Test-DesignState.ps1` in between.

Both breaches are absorption-remediable and neither is a reason to stop: `agents-md` carries
17,073 bytes of `Live` decisions whose terms already stand in named `AGENTS.md` sections, and
`design/20-contract.md` carries the analogous gap on its own `Live` set. The brief's *Abandonment*
line fires on this bound only once every executed decision has been given its site, so it is not
live until that pass has run — which is what S24 and S25 do, one unit each.

## After: a `/slice` session with `design/state/` present (S15.5)

Session `e5bc7d5d`, this repository, `/slice S15` — measured near the end of that slice, with
`design/state/` fully populated by S4 through S13.

```
$ ./tools/Measure-Session.ps1 -SessionId e5bc7d5d -Detail
{
  "idleThresholdMinutes": 5,
  "sessions": [
    {
      "id": "e5bc7d5d",
      "started": "2026-08-19T16:33:35",
      "spanSeconds": 1093.0,
      "activeSeconds": 1093.0,
      "models": ["claude-sonnet-5"],
      "total": {
        "calls": 136,
        "input": 272,
        "cacheCreate": 898151,
        "cacheRead": 20411553,
        "output": 613639
      },
      "segments": [
        {
          "label": "/slice",
          "calls": 136,
          "input": 272,
          "cacheCreate": 898151,
          "cacheRead": 20411553,
          "output": 613639
        }
      ]
    }
  ]
}
```

136 calls, 898,151 cache-creation tokens, 20,411,553 cache-read tokens, 613,639 output tokens,
over 1,093 seconds of active time.

**Not a clean before/after comparison.** S4 was a small, sequential slice; S15 fanned out 15
background subagents to run `/install-all` across every sibling repository (S15.2), which drives
cache-read far above what orienting on the design state alone costs — most of this session's
token volume is the fan-out, not the orientation this measurement exists to isolate. Read the
before/after pair as bracketing the true before/after, not as it. The comparison this measurement
was meant to settle — orienting from `design/state/` versus orienting by reading
`design/10-design.md` and `design/20-contract.md` directly — is better read from the *rate* of
growth per call than the totals: before, cache-read grew from a corpus with no state set at all;
after, the same orientation step draws on `design/state-index.md` and per-unit closures instead,
which is what `design/10-design.md` § *Orient* claims makes it cheaper.

Covers Claude Code only — Codex writes a different transcript schema this has no reader for, and
Copilot records no token usage at all, so neither is measured here.

## Correction: Measure-Session readings above double-count multi-block responses

Claude Code writes one transcript record per content block of a response — thinking, text, and
each tool call — and every one of them repeats the response's `message.id` and full `usage`.
`tools/Measure-Session.ps1` summed per record until [#297](../../issues/297), so the call counts
and token totals in both session readings above, and in `reports/weekly/2026-08-30.md`, are
inflated. Across 596 transcripts in four repositories, last written 2026-08-24 to 2026-09-14,
there were 32,924 distinct responses and 29,774 duplicate usage records. The readings are left as
they were taken; re-run the script against the same session ids for corrected ones.

## Output

What a session writes stays in its context, so it is paid for again on every later call. This is
why `AGENTS.md`, *Output discipline* exists. The script reports only what a transcript states
exactly, per session, command segment, and subagent total:

- **Output tokens per response**, counted once per `message.id`.
- **Completion responses**: the calls that end a turn (`stop_reason` `end_turn`), their output tokens, and the characters of visible text they carry.
- **Visible text characters** across all responses, and **tool-result characters** entering context.
- **Peak context**: the largest `input + cacheCreate + cacheRead` of any one call.

**What cannot be measured exactly, and is not reported.** `usage.output_tokens` covers a whole
response, so no split between thinking, visible text, and tool-call input exists to read.
Characters are characters, not tokens. No metric here calls any output waste.

**Measured, same four repositories and window, one count per response:**

| | |
|---|---:|
| Output tokens, all responses | 19,558,957 |
| Output tokens in the 1,615 completion responses | 1,116,408 (5.7%) |
| Visible text, all responses | 3,908,160 chars |
| Tool results entering context | 73,427,582 chars — 18.8× the visible text |
| of which `Read` | 39,796,391 chars (54.2%) |
| of which shell commands | 29,689,936 chars (40.4%) |

**What this settles and what it does not.** Completion prose is a small share of output, and tool
results are the larger input to later context by an order of magnitude in characters. That is why
*Output discipline* covers tool output as well as the report, and why no generic truncation
framework exists: most tool characters are full reads that *Safe start* requires. The effect of the
rule itself is **not yet measured**. It only reaches sessions started after it lands.

**The benchmark.** Run one workflow against one fixed repository state, once from a checkout
without the rule and once with it, each in a fresh session on the same model. `/kit-help` is the
reference workflow: it reads and reports without writing, so both sides do the same work. Then
compare `./tools/Measure-Session.ps1 -SessionId <id> -Detail` for the two sessions on
`completionOutput`, `completionTextChars`, `output`, `toolResultChars`, and `peakContext`. One pair
is one observation. Report the number of pairs next to the result, and name Codex and Copilot as
unmeasured.
