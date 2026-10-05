# Contributing

Issues and pull requests are welcome.

## Proposing a change

1. **Open an issue first** for anything beyond a typo, using a template in `.github/ISSUE_TEMPLATE/`
   (bug or story). It is much cheaper to agree on the problem before code is written.
2. **Branch off `main`** and keep the pull request to one change.
3. **Run the tests locally** with Node >= 22.18 before pushing:

   ```sh
   npm ci
   npx tsc --noEmit
   node --test tools/
   ```

4. **Open the pull request against `main`.** CI (`.github/workflows/verify.yml`) must pass before it
   can merge, and force-pushes to `main` are blocked.

## Conventions

The binding rules for this repository are [`AGENTS.shared.md`](AGENTS.shared.md) and
[`AGENTS.md`](AGENTS.md); they apply to human contributors as much as to agents. The ones most
often missed:

- UTF-8 with LF line endings; Node and erasable TypeScript for scripts; metric units.
- Runtime code uses Node built-ins only. Development dependencies are for type checking; users do not run npm install.
- Stage files by named path. Do not use `git add -A`.
- Commit messages say what changed. No AI attribution lines.

## Security issues

Do not open a public issue. See [`SECURITY.md`](SECURITY.md).

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
