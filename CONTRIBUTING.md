# Contributing

Issues and pull requests are welcome.

## Proposing a change

1. **Open an issue first** for anything beyond a typo, using a template in `.github/ISSUE_TEMPLATE/`
   (bug or story). It is much cheaper to agree on the problem before code is written.
2. **Branch off `main`** and keep the pull request to one change.
3. **Run the tests locally** with PowerShell 7 before pushing:

   ```powershell
   Invoke-Pester -Path tools -Output Detailed
   pwsh -File tools/Test-DesignState.ps1
   ```

4. **Open the pull request against `main`.** CI (`.github/workflows/verify.yml`) must pass before it
   can merge, and force-pushes to `main` are blocked.

## Conventions

The binding rules for this repository are [`AGENTS.shared.md`](AGENTS.shared.md) and
[`AGENTS.md`](AGENTS.md); they apply to human contributors as much as to agents. The ones most
often missed:

- UTF-8 with LF line endings; PowerShell 7 for scripts; metric units.
- Stage files by named path. Do not use `git add -A`.
- Commit messages say what changed. No AI attribution lines.
- Adding a Markdown file, a script or a command means adding its unit record under `design/state/`;
  `tools/Test-DesignState.ps1` reports the ones that are missing.

## Security issues

Do not open a public issue. See [`SECURITY.md`](SECURITY.md).

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
