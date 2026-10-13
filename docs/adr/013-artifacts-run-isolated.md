# ADR-013: An Artifact Runs Isolated, With No Network

**Status:** Accepted
**Date:** 2026-10-13
**Scope:** Artifacts — self-contained HTML documents attached to a page and shown live in it
(`CONTEXT.md`). Builds on ADR-006 (attachment access follows page access).

## Context

Agents and people produce HTML reports, dashboards and diffs (archify's architecture views,
for one) and want them on the card they belong to, alive rather than as a download. That
HTML is written by whoever attached it — often an agent — and is shown to everyone who can
read the page. Served from the app's origin, it would run with the reader's session and
could read the workspace or send it elsewhere.

## Decision

- **An artifact renders in an iframe with an opaque origin**: `sandbox="allow-scripts
  allow-popups allow-popups-to-escape-sandbox"`, never `allow-same-origin`. Its file is
  served with a matching `Content-Security-Policy: sandbox …`, so opening it directly is no
  different.
- **Scripts run; nothing leaves.** Inline scripts and styles are allowed; every network
  fetch is not (`default-src 'none'`, `connect-src 'none'`): no CDN, no API call, no
  beacon. "Self-contained" is meant literally — everything inline.
- **Links open in a new tab.** A reader's click on a visible link is the one way out.
- **No bridge to Notara**: no `postMessage` API, no auto-height. An artifact displays; it
  does not act.
- **The isolation is stated, not silent**: when an artifact is attached, the hosts it
  references are reported back (`blockedHosts`), and its frame says it is isolated.

## Considered options

- **Allow the network.** Rejected: an artifact written by an agent can read what it was
  given and post it anywhere; the reader cannot see it happen.
- **Static HTML only, no scripts.** Rejected: no charts, tabs or toggles — the reason to
  show a dashboard live is gone.
- **A separate origin for artifacts** (an `artifacts.` subdomain). Rejected for now: a
  second hostname, certificate and cookie scope for every self-hosted instance, to buy what
  an opaque-origin sandbox already gives.

## Consequences

- An artifact that loads a library from a CDN renders without it. Its producer must inline
  it; the `blockedHosts` warning says which. Archify's output passes as is.
- `localStorage` and cookies throw inside an artifact; well-behaved HTML guards them.
- **Possible relaxation, not a reversal:** an allowlist of CDN hosts for scripts and styles
  only (`fetch` still blocked). Adding it later breaks no artifact; removing it would — so
  it starts closed.
