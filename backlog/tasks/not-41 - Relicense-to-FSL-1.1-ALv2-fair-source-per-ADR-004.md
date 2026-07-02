---
id: NOT-41
title: Relicense to FSL-1.1-ALv2 (fair-source) per ADR-004
status: done
assignee: []
created_date: '2026-07-01 08:33'
updated_date: '2026-07-01 14:58'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Execute the relicense decided in ADR-004: retire the commercial EULA / €29 Polar model, adopt FSL-1.1-ALv2 (source-available, Apache-2.0 tail after 2 years), reserve a future Team tier without building it. Core always runs free without a license key.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LICENSE replaced with FSL-1.1-ALv2 text, correct copyright line and per-release change date
- [x] #2 README has a License section: free self-host, 2-year Apache tail, single no-competing-SaaS constraint
- [x] #3 LandingPage.tsx removes €29 pricing, 500-buyer cap, and Polar checkout; CTA points at the public repo
- [x] #4 /privacy and /terms reviewed and updated to match a free self-host posture (no purchase-flow references)
- [x] #5 No new runtime gating/entitlements code introduced
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions from planning discussion:
- Copyright holder for FSL header: Thomas Legrand.
- LandingPage.tsx: keep the page (do NOT remove) — repurpose as a 'free & open, self-host it' page pointing at the public repo; strip €29 pricing, 500-buyer cap, and Polar checkout.

Follow-up (post-review): removed ghcr.io image reference from README; added render.yaml one-click blueprint (Docker + persistent disk, generates BETTER_AUTH_SECRET). Rewrote README as SOTA fair-source, cairn-inspired: centered brand hero (logo + wordmark + badges + hero shot), 'The Notara toolchain' section emphasizing the notara CLI / REST API / desktop app, collapsible config reference, FSL license section. Standardized repo slug to dnzzl/notara throughout (fixed stale notara/notara refs). Deploy paths: Render one-click, Docker Compose (build from source, recommended), Fly.io, Railway, plain Docker.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Relicensed Notara to fair-source per ADR-004 (supersedes ADR-002/003).

What changed:
- LICENSE: commercial EULA replaced with the FSL-1.1-ALv2 template (Copyright 2026 Thomas Legrand; future-license grant converts each release to Apache-2.0 two years after it ships).
- README: header link now 'License: FSL-1.1-ALv2'; License section rewritten to free-to-self-host + one no-competing-SaaS restriction + Apache-2.0 tail. Tagline changed source-available -> fair-source.
- LandingPage.tsx: removed Polar checkout, EUR29 pricing, and the 500-buyer cap throughout (nav, hero, specs, ticker, why, pricing). CTAs now point at the public repo (github.com/dnzzl/notara). Analytics event checkout_clicked -> get_source_clicked (dropped price/plan props). 'Why source-available' section rewritten as 'Why fair-source, not just MIT?'. Pricing panel now EUR0 / clone & self-host.
- privacy.tsx / terms.tsx: removed purchase/Polar/EULA language; Terms 'The service' + 'Payments' + 'Updates' reflect free FSL self-host; LICENSE link points to repo; dates bumped to 2026-07-01. Privacy scope + PostHog event description de-checkout-ed.
- observability.ts: funnel-event doc comment updated checkout_clicked -> get_source_clicked (comment only).

No runtime gating/entitlements code added.

Verification: bun install + built @notara/shared; server tsc clean of real errors (only pre-existing bun:sqlite/bun:test --bun resolution noise remains); no tsc errors in the three edited app files; 118/118 server tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
