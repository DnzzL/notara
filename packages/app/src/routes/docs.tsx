import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { useEffect } from "react";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: function DocsRedirect() {
    useEffect(() => { window.location.replace("/api/docs"); }, []);
    return null;
  },
});
