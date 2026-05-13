import { create } from "zustand";
import { api } from "./rpc-client.js";

interface AppState {
  pages: any[];
  currentPage: any | null;
  loading: boolean;
  blocks: any[];
  databases: any[];
  currentDb: any | null;
  dbFields: any[];
  records: any[];
  dbViews: any[];

  loadPages: () => Promise<void>;
  selectPage: (page: any) => Promise<void>;
  selectPageById: (id: string) => Promise<void>;
  createPage: (title: string, parentId?: string | null) => Promise<void>;
  updatePage: (id: string, title: string) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  searchPages: (query: string) => Promise<void>;

  loadBlocks: (pageId: string) => Promise<void>;
  createBlock: (req: any) => Promise<void>;
  updateBlock: (id: string, content: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  reorderBlocks: (pageId: string, blockIds: string[]) => Promise<void>;

  loadDatabases: (pageId: string) => Promise<void>;
  createDatabase: (pageId: string, name: string) => Promise<any>;
  loadDbFields: (databaseId: string) => Promise<void>;
  loadDbRecords: (databaseId: string) => Promise<void>;
  createDbRecord: (databaseId: string, title: string) => Promise<void>;
  updateFieldValue: (recordId: string, fieldId: string, value: string) => Promise<void>;
  loadDbViews: (databaseId: string) => Promise<void>;
  createField: (req: any) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  pages: [],
  currentPage: null,
  loading: false,
  blocks: [],
  databases: [],
  currentDb: null,
  dbFields: [],
  records: [],
  dbViews: [],

  loadPages: async () => {
    set({ loading: true });
    try {
      const pages = await api.listPages();
      set({ pages, loading: false });
    } catch (e) {
      console.error("Failed to load pages:", e);
      set({ loading: false });
    }
  },

  selectPage: async (page) => {
    set({ currentPage: page });
    await get().loadBlocks(page.id);
    await get().loadDatabases(page.id);
    // Update URL without triggering navigation
    const url = new URL(window.location.href);
    url.searchParams.set('page', page.id);
    window.history.replaceState({}, '', url);
  },

  selectPageById: async (id) => {
    const page = get().pages.find((p) => p.id === id);
    if (page) {
      await get().selectPage(page);
    } else {
      // Page not in list, try to fetch it
      try {
        const fetchedPage = await api.getPage(id);
        if (fetchedPage) {
          set({ currentPage: fetchedPage });
          await get().loadBlocks(id);
          await get().loadDatabases(id);
        }
      } catch (e) {
        console.error('Failed to load page:', e);
      }
    }
  },

  createPage: async (title, parentId = null) => {
    const page = await api.createPage(title, parentId);
    set((s) => ({ pages: [page, ...s.pages] }));
    await get().selectPage(page);
  },

  updatePage: async (id, title) => {
    const page = await api.updatePage(id, title);
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? page : p)),
      currentPage: s.currentPage?.id === id ? page : s.currentPage,
    }));
  },

  deletePage: async (id) => {
    await api.deletePage(id);
    set((s) => ({
      pages: s.pages.filter((p) => p.id !== id),
      currentPage: s.currentPage?.id === id ? null : s.currentPage,
    }));
  },

  searchPages: async (query) => {
    const pages = await api.searchPages(query);
    set({ pages });
  },

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

  loadDatabases: async (pageId) => {
    const databases = await api.listDatabases(pageId);
    set({ databases });
  },

  createDatabase: async (pageId, name) => {
    const db = await api.createDatabase(pageId, name);
    set((s) => ({ databases: [...s.databases, db] }));
    return db;
  },

  loadDbFields: async (databaseId) => {
    const fields = await api.listFields(databaseId);
    set({ dbFields: fields });
  },

  loadDbRecords: async (databaseId) => {
    const records = await api.listRecords(databaseId);
    const recordsWithValues = await Promise.all(
      records.map(async (r: any) => {
        return await api.getRecordWithValues(r.id);
      })
    );
    set({ records: recordsWithValues });
  },

  createDbRecord: async (databaseId, title) => {
    const record = await api.createRecord(databaseId, title);
    set((s) => ({
      records: [...s.records, { record, values: {} }],
    }));
  },

  updateFieldValue: async (recordId, fieldId, value) => {
    await api.updateFieldValue(recordId, fieldId, value);
    const db = get().currentDb;
    if (db) await get().loadDbRecords(db.id);
  },

  loadDbViews: async (databaseId) => {
    const views = await api.listViews(databaseId);
    set({ dbViews: views });
  },

  createField: async (req) => {
    const field = await api.createField(req);
    set((s) => ({ dbFields: [...s.dbFields, field] }));
  },
}));
