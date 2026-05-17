import { create } from "zustand";
import { api } from "../rpc-client.js";
import type { Page, SearchResult } from "@notion-alt/shared";
import { useBlockStore } from "./blockStore.js";
import { useDatabaseStore } from "./databaseStore.js";

export interface PageState {
  pages: Page[];
  currentPage: Page | null;
  loading: boolean;
  searchResults: SearchResult[];

  loadPages: () => Promise<void>;
  /** Set currentPage and update URL. Does NOT load blocks/databases — use the composition hook for that. */
  selectPage: (page: Page) => void;
  /** Fetch a page by ID and select it. Does NOT load blocks/databases. */
  selectPageById: (id: string) => Promise<void>;
  createPage: (title: string, parentId?: string | null) => Promise<Page>;
  updatePage: (id: string, title: string) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  movePage: (id: string, parentId: string | null) => Promise<void>;
  reorderPages: (parentId: string | null, pageIds: string[]) => Promise<void>;
  globalSearch: (query: string) => Promise<void>;

  /** Cascade version: selects page AND loads blocks + databases. */
  selectPageWithCascade: (page: Page) => Promise<void>;
  selectPageByIdWithCascade: (id: string) => Promise<void>;
}

export const usePageStore = create<PageState>((set, get) => ({
  pages: [],
  currentPage: null,
  loading: false,
  searchResults: [],

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
    url.searchParams.set("page", page.id);
    window.history.replaceState({}, "", url);
    console.log("[pageStore] URL updated to:", url.toString());
  },

  selectPageById: async (id) => {
    const page = get().pages.find((p) => p.id === id);
    if (page) {
      get().selectPage(page);
    } else {
      try {
        const fetchedPage = await api.getPage(id);
        if (fetchedPage) {
          get().selectPage(fetchedPage);
        }
      } catch (e) {
        console.error("Failed to load page:", e);
      }
    }
  },

  selectPageWithCascade: async (page) => {
    get().selectPage(page);
    await useBlockStore.getState().loadBlocks(page.id);
    await useDatabaseStore.getState().loadDatabases(page.id);
  },

  selectPageByIdWithCascade: async (id) => {
    console.log("[pageStore] selectPageByIdWithCascade called with id:", id);
    const page = get().pages.find((p) => p.id === id);
    if (page) {
      console.log("[pageStore] Page found in local list:", page);
      await get().selectPageWithCascade(page);
    } else {
      try {
        console.log("[pageStore] Fetching page from server:", id);
        const fetchedPage = await api.getPage(id);
        if (fetchedPage) {
          console.log("[pageStore] Page fetched from server:", fetchedPage);
          get().selectPage(fetchedPage);
          await useBlockStore.getState().loadBlocks(id);
          await useDatabaseStore.getState().loadDatabases(id);
        }
      } catch (e) {
        console.error("[pageStore] Failed to load page:", e);
      }
    }
  },

  createPage: async (title, parentId = null) => {
    const page = await api.createPage(title, parentId);
    set((s) => ({ pages: [page, ...s.pages] }));
    return page;
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

  globalSearch: async (query) => {
    console.log("[pageStore] globalSearch called with query:", query);
    const results = await api.globalSearch(query);
    console.log("[pageStore] Search results:", results);
    set({ searchResults: results });
  },
}));
