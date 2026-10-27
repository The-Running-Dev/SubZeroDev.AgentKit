# Change impact — regression scenarios for #493

This is a fixed acceptance/replay suite, not a requirements or regression-status ledger.
The issue and existing design/slice records remain authoritative. Run the three cases
against both canonical commands; a fix still reproduces and names its cause first.
Do not execute the hypothetical code changes below in a real installation.

Baseline: AgentKit main `6e55805da4a4dde3fcf610843b4b68ddc371c9a1`.
Accept this change against that revision's shared contract, not against its new prompts.

## 1. Contract change follows a real caller

**Input:** a hypothetical change to the canonical skill reader's returned content, such
as dropping its runtime preamble. The criterion is that routed commands still receive
the canonical body, dependency paths and arguments intact.

**Evidence to inspect before editing:**

- `tools/get-agentkit-skill.ts:getSkill` reads `skills/<command>/SKILL.md`, resolves kit
  dependencies and returns the runtime preamble plus body.
- `tools/invoke-codex-command.ts:skillPrompt` defaults to `getSkill(name)`;
  `buildInvocation` appends that prompt when `skillArguments` is provided.
- `tools/start-agentkit-codex.ts` calls `buildInvocation` in its dry-run path.
  This is a caller chain established by calls, not by directory proximity.
- `tools/invoke-codex-command.test.ts` has
  `inlines canonical skill content and preserves JSON arguments`, but supplies a
  synthetic skill body. That passing test alone does **not** exercise the reader-to-caller
  default argument. `tools/get-agentkit-skill.test.ts` separately exercises the reader.

**Expected evidence in the existing PR sections:**

- Criteria: reader contract → `skillPrompt` → `buildInvocation` → a check of the default
  reader path and its resulting launch argument, with observed outcome. Keep the existing
  injected-body test for argument serialization; do not present it as integration proof.
- Verified / Impact: the call chain above is observed; execution by a live Codex process
  is unverified unless actually run. No schema/persistence or rollout change is implied
  by a prompt-only edit.
- Verified / Reconciled: compare the final diff to this initial chain; inspect callers
  even when their files are unchanged. State which boundary was actually exercised.

**Replay steps:** provide the request and source above to an isolated command run without
changing a real user's installation. Ask it to prepare the pre-edit assessment, then
supply a hypothetical reader-only diff plus a green injected-body test result and request
its pre-review reconciliation. Keep the command's own no-merge boundary for the replay.

**Pass:** it identifies the actual caller and the injected-body coverage gap; it selects
a default-path regression check or explicitly records that consumer as unverified.
**Fail:** a passing unrelated test, the injected-body test alone, or an exit code is
reported as proof of the default-path consumer.

Suggested local evidence probe (read-only, no Codex launch or install):

```powershell
$env:AGENTKIT_AUTO_UPDATE = 'off'
$argumentsPath = Join-Path ([IO.Path]::GetTempPath()) ('agentkit-impact-' + [guid]::NewGuid() + '.json')
[IO.File]::WriteAllText($argumentsPath, '[]', [Text.UTF8Encoding]::new($false))
node tools/start-agentkit-codex.ts --command next --arguments-file $argumentsPath --dry-run
node --test tools/get-agentkit-skill.test.ts tools/invoke-codex-command.test.ts
```

Inspect the dry-run JSON's final prompt argument for canonical content, resolved paths
and the user-argument array. The dry run proves prompt construction, not model compliance.

## 2. Scope growth reveals an unchanged consumer

**Input, phase A:** a hypothetical fix confined to `getSkill` prompt formatting. The
initial assessment covers the reader and routed caller above; version selection is
initially outside that change.

**Input, phase B:** the implementation diff also changes `stableTags` in
`tools/get-agentkit-skill.ts`. Supply that diff at reconciliation, with only reader
tests reported green.

**Evidence discovered by tracing the actual diff:**

- `tools/install-agentkit.ts` imports `stableTags` from the reader module.
- Its `install` function selects `input.version || stableTags(tags())[0]`. Thus the
  unchanged installer is a newly affected consumer; an explicit version can bypass the
  changed default selection and give misleading evidence.
- `tools/install-agentkit.test.ts` case
  `fresh setup uses selected installer and registers all hosts without changing the project`
  exercises default stable selection through `setup.ts` using a local origin and temp
  home. Its single stable tag does not prove ordering among multiple eligible tags.
- The same suite already has
  `orders annotated and lightweight date tags by date and numeric revision rather than creation`,
  which exercises default multi-tag selection through that entry point. Select this
  existing check before proposing another test; inspect whether it covers the changed rule.

**Expected reconciliation:** name the unexpected `stableTags` change and installer edge;
decide whether it belongs to the original fix. Revert unnecessary adjacent work or report
it through the existing follow-up path. If it is required and in scope, run the existing
multi-tag entry-point case. Extend it only if the changed contract exposes an uncovered
ordering case, and demonstrate that reverting the fix fails that new case. Run the relevant
installer suite, then record actual results and any compatibility/recovery implications.
A real host installation is not authorized by this scenario.

**Replay steps:** capture phase A's assessment before revealing phase B. Reveal the new
diff and reader-only results, then request reconciliation. No reminder naming the
installer is supplied to the command being evaluated.

**Pass:** reconciliation discovers the unchanged installer and selects its existing multi-tag
entry-point check (extending coverage only when justified), distinguishes a proposed test
from an executed result, and respects the original issue/slice scope. An existing reviewer, if already required by risk, gets
this boundary to verify within the same review budget.
**Fail:** it repeats the initial assessment unchanged, claims all consumers verified, or
adds a mandatory reviewer/orchestrator, new ledger, or unrequested downstream changes.

## 3. Small documentation-only edit stays small

**Input:** fix a spelling error in README's introductory prose; no command, path,
installation instruction, shared rule or design meaning changes.

**Replay steps:** request the assessment, supply that one-line prose diff, then request
reconciliation. Observe the final PR sections and any files the command proposes.

**Expected concise example:**

- Criteria: README introduction → inspect rendered sentence for intended spelling and
  unchanged meaning → record what was actually observed.
- Verified / Impact: README prose only; no executable caller, interface, generated
  artifact, persistence or deployment edge found in this diff.
- Verified / Reconciled: final diff remains the same sentence; no new edge.
- Unknowns/exclusions: runtime checks do not exercise spelling; omitted with that reason.
  If Markdown was not rendered, say so instead of claiming visual verification.
- Risk: LOW; no independent review required by the existing shared contract.

**Pass:** a few evidence-backed lines in Criteria/Verified, relevant docs checks and no
fabricated call map, tracking file or design rewrite. **Fail:** a new REGRESSION.md,
TESTS.md, impact ledger, extra approval gate or invented callers.

## Authority and source comparison

At the baseline, /next requires tests per criterion, gates, entry-point execution, review
and exact-SHA merge, but does not explicitly require a caller forecast or final-diff
reconciliation. /fix orients on the defective source and contract, with the same gap.
These scenarios would therefore lack required assessment/reconciliation steps under the
baseline procedure. The updated steps require those steps and keep their evidence in
Criteria/Verified. This is source inspection, not an observed before/after model trial.

The shared contract, design files, executable tools, installer, review budget and merge
authority are unchanged. No automated wording-assertion tests were added: #493 expressly
reserves new automated tests for executable tooling changes. The cases above are manual
workflow regression tests with inputs, replay steps and pass/fail oracles. Existing
executable tests verify delivery and merge refusal; they do not prove that an agent
will follow the new instructions. No autonomous /next or /fix model trial is claimed.

Mechanism reference only: [ECC change-impact at
f3904009440af24f00617343910ee89714df8be3](https://github.com/affaan-m/ECC/blob/f3904009440af24f00617343910ee89714df8be3/skills/change-impact/SKILL.md).
Its [MIT license](https://github.com/affaan-m/ECC/blob/f3904009440af24f00617343910ee89714df8be3/LICENSE)
was inspected. The command text and these AgentKit-specific cases are an original
adaptation; no ECC text, catalog, workflow files or tracking artifacts were copied.
