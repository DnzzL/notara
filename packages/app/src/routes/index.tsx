import { createRoute, redirect } from "@tanstack/react-router";
import { createAuthClient } from "better-auth/react";
import { api } from "../rpc-client.js";
import { Route as rootRoute } from "./__root.js";
import { LandingPage } from "../components/LandingPage.js";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: async () => {
    const client = createAuthClient({ baseURL: window.location.origin });
    const session = await client.getSession();
    if (!session?.data) return { loggedIn: false };
    const workspaces = await api.getMyWorkspaces();
    if (workspaces.length > 0) {
      // Restore last-active workspace from localStorage, fall back to first workspace
      const lastSlug = (() => {
        try { return localStorage.getItem("notara:lastWorkspace"); }
        catch { return null; }
      })();
      const target = lastSlug && workspaces.some((w) => w.slug === lastSlug)
        ? lastSlug
        : workspaces[0].slug;
      throw redirect({ to: "/$workspaceSlug", params: { workspaceSlug: target } });
    }
    throw redirect({ to: "/workspaces" });
  },
  component: IndexPage,
});

function IndexPage() {
  return <LandingPage />;
}
