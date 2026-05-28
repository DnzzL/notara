import { createRoute, redirect, useParams } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { useEffect, useState } from "react";
import { setCurrentWorkspaceId } from "../rpc-client.js";
import { api } from "../rpc-client.js";
import { Sidebar } from "../components/Sidebar.js";
import { BlockEditor } from "../components/BlockEditor.js";
import { SearchModal } from "../components/SearchModal.js";
import { KeyboardShortcuts } from "../components/KeyboardShortcuts.js";
import { useStore } from "../store.js";
import { usePageStore } from "../stores/pageStore.js";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$workspaceSlug",
  beforeLoad: async ({ params }) => {
    const { createAuthClient } = await import("better-auth/react");
    const client = createAuthClient({ baseURL: window.location.origin });
    const session = await client.getSession();
    if (!session?.data) {
      throw redirect({ to: "/login" });
    }

    const workspaces = await api.getMyWorkspaces();
    const ws = workspaces.find((w) => w.slug === params.workspaceSlug);
    if (!ws) {
      throw redirect({ to: "/workspaces" });
    }

    setCurrentWorkspaceId(ws.id);
    return { workspaceId: ws.id, workspace: ws };
  },
  component: WorkspaceLayout,
});

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="14" height="2" rx="1" fill="currentColor"/>
      <rect x="2" y="8" width="14" height="2" rx="1" fill="currentColor"/>
      <rect x="2" y="12" width="14" height="2" rx="1" fill="currentColor"/>
    </svg>
  );
}

function WorkspaceLayout() {
  const { loadPages } = useStore();
  const { workspaceSlug } = useParams({ from: "/$workspaceSlug" });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    usePageStore.setState({ pages: [], currentPage: null });
    let cancelled = false;
    loadPages().then(() => {
      if (cancelled) return;
      const pages = usePageStore.getState().pages.filter((p) => !p.isDeleted);
      if (pages.length === 0) return;
      // 1) If URL already has ?page=X and that page exists, honor it.
      const url = new URL(window.location.href);
      const pageParam = url.searchParams.get("page");
      if (pageParam && pages.some((p) => p.id === pageParam)) {
        usePageStore.getState().selectPageByIdWithCascade(pageParam);
        return;
      }
      // 2) Last visited page in this workspace from recents.
      try {
        const recent: string[] = JSON.parse(
          localStorage.getItem("notion-alt:recentPages") || "[]",
        );
        const last = recent.find((id) => pages.some((p) => p.id === id));
        if (last) {
          usePageStore.getState().selectPageByIdWithCascade(last);
          return;
        }
      } catch { /* ignore corrupt localStorage */ }
      // 3) Fallback: first top-level page (or first page if none are root).
      const firstRoot = pages.find((p) => p.parentId === null) ?? pages[0];
      usePageStore.getState().selectPageByIdWithCascade(firstRoot.id);
    });
    return () => { cancelled = true; };
  }, [workspaceSlug]);

  // Close sidebar on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSidebar(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeSidebar]);

  // Handle programmatic navigation via pushState (page-link blocks, relation chips)
  useEffect(() => {
    const onPopState = () => {
      const pageId = new URL(window.location.href).searchParams.get("page");
      if (pageId) usePageStore.getState().selectPageByIdWithCascade(pageId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <div className="app">
      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? "sidebar-backdrop--open" : ""}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <Sidebar
        className={sidebarOpen ? "sidebar--open" : ""}
        onNavigate={closeSidebar}
      />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        {/* Mobile topbar */}
        <div className="mobile-topbar">
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle sidebar"
          >
            <HamburgerIcon />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", opacity: 0.7 }}>Notara</span>
        </div>

        <BlockEditor />
      </div>

      <SearchModal />
      <KeyboardShortcuts />
    </div>
  );
}
