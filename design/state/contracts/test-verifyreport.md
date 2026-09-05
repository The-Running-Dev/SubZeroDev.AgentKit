# contract/test-verifyreport
Status: active
Owner: unit/script/test-verifyreport
Declaration: tools/Test-VerifyReport.ps1

## Semantics
Never decides what the gates are or whether a gate should have passed — that is `/verify`'s
judgement, the same division `Test-DesignDrift.ps1` draws for which side of a drift is correct.
It only refuses to let a malformed report reach a pull request body unnoticed, by mechanically
enforcing three of `AGENTS.md`'s own honesty rules against the parsed JSON: every gate carries
exactly one outcome from the fixed vocabulary `Passed`/`Failed`/`DidNotRun`, a `Failed` gate's
`detail` is present and at least long enough to plausibly be pasted output rather than a label,
and a `DidNotRun` gate's `reason` is present. Exit codes: 0 `Valid`, 1 `Invalid` — the report
parses but breaks an invariant — 2 `NotEvaluated` — the file is missing, empty, or not readable
JSON at all, so no invariant could even be checked. `NotEvaluated` takes precedence exactly as
`Test-DesignDrift.ps1`'s does: a run that could not read the artifact has nothing to say about
its validity, and reporting `Invalid` or `Valid` either one would be inventing an answer. Never
prompts. `-Quiet` suppresses the human-readable report only; the result object is always emitted.
