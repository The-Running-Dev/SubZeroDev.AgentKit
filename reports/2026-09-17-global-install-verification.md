# Global skill installation verification — 2026-09-17

Implemented from freshly resolved `main` at `164e8dd14e01324f9c017c39d333bd891362da7f`
on `feat/global-install-native-routed`. The user's explicit **both** selection authorizes
native Codex skills in the current session alongside separately routed `-routed` skills.
Only native skills receive the narrow model-gate exception; routed profiles remain unchanged.
The work spanned context compaction; governing files were reread and verification ran against
the working tree, not an assumed earlier state.

## Product evidence

The README's first PowerShell block was executed against an isolated temporary home and
local Git origin. Only the public remote URL and the fixture installer's public-source
constant were replaced with that local origin. No real user profile was modified.

- Fresh install: exit 0; 92 registrations (23 Claude, 23 Copilot, 23 native Codex,
  23 routed Codex). Requested latest stable; resolved synthetic fixture tag `v2099.01.02`
  at `644cb3d41555648c435c74af045314f8955f9308`.
- Identical README re-run: exit 0. Pester separately checks registration, pointer, hook,
  and manifest bytes remain identical, with no new backups.
- Existing older checkout without `setup.ps1`: the same README block obtained a temporary
  bootstrap checkout, adopted the canonical checkout, and installed the same stable fixture;
  exit 0. The temporary bootstrap is removed after use.
- The target project's sole `keep.txt` was unchanged; no kit cores or scripts appeared there.
- Real `codex-cli 0.154.0-alpha.3` app-server `skills/list`, in a new process with isolated
  `CODEX_HOME`: 46 enabled user-scope AgentKit skills, no discovery errors. Six bundled system
  skills are excluded from that count. All 46 generated AgentKit documents passed the skill
  frontmatter/name validator.
- This is discovery evidence, not a live model execution or Windows terminal result.

Fixture tags exist only in the local test origins. They are not public releases and do not
satisfy the post-merge stable-release acceptance criterion.

## Ran and passed

- PowerShell parse check and companion validation: all scripts parsed; 23 cores, zero local
  companions, no companion findings.
- Focused launcher coverage: 49 passed, zero failed, one Windows-only skip. Covers every
  command's routing, model/effort/approval/sandbox flags, environment stamps, dynamic document
  budget, lossless JSON arguments, canonical body dispatch without recursive wrappers,
  `/resume` process order and fail-fast behavior, and legacy CLI passthrough compatibility.
- Final isolated installer run: **28 passed, zero failed**, including the added legacy-pointer
  regression after the full-suite run. Tests cover fresh/adopted runtimes, stable date-tag selection and SHA
  peeling, explicit branch/SHA/rollback, dirty and wrong-origin refusal, network versus
  divergence errors, dry run, prefix changes, collisions, stale removal, uninstall, all host
  pointers, canonical dependencies, and paths containing spaces.
- Pointer mutation test: deliberately changing the global target back to kit `AGENTS.md`
  produced the expected failing regression assertion.
- Design projection regeneration; the design checker found zero blocking tree findings.
  Its live tracker comparison was unavailable, so the full design gate is not a pass.
- Declared videos workflow equivalents: `npm ci`, `npx tsc --noEmit`, and
  `npx @biomejs/biome lint segments components styles videos videowright.config.ts scripts`;
  all exit 0, lint checked 46 files.
- `git diff --check`.

## Ran and failed

Full `Invoke-Pester -Path tools -Output Detailed -PassThru`: **473 passed, 2 failed,
1 skipped, 476 total**. Both failures are in the real-repository design-state tests:

```text
S12.5/S25.4: the check reports zero findings against this repository and exits 0
Expected $null or empty, because could not evaluate: [TrackerUnavailable] gh missing or
unauthenticated; WorkStateDivergence not compared, but got @{Reason=TrackerUnavailable;
Detail=gh missing or unauthenticated; WorkStateDivergence not compared}.

S18.6: EnforcementUnevidenced rejects this repository's own superseded decision once its
SupersededBy line is removed, and clears once it is restored
Expected 1, but got 2.
```

An earlier full run also caught nondeterministic manifest field ordering; ordered serialization
fixed it and the full rerun above passed the byte-for-byte no-op assertion. An earlier run was
blocked by automatic approval review after PowerShell attempted telemetry; subsequent runs used
the supported `POWERSHELL_TELEMETRY_OPTOUT=1` and `POWERSHELL_UPDATECHECK=Off` settings.

The first Windows CI run on PR #325 reported **471 passed, 5 failed, 1 skipped**. Four failures
came from fixture Git calls inheriting `core.autocrlf=true` while installer child calls explicitly
used `false`, manufacturing dirty clones; the adoption failure was reproduced locally with
`GIT_CONFIG_KEY_0=core.autocrlf` and `GIT_CONFIG_VALUE_0=true`. The fifth assertion read a
width-wrapped CLIXML error rather than the recovery exception message. Fixture calls now share
the child line-ending policy and capture the exception message directly. The production dirty
checkout refusal is unchanged. With the host line-ending setting reproduced locally, all
28 installer tests now pass. The Windows rerun is authoritative for this correction.

## Did not run

- Full design-state gate: exit 2, `TrackerUnavailable: gh missing or unauthenticated;
  WorkStateDivergence not compared`. GitHub CLI 2.101.0 is installed but has no CLI credentials.
  Existing non-blocking `MirrorStale` notices were not rewritten to conceal that limitation.
- Live Windows terminal launch, interactive approvals, and routed Codex model execution:
  the runner is Linux and has no Windows desktop. The encoded command/process boundary is
  tested with a process mock; the Windows-specific executable-selection test is skipped locally.
- Actual Claude and Copilot CLI discovery/execution: those CLIs are unavailable here.
  Their registration and dependency paths were exercised through isolated installation tests.
- Codex `debug prompt-input` smoke: the container's nested sandbox failed with
  `NETLINK_ROUTE`/bubblewrap initialization errors. The read-only app-server discovery probe
  succeeded without weakening the sandbox or substituting a fake CLI.
- A public stable release containing this change, repository fleet migration, and installation
  on another user PC: require post-merge release and the separate migration work. Phase 5 stays open.

## Ownership and recovery

Registration deletion/replacement requires the manifest plus exact file hashes, or a legacy
manifest-listed link anchored to the canonical runtime. Changed files, added files, foreign
folders, and retargeted links survive and are named as collisions. Pointer replacement requires
the prior generated body; customized legacy blocks survive too. Hooks are matched to the exact
canonical script entry. Uninstall retains the runtime unless explicitly given `-Force`.

After checkout, setup failure reports the previous commit and a recovery command; it does not
reset local work. Network failure is reported as a Git fetch failure, never as divergence.

## Release and upstream evidence

No merge or tag is authorized in this session. After merge, verify all workflow gates and the
live Windows routed path, then use README's annotated-tag commands against the verified merged
SHA with an unused `vYYYY.MM.DD[.N]` tag. Finally repeat the fresh default install without an
explicit version. Until then, `main` is unreleased and the older public tag is not claimed to
contain this implementation.

The gstack behavior was inspected at `a6b3a57512ca6d5c6aa5b68f74f736195021f96e`:
[README](https://github.com/garrytan/gstack/blob/a6b3a57512ca6d5c6aa5b68f74f736195021f96e/README.md),
[setup](https://github.com/garrytan/gstack/blob/a6b3a57512ca6d5c6aa5b68f74f736195021f96e/setup),
[Codex host](https://github.com/garrytan/gstack/blob/a6b3a57512ca6d5c6aa5b68f74f736195021f96e/hosts/codex.ts),
[host definition](https://github.com/garrytan/gstack/blob/a6b3a57512ca6d5c6aa5b68f74f736195021f96e/hosts/define-host.ts),
[relink](https://github.com/garrytan/gstack/blob/a6b3a57512ca6d5c6aa5b68f74f736195021f96e/bin/gstack-relink),
[upgrade](https://github.com/garrytan/gstack/blob/a6b3a57512ca6d5c6aa5b68f74f736195021f96e/gstack-upgrade/SKILL.md),
and [ownership tests](https://github.com/garrytan/gstack/blob/a6b3a57512ca6d5c6aa5b68f74f736195021f96e/test/setup-link-ownership.test.ts).
Only the canonical runtime, explicit host adapters, idempotence, and ownership behavior informed
this change; its unrelated subsystems were not imported.
