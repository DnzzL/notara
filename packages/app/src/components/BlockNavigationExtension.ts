import { Extension, type Editor } from "@tiptap/core";
import { BLOCK_TYPE_CONFIG } from "./blockTypes.js";
import { splitInlineHTML } from "./blockEditing.js";

/** Callback invoked when the editor requests an inter-block operation. */
export interface BlockNavigationCallbacks {
  /**
   * Move focus to the block at `targetIndex`, entering from `edge`. When `x`
   * (the caret's screen x-coordinate) is given, the caret is placed at the
   * same horizontal position so vertical movement keeps its column.
   */
  navigateToBlock?: (targetIndex: number, edge: "top" | "bottom", x?: number) => void;

  /** Merge the current block with the previous block. Called on Backspace at position 0. */
  mergeWithPrevious?: () => void;

  /**
   * Split the current block at the cursor.
   * - `beforeContent`: HTML that stays in the current block.
   * - `afterContent`: HTML for the new block below.
   * - `newBlockType`: Type hint for the new block (e.g. "paragraph" after heading).
   */
  splitBlock?: (beforeContent: string, afterContent: string, newBlockType?: string) => void;

  /** Create a new empty block below this one. Called on Enter at the end of a block. */
  insertBlockAfter?: () => void;

  /** Update the content of the current block (for debounced saves). */
  updateBlock?: (id: string, content: string) => void;
}

export const BlockNavigationExtension = Extension.create<{
  blockIndex: number;
  totalBlocks: number;
  callbacks: BlockNavigationCallbacks;
  blockType: string;
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
      blockIndex: 0,
      totalBlocks: 0,
      callbacks: {} as BlockNavigationCallbacks,
      blockType: "paragraph",
    };
  },

  addKeyboardShortcuts() {
    const { blockIndex, totalBlocks, callbacks, blockType } = this.options;
    const { navigateToBlock, mergeWithPrevious, splitBlock, insertBlockAfter } = callbacks;

    return {
      // ── Arrow Down: move to next block ──────────────────────────────
      ArrowDown: ({ editor }) => {
        const { state } = editor;
        const pos = state.selection.anchor;
        const docSize = state.doc.content.size;

        // If cursor is at the end of the document (end of this block), navigate to next block
        if (pos >= docSize - 1 && blockIndex < totalBlocks - 1) {
          navigateToBlock?.(blockIndex + 1, "top", caretX(editor, pos));
          return true;
        }
        return false;
      },

      // ── Arrow Up: move to previous block ────────────────────────────
      ArrowUp: ({ editor }) => {
        const { state } = editor;
        const pos = state.selection.anchor;

        // If cursor is at the start of the document (start of this block), navigate to previous block
        if (pos <= 1 && blockIndex > 0) {
          navigateToBlock?.(blockIndex - 1, "bottom", caretX(editor, pos));
          return true;
        }
        return false;
      },

      // ── Backspace at position 0: merge with previous block ──────────
      Backspace: () => {
        // At start of block (position <= 1 within this TipTap doc)
        const pos = this.editor?.state?.selection?.anchor;
        if (pos !== undefined && pos <= 1 && blockIndex > 0) {
          mergeWithPrevious?.();
          return true;
        }
        return false;
      },

      // ── Cmd/Ctrl+Enter: explicit new block (cursor follows) ─────────
      "Mod-Enter": ({ editor }) => {
        const { state } = editor;
        const pos = state.selection.anchor;
        const docSize = state.doc.content.size;
        const isEmpty = editor.isEmpty;
        const newType = blockType.startsWith("heading") ? "paragraph" : "paragraph";

        if (isEmpty || pos >= docSize - 1) {
          insertBlockAfter?.();
        } else {
          const splitResult = splitAtCursor(editor, pos);
          splitBlock?.(splitResult.before, splitResult.after, newType);
        }
        return true;
      },

      // ── Enter ───────────────────────────────────────────────────────
      // For text blocks (paragraph/heading/quote/code): insert a soft
      // line break — stay within the same block. For lists/todos, split
      // into a new list item (still the same logical block type). New
      // blocks are created explicitly via Cmd+Enter or the "+" gutter.
      Enter: ({ editor }) => {
        const { state } = editor;
        const pos = state.selection.anchor;
        const docSize = state.doc.content.size;
        const isEmpty = editor.isEmpty;

        const splitBehavior = BLOCK_TYPE_CONFIG[blockType]?.splitBehavior ?? "normal";

        if (splitBehavior === "list") {
          if (isEmpty || pos >= docSize - 1) {
            splitBlock?.(editor.getHTML(), "", "paragraph");
            return true;
          }
          const splitResult = splitListAtCursor(editor, pos, blockType);
          splitBlock?.(splitResult.before, splitResult.after, blockType);
          return true;
        }
        if (splitBehavior === "todo") {
          if (isEmpty || pos >= docSize - 1) {
            splitBlock?.(editor.getHTML(), "", "paragraph");
            return true;
          }
          const splitResult = splitTodoAtCursor(editor, pos);
          splitBlock?.(splitResult.before, splitResult.after, "todo");
          return true;
        }

        // Paragraph / heading / quote / code / normal: soft line break.
        (editor.chain().focus() as any).setHardBreak().run();
        return true;
      },

      // ── Shift+Enter: same as Enter for symmetry ─────────────────────
      "Shift-Enter": ({ editor }) => {
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

/** Split a paragraph block at the cursor, preserving inline marks. */
function splitAtCursor(editor: Editor, cursorPos: number): { before: string; after: string } {
  const { before, after } = splitInlineHTML(editor, cursorPos);
  return { before: `<p>${before}</p>`, after: `<p>${after}</p>` };
}

/** Split a list item at the cursor into two items, preserving inline marks. */
function splitListAtCursor(editor: Editor, cursorPos: number, listType: string): { before: string; after: string } {
  const { before, after } = splitInlineHTML(editor, cursorPos);
  const tag = listType === "numberedList" ? "ol" : "ul";
  return {
    before: `<${tag}><li>${before}</li></${tag}>`,
    after: `<${tag}><li>${after}</li></${tag}>`,
  };
}

/** Split a todo item at the cursor into two items, preserving inline marks. */
function splitTodoAtCursor(editor: Editor, cursorPos: number): { before: string; after: string } {
  const { before, after } = splitInlineHTML(editor, cursorPos);
  return {
    before: `<ul data-type="taskList"><li data-type="taskItem" data-checked="false">${before}</li></ul>`,
    after: `<ul data-type="taskList"><li data-type="taskItem" data-checked="false">${after}</li></ul>`,
  };
}
