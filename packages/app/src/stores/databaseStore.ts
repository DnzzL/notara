import { create } from "zustand";
import { api } from "../rpc-client.js";
import type { Database, DatabaseField, DatabaseRecord, DatabaseView } from "@notion-alt/shared";

export interface DatabaseState {
  databases: Database[];
  currentDb: Database | null;
  dbFields: DatabaseField[];
  records: Array<{ record: DatabaseRecord; values: Record<string, unknown> }>;
  dbViews: DatabaseView[];

  // View state
  activeFilters: Array<{ fieldId: string; operator: string; value: string }>;
  activeSorts: Array<{ fieldId: string; direction: "asc" | "desc" }>;
  boardGroupByFieldId: string | null;

  loadDatabases: (pageId: string) => Promise<void>;
  createDatabase: (pageId: string, name: string) => Promise<any>;
  renameDatabase: (id: string, name: string) => Promise<void>;
  reorderDatabases: (pageId: string, databaseIds: string[]) => Promise<void>;

  loadDbFields: (databaseId: string) => Promise<void>;
  createField: (req: Parameters<typeof api.createField>[0]) => Promise<void>;
  updateField: (id: string, updates: { name?: string; options?: string[] | null; relationTargetDbId?: string | null }) => Promise<void>;
  deleteField: (id: string) => Promise<void>;

  loadDbRecords: (databaseId: string) => Promise<void>;
  createDbRecord: (databaseId: string, title: string) => Promise<void>;
  updateFieldValue: (recordId: string, fieldId: string, value: string) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  reorderRecords: (databaseId: string, recordIds: string[]) => Promise<void>;

  loadDbViews: (databaseId: string) => Promise<void>;

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

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  databases: [],
  currentDb: null,
  dbFields: [],
  records: [],
  dbViews: [],
  activeFilters: [],
  activeSorts: [],
  boardGroupByFieldId: null,

  loadDatabases: async (pageId) => {
    const databases = await api.listDatabases(pageId);
    set({ databases });
  },

  createDatabase: async (pageId, name) => {
    const db = await api.createDatabase(pageId, name);
    set((s) => ({ databases: [...s.databases, db] }));
    return db;
  },

  renameDatabase: async (id, name) => {
    await api.renameDatabase(id, name);
    set((s) => ({
      databases: s.databases.map((d) => (d.id === id ? { ...d, name } : d)),
      currentDb: s.currentDb?.id === id ? { ...s.currentDb, name } : s.currentDb,
    }));
  },

  reorderDatabases: async (pageId, databaseIds) => {
    await api.reorderDatabases(pageId, databaseIds);
    if (get().currentDb) {
      // Reload databases to get updated sort order — we need pageId from somewhere.
      // For now, rely on the caller to ensure currentDb is valid.
    }
  },

  loadDbFields: async (databaseId) => {
    const fields = await api.listFields(databaseId);
    set({ dbFields: fields });
  },

  createField: async (req) => {
    const field = await api.createField(req);
    set((s) => ({ dbFields: [...s.dbFields, field] }));
  },

  updateField: async (id, updates) => {
    await api.updateField(id, updates);
    const db = get().currentDb;
    if (db) await get().loadDbFields(db.id);
  },

  deleteField: async (id) => {
    await api.deleteField(id);
    set((s) => ({ dbFields: s.dbFields.filter((f) => f.id !== id) }));
  },

  loadDbRecords: async (databaseId) => {
    const recordsWithValues = await api.listRecordsWithValues(databaseId);
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

  deleteRecord: async (id) => {
    await api.deleteRecord(id);
    set((s) => ({ records: s.records.filter((r) => r.record.id !== id) }));
  },

  reorderRecords: async (databaseId, recordIds) => {
    await api.reorderRecords(databaseId, recordIds);
    const db = get().currentDb;
    if (db) await get().loadDbRecords(db.id);
  },

  loadDbViews: async (databaseId) => {
    const views = await api.listViews(databaseId);
    set({ dbViews: views });
  },

  // View state mutators
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
