---
id: NOT-107
title: One block-content contract for both API surfaces
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:11'
updated_date: '2026-08-26 14:26'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Block content is stored as a string by the blocks module. The REST adapter parses and stringifies JSON around it, so REST clients see structured content while RPC clients see the raw string. Same module, two contracts, decided by which door the caller came through.

The codec belongs inside the blocks module, not in one of its adapters. Move it there so both surfaces see one contract, and pick which contract that is — do not keep both alive behind a flag.

Also remove the duplicate page-id lookup for a block: handlers/blocks.ts declares one and the permissions module already exports the same thing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Block content is encoded and decoded inside the blocks module, not in any adapter
- [x] #2 RPC and REST callers observe the same block-content shape
- [x] #3 The duplicated block-to-page lookup is reduced to one definition
- [x] #4 A test covers the round trip through both surfaces and asserts they agree
- [x] #5 The CLI, which consumes the REST surface, still round-trips block content correctly
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The contract chosen is 'content is a string', which is what storage holds and what RPC already returned. Picking the other way would have meant changing what the editor produces.

Found while doing it, and bigger than the ticket: the OpenAPI document described a THIRD contract that matched neither surface — { "text": "…" } objects for every text block. Paragraphs store HTML. The write path coerced objects to JSON, so an integrator following the published document stored {"text":"hi"} where the editor expects <p>hi</p> and got a block that renders blank, with nothing to say why. The document was fiction and the coercion made the fiction destructive.

Evidence it was fiction rather than an aspiration: the CLI's own --content help text says 'Text blocks use HTML, e.g. <p>Hello</p>'. Two published documents for the same field, contradicting each other.

So the coercion is gone rather than kept as tolerant input. A non-string content is refused with 400 and a message naming the expected format per block type. Accepting it would have meant continuing to hand people a way to corrupt their own data.

The OpenAPI content table and all three content property descriptions were rewritten to describe what the server does. CHANGELOG carries a BREAKING entry, including the instruction to rewrite any object-content blocks — they are already broken.

playwright.config.ts: the multiuser project's matcher now also picks up rest-*.spec.ts. The distinguishing property of that project was never 'several users', it is 'brings its own session', which this spec does. Renaming the file to multiuser-* would have been a lie about what it tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One block-content contract for both API surfaces.

Block content is stored as a string whose reading depends on the block type: HTML for text blocks, JSON for structured ones. The REST adapter decided otherwise and decided it in the wrong place — JSON.parse on the way out with a fallback to the raw string, so it returned an object for an image and a string for a paragraph while RPC returned the string either way. One module, two contracts, chosen by which door the caller used.

The OpenAPI document described a third contract matching neither: { "text": "…" } for every text block. Combined with the write path's object-to-JSON coercion, an integrator following the published document stored {"text":"hi"} where the editor expects <p>hi</p> — a block that renders blank. The CLI's own help text already said HTML, so the two published documents contradicted each other.

Changes:
- handlers/blocks.ts now states and owns the contract, with the validity check and the caller-facing message beside it.
- api-v1/routes.ts no longer parses on read or coerces on write; a non-string content is refused with 400 and a message naming the expected format.
- The OpenAPI content table and all three content descriptions rewritten to describe reality, with a note that the previous shape was never stored.
- The duplicate getBlockPageId in permissions.ts is re-exported from blocks.ts instead of reimplemented.
- CHANGELOG: BREAKING entry for /api/v1 consumers, with what to do about existing object-content blocks.
- e2e/rest-block-content.spec.ts: four tests asserting the two surfaces return the identical string for both a text and a structured block, that an object is refused with an actionable message, and that a REST edit is visible to RPC unchanged. Two of them were confirmed to fail against the old adapter.

Tests: 224 unit pass / 0 fail, both type-checks and biome clean, 4 new E2E passed.
<!-- SECTION:FINAL_SUMMARY:END -->
