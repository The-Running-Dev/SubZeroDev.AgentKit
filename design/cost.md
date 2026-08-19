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

## Closure sizes, over the records that exist (S5.12)

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
`unit/document/agents-md`'s) exceeds the ceiling, so this slice proceeds rather than stopping
per the brief's abandonment line.

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
