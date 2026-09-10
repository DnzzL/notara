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
		parentId: null;
	};
	focus: { blockId: string };
}

export interface InsertAfterOperation {
	insertBlock: {
		id: string;
		type: string;
		content: string;
		index: number;
		parentId: null;
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
			parentId: null,
		},
		focus: { blockId: newBlockId },
	};
}

/** Insert a new empty paragraph right after `current`. */
export function insertBlockAfter(
	current: BlockLike,
	newBlockId: string,
): InsertAfterOperation {
	return {
		insertBlock: {
			id: newBlockId,
			type: "paragraph",
			content: defaultContentForType("paragraph"),
			index: current.index + 1,
			parentId: null,
		},
		focus: { blockId: newBlockId },
	};
}
