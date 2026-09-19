# decision/2026-09-19-check-renders-its-lists-from-the-file-read-back
Date: 2026-09-19
Anchor: 2026-09-19 — `/check` renders its three lists from the report file read back off disk, and the read-back is an instruction rather than a script assertion
Status: accepted
StatedIn: "unit/command/verify § Report"

## Claim
`skills/check/SKILL.md` § *Report* gains a read-back requirement between validating
`.claude/verify-report.json` and rendering the three lists: once `tools/Test-VerifyReport.ps1`
reports `Valid` the file is re-opened and the lists are rendered from what that read returns, again
after any later write to it, and the report states which file it was read from and that it was read
back rather than recalled. A gate present in the file but absent from the rendered lists, or the
reverse, is the command failing rather than a discrepancy a reader must notice — the count of the
artifact's `gates` entries and the count of lines across the three lists are equal, and nothing is
rendered or handed off while they are not. The gap this closes is narrow by construction and is
recorded as narrow: the artifact and its validator already existed, and the section already said the
lists came from the validated artifact. What was missing is the read, and the validator cannot supply
it, because in the failing case the report is well-formed and merely superseded — a gate re-run, a
`Failed` entry corrected, a rewrite validation itself prompted — while the prose still describes the
version the session remembers writing, which `/pr` phase 2 then copies verbatim into a pull request.
**The read-back is an instruction here rather than an assertion in a script, and that is the
decision rather than the default.** What is governed is what happens between validating the artifact
and typing prose into the conversation, and the conversation is not an input available to any script;
`tools/Test-VerifyReport.ps1` already owns structural validation, so restating shape in prose would
be a second home for one rule; and there is no separate caller to hold the assertion, because this
command file is the validator's caller. The one further mechanization within reach — a check
comparing a pull request's `Verified` section against the artifact — governs `/pr`'s output rather
than this command's report and is a different decision, taken against a verbatim-copy rule held fixed
here. The mechanism is adapted from `gstack`'s exit-plan gate, whose first check reads the plan file
back after the most recent write to it and names the failure mode as feeling finished after writing
prose while the structured section is missing or stale.
