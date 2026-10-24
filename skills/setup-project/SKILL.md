---
name: setup-project
description: Start a new project end to end - scaffold it, create its GitHub repository with the standard settings and the Main ruleset, push it, and open the SubZeroDev.GitHub pull request that records the definition. Usage - /setup-project SubZeroDev.Thing node, /setup-project SubZeroDev.Thing python private, topics tooling,cli, or /setup-project SubZeroDev.Thing with the language deferred
argument-hint: "<Name> [language] [options]"
disable-model-invocation: true
---

Start a new project: scaffold it, create its GitHub repository, apply the standard settings and the `Main` ruleset, push, and record the definition. **$1** is the project name, **$2** the language when one is given, and anything after them is plain-language options.

**This command is a thin driver.** Every step already lives in `The-Running-Dev/SubZeroDev.GitHub`: `scripts/new-project.ts` scaffolds, and `scripts/new-repository.ts` writes `repositories/<Name>.yaml` and runs OpenTofu. That repository's `README.md` owns the instructions, in *Prerequisites*, *Create a project*, *Create a repository* and *Test*. Read those and the option tables the two scripts pass to `parseOptions` in the checkout before running anything; they are the authority for option names, allowed values and defaults, and this file does not restate them. This command owns only locating the checkout, its own preconditions, and committing the new definition.

The name is required; if it is missing, ask. The language is optional. When **$2** is one of `new-project.ts`'s languages, use it. When the user leaves it out, or says it is deferred, undecided or not chosen yet, the language is **deferred**: accept that, do not ask again, and never choose, suggest or default one. A word that is neither a language nor an option is a question for the user, not a guess.

## Options

Map the plain-language options onto the scripts' options:

- A description, `private`/`public`, topics, and required checks map to `--description`, `--visibility`, `--topics` and `--required-check`. These go to both scripts.
- A required check is `"context"` or `"context@integration_id"`; GitHub Actions is integration id 15368. `require check "build / Result"` from Actions becomes `--required-check 'build / Result@15368'`.
- A client choice, a project folder, "no starter" and "skip validation" map to `--client`, `--path`, `--skip-language-starter` and `--skip-validation`. These go to `new-project.ts` only. With the language deferred there is no starter and no validation, so the last two do not apply.
- `--path` defaults, inside `new-project.ts`, to a sibling of the SubZeroDev.GitHub checkout named after the project. Resolve the same path yourself; Step 2 and `new-repository.ts --path` need it.
- **"local only"** — scaffold and commit, then stop.
- **"plan only"** — scaffold, commit and show the plan, then stop.

An option that maps to nothing in the option tables is a question for the user, not a guess. Ask it, and a missing name, as a card (`AGENTS.shared.md` § *Asking the user*).

## 1. Locate the checkout

Take the first that exists:

1. the path in `$env:SUBZERODEV_GITHUB_HOME`;
2. a `SubZeroDev.GitHub` folder that is a sibling of the current repository;
3. the canonical checkout, `D:\Dropbox\Projects\SubZeroDev.GitHub`, which need not be a sibling of the current repository.

Then verify every one of these, and stop naming the first that fails. If none of the three exists, stop and ask for the path:

- the folder is a git repository;
- its `origin` is `The-Running-Dev/SubZeroDev.GitHub`;
- `scripts/new-project.ts` exists;
- `terraform.tfstate` exists.

**Never clone it.** Its state is local, gitignored and encrypted. A clone has no state, so an apply from it would try to recreate every repository it manages.

## 2. Preconditions

Check all of these before writing anything. Report each failure; never fix one on the user's behalf.

- **Branch and pull.** The checkout is on `main` and `git status --porcelain` is empty (ignored files do not count). `git pull --ff-only` succeeds.
- **No pending setup pull request.** `gh pr list --repo The-Running-Dev/SubZeroDev.GitHub --state open --json number,headRefName,url` shows no head starting `add-repository/`. If one does, stop and name it: an unmerged definition makes the next plan archive that repository, and the script refuses that plan but leaves the new YAML behind.
- **Tools.** `node --version` is 22.18 or later, `tofu` is on PATH (install with `winget install OpenTofu.Tofu`), and `gh auth status` succeeds. `new-repository.ts` takes `GITHUB_TOKEN` from `gh auth token` itself; never read, print or pass the token.
- **Scoped publisher.** For any publishing or "plan only" run, `node scripts/new-repository.ts --capabilities` must print JSON whose `targetScoped` is `true`. If it does not, stop before scaffolding and report that the canonical checkout needs the target-scoped publisher update. Never fall back to an older script or to preview-only scope checking.
- **Optional language.** When the language is deferred, `scripts/add-project-language.ts` must exist; it ships with the `new-project.ts` that takes `--language` as optional. If it is missing, stop before scaffolding and report that the canonical checkout needs the language-neutral `new-project.ts`. Never pick a language to get past it.
- **Passphrase.** `TF_VAR_state_passphrase` is set and at least 16 characters. **Check only its length, and never print, echo or log the value** — `pwsh -NoProfile -Command "($env:TF_VAR_state_passphrase ?? '').Length -ge 16"` answers `True` or `False`. If the process does not have it, check the User scope the same way with `[Environment]::GetEnvironmentVariable('TF_VAR_state_passphrase','User')`; when it is only there, Step 3's commands load it into their own process from that scope. If it is in neither, ask the user to set it. Never set or write it anywhere.
- **Fresh target.** The project path does not exist, and `repositories/<Name>.yaml` does not exist in the checkout.

For "local only", skip the tofu, gh, scoped-publisher and passphrase checks. The optional-language check applies whenever the language is deferred.

## 3. Run the scripts

Run each script with `node`, working directory the SubZeroDev.GitHub checkout. A list such as `--topics tooling,cli` is split on commas by the script. Where the passphrase lives only in the User scope, wrap the command as `pwsh -NoProfile -Command "$env:TF_VAR_state_passphrase = [Environment]::GetEnvironmentVariable('TF_VAR_state_passphrase','User'); node scripts/<script>.ts <options>"`, so it is loaded into that process only.

**Never preview with `new-project.ts --plan-only`.** It scaffolds the path, and the real run then refuses because the path exists.

1. **Scaffold.** `node scripts/new-project.ts --name <Name> --language <language> <options> --local-only`. It scaffolds, initialises git on `main`, validates the build and tests unless told to skip, and makes one commit. Note whether it printed that the build and tests passed, that they did not, or nothing because validation was skipped — Step 5 reports it. With the language deferred, leave out `--language` entirely: it writes the common files with no starter and no commands, runs no validation, and prints that the language is deferred. For "local only", stop here and report.
2. **Plan.** `node scripts/new-repository.ts --name <Name> --path <project path> <repository options> --target-scoped --plan-only`. It writes the definition, checks the saved plan with the executable scope guard, and puts the definition back. A refusal stops setup. For "plan only", stop here and report the plan.
3. **Apply.** `node scripts/new-repository.ts --name <Name> --path <project path> <repository options> --target-scoped`. The script generates fresh plans and validates each exact saved plan immediately before applying it. Creation permits only the requested repository and its `Main` ruleset with enforcement disabled. After pushing `main`, activation permits only that ruleset's disabled-to-active enforcement change; every other attribute must stay unchanged and known. Unrelated no-ops are allowed; unrelated changes and unexpected target mutations are refused. The earlier preview is informational and does not constrain or authorize these later plans.

**Always pass `--target-scoped` to `new-repository.ts`, including previews. Never pass `--force` to either script**, and never run `tofu` directly — no bare `tofu apply`, no `tofu` outside the canonical checkout. The scripts are the only path, because they hold the executable scope guard and the refusal of destroy and replace plans. Never retry a refused plan without the guard.

Invoking this command authorizes creating that one repository and pushing its first `main`. It authorizes nothing broader.

## 4. Commit the definition

The apply leaves `repositories/<Name>.yaml` uncommitted. If it never reaches `main`, the next apply from `main` plans to archive the new repository. In the SubZeroDev.GitHub checkout:

1. `git switch -c add-repository/<Name>`.
2. `git add repositories/<Name>.yaml`, then `git diff --check`.
3. Commit with the message `Add <Name>`. No AI attribution.
4. `git push -u origin add-repository/<Name>`, then open a non-draft pull request against `main` with `gh pr create --repo The-Running-Dev/SubZeroDev.GitHub --base main`. The body says what was created — the repository, its visibility, topics and required checks — and that this pull request must merge before the next apply.
5. `git switch main`. The state file is ignored, so the switch does not move it.

This command never merges. Merging follows the kit's normal rule, `tools/merge-pull-request.ts`.

If the publishing invocation in Step 3.3 failed after the definition was written, leave the YAML uncommitted and do not delete it or proceed with this section. A first-plan refusal means no apply ran; an activation-plan refusal can leave the repository created and `main` pushed, with activation incomplete. Report the script's completed-stage message and the definition path. A failed apply may be partial. Verify remote state before describing the repository or ruleset as created, active or absent; never infer rollback. The retained definition needs manual reconciliation before another setup. A preview refusal in Step 3.2 restores the definition and applies nothing.

## 5. Report

Lead with the kit's report shape, and include each of these:

- the project path;
- its git state, read from `git -C <project path> status --short --branch` and `git -C <project path> log --oneline`;
- the repository URL and visibility, from `gh repo view The-Running-Dev/<Name> --json url,visibility`;
- whether the `Main` ruleset is active, read back from `gh api repos/The-Running-Dev/<Name>/rulesets` (its `enforcement` is `active`), never inferred from the script's output;
- whether the build and tests passed, failed, or were skipped;
- the SubZeroDev.GitHub pull request URL, and that it must merge before the next apply.

With the language deferred, report these three lines in place of the build and tests, exactly:

- `Implementation language: deferred`
- `Language-specific validation: not applicable`
- `Next: /agentkit:interview`

A deferred project has no build or tests yet; that is not a failure, and no command is to be reported for it.

For "local only" and "plan only", report what ran and where the project is, that it is not published, and name the command that publishes it later.

For a stopped setup, report only completed steps and verified remote state, plus the refusal and any retained definition requiring reconciliation. Do not present the normal success report or claim that nothing changed merely because the last plan was refused.

## Never

- Copy SubZeroDev.GitHub's scripts, templates or logic into AgentKit.
- Clone SubZeroDev.GitHub, or run `tofu` outside its canonical checkout.
- Pass `--force` to either script.
- Publish or preview without `new-repository.ts --target-scoped`.
- Print the passphrase or the token.
- Run a bare `tofu apply`.
- Choose, suggest or default a language the user did not give, or invent install, build, test, lint or run commands for a deferred project.
