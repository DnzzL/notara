import type { Block } from "@notara/shared";
import { create } from "zustand";
import { guarded } from "../lib/storeErrors.js";
import { api } from "../rpc-client.js";
import { descendantsOf, useBlockStore } from "./blockStore.js";

export type HistoryOp =
	| { kind: "create"; block: Block }
	| { kind: "delete"; block: Block; descendants?: Block[] }
	| { kind: "reorder"; pageId: string; ids: string[] };

const MAX = 100;

export interface HistoryState {
	pageId: string | null;
	past: HistoryOp[];
	future: HistoryOp[];
	applying: boolean;
	record: (op: HistoryOp) => void;
	resetFor: (pageId: string | null) => void;
	undo: () => Promise<void>;
	redo: () => Promise<void>;
}

async function apply(op: HistoryOp): Promise<HistoryOp | null> {
	const bs = useBlockStore.getState();
	if (op.kind === "create") {
		// Inverse of a previous create: delete the block. Return inverse (re-create) for redo.
		const existing = bs.blocks.find((b) => b.id === op.block.id);
		const descendants = descendantsOf(bs.blocks, op.block.id);
		await bs.deleteBlock(op.block.id);
		return { kind: "delete", block: existing ?? op.block, descendants };
	}
	if (op.kind === "delete") {
		// Re-create the block. Server assigns a fresh ULID, so the redo "create" carries the new block.
		// Both calls rethrow on failure: applyInverse's caller pops the undo stack
		// only when the inverse succeeded. Swallowing here would lose the entry
		// and leave the block deleted with no way back.
		const recreated = await guarded("Failed to undo delete", () =>
			api.createBlock({
				pageId: op.block.pageId,
				type: op.block.type,
				content: op.block.content,
				index: op.block.index,
				parentId: op.block.parentId,
			}),
		);
		// Its subtree comes back too (the delete cascaded to it), parents first so
		// each child finds its new parent id. In page order, at their old index.
		// Placed right after the recreated parent rather than at their old index,
		// which may have gaps or have been taken since. A failure part-way leaves
		// the subtree partly restored.
		const newId = new Map([[op.block.id, recreated.id]]);
		for (const [i, d] of (op.descendants ?? []).entries()) {
			const child = await guarded("Failed to undo delete", () =>
				api.createBlock({
					pageId: d.pageId,
					type: d.type,
					content: d.content,
					index: recreated.index + 1 + i,
					parentId: (d.parentId && newId.get(d.parentId)) || d.parentId,
				}),
			);
			newId.set(d.id, child.id);
		}
		// Refresh blocks since server shifted indices.
		const fresh = await guarded("Failed to refresh blocks", () =>
			api.listBlocks({ pageId: op.block.pageId }),
		);
		useBlockStore.setState({ blocks: fresh });
		return { kind: "create", block: recreated };
	}
	if (op.kind === "reorder") {
		const prevIds = [...bs.blocks]
			.sort((a, b) => a.index - b.index)
			.map((b) => b.id);
		await bs.reorderBlocks(op.pageId, op.ids);
		return { kind: "reorder", pageId: op.pageId, ids: prevIds };
	}
	return null;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
	pageId: null,
	past: [],
	future: [],
	applying: false,

	record: (op) => {
		if (get().applying) return;
		set((s) => ({
			past: [...s.past.slice(-(MAX - 1)), op],
			future: [],
		}));
	},

	resetFor: (pageId) => {
		set({ pageId, past: [], future: [] });
	},

	undo: async () => {
		const { past, applying } = get();
		if (applying || past.length === 0) return;
		const op = past[past.length - 1];
		set({ applying: true });
		try {
			const inverse = await apply(op);
			set((s) => ({
				past: s.past.slice(0, -1),
				future: inverse ? [...s.future, inverse] : s.future,
			}));
		} catch (e) {
			console.error("[history] undo failed:", e);
		} finally {
			set({ applying: false });
		}
	},

	redo: async () => {
		const { future, applying } = get();
		if (applying || future.length === 0) return;
		const op = future[future.length - 1];
		set({ applying: true });
		try {
			const inverse = await apply(op);
			set((s) => ({
				future: s.future.slice(0, -1),
				past: inverse ? [...s.past, inverse] : s.past,
			}));
		} catch (e) {
			console.error("[history] redo failed:", e);
		} finally {
			set({ applying: false });
		}
	},
}));
