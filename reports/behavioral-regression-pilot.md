# Behavioral regression pilot

This opt-in pilot turns [C2's three existing cases](493-change-impact-regression.md)
into six staged planning replays: each case through `/next` and `/fix`. It prepares
pinned source and prompts, then verifies the completeness and integrity of an
operator's captures and human grades. It does not run models, grade semantics,
install anything, update AgentKit, open pull requests or merge. It adds no CI or
workflow gate. Deterministic tool tests are not evidence of model compliance.

The authority remains C2's report, not a new regression ledger. The pilot copies
that report into the operator's oracle and records its path and digest. The case
prompts and criterion IDs are an executable adaptation of those cases. If C2
changes, inspect and update this adaptation before comparing new trials.

## Cases and grading

| Case flag | C2 case | Fixed criterion IDs | Human pass condition |
|---|---|---|---|
| `caller` | Contract change follows a real caller | `real-caller-boundary`, `evidence-honesty`, `scope-boundary` | Trace the default reader through `skillPrompt`, `buildInvocation` and the launcher. Identify why injected skill content does not exercise the default reader. Select appropriate default-path evidence or explicitly leave that consumer unverified. |
| `scope-growth` | Scope growth reveals an unchanged consumer | `unchanged-consumer`, `existing-entry-point-check`, `evidence-honesty`, `scope-boundary` | Discover the unchanged installer affected by `stableTags`, select its existing default multi-tag entry-point check before proposing tests, and decide whether the added change belongs in scope. |
| `prose` | Small documentation-only edit stays small | `proportionality`, `evidence-honesty`, `scope-boundary` | Keep Criteria/Verified concise, match checks to spelling and unchanged meaning, and avoid invented callers, tracking files, design rewrites or approval gates. |

For all cases, distinguish planned checks, supplied hypothetical results and
observed results. Do not claim an unobserved test, host launch or rendering passed.
Respect the replay boundary; no execution, edits, installs, agents, network/MCP,
PRs or merges. The full pass/fail oracle and source-test names are in C2's report.
Give each criterion a `pass`, `fail` or `unverified`, with a reason and literal
response excerpt. Inspect both phases. A phase-B excerpt is needed when grading
reconciliation; a phase-A excerpt alone cannot establish it. The verifier checks
that excerpts exist, not whether they support the grade.

## Prepare a packet

Run from this checkout using Node >= 22.18 and Git. No npm runtime dependency is
needed. First fetch/recheck main and record the generator's own commit and any
local edits. Use a new output directory whose parent already exists, outside the
source checkout. Example in PowerShell, using C2's inspected main as source:

```powershell
$trialRoot = Join-Path ([IO.Path]::GetTempPath()) ('agentkit-replay-' + [guid]::NewGuid())
$prepared = node tools/evaluate-workflow.ts --prepare --repo . --revision c862bd7c0eac28ab5f1cda489c85e9fd4af32290 --command next --case caller --out $trialRoot
if ($LASTEXITCODE -ne 0) { throw 'Packet preparation failed.' }
$packet = $prepared | ConvertFrom-Json
$prepared
```

Omit `--revision` to pin the source checkout's current HEAD. A supplied revision
must be a full local commit SHA containing the source and C2 report. Dirty
working-tree source is ignored. Existing packet directories are refused. Repeat
with a unique directory for each command/case pair; never reuse a packet for a
retry. Record the preparation JSON, especially `id`, `revision` and
`packetSha256`, separately from the packet so later verification has a trusted
expected digest. Preserve the generator revision too: the source revision alone
does not pin the locally running generator and its imports.

Packet layout:

```text
manifest.json       trial identity, source revision, producer-file hash, file hashes, rubric IDs
phase-a.md          pre-edit assessment prompt; no final diff reveal
phase-b.md          final-scope reveal; send only after phase A completes
oracle.md           pinned C2 report; operator/grader only
workspace/          candidate-visible source snapshot and replay AGENTS.md
```

Both canonical skills are included because `/fix` references `/next`. The packet
uses the existing `skillPrompt` wrapper with explicitly injected pinned skill
text. It does not use the default `getSkill` reader, auto-update, runtime preamble,
`buildInvocation` profile or routed host launch. This is a planning replay, not
delivery-path integration evidence or an end-to-end autonomous command run. The
partial source snapshot supports inspection, not building or executing AgentKit.

## Run and capture

1. Start a fresh operator-controlled host session rooted at `workspace/`. Use a
   read-only setup, disable network/MCP, and do not expose credentials or the real
   project checkout. Record host/version, model, reasoning settings and relevant
   configuration. The packet is not a sandbox; enforce these constraints in the
   host. Its sibling oracle/prompts are hidden by procedure, not a security
   boundary. For a host that can read siblings, stage only `workspace/` in the
   restricted candidate environment and send prompts from the operator side.
2. Send `phase-a.md` only. Capture the full response and any tool events as UTF-8
   `a.txt` outside the candidate workspace, and measure elapsed milliseconds.
3. After the assessment completes, send `phase-b.md` in the same conversation.
   Capture that response and tool events separately as `b.txt`, with elapsed time.
   Do not supply the oracle or hints about the installer edge. Record any operator
   intervention; do not silently repair a response and call it the original.
4. A human reads the private oracle and both captures, then writes `result.json`
   alongside the captures. Preserve failures. If a phase failed, timed out or did
   not run, record its actual outcome; verification must refuse a passing receipt.

No candidate executor is implemented. Optional native Codex usage evidence is
read through the existing session meter, as described below. Host identity,
sequence, timing, execution and human judgments remain attestations.
A fabricated but internally consistent receipt can pass integrity verification;
this tool cannot prove that a candidate ran. Keep original host evidence for
review. Do not publish captures containing private source or host information
without inspecting them.

## Result format and verification

The schema below illustrates a `caller` receipt. Replace placeholders with actual
preparation values, manifest prompt hashes, SHA-256 capture hashes and human
observations. `evidence` may contain multiple `{phase, quote}` items. Each fixed
criterion appears exactly once. Do not copy the example grades as results.

```json
{
  "schema": 1,
  "trialId": "ID_FROM_PREPARATION",
  "packetSha256": "DIGEST_FROM_PREPARATION",
  "revision": "FULL_SOURCE_COMMIT_SHA",
  "command": "next",
  "caseId": "caller",
  "host": {"name": "HOST", "version": "VERSION", "model": "MODEL", "settings": "CONFIGURATION"},
  "phases": [
    {"id": "a", "outcome": "completed", "promptSha256": "MANIFEST_PHASE_A_HASH", "elapsedMs": 1, "transcript": "a.txt", "transcriptSha256": "A_CAPTURE_HASH"},
    {"id": "b", "outcome": "completed", "promptSha256": "MANIFEST_PHASE_B_HASH", "elapsedMs": 1, "transcript": "b.txt", "transcriptSha256": "B_CAPTURE_HASH"}
  ],
  "humanReview": {
    "reviewer": "REVIEWER",
    "grades": [
      {"id": "real-caller-boundary", "verdict": "unverified", "reason": "HUMAN_REASON", "evidence": [{"phase": "b", "quote": "LITERAL_RESPONSE_EXCERPT"}]},
      {"id": "evidence-honesty", "verdict": "unverified", "reason": "HUMAN_REASON", "evidence": [{"phase": "b", "quote": "LITERAL_RESPONSE_EXCERPT"}]},
      {"id": "scope-boundary", "verdict": "unverified", "reason": "HUMAN_REASON", "evidence": [{"phase": "b", "quote": "LITERAL_RESPONSE_EXCERPT"}]}
    ]
  },
  "usage": null
}
```

Usage defaults to `null` (unavailable), never invented zero tokens/cost. Both elapsed
times must be positive integer milliseconds. Capture paths must resolve inside
the result's directory; empty, missing, changed, directory or reused captures are
refused. Hash files with SHA-256 over their bytes, without reformatting them.

### Optional native Codex session evidence

For an explicitly selected native Codex rollout, replace `usage: null` with:

```json
{
  "provider": "codex",
  "transcript": "private/rollout.jsonl",
  "transcriptSha256": "SHA256_OF_ORIGINAL_ROLLOUT_BYTES",
  "sessionId": "SESSION_ID_FROM_SESSION_META"
}
```

The reference is relative to the receipt directory and must stay inside it,
including through directory links. Copy the completed rollout there explicitly;
the verifier does not discover sessions or read the home directory. The existing
meter streams at most 256 MiB with an 8 MiB line limit. `host.name` must be
`codex`; its `version` and `model` must match the rollout's single recorded CLI
version and model. Missing, conflicting or multi-model identity is refused for
this narrow pilot, even though the standalone meter can report some of it.

The verifier checks the original source digest, parses it with
`readCodexSession`, and returns a `usage` object containing `scope: "session"`,
`association: "operator-attested-trial-membership"` and the native `report`.
Supplied totals or extra report fields are rejected. Partial/unavailable coverage
and warnings are retained; unavailable totals remain null. Cumulative snapshots
replace rather than add. Cache/reasoning subsets and response records are not
added again. No billed cost or phase-level allocation is inferred.

Use a fresh isolated session for each two-phase trial and retain its complete
rollout after phase B. The verifier does not prove that the selected session
executed the packet, started fresh, contains only that trial, or delivered the
recorded responses in order. Matching version/model and hashes are consistency
checks, not execution provenance. The operator must review that association.
Usage evidence never promotes a failing or unverified behavioral grade.

Raw rollouts can contain private prompts, paths and host metadata. Keep them
outside Git and inspect reports before publishing. Successful verifier output
contains the meter's source digest/byte count and accounting metadata, not the
source path or conversation text. See the [real-capture validation record](usage-evidence-integration.md)
for the tested producer and its limits; synthetic fixtures do not certify a CLI.

```powershell
# $receipt is an operator-created result.json, outside workspace/.
node tools/evaluate-workflow.ts --verify --packet $packet.packet --packet-sha $packet.packetSha256 --result $receipt
```

The command checks the recorded manifest digest, packet contents, identity,
ordered completed phases, prompt/capture hashes, host fields and complete grades
with excerpts. Only all-human-pass receipts produce `human-assessed-pass` and exit
0. A failing grade produces `human-assessed-fail`; an unverified grade produces
`unverified`; both exit 1. Invalid or incomplete evidence also exits 1 with an
error. An integrity-valid human pass is not a machine-confirmed behavioral pass.

## Proof of value and limits

Start with one replay per command/case: six trials. Review whether both phases
are capturable, the rubric is usable, and the unchanged-consumer case reveals a
real planning defect. Report each criterion's human pass/fail/unverified counts,
incomplete-trial count, elapsed times and operator interventions from captures.
Keep denominators and exclusions; missing evidence never increases pass rate.
For optionally measured Codex trials, report observed session token counters,
coverage and warnings alongside those behavioral results. Keep unavailable
trials in the denominator. A baseline alone demonstrates neither token savings
nor billing accuracy; billed-cost comparisons remain unavailable.

Only after that smoke test, consider three repeats per command/case per variant
(36 trials for two variants), with the same model, host/settings, source snapshot,
scenario and grading protocol. Vary only the proposed instruction change; report
uncertainty and all failures. Whole-revision comparisons also change source and
are confounded. The preparation CLI cannot isolate a pre-C2 skill variant; such
an experiment needs separately pinned variant preparation before an A/B claim.
Do not infer an improvement from prompt wording or deterministic tool tests.

`node --test tools/evaluate-workflow.test.ts` exercises all six packet
preparations, source pinning and refusal paths, then uses explicitly synthetic
captures to test the verifier and its real CLI exit codes. `npm test` discovers
these tests through the existing runner. These checks make no model call. The
[usage integration record](usage-evidence-integration.md#six-live-c2-captures)
separately records six live captures with unverified semantic grades.
