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
  movePage: (id: string, parentId: string | null) => Promise<void>;
  reorderPages: (parentId: string | null, pageIds: string[]) => Promise<void>;
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
  deleteField: (id: string) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  updateField: (id: string, updates: { name?: string; options?: string[] | null; relationTargetDbId?: string | null }) => Promise<void>;
  renameDatabase: (id: string, name: string) => Promise<void>;
  reorderRecords: (databaseId: string, recordIds: string[]) => Promise<void>;

  // View state
  activeFilters: Array<{ fieldId: string; operator: string; value: string }>;
  activeSorts: Array<{ fieldId: string; direction: "asc" | "desc" }>;
  boardGroupByFieldId: string | null;
  setBoardGroupBy: (fieldId: string | null) => void;
  addFilter: (filter: { fieldId: string; operator: string; value: string }) => void;
  setFilter: (index: number, filter: { fieldId: string; operator: string; value: string }) => void;
  removeFilter: (index: number) => void;
  addSort: (sort: { fieldId: string; direction: "asc" | "desc" }) => void;
  setSort: (index: number, sort: { fieldId: string; direction: "asc" | "desc" }) => void;
  removeSort: (index: number) => void;
  clearFilters: () => void;
  clearSorts: () => void;
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

  movePage: async (id, parentId) => {
    const page = await api.movePage(id, parentId);
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? page : p)),
      currentPage: s.currentPage?.id === id ? page : s.currentPage,
    }));
  },

  reorderPages: async (parentId, pageIds) => {
    await api.reorderPages(parentId, pageIds);
    await get().loadPages();
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

  deleteField: async (id) => {
    await api.deleteField(id);
    set((s) => ({ dbFields: s.dbFields.filter((f) => f.id !== id) }));
  },

  deleteRecord: async (id) => {
    await api.deleteRecord(id);
    set((s) => ({ records: s.records.filter((r) => r.record.id !== id) }));
  },

  updateField: async (id, updates) => {
    await api.updateField(id, updates);
    const db = get().currentDb;
    if (db) await get().loadDbFields(db.id);
  },

  renameDatabase: async (id, name) => {
    await api.renameDatabase(id, name);
    set((s) => ({
      databases: s.databases.map((d) => (d.id === id ? { ...d, name } : d)),
      currentDb: s.currentDb?.id === id ? { ...s.currentDb, name } : s.currentDb,
    }));
  },

  reorderRecords: async (databaseId, recordIds) => {
    await api.reorderRecords(databaseId, recordIds);
    const db = get().currentDb;
    if (db) await get().loadDbRecords(db.id);
  },

  // View state defaults
  activeFilters: [],
  activeSorts: [],
  boardGroupByFieldId: null,
  setBoardGroupBy: (fieldId) => set({ boardGroupByFieldId: fieldId }),
  addFilter: (filter) => set((s) => ({ activeFilters: [...s.activeFilters, filter] })),
  setFilter: (index, filter) => set((s) => {
    const newFilters = [...s.activeFilters];
    newFilters[index] = filter;
    return { activeFilters: newFilters };
  }),
  removeFilter: (index) => set((s) => ({ activeFilters: s.activeFilters.filter((_, i) => i !== index) })),
  addSort: (sort) => set((s) => ({ activeSorts: [...s.activeSorts, sort] })),
  setSort: (index, sort) => set((s) => {
    const newSorts = [...s.activeSorts];
    newSorts[index] = sort;
    return { activeSorts: newSorts };
  }),
  removeSort: (index) => set((s) => ({ activeSorts: s.activeSorts.filter((_, i) => i !== index) })),
  clearFilters: () => set({ activeFilters: [] }),
  clearSorts: () => set({ activeSorts: [] }),
}));
