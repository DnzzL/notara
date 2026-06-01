/**
 * Orchestration layer for page-level navigation.
 *
 * Coordinates page selection → block loading → database loading across the
 * three domain stores. Individual stores remain pure CRUD over their own
 * domain with no knowledge of each other.
 */
import { usePageStore } from "../stores/pageStore.js";
import { useBlockStore } from "../stores/blockStore.js";
import { useDatabaseStore } from "../stores/databaseStore.js";
import type { Page } from "@notion-alt/shared";

/**
 * Select a page and load its associated blocks and databases.
 * Handles both locally-known pages and pages that need fetching from the server.
 */
export async function selectPageWithCascade(page: Page): Promise<void> {
  usePageStore.getState().selectPage(page);
  await loadPageContent(page.id);
}

/**
 * Fetch a page by ID (if not already loaded), select it, and load its content.
 */
export async function selectPageByIdWithCascade(id: string): Promise<void> {
  const pageStore = usePageStore.getState();

  const existingPage = pageStore.pages.find((p) => p.id === id);
  if (existingPage) {
    await selectPageWithCascade(existingPage);
    return;
  }

  const page = await pageStore.fetchPage(id);
  if (!page) return;

  pageStore.selectPage(page);
  await loadPageContent(id);
}

/** Load blocks and databases for a given page. */
async function loadPageContent(pageId: string): Promise<void> {
  await Promise.all([
    useBlockStore.getState().loadBlocks(pageId),
    useDatabaseStore.getState().loadDatabases(pageId),
  ]);
}
