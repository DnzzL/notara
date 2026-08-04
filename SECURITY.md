# Security Policy

## Supported versions

Notara has not reached v0.1.0 yet. Only the latest release (and `main`) receives
security fixes — there are no backports to older tags.

## Reporting a vulnerability

Do not open a public issue.

- Email **legrand.thomas5@hotmail.fr**, or
- Use GitHub's private vulnerability reporting: **Security → Report a vulnerability**
  on <https://github.com/dnzzl/notara>.

Useful details: affected version or commit, deployment mode (self-hosted, Docker,
Electron), a description of the impact, and steps to reproduce. Redact secrets.

## What to expect

Notara is maintained by one person in his spare time, so:

- Acknowledgement within **7 days**.
- An initial assessment (severity, whether it's in scope) within **14 days**.
- Fixes land as fast as the severity warrants; critical issues jump the queue.

If you haven't heard back after 14 days, send a reminder — mail gets lost.
Please give me a reasonable window to ship a fix before disclosing publicly.
Credit in the release notes if you want it.

## Scope

In scope: the server (`packages/server`), the web app (`packages/app`), the CLI,
the Electron app, the shared RPC schema, and the published Docker image —
authentication and session handling, workspace/permission checks, data exposure
across workspaces, injection, and RCE.

Out of scope: findings against a third-party service Notara talks to (report those
to that vendor), missing hardening headers with no demonstrated impact, automated
scanner output without a working reproduction, denial of service through raw
request volume, social engineering, and issues that require an already-compromised
host or admin account.

## Self-hosted deployments

Notara is self-hosted software. Operating it safely — TLS, backups, OS and
container updates, secret management, database file permissions, network exposure
and access control — is the operator's responsibility. I'll fix vulnerabilities in
the code; I can't secure your server.
