---
name: setup-project
description: Start a new project end to end - scaffold it, create its GitHub repository with the standard settings and the Main ruleset, push it, and open the SubZeroDev.GitHub pull request that records the definition. Usage - /setup-project SubZeroDev.Thing node, or /setup-project SubZeroDev.Thing python private, topics tooling,cli
argument-hint: "<Name> <language> [options]"
disable-model-invocation: true
---

Start a new project: scaffold it, create its GitHub repository, apply the standard settings and the `Main` ruleset, push, and record the definition. **$1** is the project name, **$2** the language, and anything after them is plain-language options.

**This command is a thin driver.** Every step already lives in `The-Running-Dev/SubZeroDev.GitHub`: `scripts/New-Project.ps1` scaffolds, and `scripts/New-Repository.ps1` writes `repositories/<Name>.yaml` and runs OpenTofu. That repository's `README.md` owns the instructions, in *Prerequisites*, *Create a project*, *Create a repository* and *Test*. Read those and the two scripts' `param` blocks in the checkout before running anything; they are the authority for parameter names, allowed values and defaults, and this file does not restate them. This command owns only locating the checkout, its own preconditions, and committing the new definition.

If the name or the language is missing, ask. Guess neither.

## Options

Map the plain-language options onto the scripts' parameters:

- A description, `private`/`public`, topics, and required checks map to `-Description`, `-Visibility`, `-Topics` and `-RequiredCheck`. These go to both scripts.
- A required check is `"context"` or `"context@integration_id"`; GitHub Actions is integration id 15368. `require check "build / Result"` from Actions becomes `-RequiredCheck 'build / Result@15368'`.
- A client choice, a project folder, "no starter" and "skip validation" map to `-Client`, `-Path`, `-SkipLanguageStarter` and `-SkipValidation`. These go to `New-Project.ps1` only.
- `-Path` defaults, inside `New-Project.ps1`, to a sibling of the SubZeroDev.GitHub checkout named after the project. Resolve the same path yourself; Step 2 and `New-Repository.ps1 -Path` need it.
- **"local only"** — scaffold and commit, then stop.
- **"plan only"** — scaffold, commit and show the plan, then stop.

An option that maps to nothing in the `param` blocks is a question for the user, not a guess.

## 1. Locate the checkout

Take the first that exists:

1. the path in `$env:SUBZERODEV_GITHUB_HOME`;
2. a `SubZeroDev.GitHub` folder that is a sibling of the current repository.

Then verify every one of these, and stop naming the first that fails:

- the folder is a git repository;
- its `origin` is `The-Running-Dev/SubZeroDev.GitHub`;
- `scripts/New-Project.ps1` exists;
- `terraform.tfstate` exists.

**Never clone it.** Its state is local, gitignored and encrypted. A clone has no state, so an apply from it would try to recreate every repository it manages.

## 2. Preconditions

Check all of these before writing anything. Report each failure; never fix one on the user's behalf.

- **Branch and pull.** The checkout is on `main` and `git status --porcelain` is empty (ignored files do not count). `git pull --ff-only` succeeds.
- **No pending setup pull request.** `gh pr list --repo The-Running-Dev/SubZeroDev.GitHub --state open --json number,headRefName,url` shows no head starting `add-repository/`. If one does, stop and name it: an unmerged definition makes the next plan archive that repository, and the script refuses that plan but leaves the new YAML behind.
- **Tools.** `tofu` is on PATH (install with `winget install OpenTofu.Tofu`), and `gh auth status` succeeds. `New-Repository.ps1` takes `GITHUB_TOKEN` from `gh auth token` itself; never read, print or pass the token.
- **Passphrase.** `TF_VAR_state_passphrase` is set and at least 16 characters. **Check only its length, and never print, echo or log the value** — `pwsh -NoProfile -Command "($env:TF_VAR_state_passphrase ?? '').Length -ge 16"` answers `True` or `False`. If the process does not have it, check the User scope the same way with `[Environment]::GetEnvironmentVariable('TF_VAR_state_passphrase','User')`; when it is only there, Step 3's commands load it into their own process from that scope. If it is in neither, ask the user to set it. Never set or write it anywhere.
- **Fresh target.** The project path does not exist, and `repositories/<Name>.yaml` does not exist in the checkout.

For "local only", skip the tofu, gh and passphrase checks.

## 3. Run the scripts

Run each script with `pwsh -NoProfile -Command`, working directory the SubZeroDev.GitHub checkout. Use `-Command`, not `-File`: under `-File` a comma list such as `-Topics tooling,cli` arrives as one string. Where the passphrase lives only in the User scope, begin the command with `$env:TF_VAR_state_passphrase = [Environment]::GetEnvironmentVariable('TF_VAR_state_passphrase','User');`.

**Never preview with `New-Project.ps1 -PlanOnly`.** It scaffolds the path, and the real run then refuses because the path exists.

1. **Scaffold.** `./scripts/New-Project.ps1 -Name <Name> -Language <language> <options> -LocalOnly`. It scaffolds, initialises git on `main`, validates the build and tests unless told to skip, and makes one commit. Note whether it printed that the build and tests passed, that they did not, or nothing because validation was skipped — Step 5 reports it. For "local only", stop here and report.
2. **Plan.** `./scripts/New-Repository.ps1 -Name <Name> -Path <project path> <repository options> -PlanOnly`. It writes the definition, plans, and puts the definition back. For "plan only", stop here and report the plan.
3. **Check the plan's scope.** Every resource change in the plan output (`# <address> will be created`, `will be updated in-place`, `must be replaced`, `will be destroyed`) must be a create, at an address beginning `module.repository["<Name>"]`; the summary line must read `0 to change, 0 to destroy`. Anything else — any update, replacement or destruction, or a create outside that module instance — is drift, and drift is the user's to resolve: stop and report those addresses.
4. **Apply.** `./scripts/New-Repository.ps1 -Name <Name> -Path <project path> <repository options>`. It applies with the ruleset disabled, adds `origin` and pushes `main`, then applies again to enable the ruleset.

**Never pass `-Force` to either script**, and never run `tofu` directly — no bare `tofu apply`, no `tofu` outside the canonical checkout. The scripts are the only path, because they hold the refusal of destroy and replace plans.

Invoking this command authorizes creating that one repository and pushing its first `main`. It authorizes nothing broader.

## 4. Commit the definition

The apply leaves `repositories/<Name>.yaml` uncommitted. If it never reaches `main`, the next apply from `main` plans to archive the new repository. In the SubZeroDev.GitHub checkout:

1. `git switch -c add-repository/<Name>`.
2. `git add repositories/<Name>.yaml`, then `git diff --check`.
3. Commit with the message `Add <Name>`. No AI attribution.
4. `git push -u origin add-repository/<Name>`, then open a non-draft pull request against `main` with `gh pr create --repo The-Running-Dev/SubZeroDev.GitHub --base main`. The body says what was created — the repository, its visibility, topics and required checks — and that this pull request must merge before the next apply.
5. `git switch main`. The state file is ignored, so the switch does not move it.

This command never merges. Merging follows the kit's normal rule, `tools/merge-pull-request.ts`.

If Step 3 failed after the definition was written — the apply stopped partway — leave the YAML uncommitted and do not delete it. Report its path and say it needs this pull request or deleting by hand.

## 5. Report

Lead with the kit's report shape, and include each of these:

- the project path;
- the repository URL and visibility, from `gh repo view The-Running-Dev/<Name> --json url,visibility`;
- whether the `Main` ruleset is active, read back from `gh api repos/The-Running-Dev/<Name>/rulesets` (its `enforcement` is `active`), never inferred from the script's output;
- whether the build and tests passed, failed, or were skipped;
- the SubZeroDev.GitHub pull request URL, and that it must merge before the next apply.

For "local only" and "plan only", report what ran and where the project is, and name the command that publishes it later.

## Never

- Copy SubZeroDev.GitHub's scripts, templates or logic into AgentKit.
- Clone SubZeroDev.GitHub, or run `tofu` outside its canonical checkout.
- Pass `-Force` to either script.
- Print the passphrase or the token.
- Run a bare `tofu apply`.
