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
