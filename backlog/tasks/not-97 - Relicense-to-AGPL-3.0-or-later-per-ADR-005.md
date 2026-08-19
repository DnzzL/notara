---
id: NOT-97
title: Relicense to AGPL-3.0-or-later per ADR-005
status: done
assignee:
  - '@claude'
created_date: '2026-08-19 15:53'
updated_date: '2026-08-19 15:54'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Execute the relicense decided in ADR-005 (supersedes ADR-004): FSL-1.1-ALv2 costs distribution — OSI-gated catalogues, a licence paragraph to defend in every launch thread — to protect a hosted-competitor scenario whose expected value ADR-004 itself judged near zero. As sole copyright holder, AGPL keeps nearly all of that optionality anyway.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LICENSE carries the verbatim GNU AGPL v3 text, with the copyright notice alongside it
- [x] #2 README badge, intro and License section state AGPL-3.0-or-later and which releases carry which terms
- [x] #3 CONTRIBUTING and the PR template state inbound = AGPL-3.0-or-later, DCO optional, no CLA
- [x] #4 LandingPage and /terms carry no fair-source or Apache-2.0-tail framing
- [x] #5 ADR-005 recorded, ADR-004 marked superseded, CLAUDE.md posture updated
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Relicensed Notara from FSL-1.1-ALv2 to AGPL-3.0-or-later per ADR-005, effective v0.1.3.

Why: ADR-004 chose FSL to block a hosted competitor while simultaneously recording that monetisation was unlikely and that distribution was the real constraint. FSL priced that trade backwards — it costs OSI-gated catalogues (awesome-selfhosted and friends), a licence argument in every launch thread, and a 'source available' asterisk everywhere, to protect a scenario with near-zero probability and damage. As sole copyright holder, AGPL keeps nearly all the optionality FSL was bought for: copyleft binds licensees, not the holder, so a hosted edition or a dual-licensed add-on remains possible without anyone's permission.

Changes:
- LICENSE: verbatim GNU AGPL v3; new COPYRIGHT with the standard notice.
- README: badge, intro, License section (stating that <= v0.1.2 keeps FSL terms).
- CONTRIBUTING + PR template: inbound = outbound AGPL, DCO optional, explicitly no CLA.
- LandingPage.tsx: kicker, 'Why AGPL, not just MIT?', pricing sheet and spec tiles; the Apache-2.0-tail claims are gone. OnboardingTour and /terms follow.
- docs/adr/005-agpl.md added; 004 marked superseded; CLAUDE.md posture and docs/agents/domain.md updated.

Follow-up: NOT-98 — surface a source link inside the app for AGPL section 13.
<!-- SECTION:FINAL_SUMMARY:END -->
