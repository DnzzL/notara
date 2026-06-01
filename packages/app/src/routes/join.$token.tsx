import { createRoute, redirect } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { createAuthClient } from "better-auth/react";
import { api } from "../rpc-client.js";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/join/$token",
  beforeLoad: async ({ params }) => {
    const client = createAuthClient({ baseURL: window.location.origin });
    const session = await client.getSession();
    if (!session?.data) {
      throw redirect({ to: "/login" });
    }
    try {
      const ws = await api.joinWorkspaceByToken({ inviteToken: params.token });
      throw redirect({ to: "/$workspaceSlug", params: { workspaceSlug: ws.slug } });
    } catch (err: any) {
      if (err?.isRedirect) throw err;
      throw redirect({ to: "/workspaces" });
    }
  },
  component: () => <p>Joining workspace...</p>,
});
