import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Toaster } from "../components/Toaster.js";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  ),
});
