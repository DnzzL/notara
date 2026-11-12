/**
 * Pure split/merge/insert logic for the block editor, extracted out of
 * BlockEditor.tsx. Each function takes the minimal block data it needs and
 * returns a plain "operation" object describing what should happen — it
 * never touches the store, TipTap, or the DOM. The caller (BlockEditor)
 * applies the operation via store actions and focus requests.
 *
 * Keeping this pure means split/merge/insert can be unit tested by import,
 * without mounting an editor or a store.
 */

import { extractInlineHTML } from "../components/blockEditing.js";
import { blockTypeFromHtml, wrapInlineHTML } from "../components/blockTypes.js";
import { defaultContentForType } from "../components/editorSchema.js";

export interface BlockLike {
	id: string;
	type: string;
	content: string;
	index: number;
	parentId?: string | null;
}

export interface MergeOperation {
	/** Write this content into the surviving (previous) block. */
	updateBlock: { id: string; content: string };
	/** Delete the block that got merged away. */
	deleteBlockId: string;
	/** Where the caret should land after the merge. */
	focus: { blockId: string; offset: number };
}

export interface SplitOperation {
	/** Truncate the split block down to what stays before the cursor. */
	updateBlock: { id: string; content: string; type?: string };
	/** The new block created from what was after the cursor. */
	insertBlock: {
		id: string;
		type: string;
		content: string;
		index: number;
		parentId: string | null;
	};
	focus: { blockId: string };
}

export interface InsertAfterOperation {
	insertBlock: {
		id: string;
		type: string;
		content: string;
		index: number;
		parentId: string | null;
	};
	focus: { blockId: string };
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

/** Merge `current` into `prev`, preserving inline formatting from both. */
export function mergeBlocks(
	prev: BlockLike,
	current: BlockLike,
): MergeOperation {
	// Derive the previous block's type from its content HTML, not the stored
	// type, to avoid the 500ms debounce race (a markdown transform may have
	// changed the content without yet persisting the type).
	const prevHtml = prev.content || defaultContentForType(prev.type);
	const prevType = blockTypeFromHtml(prevHtml);

	// Concatenate inline content (marks intact), then re-wrap in prev's tag.
	const prevInner = extractInlineHTML(prevHtml);
	const currentInner = extractInlineHTML(
		current.content || defaultContentForType(current.type),
	);
	const mergedHtml = wrapInlineHTML(prevType, prevInner + currentInner);

	// Caret lands at the seam — the text length of prev's content.
	const seam = stripHtml(prevInner).length;

	return {
		updateBlock: { id: prev.id, content: mergedHtml },
		deleteBlockId: current.id,
		focus: { blockId: prev.id, offset: seam },
	};
}

/**
 * Split `current` at the cursor. `beforeContent` stays in `current`,
 * `afterContent` becomes a new block right after it.
 */
export function splitBlock(
	current: BlockLike,
	beforeContent: string,
	afterContent: string,
	newBlockId: string,
	newBlockType?: string,
	currentType?: string,
	parentId: string | null = current.parentId ?? null,
): SplitOperation {
	// Persist the type alongside the content when a markdown transform has
	// changed it (`- ` → bullet list) but the debounced save hasn't landed:
	// the split truncates this block, which would cancel that save.
	const finalBefore = beforeContent || defaultContentForType(current.type);
	const newType = newBlockType || "paragraph";
	const finalAfter = afterContent || defaultContentForType(newType);

	return {
		updateBlock: {
			id: current.id,
			content: finalBefore,
			type:
				currentType && currentType !== current.type ? currentType : undefined,
		},
		insertBlock: {
			id: newBlockId,
			type: newType,
			content: finalAfter,
			index: current.index + 1,
			parentId,
		},
		focus: { blockId: newBlockId },
	};
}

/** Insert a new empty paragraph right after `current`. */
export function insertBlockAfter(
	current: BlockLike,
	newBlockId: string,
	parentId: string | null = current.parentId ?? null,
): InsertAfterOperation {
	return {
		insertBlock: {
			id: newBlockId,
			type: "paragraph",
			content: defaultContentForType("paragraph"),
			index: current.index + 1,
			parentId,
		},
		focus: { blockId: newBlockId },
	};
}

/**
 * How deep each block sits. Blocks come in depth-first order, so a parent is
 * always seen before its children; one with an unknown parent counts as top
 * level.
 */
export function blockDepths(
	blocks: readonly { id: string; parentId?: string | null }[],
): Map<string, number> {
	const depths = new Map<string, number>();
	for (const b of blocks)
		depths.set(b.id, b.parentId ? (depths.get(b.parentId) ?? -1) + 1 : 0);
	return depths;
}

/**
 * The parent changes `reparentBlock` makes, worked out locally so the screen
 * (and a block inserted a keystroke later) agrees before the server replies.
 * Same rules as the server's `reparentBlock`, which stays authoritative.
 */
export function reparentChanges(
	blocks: readonly { id: string; index: number; parentId?: string | null }[],
	id: string,
	direction: "in" | "out",
): Map<string, string | null> {
	const changes = new Map<string, string | null>();
	const block = blocks.find((b) => b.id === id);
	if (!block) return changes;
	const parent = block.parentId ?? null;
	if (direction === "in") {
		const prev = blocks
			.filter((b) => (b.parentId ?? null) === parent && b.index < block.index)
			.sort((a, b) => b.index - a.index)[0];
		if (prev) changes.set(id, prev.id);
	} else if (parent) {
		for (const b of blocks)
			if (b.parentId === parent && b.index > block.index) changes.set(b.id, id);
		changes.set(id, blocks.find((b) => b.id === parent)?.parentId ?? null);
	}
	return changes;
}

/**
 * Where "move up/down" drops a block: before its previous sibling, or after
 * its next sibling (same parent), so its subtree travels with it. Null at the
 * edge of its siblings.
 */
export function stepTarget(
	blocks: readonly { id: string; index: number; parentId?: string | null }[],
	id: string,
	direction: "up" | "down",
): { targetId: string; position: "before" | "after" } | null {
	const block = blocks.find((b) => b.id === id);
	if (!block) return null;
	const sibs = blocks
		.filter((b) => (b.parentId ?? null) === (block.parentId ?? null))
		.sort((a, b) => a.index - b.index);
	const i = sibs.findIndex((b) => b.id === id);
	const next = sibs[direction === "up" ? i - 1 : i + 1];
	return next
		? { targetId: next.id, position: direction === "up" ? "before" : "after" }
		: null;
}
