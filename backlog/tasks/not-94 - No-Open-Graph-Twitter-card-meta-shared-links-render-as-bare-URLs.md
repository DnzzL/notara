---
id: NOT-94
title: 'No Open Graph / Twitter card meta: shared links render as bare URLs'
status: ready-for-human
assignee:
  - '@claude'
created_date: '2026-08-19 12:21'
updated_date: '2026-08-19 12:49'
labels:
  - bug
dependencies: []
priority: high
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
packages/app/index.html declares no og:*, twitter:* or meta description tags. Every share of notara.legrand.sh or demo.notara.legrand.sh on HN, Reddit, X, LinkedIn, Slack or Discord renders as a bare link with no title, description or preview image. Blocks any launch communication.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 index.html declares og:title, og:description, og:image (absolute URL), og:url, og:type and a meta description
- [x] #2 twitter:card=summary_large_image plus twitter:title/description/image declared
- [x] #3 og:image is a 1200x630 asset served from packages/app/public with a real MIME type
- [ ] #4 Preview verified on the deployed URL with a card validator or by fetching the HTML
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Generate a 1200x630 og.jpg from the existing hero poster (scale + pad, no crop)
2. Declare og:*, twitter:* and meta description in packages/app/index.html
3. Verify the tags survive the Vite build and the asset is served
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Generated packages/app/public/notara-og.jpg (1200x630) from the existing hero poster with ffmpeg: scale to height 630, pad to width on the poster's own black ground, so nothing is cropped.
- Declared meta description, og:type/url/site_name/title/description/image(+width/height/alt) and twitter:card/title/description/image in packages/app/index.html.
- og:url and og:image are absolute to https://notara.legrand.sh — a self-hosted instance therefore advertises the project's marketing page rather than its own host. Deliberate: relative og:image is unreliable across crawlers, and canonicalising a private instance URL away is the safer default.
- Verified in the Vite build output: dist/index.html carries all 13 tags and dist/notara-og.jpg ships. .jpg already had an image/jpeg MIME entry in the static table.
- .github/bundle-sizes.json baseline for index.html refreshed (1438B -> 2967B); the gate flagged the +106% as expected.

- AC4 (preview verified on the deployed URL) is not checkable from the working tree: notara.legrand.sh still serves the pre-change head and /notara-og.jpg 404s to the SPA fallback. Re-run a card validator once this is deployed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every share of notara.legrand.sh or demo.notara.legrand.sh rendered as a bare link: packages/app/index.html declared no og:*, no twitter:* and no meta description.

Changes:
- packages/app/index.html: meta description, full og:* set (type, url, site_name, title, description, image with width/height/alt) and twitter:card=summary_large_image with title/description/image.
- packages/app/public/notara-og.jpg: 1200x630 card derived from the existing hero poster (scaled and padded on its own black ground, nothing cropped).
- .github/bundle-sizes.json: index.html baseline refreshed for the larger head.

Verified: the built dist/index.html carries the tags and dist/notara-og.jpg ships; the bundle-size gate passes again.

Follow-up: the card itself can only be validated once deployed — notara.legrand.sh still serves the old head.
<!-- SECTION:FINAL_SUMMARY:END -->
