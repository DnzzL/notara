import { create } from "zustand";
import { api } from "../rpc-client.js";
import type { Database, DatabaseField, DatabaseRecord, DatabaseView } from "@notara/shared";
import type { Filter, Sort } from "../lib/filterEngine.js";

type RecordWithValues = { record: DatabaseRecord; values: Record<string, unknown> };

// Stable empty references so selecting an unloaded database's slice doesn't
// hand callers a fresh array/null on every render (avoids useMemo churn).
const EMPTY_RECORDS: RecordWithValues[] = [];
const EMPTY_FIELDS: DatabaseField[] = [];
const EMPTY_FILTERS: Filter[] = [];
const EMPTY_SORTS: Sort[] = [];
const EMPTY_HIDDEN: string[] = [];
const EMPTY_VIEWS: DatabaseView[] = [];

export interface DatabaseState {
  databases: Database[];
  currentDb: Database | null;
  dbViews: DatabaseView[];
  /** Per-database views map (databaseId -> views) so sibling instances don't clash. */
  dbViewsByDb: Record<string, DatabaseView[]>;

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
  /** The active saved view id (null = 'All' default) */
  activeViewIdByDb: Record<string, string | null>;

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
  createView: (databaseId: string, name: string, type: "table" | "board" | "calendar", groupByFieldId: string | null, config?: string) => Promise<DatabaseView>;
  updateView: (id: string, updates: { name?: string; type?: "table" | "board" | "calendar"; groupByFieldId?: string | null; config?: string }) => Promise<void>;
  deleteView: (databaseId: string, viewId: string) => Promise<void>;
  switchView: (databaseId: string, view: DatabaseView | null) => void;

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
  hydrateView: (databaseId: string, view: { filters: Filter[]; sorts: Sort[]; groupBy: string | null; boardHidden: string[] }) => void;
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  databases: [],
  currentDb: null,
  dbViews: [],
  dbViewsByDb: {},
  fieldsByDb: {},
  recordsByDb: {},
  filtersByDb: {},
  sortsByDb: {},
  boardGroupByDb: {},
  boardHiddenByDb: {},
  activeViewIdByDb: {},

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
    set((s) => ({
      dbViewsByDb: { ...s.dbViewsByDb, [databaseId]: views },
      dbViews: views,
    }));
  },

  createView: async (databaseId, name, type, groupByFieldId, config) => {
    const view = await api.createView({ databaseId, name, type, groupByFieldId, config: config ?? undefined });
    set((s) => ({
      dbViewsByDb: { ...s.dbViewsByDb, [databaseId]: [...(s.dbViewsByDb[databaseId] || []), view] },
      dbViews: [...s.dbViews, view],
    }));
    return view;
  },

  updateView: async (id, updates) => {
    const view = await api.updateView({ id, ...updates });
    set((s) => {
      // Find which database this view belongs to
      let dbId = "";
      for (const [db, views] of Object.entries(s.dbViewsByDb)) {
        if (views.some((v) => v.id === id)) { dbId = db; break; }
      }
      if (!dbId) return {};
      return {
        dbViewsByDb: {
          ...s.dbViewsByDb,
          [dbId]: (s.dbViewsByDb[dbId] || []).map((v) => (v.id === id ? view : v)),
        },
        dbViews: s.dbViews.map((v) => (v.id === id ? view : v)),
      };
    });
  },

  deleteView: async (databaseId, viewId) => {
    await api.deleteView({ id: viewId });
    set((s) => ({
      dbViewsByDb: {
        ...s.dbViewsByDb,
        [databaseId]: (s.dbViewsByDb[databaseId] || []).filter((v) => v.id !== viewId),
      },
      dbViews: s.dbViews.filter((v) => v.id !== viewId),
      activeViewIdByDb: s.activeViewIdByDb[databaseId] === viewId
        ? { ...s.activeViewIdByDb, [databaseId]: null }
        : s.activeViewIdByDb,
    }));
  },

  switchView: (databaseId, view) => {
    if (!view) {
      // Reset to 'All' — clear filters/sorts/group-by/boardHidden
      set((s) => ({
        filtersByDb: { ...s.filtersByDb, [databaseId]: [] },
        sortsByDb: { ...s.sortsByDb, [databaseId]: [] },
        boardGroupByDb: { ...s.boardGroupByDb, [databaseId]: null },
        boardHiddenByDb: { ...s.boardHiddenByDb, [databaseId]: [] },
        activeViewIdByDb: { ...s.activeViewIdByDb, [databaseId]: null },
      }));
      return;
    }
    // Apply the saved view's configuration
    const config = parseViewConfig(view.config);
    set((s) => ({
      filtersByDb: { ...s.filtersByDb, [databaseId]: config.filters },
      sortsByDb: { ...s.sortsByDb, [databaseId]: config.sorts },
      boardGroupByDb: { ...s.boardGroupByDb, [databaseId]: view.groupByFieldId },
      boardHiddenByDb: { ...s.boardHiddenByDb, [databaseId]: config.boardHidden },
      activeViewIdByDb: { ...s.activeViewIdByDb, [databaseId]: view.id },
    }));
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
  hydrateView: (databaseId, view) => set((s) => ({
    filtersByDb: { ...s.filtersByDb, [databaseId]: view.filters },
    sortsByDb: { ...s.sortsByDb, [databaseId]: view.sorts },
    boardGroupByDb: { ...s.boardGroupByDb, [databaseId]: view.groupBy },
    boardHiddenByDb: { ...s.boardHiddenByDb, [databaseId]: view.boardHidden },
  })),
}));

// Per-database selector helpers — return stable empty refs when unloaded.
export const selectFields = (s: DatabaseState, dbId: string) => s.fieldsByDb[dbId] || EMPTY_FIELDS;
export const selectRecords = (s: DatabaseState, dbId: string) => s.recordsByDb[dbId] || EMPTY_RECORDS;
export const selectFilters = (s: DatabaseState, dbId: string) => s.filtersByDb[dbId] || EMPTY_FILTERS;
export const selectSorts = (s: DatabaseState, dbId: string) => s.sortsByDb[dbId] || EMPTY_SORTS;
export const selectBoardGroupBy = (s: DatabaseState, dbId: string) => s.boardGroupByDb[dbId] ?? null;
export const selectBoardHidden = (s: DatabaseState, dbId: string) => s.boardHiddenByDb[dbId] || EMPTY_HIDDEN;
export const selectDbViews = (s: DatabaseState, dbId: string) => s.dbViewsByDb[dbId] || EMPTY_VIEWS;
export const selectActiveViewId = (s: DatabaseState, dbId: string) => s.activeViewIdByDb[dbId] ?? null;

/** Parse view config JSON safely. */
export function parseViewConfig(config: string): { filters: Filter[]; sorts: Sort[]; boardHidden: string[] } {
  try {
    const parsed = JSON.parse(config);
    return {
      filters: Array.isArray(parsed.filters) ? parsed.filters : [],
      sorts: Array.isArray(parsed.sorts) ? parsed.sorts : [],
      boardHidden: Array.isArray(parsed.boardHidden) ? parsed.boardHidden : [],
    };
  } catch {
    return { filters: [], sorts: [], boardHidden: [] };
  }
}

/** Serialize current view state to JSON string. */
export function serializeViewConfig(filters: Filter[], sorts: Sort[], boardHidden: string[]): string {
  return JSON.stringify({ filters, sorts, boardHidden });
}
