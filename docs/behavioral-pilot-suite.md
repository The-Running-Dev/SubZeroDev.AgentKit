# Read-only behavioral pilot suite report

`node tools/report-workflow-suite.ts --selection /private/suite.json` verifies an
explicit receipt list using `evaluate-workflow.ts` (the #515 verifier), then
reports the six C2 command/case slots and each fixed criterion. It reads local
evidence and writes only stdout; it does not discover captures, call a model,
execute a candidate, grade responses, change receipts or create a workflow gate.
Use `--format markdown` for a copyable table; JSON is the default.

## Selection contract

Keep the selection private alongside the original receipts. Paths resolve
relative to the selection file; absolute paths are also accepted. A minimal
selection has this shape (replace the illustrative hashes with the original
preparation values, and add the other five receipts):

```json
{
  "schema": 1,
  "cohorts": [{
    "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "producerSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "host": {
      "name": "codex",
      "version": "recorded-cli-version",
      "model": "recorded-model",
      "settings": "exact operator attestation from the receipts"
    },
    "repeats": 1
  }],
  "receipts": [{
    "packet": "next-caller/packet",
    "packetSha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "result": "next-caller/result.json"
  }]
}
```

The schema accepts only the named fields. Bounds: selection file 1 MiB, 1–16
cohorts, 0–100 receipt references, 1–20 expected repeats **per slot**, at most
100 expected trials in total, and strings up to 4096 characters. Artifact and
native transcript bounds/confinement remain those of the verifier. The selection
is an operator expectation, not proof of how a capture was produced. Do not
rewrite expectations merely to turn an incomplete run green.

A cohort matches the exact tuple of source revision, packet producer SHA-256,
host name/version/model/settings. The current verifier and reporter file digests
are recorded separately. Different tuples never pool grades or tokens, including
receipts from undeclared cohorts. Each declared cohort has all six slots:
`next|fix` × `caller|scope-growth|prose`; an undeclared cohort has unknown expected
counts and cannot make the selection complete. Source/producer and host fields
are attestations checked for consistency, not independently proven execution
provenance. The verifier does not resolve the old producer hash to executable
code or establish that today's rubric is historically identical.

## Integrity, grades and exit status

Every selected receipt goes through #515's packet/artifact, phase, quote,
identity and optional native usage checks. The verifier exposes hashes of the
original verified receipt bytes and packet, plus its recorded producer hash.
An exact repeated trial identity with identical packet and receipt bytes counts
once. Different bytes for the same valid trial identity reject the entire
selection, even when the only difference is an attestation reason. Reformatting
a receipt changes its bytes and therefore conflicts with an earlier copy.

Invalid evidence remains in the top-level `invalid` count, without exception
text or paths. Its grades cannot contribute to a slot; the expected slot stays
missing unless another valid trial fills it. Incomplete phases, modified
captures and missing files are invalid evidence, not semantic failures. Failed
and unverified human grades remain visible in trial and per-criterion counts.
The report deliberately has no pass percentage that could hide missing trials.
Per-criterion unverified counts cover explicit unverified grades; missing trials
are shown separately, never converted to grades.

Status precedence: `rejected` for conflicting valid identities; otherwise
`incomplete` for invalid evidence, undeclared cohorts, missing or excess trials;
then `human-assessed-fail`, `unverified`, or `human-assessed-pass`. Exit 0 requires
a complete selection with every human grade passing; every other status exits
1. Invalid command/selection input exits 1 with a generic diagnostic. A passing
status repeats human attestations; it does not establish behavioral correctness.
Usage availability does not change human grades or the behavioral status.

## Usage and privacy

Usage is independently verified from original native Codex transcript bytes by
the existing reader. Counts retain observed, partial, unavailable and unattached
receipts in the denominator. A cohort token total is available only with exact
expected slot counts, no invalid selected evidence, and observed usage for every
unique trial. It sums each independent session's latest cumulative counters once.
Duplicate trial references add neither grades nor tokens. A repeated session ID
or native source digest across distinct trials suppresses totals in every
affected cohort, including reuse across cohorts and differing rollout snapshots
of the same session. Null counters remain null; cache/reasoning counters are
subsets, never additional tokens. Integer overflow suppresses totals and is
flagged. These are session counters associated with trials by an operator, not
incremental trial usage, savings, billed cost or a cross-cohort comparison.

Output is deterministically sorted, bounded by the input limits, and contains
fixed labels, counts, source/tool hashes and hashed cohort/trial identities.
JSON also includes packet/receipt digests for matching the private evidence.
Neither format includes local paths, raw host/model/settings strings, session
IDs, transcripts, review identities, reasons, evidence quotes or elapsed times.
Hashes are stable correlators, not anonymization of guessable metadata. Retain
the private selection to interpret cohort IDs and reproduce the report. Review
even sanitized output before publishing it.

Elapsed times are intentionally excluded: the retained #515 captures include a
hibernation interruption. Human review and controlled repeated trials are still
needed for behavioral or improvement claims. A baseline report is no A/B result.

## Verification

`node --test tools/report-workflow-suite.test.ts tools/evaluate-workflow.test.ts`
tests the real CLI, fixed C2 matrix, fail/unverified handling, missing/tampered
evidence, exact deduplication/conflicts, order determinism, cohort isolation,
session reuse, coverage, accounting, bounds, privacy and non-mutation using
explicitly synthetic receipts. `npm test` discovers both suites. The native
capture validation is recorded in
[`reports/behavioral-pilot-suite.md`](../reports/behavioral-pilot-suite.md).
