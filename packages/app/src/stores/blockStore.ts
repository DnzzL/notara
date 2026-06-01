import { create } from "zustand";
import { api } from "../rpc-client.js";
import type { Block } from "@notion-alt/shared";
import { useHistoryStore } from "./historyStore.js";

export interface BlockState {
  blocks: Block[];

  loadBlocks: (pageId: string) => Promise<void>;
  createBlock: (req: Parameters<typeof api.createBlock>[0]) => Promise<Block>;
  updateBlock: (id: string, content: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  duplicateBlock: (id: string) => Promise<Block | null>;
  reorderBlocks: (pageId: string, blockIds: string[]) => Promise<void>;
}

export const useBlockStore = create<BlockState>((set, get) => ({
  blocks: [],

  loadBlocks: async (pageId) => {
    const blocks = await api.listBlocks({ pageId });
    set({ blocks });
  },

  createBlock: async (req) => {
    const block = await api.createBlock(req);
    // Server shifts later indices on insert, so refetch keeps client in sync.
    const fresh = await api.listBlocks({ pageId: req.pageId });
    set({ blocks: fresh });
    useHistoryStore.getState().record({ kind: "create", block });
    return block;
  },

  updateBlock: async (id, content) => {
    // Intentionally not recorded: TipTap handles intra-block text history.
    const block = await api.updateBlock({ id, content });
    set((s) => ({ blocks: s.blocks.map((b) => (b.id === id ? block : b)) }));
  },

  deleteBlock: async (id) => {
    const prev = get().blocks.find((b) => b.id === id);
    await api.deleteBlock({ id });
    set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }));
    if (prev) useHistoryStore.getState().record({ kind: "delete", block: prev });
  },

  duplicateBlock: async (id) => {
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
  },

  reorderBlocks: async (pageId, blockIds) => {
    const prevIds = [...get().blocks].sort((a, b) => a.index - b.index).map((b) => b.id);
    const blocks = await api.reorderBlocks({ pageId, blockIds });
    set({ blocks });
    useHistoryStore.getState().record({ kind: "reorder", pageId, ids: prevIds });
  },
}));
