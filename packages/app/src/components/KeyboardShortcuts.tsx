import { useEffect } from "react";
import { useStore } from "../store.js";
import { useHistoryStore } from "../stores/historyStore.js";

/**
 * Global keyboard shortcuts:
 *   Cmd+[ / Cmd+] — history back / forward
 *   Cmd+D — duplicate focused block
 *   Cmd+Shift+↑ / Cmd+Shift+↓ — move focused block up/down
 *
 * Block-aware shortcuts derive the focused block from the DOM ancestor
 * carrying data-block-index on .block-node.
 */
export function KeyboardShortcuts() {
  const { currentPage, blocks, createBlock, reorderBlocks } = useStore();

  useEffect(() => {
    const focusedBlockIndex = (): number | null => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const node = el.closest?.("[data-block-index]") as HTMLElement | null;
      if (!node) return null;
      const idx = node.getAttribute("data-block-index");
      return idx === null ? null : Number(idx);
    };

    const handler = async (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd+Z / Cmd+Shift+Z — undo / redo block structural ops.
      // When focus is inside a TipTap editor, TipTap consumes the event first
      // (handles intra-block text history); this global handler only fires for
      // events that bubble up, i.e. focus outside an editor.
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) await useHistoryStore.getState().redo();
        else await useHistoryStore.getState().undo();
        return;
      }

      // Cmd+[ — back, Cmd+] — forward
      if (!e.shiftKey && e.key === "[") {
        e.preventDefault();
        window.history.back();
        return;
      }
      if (!e.shiftKey && e.key === "]") {
        e.preventDefault();
        window.history.forward();
        return;
      }

      // Cmd+D — duplicate block
      if (!e.shiftKey && (e.key === "d" || e.key === "D")) {
        const idx = focusedBlockIndex();
        if (idx === null || !currentPage) return;
        const sorted = [...blocks].filter((b) => b.type !== "database").sort((a, b) => a.index - b.index);
        const block = sorted[idx];
        if (!block) return;
        e.preventDefault();
        await createBlock({
          pageId: currentPage.id,
          type: block.type,
          content: block.content,
          index: block.index + 1,
          parentId: block.parentId,
        });
        return;
      }

      // Cmd+Shift+ArrowUp/Down — move block
      if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const idx = focusedBlockIndex();
        if (idx === null || !currentPage) return;
        const sorted = [...blocks].filter((b) => b.type !== "database").sort((a, b) => a.index - b.index);
        if (sorted.length < 2) return;
        const dir = e.key === "ArrowUp" ? -1 : 1;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= sorted.length) return;
        e.preventDefault();
        const ids = sorted.map((b) => b.id);
        [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
        await reorderBlocks(currentPage.id, ids);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPage, blocks, createBlock, reorderBlocks]);

  return null;
}
