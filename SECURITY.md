# Security policy

AgentKit's installer changes machine-wide state: host registrations, global instruction files, git
hooks. A flaw in it reaches every machine that runs it, so reports are welcome and taken seriously.

## Reporting a vulnerability

**Report privately, not in a public issue.** Use GitHub's private vulnerability reporting:
the **Security** tab of this repository, then **Report a vulnerability**. Only the maintainer can
see the report.

Include what you can of:

- what an attacker can do, and what they need first (a fork, a crafted repository, local access)
- the steps to reproduce, and the commit or release tag you tested
- the platform and Node version

## What to expect

- An acknowledgement within 7 days.
- A fix on `main`, and a new tagged release, for anything confirmed. Credit in the advisory if you
  want it.

## Verifying a release

Release tags are signed with the maintainer's SSH key, and each release carries
`SubZeroDev.AgentKit-<tag>.tar.gz` (the source, from `git archive`) with its SHA-256 checksum in
`SubZeroDev.AgentKit-<tag>.tar.gz.sha256`. This starts with the first release published by
`tools/publish-release.ts`; earlier tags are unsigned and have no checksum asset.

Verify the tag in a checkout (`git fetch --tags` first). It prints `Good "git" signature for
The-Running-Dev@users.noreply.github.com` and exits 0, or fails:

```text
git -c gpg.ssh.allowedSignersFile=.github/allowed_signers tag -v <tag>
```

`.github/allowed_signers` comes from the repository it vouches for, so check its key once against
the maintainer's GitHub signing keys (`gh api users/The-Running-Dev/ssh_signing_keys`); GitHub also
marks the tag *Verified*.

Verify a downloaded archive in the folder holding both files:

```text
sha256sum -c SubZeroDev.AgentKit-<tag>.tar.gz.sha256
```

In PowerShell, compare `(Get-FileHash SubZeroDev.AgentKit-<tag>.tar.gz -Algorithm SHA256).Hash` with
the first field of the `.sha256` file.

## Supported versions

Only the latest tagged release and `main` receive fixes. Older tags are not patched; upgrade with
`/sync` or by re-running the installer.
