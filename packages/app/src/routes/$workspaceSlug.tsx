import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "../auth-client.js";
import { setCurrentWorkspaceId } from "../rpc-client.js";
import { api } from "../rpc-client.js";
import { Sidebar } from "../components/Sidebar.js";
import { BlockEditor } from "../components/BlockEditor.js";
import { SearchModal } from "../components/SearchModal.js";
import { KeyboardShortcuts } from "../components/KeyboardShortcuts.js";
import { useStore } from "../store.js";

export const Route = createFileRoute("/$workspaceSlug")({
  beforeLoad: async ({ params }) => {
    // Verify session exists
    const { createAuthClient } = await import("better-auth/react");
    const client = createAuthClient({ baseURL: window.location.origin });
    const session = await client.getSession();
    if (!session?.data) {
      throw redirect({ to: "/login" });
    }

    // Resolve workspaceId from slug
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

function WorkspaceLayout() {
  const { loadPages } = useStore();

  useEffect(() => {
    loadPages();
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <BlockEditor />
      <SearchModal />
      <KeyboardShortcuts />
    </div>
  );
}
