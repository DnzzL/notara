import { useCallback } from "react";
import { api } from "../rpc-client.js";
import { usePageStore } from "./pageStore.js";
import { useBlockStore } from "./blockStore.js";
import { useDatabaseStore } from "./databaseStore.js";

/**
 * Orchestration hook that coordinates cross-domain behavior when selecting a page.
 * The page slice only sets currentPage + URL; this hook cascades to load blocks
 * and databases for the selected page.
 */
export function usePageSelection() {
  const selectPage = usePageStore((s) => s.selectPage);
  const selectPageById = usePageStore((s) => s.selectPageById);
  const loadBlocks = useBlockStore((s) => s.loadBlocks);
  const loadDatabases = useDatabaseStore((s) => s.loadDatabases);
  const pages = usePageStore((s) => s.pages);
  const currentPage = usePageStore((s) => s.currentPage);

  const selectPageWithCascade = useCallback(
    async (page: any) => {
      selectPage(page);
      await loadBlocks(page.id);
      await loadDatabases(page.id);
    },
    [selectPage, loadBlocks, loadDatabases],
  );

  const selectPageByIdWithCascade = useCallback(
    async (id: string) => {
      const page = pages.find((p) => p.id === id);
      if (page) {
        await selectPageWithCascade(page);
      } else {
        try {
          const fetchedPage = await api.getPage(id);
          if (fetchedPage) {
            selectPage(fetchedPage);
            await loadBlocks(id);
            await loadDatabases(id);
          }
        } catch (e) {
          console.error("Failed to load page:", e);
        }
      }
    },
    [pages, selectPageWithCascade, selectPage, loadBlocks, loadDatabases],
  );

  return {
    currentPage,
    selectPage: selectPageWithCascade,
    selectPageById: selectPageByIdWithCascade,
  };
}
