---
id: NOT-98
title: Surface a source link inside the app (AGPL section 13)
status: done
assignee:
  - '@thomas'
created_date: '2026-08-19 15:53'
updated_date: '2026-08-27 08:12'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AGPL section 13 expects users who interact with the program over a network to be able to get its source. The landing page links the repository, but a logged-in user on a self-hosted instance has no such link — and on a modified instance the operator's obligation is to point at their source, not ours. Settings needs an About row with the version, the licence, and a source URL that an operator can override.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Settings shows version, licence (AGPL-3.0-or-later) and a link to the source
- [x] #2 The source URL is overridable by env var so an operator can point at their own fork
- [x] #3 The link is reachable without leaving the app shell
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Served by the instance rather than compiled into the bundle, which is the whole point: an operator running a MODIFIED build owes users THEIR source, not upstream's. SOURCE_URL overrides it, APP_VERSION sets the version, and both are documented in the README with that obligation spelled out rather than left implied.

Placed in Settings → About, behind no admin check. Section 13 is about anyone interacting with the instance over a network, so gating it on being an owner would defeat it.

The panel degrades rather than disappearing: if the config call fails it still names upstream and says the instance may have been modified. A licence disclosure that renders nothing when the network hiccups is not a disclosure.

route-auth.test.ts asserted the exact key set of /api/public-config, so it had to change. Kept as an exact-set assertion rather than loosened — the endpoint is unauthenticated, so anything added there is added for the whole internet, and that is the property worth guarding. A second test asserts the URL is absolute and the licence string is the one the project actually ships under.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Surface version, licence and source inside the app (AGPL section 13).

Section 13 expects someone interacting with the program over a network to be able to get its source. The landing page links the repository, but a logged-in user never sees the landing page — and on a modified instance the operator owes users their own source, not upstream's.

Settings gains an About tab showing version, licence and source URL. All three come from /api/public-config rather than the bundle, so SOURCE_URL lets an operator point at their fork and APP_VERSION at their build; both are documented in the README with the obligation stated rather than implied. No admin check: the clause is about any user of the instance.

The panel degrades rather than vanishing — if the config call fails it still names upstream and says the instance may have been modified.

route-auth.test.ts asserted the endpoint's exact key set and was updated, deliberately keeping the exact-set form: the endpoint is unauthenticated, so anything added there is added for everyone.

Tests: quickcheck, check-effect-errors and biome ci all exit 0.
<!-- SECTION:FINAL_SUMMARY:END -->
