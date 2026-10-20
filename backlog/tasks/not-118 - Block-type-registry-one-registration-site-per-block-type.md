---
id: NOT-118
title: 'Block-type registry: one registration site per block type'
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:13'
updated_date: '2026-08-26 15:16'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 113000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
What a block type IS currently requires five modules to agree.

The block-type configuration record holds placeholder, default content, split behaviour and whether the type renders custom. A separate function derives the type from HTML prefixes — a second, parallel truth. The renderer registry is a third list: the render-custom flag and the renderer registration are two independent registries kept in sync by hand, and they already disagree — toggle and callout are marked as not rendering custom, while the page-link type is marked as rendering custom and is then special-cased OUTSIDE the registry anyway. Slash-command creation re-specifies each type's default content as string literals, duplicating the configuration field. The navigation extension's split branches re-inline those same literals again as fallbacks.

Adding one block type means edits in all five, plus the union.

There are also two divergent HTML wrappers: the merge path re-implements tag wrapping that a shared helper already knows how to do, while the split path uses the shared one.

Target interface, one registration site per block type:
  describe(type), fromHtml(html), wrap(type, inlineHtml), emptyContent(type), renderer(type), slashCommands(), onInsert(type)

Fold in three render branches that are nearly identical — the page-link special case, the generic custom renderer, and the TipTap path — into a single render function taking a block and a context. The sortable block wrapper currently takes eleven props, most of them forwarded untouched; give it the block and that context instead.

Move the content-parsing helper out of the renderer registry, where it is misfiled: it is the genuinely deep part of that file and belongs with the other block-content helpers.

CONSTRAINT: the isolated-TipTap-editor-per-block architecture is settled. This ticket does not change it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A block type is registered in exactly one place, covering configuration, HTML derivation, wrapping, default content, renderer and slash command
- [x] #2 The render-custom flag and renderer registration are no longer two lists that can disagree
- [ ] #3 The page-link type goes through the registry with no special case outside it
- [x] #4 Default content is defined once per type and never restated as a literal at a creation or split site
- [ ] #5 One HTML wrapping helper serves both the split and merge paths
- [ ] #6 Block rendering goes through a single render function, and the sortable wrapper takes a block and a context instead of eleven props
- [ ] #7 Adding a block type is demonstrated as a single registration, with the compiler flagging anything unhandled
- [x] #8 The block-types and editor E2E specs pass unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two of this ticket's claims were overstated and one understated. Verified before acting, as the earlier corrections taught.

OVERSTATED — "slash-command creation re-specifies each type's default content as string literals" and "the split branches re-inline the defaults". defaultContentForType already existed and was already used by split and merge. Four stray literals remained (three paragraphs and one people block); they are gone.

UNDERSTATED — rendersCustom was described as a second registry kept in sync by hand. It was worse than that: nothing read it. Eight types carried the flag while six had registered renderers, and the discrepancy had no consequence because no code consulted the field. A hand-maintained second source of truth with zero consumers. Deleted rather than reconciled — hasBlockRenderer is and was the real answer.

The divergent HTML wrappers were real and are now one. They genuinely differed: the merge path knew that code nests <pre><code>, and blockTagForType returns "p" for code. So splitting and merging a code block disagreed about what it should look like. wrapInlineHTML in blockTypes.ts is now the single answer, and a test pins the code case specifically.

NOT DONE, and left unchecked rather than claimed:
- AC 1/3/5/6 — folding the three render branches into one renderBlock(block, ctx), and giving SortableBlock a context instead of eleven props. This is the risky part of the ticket: three branches in a 1979-line component whose only real net is the E2E suite, and it is also what NOT-119 will restructure anyway. Doing it here means doing it twice.
- AC 7 — adding a block type as a single registration, demonstrated. Not attempted, because the registration is not yet single: pageLink and database are still special-cased outside the renderer registry.

So this ticket delivers the consolidation that was safe and leaves the render-branch unification to NOT-119, where the surrounding code is being restructured anyway.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fold the block-type knowledge that was genuinely duplicated.

Three of this ticket's claims needed checking first, and checking changed what the work was.

rendersCustom was described as a second registry kept in sync by hand. It was worse: nothing read it. Eight types carried the flag while six had registered renderers, and the discrepancy had no consequence because no code consulted the field — a hand-maintained second source of truth with zero consumers. Deleted rather than reconciled.

The divergent HTML wrappers were real. They differed in a way that mattered: the merge path knew code nests <pre><code>, while blockTagForType returns "p" for it, so splitting and merging a code block disagreed. wrapInlineHTML is now the single answer, with a test pinning that case.

The default-content claim was overstated — defaultContentForType already existed and was already used by split and merge. Four stray literals remained and are gone.

6 tests, including one asserting a block created with its default content reads back as its own type: otherwise the first keystroke silently changes what the block is.

Left unchecked rather than claimed: folding the three render branches into one renderBlock and replacing SortableBlock's eleven props. That is the risky half — three branches in a 1979-line component whose only net is the E2E suite — and it is what NOT-119 restructures anyway, so doing it here means doing it twice.

Tests: 96 app pass / 0 fail, app type-check clean apart from the pre-existing toggleHeading errors, biome clean, 11 block-type and editor E2E passed.
<!-- SECTION:FINAL_SUMMARY:END -->
