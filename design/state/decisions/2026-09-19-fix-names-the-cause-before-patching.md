# decision/2026-09-19-fix-names-the-cause-before-patching
Date: 2026-09-19
Anchor: 2026-09-19 — `/fix` names the cause before patching, and stops after three failed attempts
Status: accepted
StatedIn: "unit/command/fix § Name the cause before writing the patch", "unit/command/fix § Never"

## Claim
`/fix` gains a gate between orienting and fixing. The defect's cause is stated in a sentence
before the first edit — which code produces the wrong value, order or state, and why the
reproduction reaches it — and where the issue's agent block already names a mechanism, whether the
reproduction confirms that one, since a plausible mechanism that is merely present is not the
mechanism. Where the cause will not come the command stops and fixes nothing, in the same shape as
a defect that will not reproduce, because a patch turning a test green with no cause stated is a
guess that is harder to see than the open bug it replaces. Three implemented fixes that each
failed to clear the reproduction is a stop rather than a fourth attempt: what is wrong by then is
the diagnosis, and the command brings a fork with a recommendation among continuing, escalating to
a contract or design change it may not make itself, and instrumenting first. The count is within
one invocation, leaving *Re-run*'s independence between invocations unchanged.
