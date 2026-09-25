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
- the platform and PowerShell version

## What to expect

- An acknowledgement within 7 days.
- A fix on `main`, and a new tagged release, for anything confirmed. Credit in the advisory if you
  want it.

## Supported versions

Only the latest tagged release and `main` receive fixes. Older tags are not patched; upgrade with
`/sync` or by re-running the installer.
