import { Extension } from "@tiptap/core";
import { BLOCK_TYPE_CONFIG } from "./blockTypes.js";

/** Callback invoked when the editor requests an inter-block operation. */
export interface BlockNavigationCallbacks {
  /** Move focus to the block with the given index. cursorPosition: 'start' | 'end'. */
  navigateToBlock?: (targetIndex: number, cursorPosition: "start" | "end") => void;

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
          navigateToBlock?.(blockIndex + 1, "start");
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
          navigateToBlock?.(blockIndex - 1, "end");
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

/** Split HTML at cursor position for a paragraph block. */
function splitAtCursor(
  editor: { getText: () => string },
  cursorPos: number,
): { before: string; after: string } {
  const fullText = editor.getText();
  const textSplitPoint = Math.max(0, cursorPos - 1);
  const textBefore = fullText.slice(0, textSplitPoint);
  const textAfter = fullText.slice(textSplitPoint);

  return {
    before: `<p>${textBefore}</p>`,
    after: `<p>${textAfter}</p>`,
  };
}

/** Split heading content at cursor - returns heading + paragraph. */
function splitHeadingAtCursor(
  editor: { getHTML: () => string; getText: () => string },
  cursorPos: number,
  docSize: number,
): { before: string; after: string } {
  if (cursorPos >= docSize - 1) {
    return { before: editor.getHTML(), after: "<p></p>" };
  }

  const fullText = editor.getText();
  const textSplitPoint = Math.max(0, cursorPos - 1);
  const textBefore = fullText.slice(0, textSplitPoint);
  const textAfter = fullText.slice(textSplitPoint);

  const level = getHeadingLevel(editor.getHTML());
  return {
    before: `<h${level}>${textBefore}</h${level}>`,
    after: `<p>${textAfter}</p>`,
  };
}

/** Extract heading level from HTML string. */
function getHeadingLevel(html: string): string {
  const m = html.match(/<h(\d)/);
  return m ? m[1] : "1";
}

/** Split list item at cursor into two list items. */
function splitListAtCursor(
  editor: { getHTML: () => string; getText: () => string },
  cursorPos: number,
  listType: string,
): { before: string; after: string } {
  const fullText = editor.getText();
  const textSplitPoint = Math.max(0, cursorPos - 1);
  const textBefore = fullText.slice(0, textSplitPoint);
  const textAfter = fullText.slice(textSplitPoint);

  const tag = listType === "numberedList" ? "ol" : "ul";
  return {
    before: `<${tag}><li>${textBefore}</li></${tag}>`,
    after: `<${tag}><li>${textAfter}</li></${tag}>`,
  };
}

/** Split todo item at cursor into two todo items. */
function splitTodoAtCursor(
  editor: { getHTML: () => string; getText: () => string },
  cursorPos: number,
): { before: string; after: string } {
  const fullText = editor.getText();
  const textSplitPoint = Math.max(0, cursorPos - 1);
  const textBefore = fullText.slice(0, textSplitPoint);
  const textAfter = fullText.slice(textSplitPoint);

  return {
    before: `<ul class="task-list"><li data-checked="false">${textBefore}</li></ul>`,
    after: `<ul class="task-list"><li data-checked="false">${textAfter}</li></ul>`,
  };
}
