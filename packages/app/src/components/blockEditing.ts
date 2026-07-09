import { getHTMLFromFragment, type Editor } from "@tiptap/core";

/** The ProseMirror document node type, derived from the editor to avoid a direct pm import. */
type DocNode = Editor["state"]["doc"];

// ── Formatting-preserving slicing ─────────────────────────────────────
//
// Split and merge must keep inline marks (bold/italic/code/[[page]] refs).
// We slice the ProseMirror document instead of round-tripping through plain
// text. `getHTMLFromFragment` serializes a fragment back to HTML with marks.

/**
 * Inline HTML of the textblock at `pos`, split into the part before and after
 * the cursor. Marks are preserved. The returned strings are inline-only (no
 * block wrapper) so callers can re-wrap in whatever block tag they need.
 */
export function splitInlineHTML(editor: Editor, pos: number): { before: string; after: string } {
  const $pos = editor.state.doc.resolve(pos);
  const parent = $pos.parent; // the textblock containing the cursor
  const offset = $pos.parentOffset;
  const before = getHTMLFromFragment(parent.content.cut(0, offset), editor.schema);
  const after = getHTMLFromFragment(parent.content.cut(offset), editor.schema);
  return { before, after };
}

/**
 * Inline HTML of a stored block's content string — the content of the
 * innermost text-bearing element, marks intact. Descends through single
 * wrappers (blockquote > p, pre > code, ul > li) so the result is inline.
 */
export function extractInlineHTML(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  let el = parsed.body.firstElementChild;
  while (el && el.children.length === 1 && el.textContent === el.children[0].textContent) {
    el = el.firstElementChild;
  }
  return el ? el.innerHTML : html;
}

/** Map a plain-text offset to a document position (mark/nesting aware). */
export function posAtTextOffset(doc: DocNode, targetOffset: number): number {
  let remaining = targetOffset;
  let result = 1;
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    const len = node.text?.length ?? 0;
    if (remaining <= len) {
      result = pos + remaining;
      return false;
    }
    remaining -= len;
    return true;
  });
  return result;
}

// ── Pending-focus registry ────────────────────────────────────────────
//
// Replaces the old setTimeout-retry focus dispatch. A focus request names a
// block and where to place the caret. The matching block consumes it the
// moment its editor is ready (or immediately, if already mounted), so there
// is no timing race against editor mount.

export type FocusTarget =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "offset"; offset: number }
  | { kind: "column"; x: number; edge: "top" | "bottom" };

let pending: { blockId: string; target: FocusTarget } | null = null;
const listeners = new Set<() => void>();

/** Request that `blockId` receive focus. Overwrites any prior pending request. */
export function requestFocus(blockId: string, target: FocusTarget): void {
  pending = { blockId, target };
  for (const l of [...listeners]) l();
}

/** Consume a pending focus request for `blockId`, if any. */
export function consumeFocus(blockId: string): FocusTarget | null {
  if (pending?.blockId === blockId) {
    const target = pending.target;
    pending = null;
    return target;
  }
  return null;
}

/** Subscribe to focus requests; returns an unsubscribe function. */
export function subscribeFocus(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Place the caret in `editor` per `target` and focus it. */
export function applyFocus(editor: Editor, target: FocusTarget): void {
  const docEnd = Math.max(1, editor.state.doc.content.size - 1);
  let pos: number;
  switch (target.kind) {
    case "start":
      pos = 1;
      break;
    case "end":
      pos = docEnd;
      break;
    case "offset":
      pos = Math.min(posAtTextOffset(editor.state.doc, target.offset), docEnd);
      break;
    case "column": {
      const rect = (editor.view.dom as HTMLElement).getBoundingClientRect();
      const y = target.edge === "top" ? rect.top + 8 : rect.bottom - 8;
      const found = editor.view.posAtCoords({ left: target.x, top: y });
      pos = found ? found.pos : target.edge === "top" ? 1 : docEnd;
      break;
    }
  }
  editor.commands.setTextSelection(pos);
  editor.commands.focus();
}
