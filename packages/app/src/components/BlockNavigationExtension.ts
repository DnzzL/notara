import { type Editor, Extension, getHTMLFromFragment } from "@tiptap/core";
import { extractInlineHTML, splitInlineHTML } from "./blockEditing.js";
import {
	BLOCK_TYPE_CONFIG,
	type BlockType,
	blockTypeFromHtml,
	wrapInlineHTML,
} from "./blockTypes.js";

/**
 * Callbacks invoked when the editor requests an inter-block operation.
 *
 * NOTHING HERE TAKES AN INDEX, and that is the point. `useEditor` is called
 * with an empty deps array, and TipTap's fast path for that case is
 * `Editor.setOptions` — which updates `editor.options` but does NOT rebuild the
 * extension manager. So whatever `BlockNavigationExtension.configure()` was
 * handed at mount is what the keyboard shortcuts keep forever.
 *
 * When these callbacks carried the block's position, that stale copy addressed
 * a different block after anything was inserted above: Enter rewrote a
 * neighbour's content, Backspace deleted a neighbour outright. Binding them to
 * the block's id instead makes the frozen copy correct by construction — an id
 * does not go stale.
 */
export interface BlockNavigationCallbacks {
	/**
	 * Move focus to the adjacent block, entering from the edge the caret is
	 * leaving. When `x` (the caret's screen x-coordinate) is given, the caret is
	 * placed at the same horizontal position so vertical movement keeps its
	 * column. Returns false when there is no such block, so the key falls
	 * through to the editor's own handling.
	 */
	navigate?: (dir: "prev" | "next", x?: number) => boolean;

	/** Merge the current block with the previous block. Called on Backspace at position 0. */
	mergeWithPrevious?: () => void;

	/** Pull the next block into this one. Called on Delete at the end. */
	mergeWithNext?: () => boolean;

	/**
	 * Split the current block at the cursor.
	 * - `beforeContent`: HTML that stays in the current block.
	 * - `afterContent`: HTML for the new block below.
	 * - `newBlockType`: Type hint for the new block (e.g. "paragraph" after heading).
	 */
	splitBlock?: (
		beforeContent: string,
		afterContent: string,
		newBlockType?: string,
		/**
		 * The type this block is right now, read off the live document. A
		 * markdown transform (`- ` → bullet list) changes the node before the
		 * debounced save has written the new type, and splitting cancels that
		 * save — so the split has to carry it.
		 */
		currentType?: string,
	) => void;

	/** Create a new empty block below this one. Called on Cmd+Enter. */
	insertBlockAfter?: () => void;

	/** Update the content (and optionally type) of a block (for debounced saves). */
	updateBlock?: (id: string, content: string, type?: string) => void;
}

/**
 * Derive the current block type from the editor's live top-level node HTML.
 * Thin wrapper around {@link blockTypeFromHtml} for the TipTap Editor API.
 * This is used instead of the stored `blockType` option so that markdown
 * transforms (e.g. typing `# ` which changes the node to <h1>) are reflected
 * immediately in split/merge/Enter behavior, without waiting for the debounced
 * store update.
 */
export function detectBlockTypeFromEditor(editor: Editor): BlockType {
	return blockTypeFromHtml(editor.getHTML());
}

export const BlockNavigationExtension = Extension.create<{
	blockId: string;
	callbacks: BlockNavigationCallbacks;
}>({
	name: "blockNavigation",

	/**
	 * Outranks StarterKit (priority 100) so our Enter handler runs first.
	 * Without this, the paragraph node's default Enter creates a `<p>` inside
	 * the same TipTap editor instead of splitting into a separate block.
	 */
	priority: 1000,

	addOptions() {
		return {
			blockId: "",
			callbacks: {} as BlockNavigationCallbacks,
		};
	},

	addKeyboardShortcuts() {
		const { blockId, callbacks } = this.options;
		const {
			navigate,
			mergeWithPrevious,
			mergeWithNext,
			splitBlock,
			insertBlockAfter,
		} = callbacks;

		/** Rewrite this block in place, editor and store together. */
		const convertTo = (editor: Editor, html: string, type: BlockType) => {
			// emitUpdate stays false: the debounced save is bypassed on purpose,
			// because we persist the same HTML right here. Leaving it to onUpdate
			// used to mean the conversion was never written at all.
			editor.commands.setContent(html, false);
			callbacks.updateBlock?.(blockId, html, type);
		};

		return {
			// ── Arrow Down: move to next block ──────────────────────────────
			ArrowDown: ({ editor }) => {
				const { state } = editor;
				const pos = state.selection.anchor;
				const docSize = state.doc.content.size;

				// If cursor is at the end of the document (end of this block), navigate to next block
				if (pos >= docSize - 1) {
					return navigate?.("next", caretX(editor, pos)) ?? false;
				}
				return false;
			},

			// ── Arrow Up: move to previous block ────────────────────────────
			ArrowUp: ({ editor }) => {
				const { state } = editor;
				const pos = state.selection.anchor;

				// If cursor is at the start of the document (start of this block), navigate to previous block
				if (pos <= 1) {
					return navigate?.("prev", caretX(editor, pos)) ?? false;
				}
				return false;
			},

			// ── Backspace at position 0: merge with previous block ──────────
			Backspace: () => {
				const editor = this.editor;
				if (!editor) return false;
				const { selection } = editor.state;
				// A selection has something of its own to delete. Only a collapsed
				// caret sitting at the very start is a block-level operation.
				if (!selection.empty) return false;
				const pos = selection.anchor;
				if (pos > 1) return false;

				// At the start of a single-item list or todo → leave the list, keeping
				// the text and its marks, so Backspace doesn't feel like a no-op. With
				// more than one item, ProseMirror's own lift is the right behavior and
				// flattening them into one paragraph would lose the other items.
				const liveType = detectBlockTypeFromEditor(editor);
				const splitBehavior =
					BLOCK_TYPE_CONFIG[liveType]?.splitBehavior ?? "normal";
				if (
					(splitBehavior === "list" || splitBehavior === "todo") &&
					itemCount(editor) <= 1
				) {
					convertTo(
						editor,
						wrapInlineHTML("paragraph", extractInlineHTML(editor.getHTML())),
						"paragraph",
					);
					return true;
				}
				if (splitBehavior === "list" || splitBehavior === "todo") return false;

				// Non-list block at position 0 → merge with previous block
				mergeWithPrevious?.();
				return true;
			},

			// ── Delete at the end: pull the next block up ───────────────────
			// The mirror of Backspace at the start. Without it, forward-delete at
			// the end of a block did nothing at all: the caret sat against a wall
			// that is invisible, because the blocks read as one document.
			Delete: ({ editor }) => {
				const { selection, doc } = editor.state;
				if (!selection.empty) return false;
				if (selection.anchor < doc.content.size - 1) return false;
				return mergeWithNext?.() ?? false;
			},

			// ── Cmd/Ctrl+Enter: explicit new block (cursor follows) ─────────
			"Mod-Enter": ({ editor }) => {
				const { state } = editor;
				const pos = state.selection.anchor;
				const docSize = state.doc.content.size;

				if (editor.isEmpty || pos >= docSize - 1) {
					insertBlockAfter?.();
				} else {
					const { before, after } = splitInlineHTML(editor, pos);
					splitBlock?.(`<p>${before}</p>`, `<p>${after}</p>`, "paragraph");
				}
				return true;
			},

			// ── Enter ───────────────────────────────────────────────────────
			// Derives the split behavior from the editor's LIVE top node type,
			// not the stored block.type, so markdown transforms take effect
			// immediately without waiting for the debounced save.
			Enter: ({ editor }) => {
				const { state } = editor;
				const pos = state.selection.anchor;
				const docSize = state.doc.content.size;
				// textContent is empty for both empty paragraphs AND empty list/todo
				// blocks (where editor.isEmpty returns false for nested nodes).
				const blockIsEmpty = editor.isEmpty || !state.doc.textContent.trim();

				const liveType = detectBlockTypeFromEditor(editor);
				const splitBehavior =
					BLOCK_TYPE_CONFIG[liveType]?.splitBehavior ?? "normal";

				if (splitBehavior === "list" || splitBehavior === "todo") {
					if (blockIsEmpty) {
						// Enter on an empty bullet leaves the list, exactly where the
						// caret already is. It used to leave the empty bullet behind AND
						// add a paragraph under it — two blocks for a key that should
						// have produced none.
						convertTo(editor, "<p></p>", "paragraph");
						return true;
					}
					if (pos >= docSize - 1) {
						// Cursor at end of a non-empty list → create a new empty sibling.
						const emptyContent =
							BLOCK_TYPE_CONFIG[liveType]?.defaultContent ??
							"<ul><li></li></ul>";
						splitBlock?.(editor.getHTML(), emptyContent, liveType, liveType);
						return true;
					}
					const { before, after } = splitDocAtCursor(editor, pos);
					// Truncate this editor to the "before" half first — its own debounced
					// save still holds the whole pre-split line and would land after
					// splitBlock, restoring it and leaving the text in both items
					// (NOT-96). emitUpdate=false so this doesn't schedule another save.
					editor.commands.setContent(before, false);
					splitBlock?.(before, after, liveType, liveType);
					return true;
				}
				if (splitBehavior === "split-paragraph") {
					if (blockIsEmpty || pos >= docSize - 1) {
						splitBlock?.(editor.getHTML(), "", "paragraph", liveType);
						return true;
					}
					const before = splitDocAtCursor(editor, pos).before;
					// The tail of a heading or a quote continues as a paragraph, so it
					// is taken as inline content rather than sliced with its wrapper.
					const after = `<p>${splitInlineHTML(editor, pos).after}</p>`;
					// Same truncation, same reason (NOT-96).
					editor.commands.setContent(before, false);
					splitBlock?.(before, after, "paragraph", liveType);
					return true;
				}

				// Code / normal: soft line break, so Enter adds a line inside the
				// block rather than leaving it.
				(editor.chain().focus() as any).setHardBreak().run();
				return true;
			},

			// ── Tab / Shift+Tab: indent inside a list ───────────────────────
			//
			// A block usually holds a single list item, and there is nothing to
			// indent it under — so ProseMirror's own handler declines and the key
			// falls through to the browser, which moves focus to the next element
			// on the page. Pressing Tab in the middle of a document and landing in
			// the sidebar is the "indentation goes wrong" report.
			//
			// So: indent when the block holds several items (imported or pasted
			// lists do), and otherwise consume the key rather than leave. Escape
			// is the way out of a block, and it already is.
			Tab: ({ editor }) => {
				const name = itemNameForList(editor);
				if (name) (editor.chain().focus() as any).sinkListItem(name).run();
				return true;
			},
			"Shift-Tab": ({ editor }) => {
				const name = itemNameForList(editor);
				if (name) (editor.chain().focus() as any).liftListItem(name).run();
				return true;
			},

			// ── Shift+Enter: line break inside the current block ────────────
			"Shift-Enter": ({ editor }) => {
				// The counterpart to Enter: wherever Enter leaves the block (paragraph,
				// heading, quote, list, todo), Shift+Enter stays in it and inserts a
				// break. For code blocks, whose splitBehavior is "normal", both keys
				// add a line — which is what a code block wants.
				(editor.chain().focus() as any).setHardBreak().run();
				return true;
			},
		};
	},
});

/** Screen x-coordinate of the caret, for column-preserving navigation. */
function caretX(editor: Editor, pos: number): number | undefined {
	try {
		return editor.view.coordsAtPos(pos).left;
	} catch {
		return undefined;
	}
}

/** The list-item node name for the block's list type, or null if it isn't a list. */
function itemNameForList(editor: Editor): "listItem" | "taskItem" | null {
	const type = detectBlockTypeFromEditor(editor);
	if (type === "todo") return "taskItem";
	if (type === "bulletList" || type === "numberedList") return "listItem";
	return null;
}

/** How many items the top-level list of this block holds (0 if it isn't one). */
function itemCount(editor: Editor): number {
	const top = editor.state.doc.firstChild;
	return top ? top.childCount : 0;
}

/**
 * Split the whole block document at the cursor, keeping every wrapper and
 * every sibling.
 *
 * This replaced four per-type splitters that each rebuilt the block's HTML from
 * the cursor's own text node — `<ul><li>before</li></ul>`. For a block holding
 * one list item that reads the same; for a block holding five (anything pasted
 * or imported) it silently dropped the other four. Slicing the document says
 * "everything up to here" and "everything from here" without knowing what the
 * block is made of.
 */
function splitDocAtCursor(
	editor: Editor,
	cursorPos: number,
): { before: string; after: string } {
	const { doc } = editor.state;
	const before = getHTMLFromFragment(
		doc.slice(0, cursorPos).content,
		editor.schema,
	);
	const after = getHTMLFromFragment(
		doc.slice(cursorPos, doc.content.size).content,
		editor.schema,
	);
	return { before, after };
}
