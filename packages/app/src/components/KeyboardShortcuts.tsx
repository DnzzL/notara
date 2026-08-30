import { useEffect } from "react";
import { useBlockStore, usePageStore } from "../store.js";
import { useHistoryStore } from "../stores/historyStore.js";

/**
 * Global keyboard shortcuts:
 *   Cmd+[ / Cmd+] — history back / forward
 *   Cmd+D — duplicate focused block
 *   Cmd+Shift+↑ / Cmd+Shift+↓ — move focused block up/down
 *
 * Block-aware shortcuts derive the focused block from the DOM ancestor
 * carrying data-block-id.
 */
export function KeyboardShortcuts() {
	const currentPage = usePageStore((s) => s.currentPage);
	const blocks = useBlockStore((s) => s.blocks);
	const createBlock = useBlockStore((s) => s.createBlock);
	const reorderBlocks = useBlockStore((s) => s.reorderBlocks);

	useEffect(() => {
		/**
		 * The focused block, by id.
		 *
		 * This used to read a position off the DOM and index into a list of
		 * blocks with the database ones filtered out — two orderings that part
		 * company as soon as a page holds a database, so the shortcut acted on
		 * the wrong block or on none.
		 */
		const focusedBlockId = (): string | null => {
			const el = document.activeElement as HTMLElement | null;
			return (
				(el?.closest?.("[data-block-id]") as HTMLElement | null)?.getAttribute(
					"data-block-id",
				) ?? null
			);
		};

		const handler = async (e: KeyboardEvent) => {
			const mod = e.metaKey || e.ctrlKey;
			if (!mod) return;

			// Cmd+Z / Cmd+Shift+Z — undo / redo block structural ops.
			//
			// Only when no editor has the caret. This used to run unconditionally,
			// on the theory that TipTap consumed the event first when a block was
			// focused — it does call preventDefault, but the event still bubbles to
			// this window listener. So one Cmd+Z ran the editor's text undo AND
			// popped the block stack, which deletes the last created block: the
			// line the user had just typed into vanished.
			if (e.key === "z" || e.key === "Z") {
				if (
					(document.activeElement as HTMLElement | null)?.closest?.(
						".ProseMirror",
					)
				)
					return;
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
				const id = focusedBlockId();
				if (id === null || !currentPage) return;
				const block = blocks.find((b) => b.id === id);
				if (!block || block.type === "database") return;
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
				const id = focusedBlockId();
				if (id === null || !currentPage) return;
				// Every block on the page, database blocks included: the reorder
				// assigns each id its position in this list, so leaving any out
				// hands the missing ones whatever index is left over.
				const sorted = [...blocks].sort((a, b) => a.index - b.index);
				const idx = sorted.findIndex((b) => b.id === id);
				if (idx === -1 || sorted.length < 2) return;
				const newIdx = idx + (e.key === "ArrowUp" ? -1 : 1);
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
