---
id: NOT-91
title: 'Landing hero: demo CTA misaligned and mock checkmark off-centre'
status: done
assignee: []
created_date: '2026-08-06 08:14'
updated_date: '2026-08-06 08:14'
labels:
  - bug
dependencies: []
priority: low
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two visual defects on the landing page. (1) The 'Try the live demo' CTA is a <button> between two <a>s and kept three user-agent defaults — line-height: normal (74px tall vs 81.6px for the anchors), background: buttonface (grey fill) and text-align: center — while the row used align-items: center, so the seamed button bar had mismatched top/bottom edges. (2) The checked box in the SQLite file mock positioned its checkmark with an absolute top:-3px/left:1px, putting the glyph in the top-right corner instead of the centre.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The three hero CTAs share the same top, bottom and height, with no background or alignment difference between the button and the anchors
- [x] #2 The checkmark is centred in its box on both axes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed both landing-page defects in styles.css.

CTA row: .landing-hero-ctas now stretches instead of centring, and .landing-cta-secondary resets the three user-agent defaults that made the <button> the odd one out among the <a>s — line-height: inherit, background: transparent, text-align: left (plus cursor: pointer). Measured in the browser before/after: 74px vs 81.6px tall and a grey buttonface fill before, all three at top 483.4 / bottom 565 / height 81.6 and transparent after.

Mock checkbox: .lp-chk.on centres its glyph with flex instead of an absolute top:-3px/left:1px, which had pushed the checkmark out of the top-right corner of the 14px box.

Verified visually at 1440x900 and at 4x zoom on the checkbox; biome and the 64 app tests are green.
<!-- SECTION:FINAL_SUMMARY:END -->
