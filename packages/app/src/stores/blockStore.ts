import { create } from "zustand";
import { api } from "../rpc-client.js";
import type { Block } from "@notion-alt/shared";

export interface BlockState {
  blocks: Block[];

  loadBlocks: (pageId: string) => Promise<void>;
  createBlock: (req: Parameters<typeof api.createBlock>[0]) => Promise<void>;
  updateBlock: (id: string, content: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  reorderBlocks: (pageId: string, blockIds: string[]) => Promise<void>;
}

export const useBlockStore = create<BlockState>((set) => ({
  blocks: [],

  loadBlocks: async (pageId) => {
    const blocks = await api.listBlocks(pageId);
    set({ blocks });
  },

  createBlock: async (req) => {
    const block = await api.createBlock(req);
    set((s) => ({ blocks: [...s.blocks, block] }));
  },

  updateBlock: async (id, content) => {
    const block = await api.updateBlock(id, content);
    set((s) => ({ blocks: s.blocks.map((b) => (b.id === id ? block : b)) }));
  },

  deleteBlock: async (id) => {
    await api.deleteBlock(id);
    set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }));
  },

  reorderBlocks: async (pageId, blockIds) => {
    const blocks = await api.reorderBlocks(pageId, blockIds);
    set({ blocks });
  },
}));
