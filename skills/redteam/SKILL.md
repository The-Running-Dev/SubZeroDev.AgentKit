---
name: redteam
description: Optional adversarial review of the design doc — or of one deliverable, within its review budget — run when asked. Best on a different vendor's model than the author's.
argument-hint: "[optional: a file or folder to review instead of the design]"
disable-model-invocation: true
---

Read `design/00-brief.md`, `design/10-design.md` and `design/20-contract.md`. With `$1` naming a file or folder, review that deliverable instead: *Reviewing a deliverable*, below.

You did not write this design and you are not being asked whether it is good. You are being asked where it breaks.

**Do not produce a verdict, a score, a summary, or a "looks solid overall."** Findings only.

For each finding:

```
[SEV] <one-line claim>
Where: <section or component>
Breaks when: <the specific condition, with concrete values where possible>
Consequence: <what the user or operator experiences>
Cheap to fix now / expensive to fix later: <which, and why>
```

Severity: `BLOCKING` (design cannot ship as written), `STRUCTURAL` (works, but the fix later requires touching many modules), `LOCAL` (contained, fixable in one place). In the shared vocabulary (`AGENTS.shared.md` § *Review budget*) `STRUCTURAL` and `LOCAL` are `NON-BLOCKING`. A finding with no concrete `Breaks when` is `SPECULATIVE`, never `BLOCKING`; one that repeats a finding from an earlier pass is `DUPLICATE` and names it (`Duplicate of: <file> F<n>`).

Attack these specifically:

- **Data model** — what state can become unreachable, orphaned, or internally contradictory? What happens on partial write?
- **Boundaries** — which module knows something it should not? Where will a change ripple further than the design implies?
- **Failure modes** — which listed failure has an unhandled second-order effect? What fails silently?
- **Scale** — what breaks at 100x the stated volume? At 1 item? At 0?
- **Concurrency** — what is assumed serial that is not guaranteed serial?
- **Non-goals** — where does the design quietly build toward something the brief excluded?
- **Absence** — what is not mentioned at all? Missing sections are findings.

Rules:
- Do not propose fixes. Naming the fix invites me to accept your framing of the problem.
- Do not soften. If something is BLOCKING, say BLOCKING.
- If you genuinely find nothing at a severity level, say "none at this level" rather than padding.
- Findings go to stdout **and** to a findings file (below), never into the design doc. I decide what gets written back into `design/`.

## Write the findings to a file

**This command runs on a different vendor from the design author, and adjudication happens back on the author's vendor.** Findings that exist only in one session's stdout have to be copy-pasted across that gap by hand, which is lossy, and is the step where a severity gets softened or a finding gets dropped without anyone deciding to drop it. Write them down instead — the repository is the handoff.

One file per pass, at `design/redteam/<YYYY-MM-DD>-<target>.md`, where `<target>` is the document attacked (`10-design`, `00-brief`). A second pass on the same day against the same target appends `-2`; it never overwrites the first, because two passes are two pieces of evidence.

```markdown
# Red team — design/10-design.md

Target: design/10-design.md @ <sha>
Vendor: <vendor>
Model: <model id, and effort if known>
Date: <YYYY-MM-DD>
Coverage: complete | partial | not assessed — <for anything but complete, which surfaces were not reached, and why>

## F1
Severity: BLOCKING
Status: unadjudicated
Claim: <the one-line claim>
Where: <section or component>
Breaks when: <the specific condition, with concrete values where possible>
Consequence: <what the user or operator experiences>
Cost: <cheap to fix now / expensive to fix later, and why>
```

- **The finding body is verbatim what you would have printed.** This file is not a summary of the pass; it is the pass.
- **`Status:` is `unadjudicated` and this command never changes it.** The adjudicating session writes `defect`, `accepted risk`, `brief conflict`, or `not sustained` in place, on the line, as I rule on each one. That keeps the classification next to the finding it classifies rather than in a chat log nobody can find later.
- **Ids are stable within a file** (`F1`, `F2`) and are what a decision-log entry or an issue cites.
- **`Target:` pins a sha.** A finding against a revision of the design that no longer exists is still evidence, but a reader has to be able to tell.
- **`Coverage:` is the assessed scope**, over the attack surfaces above — the findings-report form of the contract's "never say a check passed that did not run" (`AGENTS.shared.md`, *Verification*). It is what makes "none at this level" readable: with it, a clean severity level is a result, and without it, it is either a result or a surface nobody reached, and the reader cannot tell which. A surface skipped because the pass ran short is `partial`, never `complete`.
- **Commit and push it.** `AGENTS.shared.md` § *Git and delivery* delegates the branch, the commit, the push and the pull request; this file is ordinary work and takes the ordinary path. It is the only thing this command writes.
- **This is not the design doc and writing it is not proposing a fix.** The rule above is unchanged: no fixes, no verdict, no summary.

## Stopping rule

**A red-team pass is optional and runs once per request. It is never a gate on `/plan` or `/next`, and never an iterative design loop.**

- One invocation authorizes **exactly one complete pass**. At most one pass per materially changed design revision.
- **Never automatically recommend or start another pass.** Repeat only when I ask and the design has materially changed since the last one.
- After a pass, stop. Present findings **one at a time** for adjudication, and classify each as I rule on it: **defect**, **accepted risk**, **brief conflict**, or **not sustained**.
- **Recommend a classification for each, but never a fix.** Naming a fix invites me to accept your framing of the problem — naming a *severity and category* does not.
- **A known-and-retained decision is not a new defect.** It becomes one only if new evidence shows it contradicts a higher-precedence source, or creates a consequence not already recorded. Name that evidence or consequence — without one, it is the same finding again.
- For a local correction, verify the correction. Do not reread and re-attack the whole design because wording changed.

## Reviewing a deliverable

With `$1` naming a file or folder, the target is that deliverable, and the review budget (`AGENTS.shared.md` § *Review budget*) governs it — across sessions, models and vendors, because its record is a file: `reviews/<deliverable>.md`, committed like the findings file above.

1. Run `node tools/test-review-ledger.ts --path reviews/<deliverable>.md`. Exit 2 means there is no record yet: write its header (below) from the deliverable and whatever states its goal, and run the tool again. `Problems` means the record is malformed: report them and stop. `NextReview` `none` means no pass is due or the budget is spent: print `State` and `Next` and stop — no pass.
2. **The entry point runs before any review.** If `Verification` has no `Entry point:` result, run it — against a mock or a sandbox where it is destructive — and record it first.
3. `NextReview` `review` is one complete pass over the deliverable. `re-review` covers only the findings already recorded and the corrections made for them (`## C<n>`): a new finding there is `BLOCKING` with evidence, a defect a correction introduced, or `tracked` in one follow-up issue — nothing else is opened.
4. Append the pass and its findings, run the tool again, and print its `State` and `Next`. The adjudicating session sets each `Status:`; a correction is recorded as one `## C<n>` naming every finding it fixes.

```markdown
# Review — <deliverable>

Deliverable: <name>
Artifact: <path>
Goal: <one line>
Risk: LOW | MEDIUM | HIGH — <what it touches>
Acceptance:
- A1 <criterion>
Authorized: <YYYY-MM-DD> — <the user's words; each line allows one more review and one more correction>

## Verification
Syntax: passed | failed | not run | not applicable — <evidence, or the reason>
Unit: ...
Integration: ...
Entry point: ...
End to end: ...
Risk check: ... (HIGH only — the verification aimed at that risk)

## R1
Kind: review | re-review
Revision: <sha>
Vendor: <vendor>
Model: <model>
Date: <YYYY-MM-DD>

## F1
Severity: BLOCKING | NON-BLOCKING | SPECULATIVE | DUPLICATE
Status: open | resolved | not sustained | accepted risk | tracked
Raised in: R1 | verification
Where: <path:line>
Claim: <one line>
Evidence: <path:line, a command and its output, or a reproduction>
Consequence: <what the user experiences>
Correction: <filled by whoever corrects it>

## C1
Revision: <sha>
Fixes: F1, F2
```

`Duplicate of: F<n>` marks a duplicate; `Reopened by: <new evidence>` is the only way a resolved finding comes back; `Accepted: <the user's words>` goes with `accepted risk`; `Cancelled: <the user's words>` in the header ends the record. The design-pass rules above still hold: no fixes proposed, no verdict, no summary.
