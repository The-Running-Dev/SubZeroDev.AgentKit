# contract/merge-pullrequest
Status: active
Owner: unit/script/merge-pullrequest
Declaration: tools/Merge-PullRequest.ps1

## Semantics
`-HeadSha` is mandatory and has no default, permanently, and for the same reason
`contract/wait-pullrequestcheck`'s is: defaulting it to the current head would merge a commit
pushed after the gates ran as though it had passed them. The `MergeResult` is emitted on the
success stream always, including on every refusal — a caller that gets an exception loses the
`Refusal` and the partial check list, which are the parts worth reporting. Exit codes carry the
state: 0 `Merged` and `WouldMerge`, 1 `Refused`, 2 `NotEvaluated`; a caller branching on the exit
code and a caller reading `.State` must reach the same conclusion, and **only those two states map
to 0**.

**Every unknown refuses.** `NoChecksConfigured` is the case worth naming, because it is the one a
permissive reading would wave through: a repository with no CI produces no green signal, and the
absence of a signal is never a pass. `--admin` is never passed, so branch protection remains an
outer gate this script cannot reach past, and a protected-branch rejection surfaces as
`Refused`/`MergeRejected` carrying gh's own text rather than being retried.

Check classification is not this contract's. It delegates whole to
`contract/wait-pullrequestcheck` and carries that script's `NotEvaluated` failures through
verbatim as its own `Refusal`, so bucket semantics and the head-moved invariant keep exactly one
home. Thread *classification* is likewise not this contract's — it counts `isResolved:false` as a
blocker and never reads a comment body, answers a thread, or resolves one; that is
`contract/resolve`'s.

Never prompts. `-DryRun` evaluates every precondition and merges nothing, reporting `WouldMerge`
where a real run would have merged.
