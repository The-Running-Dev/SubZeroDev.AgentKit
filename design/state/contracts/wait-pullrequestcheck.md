# contract/wait-pullrequestcheck
Status: active
Owner: unit/script/wait-pullrequestcheck
Declaration: tools/Wait-PullRequestCheck.ps1

## Semantics
`-HeadSha` is mandatory and has no default, permanently — defaulting it to the current head is
the one convenience that would defeat I2, the invariant the whole script exists to enforce. The
`WaitResult` is emitted on the success stream always, including on every failure path — a caller
that gets an exception loses the partial check list, which is the part worth reporting. Exit
codes carry the state: 0 `Passed`, 1 `Failed`, 2 `NotEvaluated`; a caller branching on the exit
code and a caller reading `.State` must reach the same conclusion. Never prompts, never re-runs
a check, never merges, resolves, or writes anything. `-Quiet` suppresses the progress line only;
the `WaitResult` is always emitted.
