import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root.js";
import { Route as indexRoute } from "./routes/index.js";
import { Route as loginRoute } from "./routes/login.js";
import { Route as workspacesRoute } from "./routes/workspaces.js";
import { Route as workspaceSlugRoute } from "./routes/$workspaceSlug.js";
import { Route as joinTokenRoute } from "./routes/join.$token.js";

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  workspacesRoute,
  workspaceSlugRoute,
  joinTokenRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
