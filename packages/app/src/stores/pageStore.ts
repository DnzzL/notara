import { create } from "zustand";
import { api, AccessDeniedError } from "../rpc-client.js";
import type { Page, SearchResult, Backlink } from "@notion-alt/shared";
import { useBlockStore } from "./blockStore.js";
import { useDatabaseStore } from "./databaseStore.js";

export interface PageState {
  pages: Page[];
  currentPage: Page | null;
  loading: boolean;
  /** Id of the page the user just tried to open but was denied access to, or null. */
  accessDeniedFor: string | null;
  searchResults: SearchResult[];
  backlinks: Backlink[];
  backlinksLoading: boolean;
  recentPages: Page[];

  loadPages: () => Promise<void>;
  /** Set currentPage and update URL. Does NOT load blocks/databases — use the composition hook for that. */
  selectPage: (page: Page) => void;
  /** Fetch a page by ID and select it. Does NOT load blocks/databases. */
  selectPageById: (id: string) => Promise<void>;
  createPage: (title: string, parentId?: string | null) => Promise<Page>;
  updatePage: (id: string, patch: { title?: string | null; icon?: string | null; coverUrl?: string | null; isFavorite?: boolean | null }) => Promise<void>;
  setPageIcon: (id: string, icon: string | null) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  movePage: (id: string, parentId: string | null) => Promise<void>;
  reorderPages: (parentId: string | null, pageIds: string[]) => Promise<void>;
  globalSearch: (query: string) => Promise<void>;
  loadBacklinks: (pageId: string) => Promise<void>;
  loadRecentPages: () => Promise<void>;

  /** Cascade version: selects page AND loads blocks + databases. */
  selectPageWithCascade: (page: Page) => Promise<void>;
  selectPageByIdWithCascade: (id: string) => Promise<void>;

  importNotion: (directory: string) => Promise<{ pagesImported: number; databasesImported: number }>;
}

export const usePageStore = create<PageState>((set, get) => ({
  pages: [],
  currentPage: null,
  loading: false,
  accessDeniedFor: null,
  searchResults: [],
  backlinks: [],
  backlinksLoading: false,
  recentPages: [],

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

  selectPage: (page) => {
    console.log("[pageStore] selectPage called with:", page);
    set({ currentPage: page });
    // Track recently viewed pages
    const recent = JSON.parse(localStorage.getItem("notion-alt:recentPages") || "[]");
    const filtered = [page.id, ...recent.filter((x: string) => x !== page.id)].slice(0, 5);
    localStorage.setItem("notion-alt:recentPages", JSON.stringify(filtered));
    const url = new URL(window.location.href);
    const currentPageParam = url.searchParams.get("page");
    url.searchParams.set("page", page.id);
    if (currentPageParam !== page.id) {
      window.history.pushState({ pageId: page.id }, "", url);
    } else {
      window.history.replaceState({ pageId: page.id }, "", url);
    }
    console.log("[pageStore] URL updated to:", url.toString());
  },

  selectPageById: async (id) => {
    const page = get().pages.find((p) => p.id === id);
    if (page) {
      set({ accessDeniedFor: null });
      get().selectPage(page);
    } else {
      try {
        const fetchedPage = await api.getPage(id);
        if (fetchedPage) {
          set({ accessDeniedFor: null });
          get().selectPage(fetchedPage);
        }
      } catch (e) {
        if (e instanceof AccessDeniedError) {
          set({ accessDeniedFor: id, currentPage: null });
        } else {
          console.error("Failed to load page:", e);
        }
      }
    }
  },

  selectPageWithCascade: async (page) => {
    get().selectPage(page);
    await useBlockStore.getState().loadBlocks(page.id);
    await useDatabaseStore.getState().loadDatabases(page.id);
  },

  selectPageByIdWithCascade: async (id) => {
    const page = get().pages.find((p) => p.id === id);
    if (page) {
      set({ accessDeniedFor: null });
      await get().selectPageWithCascade(page);
    } else {
      try {
        const fetchedPage = await api.getPage(id);
        if (fetchedPage) {
          set({ accessDeniedFor: null });
          get().selectPage(fetchedPage);
          await useBlockStore.getState().loadBlocks(id);
          await useDatabaseStore.getState().loadDatabases(id);
        }
      } catch (e) {
        if (e instanceof AccessDeniedError) {
          set({ accessDeniedFor: id, currentPage: null });
        } else {
          console.error("[pageStore] Failed to load page:", e);
        }
      }
    }
  },

  createPage: async (title, parentId = null) => {
    const page = await api.createPage(title, parentId);
    set((s) => ({ pages: [page, ...s.pages] }));
    return page;
  },

  updatePage: async (id, patch) => {
    const page = await api.updatePage(id, patch);
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? page : p)),
      currentPage: s.currentPage?.id === id ? page : s.currentPage,
    }));
  },

  setPageIcon: async (id, icon) => {
    await get().updatePage(id, { icon });
  },

  toggleFavorite: async (id) => {
    const page = get().pages.find((p) => p.id === id);
    await get().updatePage(id, { isFavorite: !page?.isFavorite });
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

  globalSearch: async (query) => {
    console.log("[pageStore] globalSearch called with query:", query);
    const results = await api.globalSearch(query);
    console.log("[pageStore] Search results:", results);
    set({ searchResults: results });
  },

  loadBacklinks: async (pageId) => {
    set({ backlinksLoading: true });
    try {
      const backlinks = await api.getBacklinks(pageId);
      set({ backlinks });
    } catch {
      set({ backlinks: [] });
    } finally {
      set({ backlinksLoading: false });
    }
  },

  loadRecentPages: async () => {
    const ids: string[] = (() => {
      try { return JSON.parse(localStorage.getItem("notion-alt:recentPages") || "[]"); }
      catch { return []; }
    })();
    if (ids.length === 0) { set({ recentPages: [] }); return; }
    const known = get().pages;
    const results: Page[] = [];
    for (const id of ids) {
      const found = known.find(p => p.id === id);
      if (found && !found.isDeleted) { results.push(found); continue; }
      try {
        const page = await api.getPage(id);
        if (page && !page.isDeleted) results.push(page);
      } catch { /* skip missing pages */ }
    }
    set({ recentPages: results });
  },

  importNotion: async (directory) => {
    set({ loading: true });
    try {
      const result = await api.importNotion(directory);
      await get().loadPages();
      return result;
    } finally {
      set({ loading: false });
    }
  },
}));
