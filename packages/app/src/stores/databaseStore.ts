import { create } from "zustand";
import { api } from "../rpc-client.js";
import type { Database, DatabaseField, DatabaseRecord, DatabaseView } from "@notion-alt/shared";
import type { Filter, Sort } from "../lib/filterEngine.js";

type RecordWithValues = { record: DatabaseRecord; values: Record<string, unknown> };

// Stable empty references so selecting an unloaded database's slice doesn't
// hand callers a fresh array/null on every render (avoids useMemo churn).
const EMPTY_RECORDS: RecordWithValues[] = [];
const EMPTY_FIELDS: DatabaseField[] = [];
const EMPTY_FILTERS: Filter[] = [];
const EMPTY_SORTS: Sort[] = [];
const EMPTY_HIDDEN: string[] = [];

export interface DatabaseState {
  databases: Database[];
  currentDb: Database | null;
  dbViews: DatabaseView[];

  // Per-database state, keyed by databaseId. A page renders many DatabaseView
  // instances at once, so these MUST NOT be a single shared slot — otherwise
  // each view's load/refetch clobbers the others (cards jump to a "weird view"
  // showing another database's records until a full refresh).
  fieldsByDb: Record<string, DatabaseField[]>;
  recordsByDb: Record<string, RecordWithValues[]>;
  filtersByDb: Record<string, Filter[]>;
  sortsByDb: Record<string, Sort[]>;
  boardGroupByDb: Record<string, string | null>;
  boardHiddenByDb: Record<string, string[]>;

  loadDatabases: (pageId: string) => Promise<void>;
  createDatabase: (pageId: string, name: string) => Promise<any>;
  renameDatabase: (id: string, name: string) => Promise<void>;
  deleteDatabase: (id: string) => Promise<void>;
  reorderDatabases: (pageId: string, databaseIds: string[]) => Promise<void>;

  loadDbFields: (databaseId: string) => Promise<void>;
  createField: (req: Parameters<typeof api.createField>[0]) => Promise<void>;
  updateField: (id: string, updates: { name?: string; options?: string[] | null; relationTargetDbId?: string | null }) => Promise<void>;
  deleteField: (databaseId: string, id: string) => Promise<void>;

  loadDbRecords: (databaseId: string) => Promise<void>;
  createDbRecord: (databaseId: string, title: string) => Promise<DatabaseRecord>;
  updateFieldValue: (recordId: string, fieldId: string, value: string) => Promise<void>;
  deleteRecord: (databaseId: string, id: string) => Promise<void>;
  reorderRecords: (databaseId: string, recordIds: string[]) => Promise<void>;

  loadDbViews: (databaseId: string) => Promise<void>;

  setBoardGroupBy: (databaseId: string, fieldId: string | null) => void;
  toggleBoardField: (databaseId: string, fieldId: string) => void;
  addFilter: (databaseId: string, filter: Filter) => void;
  setFilter: (databaseId: string, index: number, filter: Filter) => void;
  removeFilter: (databaseId: string, index: number) => void;
  addSort: (databaseId: string, sort: Sort) => void;
  setSort: (databaseId: string, index: number, sort: Sort) => void;
  removeSort: (databaseId: string, index: number) => void;
  clearFilters: (databaseId: string) => void;
  clearSorts: (databaseId: string) => void;
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  databases: [],
  currentDb: null,
  dbViews: [],
  fieldsByDb: {},
  recordsByDb: {},
  filtersByDb: {},
  sortsByDb: {},
  boardGroupByDb: {},
  boardHiddenByDb: {},

  loadDatabases: async (pageId) => {
    const databases = await api.listDatabases({ pageId });
    set({ databases });
  },

  createDatabase: async (pageId, name) => {
    const db = await api.createDatabase({ pageId, name });
    set((s) => ({ databases: [...s.databases, db] }));
    return db;
  },

  renameDatabase: async (id, name) => {
    await api.renameDatabase({ id, name });
    set((s) => ({
      databases: s.databases.map((d) => (d.id === id ? { ...d, name } : d)),
      currentDb: s.currentDb?.id === id ? { ...s.currentDb, name } : s.currentDb,
    }));
  },

  deleteDatabase: async (id) => {
    await api.deleteDatabase({ id });
    set((s) => ({
      databases: s.databases.filter((d) => d.id !== id),
      currentDb: s.currentDb?.id === id ? null : s.currentDb,
    }));
  },

  reorderDatabases: async (pageId, databaseIds) => {
    await api.reorderDatabases({ pageId, databaseIds });
    if (get().currentDb) {
      // Reload databases to get updated sort order — we need pageId from somewhere.
      // For now, rely on the caller to ensure currentDb is valid.
    }
  },

  loadDbFields: async (databaseId) => {
    const fields = await api.listFields({ databaseId });
    set((s) => ({ fieldsByDb: { ...s.fieldsByDb, [databaseId]: fields } }));
  },

  createField: async (req) => {
    const field = await api.createField(req);
    set((s) => ({
      fieldsByDb: { ...s.fieldsByDb, [req.databaseId]: [...(s.fieldsByDb[req.databaseId] || []), field] },
    }));
  },

  updateField: async (id, updates) => {
    await api.updateField({ id, ...updates });
    // Callers refetch fields for the affected database explicitly.
  },

  deleteField: async (databaseId, id) => {
    await api.deleteField({ id });
    set((s) => ({
      fieldsByDb: { ...s.fieldsByDb, [databaseId]: (s.fieldsByDb[databaseId] || []).filter((f) => f.id !== id) },
    }));
  },

  loadDbRecords: async (databaseId) => {
    const recordsWithValues = await api.listRecordsWithValues({ databaseId });
    set((s) => ({ recordsByDb: { ...s.recordsByDb, [databaseId]: recordsWithValues } }));
  },

  createDbRecord: async (databaseId, title) => {
    const record = await api.createRecord({ databaseId, title });
    set((s) => ({
      recordsByDb: { ...s.recordsByDb, [databaseId]: [...(s.recordsByDb[databaseId] || []), { record, values: {} }] },
    }));
    return record;
  },

  updateFieldValue: async (recordId, fieldId, value) => {
    await api.updateFieldValue({ recordId, fieldId, value });
    // Callers refetch records for the affected database explicitly.
  },

  deleteRecord: async (databaseId, id) => {
    await api.deleteRecord({ id });
    set((s) => ({
      recordsByDb: { ...s.recordsByDb, [databaseId]: (s.recordsByDb[databaseId] || []).filter((r) => r.record.id !== id) },
    }));
  },

  reorderRecords: async (databaseId, recordIds) => {
    await api.reorderRecords({ databaseId, recordIds });
    await get().loadDbRecords(databaseId);
  },

  loadDbViews: async (databaseId) => {
    const views = await api.listViews({ databaseId });
    set({ dbViews: views });
  },

  // View state mutators — all scoped to a single databaseId.
  setBoardGroupBy: (databaseId, fieldId) => set((s) => ({
    boardGroupByDb: { ...s.boardGroupByDb, [databaseId]: fieldId },
  })),
  toggleBoardField: (databaseId, fieldId) => set((s) => {
    const cur = s.boardHiddenByDb[databaseId] || [];
    const next = cur.includes(fieldId) ? cur.filter((id) => id !== fieldId) : [...cur, fieldId];
    return { boardHiddenByDb: { ...s.boardHiddenByDb, [databaseId]: next } };
  }),
  addFilter: (databaseId, filter) => set((s) => ({
    filtersByDb: { ...s.filtersByDb, [databaseId]: [...(s.filtersByDb[databaseId] || []), filter] },
  })),
  setFilter: (databaseId, index, filter) => set((s) => {
    const next = [...(s.filtersByDb[databaseId] || [])];
    next[index] = filter;
    return { filtersByDb: { ...s.filtersByDb, [databaseId]: next } };
  }),
  removeFilter: (databaseId, index) => set((s) => ({
    filtersByDb: { ...s.filtersByDb, [databaseId]: (s.filtersByDb[databaseId] || []).filter((_, i) => i !== index) },
  })),
  addSort: (databaseId, sort) => set((s) => ({
    sortsByDb: { ...s.sortsByDb, [databaseId]: [...(s.sortsByDb[databaseId] || []), sort] },
  })),
  setSort: (databaseId, index, sort) => set((s) => {
    const next = [...(s.sortsByDb[databaseId] || [])];
    next[index] = sort;
    return { sortsByDb: { ...s.sortsByDb, [databaseId]: next } };
  }),
  removeSort: (databaseId, index) => set((s) => ({
    sortsByDb: { ...s.sortsByDb, [databaseId]: (s.sortsByDb[databaseId] || []).filter((_, i) => i !== index) },
  })),
  clearFilters: (databaseId) => set((s) => ({ filtersByDb: { ...s.filtersByDb, [databaseId]: [] } })),
  clearSorts: (databaseId) => set((s) => ({ sortsByDb: { ...s.sortsByDb, [databaseId]: [] } })),
}));

// Per-database selector helpers — return stable empty refs when unloaded.
export const selectFields = (s: DatabaseState, dbId: string) => s.fieldsByDb[dbId] || EMPTY_FIELDS;
export const selectRecords = (s: DatabaseState, dbId: string) => s.recordsByDb[dbId] || EMPTY_RECORDS;
export const selectFilters = (s: DatabaseState, dbId: string) => s.filtersByDb[dbId] || EMPTY_FILTERS;
export const selectSorts = (s: DatabaseState, dbId: string) => s.sortsByDb[dbId] || EMPTY_SORTS;
export const selectBoardGroupBy = (s: DatabaseState, dbId: string) => s.boardGroupByDb[dbId] ?? null;
export const selectBoardHidden = (s: DatabaseState, dbId: string) => s.boardHiddenByDb[dbId] || EMPTY_HIDDEN;
