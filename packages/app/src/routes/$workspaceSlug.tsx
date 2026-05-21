import { createRoute, redirect } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { useEffect, useState } from "react";
import { setCurrentWorkspaceId } from "../rpc-client.js";
import { api } from "../rpc-client.js";
import { Sidebar } from "../components/Sidebar.js";
import { BlockEditor } from "../components/BlockEditor.js";
import { SearchModal } from "../components/SearchModal.js";
import { KeyboardShortcuts } from "../components/KeyboardShortcuts.js";
import { useStore } from "../store.js";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    loadPages();
  }, []);

  // Close sidebar on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSidebar(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeSidebar]);

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
