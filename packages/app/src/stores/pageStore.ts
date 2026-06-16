import { create } from "zustand";
import { api, AccessDeniedError } from "../rpc-client.js";
import type { Page, SearchResult, Backlink } from "@notara/shared";
import { useHistoryStore } from "./historyStore.js";
import { toaster } from "../toaster.js";

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
  /** Set currentPage and update URL. Does NOT load blocks/databases. */
  selectPage: (page: Page) => void;
  /** Fetch a page by ID and select it. Does NOT load blocks/databases. */
  selectPageById: (id: string) => Promise<void>;
  /** Fetch a single page, returning null on 403/404. */
  fetchPage: (id: string) => Promise<Page | null>;
  createPage: (title: string, parentId?: string | null) => Promise<Page>;
  createPageFromTemplate: (templateId: string, parentId?: string | null) => Promise<Page>;
  updatePage: (id: string, patch: { title?: string | null; icon?: string | null; coverUrl?: string | null; isFavorite?: boolean | null }) => Promise<void>;
  setPageIcon: (id: string, icon: string | null) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  movePage: (id: string, parentId: string | null) => Promise<void>;
  reorderPages: (parentId: string | null, pageIds: string[]) => Promise<void>;
  globalSearch: (query: string) => Promise<void>;
  loadBacklinks: (pageId: string) => Promise<void>;
  loadRecentPages: () => Promise<void>;

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
      toaster.create({ type: "error", title: "Failed to load pages", description: String(e) });
      set({ loading: false });
    }
  },

  selectPage: (page) => {
    if (get().currentPage?.id !== page.id) {
      useHistoryStore.getState().resetFor(page.id);
    }
    set({ currentPage: page });
    // Track last viewed page per workspace and persist last-active workspace
    const url = new URL(window.location.href);
    const slug = url.pathname.split("/").filter(Boolean)[0];
    if (slug) {
      localStorage.setItem(`notara:lastPage:${slug}`, page.id);
      localStorage.setItem("notara:lastWorkspace", slug);
    }
    // Keep flat recentPages list for the search modal's "recent pages" section
    const recent = JSON.parse(localStorage.getItem("notara:recentPages") || "[]");
    const filtered = [page.id, ...recent.filter((x: string) => x !== page.id)].slice(0, 5);
    localStorage.setItem("notara:recentPages", JSON.stringify(filtered));
    const currentPageParam = url.searchParams.get("page");
    url.searchParams.set("page", page.id);
    if (currentPageParam !== page.id) {
      window.history.pushState({ pageId: page.id }, "", url);
    } else {
      window.history.replaceState({ pageId: page.id }, "", url);
    }
  },

  selectPageById: async (id) => {
    const page = get().pages.find((p) => p.id === id);
    if (page) {
      set({ accessDeniedFor: null });
      get().selectPage(page);
    } else {
      try {
        const fetchedPage = await api.getPage({ id });
        if (fetchedPage) {
          set({ accessDeniedFor: null });
          get().selectPage(fetchedPage);
        }
      } catch (e) {
        if (e instanceof AccessDeniedError) {
          set({ accessDeniedFor: id, currentPage: null });
        } else {
          toaster.create({ type: "error", title: "Failed to load page", description: String(e) });
        }
      }
    }
  },

  selectPageByIdWithCascade: async (id: string) => {
    // Cascade logic moved to page-loader.ts — this is kept for backward compatibility
    const page = get().pages.find((p) => p.id === id);
    if (page) {
      set({ accessDeniedFor: null });
      get().selectPage(page);
    } else {
      try {
        const fetchedPage = await api.getPage({ id });
        if (fetchedPage) {
          set({ accessDeniedFor: null });
          get().selectPage(fetchedPage);
        }
      } catch (e) {
        if (e instanceof AccessDeniedError) {
          set({ accessDeniedFor: id, currentPage: null });
        } else {
          toaster.create({ type: "error", title: "Failed to load page", description: String(e) });
        }
      }
    }
  },

  createPage: async (title, parentId = null) => {
    const page = await api.createPage({ title, parentId });
    set((s) => ({ pages: [page, ...s.pages] }));
    return page;
  },

  createPageFromTemplate: async (templateId, parentId = null) => {
    const page = await api.createPageFromTemplate({ templateId, parentId });
    // Templates may create sub-pages; reload the full tree so they appear in
    // the sidebar and pageLink blocks can resolve their targets.
    await get().loadPages();
    return page;
  },

  updatePage: async (id, patch) => {
    const page = await api.updatePage({ id, ...patch });
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
    await api.deletePage({ id });
    set((s) => ({
      pages: s.pages.filter((p) => p.id !== id),
      currentPage: s.currentPage?.id === id ? null : s.currentPage,
    }));
  },

  movePage: async (id, parentId) => {
    const page = await api.movePage({ id, parentId });
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? page : p)),
      currentPage: s.currentPage?.id === id ? page : s.currentPage,
    }));
  },

  reorderPages: async (parentId, pageIds) => {
    await api.reorderPages({ parentId, pageIds });
    await get().loadPages();
  },

  globalSearch: async (query) => {
    const results = await api.globalSearch({ query });
    set({ searchResults: results });
  },

  loadBacklinks: async (pageId) => {
    set({ backlinksLoading: true, backlinks: [] });
    try {
      const backlinks = await api.getBacklinks({ pageId });
      set({ backlinks });
    } catch {
      set({ backlinks: [] });
    } finally {
      set({ backlinksLoading: false });
    }
  },

  loadRecentPages: async () => {
    const ids: string[] = (() => {
      try { return JSON.parse(localStorage.getItem("notara:recentPages") || "[]"); }
      catch { return []; }
    })();
    if (ids.length === 0) { set({ recentPages: [] }); return; }
    const known = get().pages;
    const results: Page[] = [];
    for (const id of ids) {
      const found = known.find(p => p.id === id);
      if (found && !found.isDeleted) { results.push(found); continue; }
      try {
        const page = await api.getPage({ id });
        if (page && !page.isDeleted) results.push(page);
      } catch { /* skip missing pages */ }
    }
    set({ recentPages: results });
  },

  /** Fetch a single page by ID. Returns null on 403/404. */
  fetchPage: async (id: string): Promise<Page | null> => {
    try {
      const page = await api.getPage({ id });
      return page;
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        set({ accessDeniedFor: id, currentPage: null });
      } else {
        toaster.create({ type: "error", title: "Failed to fetch page", description: String(e) });
      }
      return null;
    }
  },

  importNotion: async (directory) => {
    set({ loading: true });
    try {
      const result = await api.importNotion({ directory });
      await get().loadPages();
      return result;
    } finally {
      set({ loading: false });
    }
  },
}));
