# ADR-014: Block nesting is `parent_id` over a flat, depth-first list

**Status:** Accepted
**Date:** 2026-11-12
**Scope:** `blocks.parent_id`, the `reparentBlock` operation, page and public-page rendering (NOT-140, slice 1).

## Decision

A page's blocks stay a flat list ordered by `"index"`, and that order is **depth-first**: a block's
descendants follow it directly. `parent_id` (already in the schema, `ON DELETE CASCADE`, always NULL
until now) says who owns whom. No new column, no migration.

`reparentBlock(blockId, direction: "in" | "out")` is the only way to change nesting:

- `in` (Tab): the block becomes a child of its previous sibling (same parent, greatest lower index).
  No-op without one.
- `out` (Shift-Tab): the block moves to its parent's level; its later siblings become its children
  (Notion's behaviour). No-op at the top level.

Both moves keep the order depth-first, so **no `index` is rewritten**. Returns the page's blocks.

Rendering is the flat list, indented by depth (24px per level). The DOM is not nested: one TipTap
editor per block stays a sibling of the others (see the block-per-editor decision).

Deleting a block deletes its subtree (the FK cascade, ADR-013); the client mirrors it locally.

## Rejected

- **A second `parent_block_id` column** (the first draft of the brief): `parent_id` already means
  exactly this, and two columns can disagree.
- **Client-computed `setParent(id, parentId)`**: pushes the previous-sibling and adoption rules to every
  caller (app, CLI, API) and lets a client create cycles or cross-page parents.
- **Nested DOM / tree of editors**: conflicts with the isolated-editor-per-block architecture.

## Consequences

- Anything that creates a block after another (Enter, slash commands) must pick its `parent_id`: first
  child if the block has children, else the same parent. `createBlock` itself does not check it.
- Not covered yet (follow-up tickets): drag-and-drop and Move up/down do not carry a block's subtree;
  numbered lists do not restart per level; undo of a delete restores only the deleted block.
- Backspace-merge into the previous block is refused when the merged block has children (it would
  cascade-delete them).
