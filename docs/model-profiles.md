# Task profiles and model selection

Six task commands each carry a model profile: the model and reasoning effort the work is meant to run on, for each provider. One policy file, [`policy/model-profiles.json`](../policy/model-profiles.json), holds all six; the skills, adapters and launcher read it and nothing else.

| Command | Use it for | OpenAI (Codex) | Anthropic (Claude Code) |
|---|---|---|---|
| `model-fit` | Recommend a profile for a task, without doing it | `gpt-6-luna` · low, read-only | `haiku` · low |
| `asset-craft` | Prepare a generation-ready prompt and asset spec, and render it where an image tool exists | `gpt-6.1-sol` · low | `sonnet` · low |
| `implement` | A scoped change with tests that is not a plan slice | `gpt-6.1-sol` · medium | `sonnet` · medium |
| `visual-check` | Check the running app against a reference or expectation | `gpt-6.1-terra` · medium | `sonnet` · medium |
| `small-edit` | A contained edit: copy, a value, one function | `gpt-6-luna` · low | `haiku` · medium |
| `deep-debug` | A failure ordinary debugging has not cracked — **expensive** | `gpt-6-astra` · medium | `opus` · medium |

General development defaults to `implement`. `/next` and `/fix` are unchanged: they keep their own profiles and are not task commands. The session's global default model is never changed; a profile applies only when its command is invoked, and only on a host that can apply it.

## Requested, resolved, verified active

Three different things, always reported separately:

- **Requested** — what the invoking adapter or launcher asked for.
- **Resolved** — what the policy and your overrides say now. Resolution order: an explicit value for this call, then your override in `~/.agent-kit-state/config.json`, then the policy.
- **Verified active** — what the host actually ran, read from its own record. Where nothing records it, it stays unverified; it is never assumed.

## What each host does

| Host | How a profile applies | Per-call override |
|---|---|---|
| **Claude Code** | The plugin adapter's `model:` and `effort:` frontmatter, written when setup generates it. It applies for the turn that invokes the skill — if the host accepts it. Organisation policy, `availableModels` or auto mode can refuse the model; environment settings or caps can change the effort. | Not applicable to a loaded skill. Set an override and rerun setup, or switch the session with `/model`. |
| **Codex, routed** (`/<name>-routed`, `start-agentkit-codex.ts`) | The launcher passes `-m <model>` and `-c model_reasoning_effort=<effort>` to a new Codex process. | `--model` and `--effort` on the launcher, applied and reported as `explicit`. |
| **Codex, native** (`/<name>`) | Recommendation only. The session keeps its own model. | — |
| **Copilot** | Recommendation only, for both providers. | — |

An override that cannot be applied is refused with the reason. It is never silently ignored.

### Verifying the active Claude model

The Claude adapter tells the agent to run, after loading:

```bash
node tools/model-profile.ts --verify-active --profile small-edit --model haiku --effort medium
```

It reads the current session's transcript (`CLAUDE_CODE_SESSION_ID`) and compares the last assistant model with the request. `ModelMatch: false` means the host did not apply the skill's model, and the report must say so. The transcript does not record effort, so effort is always reported as unverified. `RegenerationNeeded` appears when the policy or your overrides changed since setup wrote the adapter.

### The Codex model cache

The routed launcher checks the model and effort together against `~/.codex/models_cache.json` (or `$CODEX_HOME/models_cache.json`) before it starts Codex:

- **Fresh** (fetched within 7 days) and the effort is listed — `verified`.
- **Fresh** and the effort is not listed for that model — `refused`, with the listed efforts.
- **Stale, missing or unreadable** — `unverified`; the call goes ahead and Codex decides. Starting Codex refreshes the cache.
- **Model not in the cache** — `unverified`. Absence from a cache alone does not prove the model was retired.

The cache is evidence, not authority.

### `ultra` effort

`ultra` is refused for every task profile. Codex describes it as maximum reasoning with automatic task delegation, which none of these profiles needs.

## Examples

List the profiles, with any overrides you have set:

```bash
node tools/model-profile.ts --list
```

Resolve and validate one profile, for both providers or one:

```bash
node tools/model-profile.ts --profile implement
```

```bash
node tools/model-profile.ts --profile deep-debug --provider openai --effort high
```

Run a task on its profile from a Codex host — the routed adapter does this for you; directly:

```bash
node tools/invoke-codex-command.ts --command small-edit --dry-run
```

Open a new Codex window on a profile, with an explicit model for this call (the arguments file holds the task text):

```bash
node tools/start-agentkit-codex.ts --command implement --arguments-file task.txt --model gpt-6.1-terra --effort high
```

Make `small-edit` run on Sonnet at low effort under Claude Code, then regenerate the adapters so the frontmatter carries it:

```bash
node tools/model-profile.ts --set-override --profile small-edit --provider anthropic --model sonnet --effort low
```

```bash
node setup.ts
```

Remove that override (both providers when `--provider` is left out), then rerun setup:

```bash
node tools/model-profile.ts --clear-override --profile small-edit --provider anthropic
```

Overrides live under the `modelProfiles` key of `~/.agent-kit-state/config.json`. Writing one keeps every other setting in that file.

## Updating model IDs

When a provider renames, adds or retires a model:

1. Edit `policy/model-profiles.json`: change the `model` or `effort` for the affected profiles and provider. Claude entries use the family aliases (`haiku`, `sonnet`, `opus`), which follow the latest model in each family; pin a full `claude-*` ID only when you need a fixed version.
2. Set `reviewed` to today's date.
3. Run `node tools/model-profile.ts --profile <name> --provider openai` for each changed OpenAI profile. Start Codex once first if the cache is stale, so the check runs against a fresh cache.
4. Rerun setup, so the Claude frontmatter and the Codex and Copilot recommendations pick up the change.
5. Run `npm test`.

A change that is only for you goes in an override, not the policy.

## Escalation and usage

- No command moves to a more expensive profile on its own. `/implement` and `/small-edit` recommend `/deep-debug` after two substantive failed attempts, with the evidence; you decide whether to run it.
- A missing tool, credential or environment fault is reported as that, not as a reason to escalate.
- **AgentKit currently measures Claude transcripts only.** No command reports Codex token usage, and no command estimates savings.

## Image generation

`/asset-craft` works without a renderer: it inspects the references and prepares the specification and a prompt an image tool can take unchanged. With no image-generation tool configured, it stops there and says so. A prompt is never reported as a generated asset, and the chat model that wrote the prompt is never named as the model that rendered the image.

## Example: a game project

Hollow Moon is a game project used here only as an example. Nothing in the kit refers to its paths or its art direction; the project's own files supply both.

- **New art.** `/asset-craft` with a description of the sprite and the project's existing art as references. On a host with no image tool, it returns the spec and the prompt and stops. With one, it renders a sample for approval first, then the asset, with a metadata sidecar beside it.
- **Checking a scene.** `/visual-check` with the scene and what it should look like. It starts the game, captures the screen and lists each difference; anything it could not exercise — movement, a saved state — is named as untested.
- **A tweak it found.** `/small-edit` for a single value or a colour; `/implement` if the fix spans several files and needs tests.
- **A crash nobody can explain** after two real attempts: `/model-fit` to confirm, then `/deep-debug` if you choose to spend on it.

## Host limits

- Claude Code applies frontmatter at skill load; nothing can change the model of a skill already running. A changed policy or override needs setup rerun.
- Claude Code effort can be capped by environment settings; the transcript does not record it.
- Codex native skills and Copilot cannot switch models from inside a skill.
- The Codex cache describes one client version; a newer Codex may accept models the cache does not list.
