---
id: NOT-118
title: 'Block-type registry: one registration site per block type'
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:13'
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
- [ ] #2 The render-custom flag and renderer registration are no longer two lists that can disagree
- [ ] #3 The page-link type goes through the registry with no special case outside it
- [ ] #4 Default content is defined once per type and never restated as a literal at a creation or split site
- [ ] #5 One HTML wrapping helper serves both the split and merge paths
- [ ] #6 Block rendering goes through a single render function, and the sortable wrapper takes a block and a context instead of eleven props
- [ ] #7 Adding a block type is demonstrated as a single registration, with the compiler flagging anything unhandled
- [ ] #8 The block-types and editor E2E specs pass unchanged
<!-- AC:END -->
