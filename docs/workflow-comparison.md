# Offline workflow comparison (A2)

Compare explicit baseline and candidate selections and their A1 assessment
attachments without executing either candidate or calling any evaluator:

```sh
node tools/compare-workflow.ts --experiment /private/experiment.json --format markdown
```

JSON is the default format. Output goes only to stdout. Existing schema-1 suite
selections, original receipts and human grades stay unchanged. This command uses
`reportSuite()` and the original verifier, then revalidates each sealed A1
attachment against its selected capture. It never searches for attachments,
edits instructions or writes MemoryKit acceptance state.

## Experiment sidecar

Keep this file private beside the evidence. Replace every illustrative digest
below with the actual value. Each side selects exactly one cohort, using its `id`
from `report-workflow-suite.ts`. Both selection files must cover the six C2 slots
with their declared repeats; the example attachment lists need extending to
cover every trial for every declared evaluator.

```json
{
  "schema": "agentkit.workflow-experiment.v1",
  "hypothesis": "Changing the source revision reduces scope-growth failures.",
  "parents": [],
  "baseline": {
    "selection": { "path": "baseline/suite.json", "sha256": "<64 lowercase hex>" },
    "cohortId": "<64 lowercase hex from the suite report>",
    "corpusSha256": "<64 lowercase hex identifying the pinned corpus>",
    "evaluators": [{
      "id": "reviewer", "version": "1", "origin": "model",
      "codeSha256": "<64 lowercase hex>",
      "configSha256": "<64 lowercase hex>",
      "rubricSha256": "<64 lowercase hex>"
    }],
    "assessments": [{ "path": "baseline/assessment.json", "sha256": "<64 lowercase hex of file bytes>" }]
  },
  "candidate": {
    "selection": { "path": "candidate/suite.json", "sha256": "<64 lowercase hex>" },
    "cohortId": "<64 lowercase hex from the suite report>",
    "corpusSha256": "<same pinned corpus digest>",
    "evaluators": [{
      "id": "reviewer", "version": "1", "origin": "model",
      "codeSha256": "<same code digest>",
      "configSha256": "<same config digest>",
      "rubricSha256": "<same rubric digest>"
    }],
    "assessments": [{ "path": "candidate/assessment.json", "sha256": "<64 lowercase hex of file bytes>" }]
  },
  "changedVariables": ["source-revision"],
  "authorRole": "human",
  "conclusion": "Pending human interpretation of the comparison.",
  "limitations": ["Small, deliberately selected corpus."],
  "evidenceDigests": []
}
```

References resolve relative to the experiment, with absolute paths allowed.
Reference digests pin exact **file bytes**, including whitespace. Assessment
and selection readers hash the same byte snapshot they parse. Assessment
`assessmentSha256` is its separate A1 canonical content identity. Parents are
exact-byte SHA-256 IDs of previous experiment files; evidence digests are
operator-supplied supporting evidence IDs. These lineage fields are recorded,
not recursively loaded or independently verified. Corpus and execution metadata
are attestations, not proof that the corpus was used. Keep the experiment out
of candidate instructions.

The exact schema rejects extra fields. Bounds: 1 MiB experiment; one baseline
and one candidate; 1–8 unique full evaluator fingerprints and 0–800 attachment
references per side; 16 parents, changed variables and limitations each; 64
evidence digests. Strings are nonempty and at most 4096 UTF-8 bytes (evaluator
ID/version 256). Set-like string arrays reject duplicates. All digests are 64
lowercase hexadecimal characters. `authorRole` is human/model/mixed; evaluator
origin is human/model/deterministic/mock. Existing suite and A1 limits still
apply. Empty attachment lists are valid input that produce insufficient evidence.

## Reading the result

Human pass/fail/unverified counts and evaluator pass/fail/unverified/skipped
counts occupy separate columns for each command/case/criterion. Human status
comes unchanged from the suite reporter. A second evaluator adds assessment
columns, never trials, human grades or another session's tokens. Determinate
pass/fail disagreements are counted, including a separate human/model count;
unverified and skipped results are not agreements or disagreements.

Missing/excess trials appear in the original six-slot report. Missing assessment
counts include absent expected trials. Invalid attachments stay in the selected
denominator. Exact repeated attachments and captures count once. Multiple distinct
sealed identities for the same capture and full evaluator fingerprint conflict:
neither version contributes grades. A changed rubric/version/config is a new
fingerprint, not a conflicting result by the old evaluator.

Comparability is `insufficient-evidence` when any side has invalid evidence,
conflicts, cohort mismatch, missing/excess trials, missing assessments, skipped
or unverified assessments, or unverified human grades. Otherwise changes to the
corpus, full evaluator fingerprints, host/model/settings, repeats, capture
producer, execution provenance, usage coverage or reuse produce `confounded`.
A changed source revision is intended only when `changedVariables` includes
the exact reserved label `source-revision`; otherwise it is a confounder too.
Other changed-variable labels record context and do not waive confounders.

Only a `comparable` report includes descriptive human-count deltas. Exit 0 means
comparable, including when a human or evaluator reports failures; exit 1 means
insufficient/confounded or rejected input. No output declares causal or
statistical improvement: `improvementVerdict` remains `not-established` even
with complete comparable evidence. The operator must interpret repeated trials.

Reused capture identities across sides are flagged, so comparing a suite to
itself cannot imply independent evidence. Reused native session IDs or source
digests across any distinct trials suppress both `comparisonUsage` summaries.
Original `humanSuite` usage reports retain their existing per-selection meaning;
do not sum them across sides. Unattached/partial/unavailable usage stays visible,
and missing usage never becomes zero cost. Native session usage is not billed
cost or incremental per-trial spending.

Output order is fixed or sorted. JSON contains selected evidence hashes and
hashed evaluator, experiment and lineage identities; Markdown contains count
tables and integrity coverage. Raw paths, host settings, session IDs, transcript
text, evidence quotes and lineage prose are omitted. Hashes remain correlators,
not anonymization. Retain the private sidecar to interpret and reproduce output.

## Verification

`node --test tools/compare-workflow.test.ts` exercises six-slot fixtures,
the real JSON and Markdown entry points with no candidate/model execution,
byte preservation, changed rubrics/corpus, cohort mismatch, duplicates,
conflicts, missing coverage and sanitized digest failures. The existing suite
and A1 tests remain independent regression coverage.
