import type { Block } from "@notara/shared";
import { create } from "zustand";
import { AccessDeniedError, api } from "../rpc-client.js";
import { toaster } from "../toaster.js";
import { useHistoryStore } from "./historyStore.js";

function showError(title: string, e: unknown) {
	if (e instanceof AccessDeniedError) return; // handled by component layer
	toaster.create({ type: "error", title, description: String(e) });
}

export interface BlockState {
	blocks: Block[];

	loadBlocks: (pageId: string) => Promise<void>;
	createBlock: (req: Parameters<typeof api.createBlock>[0]) => Promise<Block>;
	updateBlock: (id: string, content: string, type?: string) => Promise<void>;
	deleteBlock: (id: string) => Promise<void>;
	duplicateBlock: (id: string) => Promise<Block | null>;
	reorderBlocks: (pageId: string, blockIds: string[]) => Promise<void>;
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

	createBlock: async (req) => {
		try {
			const block = await api.createBlock(req);
			const fresh = await api.listBlocks({ pageId: req.pageId });
			set({ blocks: fresh });
			useHistoryStore.getState().record({ kind: "create", block });
			return block;
		} catch (e) {
			showError("Failed to create block", e);
			throw e;
		}
	},

	updateBlock: async (id, content, type?) => {
		try {
			const block = await api.updateBlock({
				id,
				content,
				...(type !== undefined ? { type } : {}),
			});
			set((s) => ({
				blocks: s.blocks.map((b) => (b.id === id ? block : b)),
			}));
		} catch (e) {
			showError("Failed to update block", e);
		}
	},

	deleteBlock: async (id) => {
		try {
			const prev = get().blocks.find((b) => b.id === id);
			await api.deleteBlock({ id });
			set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }));
			if (prev) {
				useHistoryStore.getState().record({ kind: "delete", block: prev });
			}
		} catch (e) {
			showError("Failed to delete block", e);
		}
	},

	duplicateBlock: async (id) => {
		try {
			const orig = get().blocks.find((b) => b.id === id);
			if (!orig) return null;
			const copy = await api.createBlock({
				pageId: orig.pageId,
				type: orig.type,
				content: orig.content,
				index: orig.index + 1,
				parentId: orig.parentId,
			});
			const fresh = await api.listBlocks({ pageId: orig.pageId });
			set({ blocks: fresh });
			useHistoryStore.getState().record({ kind: "create", block: copy });
			return copy;
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
}));
