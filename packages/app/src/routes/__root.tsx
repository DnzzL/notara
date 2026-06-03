import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Toaster } from "../components/Toaster.js";
import { ConsentBanner } from "../components/ConsentBanner.js";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster />
      <ConsentBanner />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  ),
});
