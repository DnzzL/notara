import { create } from "zustand";
import { api } from "../rpc-client.js";
import type { Page } from "@notion-alt/shared";

export interface PageState {
  pages: Page[];
  currentPage: Page | null;
  loading: boolean;

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
  searchPages: (query: string) => Promise<void>;
}

export const usePageStore = create<PageState>((set, get) => ({
  pages: [],
  currentPage: null,
  loading: false,

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
    set({ currentPage: page });
    const url = new URL(window.location.href);
    url.searchParams.set("page", page.id);
    window.history.replaceState({}, "", url);
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

  searchPages: async (query) => {
    const pages = await api.searchPages(query);
    set({ pages });
  },
}));
