import type { Block } from "@notara/shared";
import { ulid } from "ulidx";
import { create } from "zustand";
import { reparentChanges, stepTarget } from "../lib/blockDocument.js";
import { AccessDeniedError, api } from "../rpc-client.js";
import { toaster } from "../toaster.js";
import { useHistoryStore } from "./historyStore.js";

/**
 * Creates that have been applied locally but not yet acknowledged.
 *
 * A block is rendered and focused the moment Enter is pressed, so the user can
 * be typing into it — and its debounced save can reach the server — before the
 * POST that creates it does. The server answers that PUT with "block not
 * found", the failed write rolls the text back, and the line the user just
 * typed disappears. Writes to a block therefore wait for its creation first.
 */
const inFlightCreates = new Map<string, Promise<unknown>>();

/** Wait for a pending create of `id`, if any. Its own error path handles it. */
async function afterCreate(id: string): Promise<void> {
	const pending = inFlightCreates.get(id);
	if (pending) await pending.catch(() => {});
}

/** Everything nested under `id`, in page order (the server cascades deletes to it). */
export function descendantsOf(blocks: Block[], id: string): Block[] {
	const gone = new Set([id]);
	return [...blocks]
		.sort((x, y) => x.index - y.index)
		.filter((b) => b.parentId && gone.has(b.parentId) && gone.add(b.id));
}

/** `blocks` without `id` and everything nested under it. */
export function withoutSubtree(blocks: Block[], id: string): Block[] {
	const gone = new Set([id, ...descendantsOf(blocks, id).map((b) => b.id)]);
	return blocks.filter((b) => !gone.has(b.id));
}

function showError(title: string, e: unknown) {
	if (e instanceof AccessDeniedError) return; // handled by component layer
	toaster.create({ type: "error", title, description: String(e) });
}

export interface BlockState {
	blocks: Block[];

	loadBlocks: (pageId: string) => Promise<void>;
	setLocalContent: (id: string, content: string, type?: string) => void;
	createBlock: (req: Parameters<typeof api.createBlock>[0]) => Promise<Block>;
	updateBlock: (id: string, content: string, type?: string) => Promise<void>;
	deleteBlock: (id: string) => Promise<void>;
	duplicateBlock: (id: string) => Promise<Block | null>;
	reorderBlocks: (pageId: string, blockIds: string[]) => Promise<void>;
	/** Move a block and its subtree next to `targetId`, adopting the target's parent. */
	moveBlock: (
		id: string,
		targetId: string,
		position: "before" | "after",
	) => Promise<void>;
	/** Move up/down among siblings; no-op at the edge. */
	stepBlock: (id: string, direction: "up" | "down") => Promise<void>;
	/** Tab ("in") / Shift-Tab ("out"): nest under the previous sibling, or lift out. */
	reparentBlock: (id: string, direction: "in" | "out") => Promise<void>;
}

export const useBlockStore = create<BlockState>((set, get) => ({
	blocks: [],

	loadBlocks: async (pageId) => {
		try {
			const blocks = await api.listBlocks({ pageId });
			set({ blocks });
		} catch (e) {
			showError("Failed to load blocks", e);
		}
	},

	/**
	 * Insert a block, locally first.
	 *
	 * This used to await the POST, then await a full `listBlocks` refetch, and
	 * only then hand the caller a block to focus. On anything but a local server
	 * that is a visible gap after Enter in which the caret is still in the old
	 * block — so the first characters of the new line were typed into the
	 * previous one. The id is chosen here and sent along, so the block can be
	 * rendered and focused on the keystroke and the write reconciled after.
	 *
	 * The refetch went with it. It replaced every block in the store with the
	 * server's copy, including blocks whose debounced save was still in flight.
	 * The shift it existed to pick up is the same one the server applies, and
	 * it is one line to do here.
	 */
	/**
	 * Record what an editor holds right now, without touching the network.
	 *
	 * The store used to be written only by the debounced save, so for up to
	 * 200ms it disagreed with what was on screen — and every structural
	 * operation reads the store. Press Backspace to merge two blocks a beat
	 * after typing and the merge used the text from before the last few
	 * keystrokes: the tail of the line was silently dropped. The keystroke
	 * updates the store; only the request is debounced.
	 */
	setLocalContent: (id, content, type) => {
		set((s) => ({
			blocks: s.blocks.map((b) =>
				b.id === id
					? ({
							...b,
							content,
							...(type !== undefined ? { type } : {}),
						} as Block)
					: b,
			),
		}));
	},

	createBlock: async (req) => {
		const id = req.id ?? ulid();
		const optimistic: Block = {
			id,
			pageId: req.pageId,
			type: req.type,
			content: req.content,
			index: req.index,
			parentId: req.parentId ?? null,
		} as Block;
		const before = get().blocks;
		set({
			blocks: [
				// Same shift the server performs: everything at or after the new
				// index moves down one.
				...before.map((b) =>
					b.pageId === req.pageId && b.index >= req.index
						? ({ ...b, index: b.index + 1 } as Block)
						: b,
				),
				optimistic,
			],
		});
		const posted = api.createBlock({ ...req, id });
		inFlightCreates.set(id, posted);
		try {
			// The reply carries nothing the store does not already hold — same id,
			// same content, same index — and writing it back would undo whatever
			// was typed into the block while the request was in flight. Awaited
			// only so a failure can roll back.
			await posted;
			// Recorded once the write is real: a rolled-back create left behind an
			// undo entry for a block that no longer exists.
			useHistoryStore.getState().record({ kind: "create", block: optimistic });
			return optimistic;
		} catch (e) {
			// Undo just this insert, rather than restoring the snapshot wholesale:
			// anything typed into another block while the request was in flight is
			// in the store by now, and a snapshot rollback would take it with it.
			set((s) => ({
				blocks: s.blocks
					.filter((b) => b.id !== id)
					.map((b) =>
						b.pageId === req.pageId && b.index > req.index
							? ({ ...b, index: b.index - 1 } as Block)
							: b,
					),
			}));
			showError("Failed to create block", e);
			throw e;
		} finally {
			inFlightCreates.delete(id);
		}
	},

	/**
	 * Write a block's content, locally first.
	 *
	 * The store used to lag the editor by a round-trip, and a split is what made
	 * that visible: the editor truncates itself to the first half, focus moves to
	 * the new block, and the now-unfocused block re-syncs from a store that still
	 * holds the whole pre-split line — putting the text back in both halves.
	 */
	updateBlock: async (id, content, type?) => {
		const before = get().blocks;
		set({
			blocks: before.map((b) =>
				b.id === id
					? ({
							...b,
							content,
							...(type !== undefined ? { type } : {}),
						} as Block)
					: b,
			),
		});
		try {
			await afterCreate(id);
			// Same as createBlock: the reply is the row we just sent, and adopting
			// it would undo any keystroke that landed while it was in flight.
			await api.updateBlock({
				id,
				content,
				...(type !== undefined ? { type } : {}),
			});
		} catch (e) {
			// Roll back only if the block still holds exactly what we failed to
			// send. A refused write (a peer holds the block) should put the old
			// text back; a write the user has already typed past should not have
			// their newer text yanked out from under them.
			set((s) => ({
				blocks: s.blocks.map((b) =>
					b.id === id && b.content === content
						? (before.find((o) => o.id === id) ?? b)
						: b,
				),
			}));
			showError("Failed to update block", e);
		}
	},

	deleteBlock: async (id) => {
		const before = get().blocks;
		const prev = before.find((b) => b.id === id);
		if (!prev) return;
		// Optimistic for the same reason as createBlock: Backspace merges two
		// blocks, and the block that is going away must stop rendering now, not
		// a round-trip later.
		const remaining = withoutSubtree(before, id);
		set({ blocks: remaining });
		try {
			await afterCreate(id);
			await api.deleteBlock({ id });
			useHistoryStore.getState().record({
				kind: "delete",
				block: prev,
				descendants: descendantsOf(before, id),
			});
		} catch (e) {
			// Put back just what left with it, for the same reason as
			// createBlock's rollback: the rest of the page may have moved on.
			const removed = before.filter((b) => !remaining.includes(b));
			set((s) => ({
				blocks: s.blocks.some((b) => b.id === id)
					? s.blocks
					: [...s.blocks, ...removed],
			}));
			showError("Failed to delete block", e);
		}
	},

	duplicateBlock: async (id) => {
		try {
			const orig = get().blocks.find((b) => b.id === id);
			if (!orig) return null;
			// Through createBlock so the copy lands optimistically and the shift
			// is applied the one way. After the original's subtree, so the
			// children stay directly under the original.
			const subtree = descendantsOf(get().blocks, id);
			return await get().createBlock({
				pageId: orig.pageId,
				type: orig.type,
				content: orig.content,
				index: (subtree.at(-1) ?? orig).index + 1,
				parentId: orig.parentId,
			});
		} catch (e) {
			showError("Failed to duplicate block", e);
			return null;
		}
	},

	reorderBlocks: async (pageId, blockIds) => {
		try {
			const prevIds = [...get().blocks]
				.sort((a, b) => a.index - b.index)
				.map((b) => b.id);
			const blocks = await api.reorderBlocks({ pageId, blockIds });
			set({ blocks });
			useHistoryStore
				.getState()
				.record({ kind: "reorder", pageId, ids: prevIds });
		} catch (e) {
			showError("Failed to reorder blocks", e);
		}
	},

	moveBlock: async (id, targetId, position) => {
		try {
			const prevIds = [...get().blocks]
				.sort((a, b) => a.index - b.index)
				.map((b) => b.id);
			const moving = get().blocks.find((b) => b.id === id);
			const blocks = await api.moveBlock({ id, targetId, position });
			set({ blocks });
			// Undo restores the order only, so a move that changed the parent
			// is not recorded: undoing it would leave the block mis-parented.
			const pageId = moving?.pageId;
			if (
				pageId &&
				blocks.find((b) => b.id === id)?.parentId === (moving?.parentId ?? null)
			)
				useHistoryStore
					.getState()
					.record({ kind: "reorder", pageId, ids: prevIds });
		} catch (e) {
			showError("Failed to move block", e);
		}
	},

	stepBlock: async (id, direction) => {
		const t = stepTarget(get().blocks, id, direction);
		if (t) await get().moveBlock(id, t.targetId, t.position);
	},

	reparentBlock: async (id, direction) => {
		// Applied locally first: Enter right after Tab must already see the new
		// parent, or the block it creates lands at the old level.
		const applyParents = (byId: Map<string, string | null>) =>
			set((s) => ({
				blocks: s.blocks.map((b) =>
					byId.has(b.id)
						? ({ ...b, parentId: byId.get(b.id) ?? null } as Block)
						: b,
				),
			}));
		const before = new Map(
			get().blocks.map((b) => [b.id, b.parentId] as const),
		);
		applyParents(reparentChanges(get().blocks, id, direction));
		try {
			await afterCreate(id);
			const parents = await api.reparentBlock({ id, direction });
			// Only parentId is taken from the reply: it carries the saved content,
			// which may be a keystroke behind what is on screen.
			applyParents(new Map(parents.map((b) => [b.id, b.parentId] as const)));
		} catch (e) {
			applyParents(before);
			showError("Failed to move block", e);
		}
	},
}));
