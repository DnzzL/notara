/**
 * Composed store — merges Page, Block, and Database slices into a single
 * backwards-compatible hook. Each slice is independently testable; this
 * module is purely a composition layer.
 *
 * Cross-domain orchestration (page selection → block/database loading) is
 * handled by page-loader.ts, not by individual stores.
 */
import { usePageStore } from "./stores/pageStore.js";
import { useBlockStore } from "./stores/blockStore.js";
import { useDatabaseStore } from "./stores/databaseStore.js";
import { selectPageWithCascade, selectPageByIdWithCascade } from "./lib/page-loader.js";

/**
 * Backwards-compatible composed hook. Returns the merged state from all
 * three slices. selectPage and selectPageById cascade to load blocks/databases.
 */
export function useStore() {
  const pageState = usePageStore();
  const blockState = useBlockStore();
  const dbState = useDatabaseStore();

  return {
    // Page state
    pages: pageState.pages,
    currentPage: pageState.currentPage,
    loading: pageState.loading,
    accessDeniedFor: pageState.accessDeniedFor,
    loadPages: pageState.loadPages,
    selectPage: selectPageWithCascade,
    selectPageById: selectPageByIdWithCascade,
    createPage: pageState.createPage,
    updatePage: pageState.updatePage,
    setPageIcon: pageState.setPageIcon,
    toggleFavorite: pageState.toggleFavorite,
    deletePage: pageState.deletePage,
    movePage: pageState.movePage,
    reorderPages: pageState.reorderPages,
    searchResults: pageState.searchResults,
    globalSearch: pageState.globalSearch,

    // Block state
    blocks: blockState.blocks,
    loadBlocks: blockState.loadBlocks,
    createBlock: blockState.createBlock,
    updateBlock: blockState.updateBlock,
    deleteBlock: blockState.deleteBlock,
    duplicateBlock: blockState.duplicateBlock,
    reorderBlocks: blockState.reorderBlocks,

    // Database state
    // Per-database state (records/fields/filters/sorts/board) is keyed by
    // databaseId in useDatabaseStore — read it there via the selectFields/
    // selectRecords/… helpers, not from this flat composition layer.
    databases: dbState.databases,
    currentDb: dbState.currentDb,
    dbViews: dbState.dbViews,
    loadDatabases: dbState.loadDatabases,
    createDatabase: dbState.createDatabase,
    loadDbFields: dbState.loadDbFields,
    loadDbRecords: dbState.loadDbRecords,
    createDbRecord: dbState.createDbRecord,
    updateFieldValue: dbState.updateFieldValue,
    loadDbViews: dbState.loadDbViews,
    createField: dbState.createField,
    deleteField: dbState.deleteField,
    deleteRecord: dbState.deleteRecord,
    updateField: dbState.updateField,
    renameDatabase: dbState.renameDatabase,
    deleteDatabase: dbState.deleteDatabase,
    reorderRecords: dbState.reorderRecords,
    reorderDatabases: dbState.reorderDatabases,

    // Import/Export
    importNotion: pageState.importNotion,

    // View-state mutators (per-database; pass a databaseId). The current
    // values live in useDatabaseStore keyed by db — use selectFilters/
    // selectSorts/selectBoardGroupBy/selectBoardHidden to read them.
    setBoardGroupBy: dbState.setBoardGroupBy,
    toggleBoardField: dbState.toggleBoardField,
    addFilter: dbState.addFilter,
    setFilter: dbState.setFilter,
    removeFilter: dbState.removeFilter,
    addSort: dbState.addSort,
    setSort: dbState.setSort,
    removeSort: dbState.removeSort,
    clearFilters: dbState.clearFilters,
    clearSorts: dbState.clearSorts,
  };
}

// Re-export individual stores for direct use (new code should prefer these)
export { usePageStore } from "./stores/pageStore.js";
export { useBlockStore } from "./stores/blockStore.js";
export { useDatabaseStore } from "./stores/databaseStore.js";
export { useApiKeyStore } from "./stores/apiKeyStore.js";
