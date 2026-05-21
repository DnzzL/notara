import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root.js";
import { Route as indexRoute } from "./routes/index.js";
import { Route as loginRoute } from "./routes/login.js";
import { Route as workspacesRoute } from "./routes/workspaces.js";
import { Route as workspaceSlugRoute } from "./routes/$workspaceSlug.js";
import { Route as joinTokenRoute } from "./routes/join.$token.js";
import { Route as forgotPasswordRoute } from "./routes/forgot-password.js";
import { Route as resetPasswordRoute } from "./routes/reset-password.js";
import { Route as adminRoute } from "./routes/admin.js";
import { Route as pricingRoute } from "./routes/pricing.js";

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  workspacesRoute,
  workspaceSlugRoute,
  joinTokenRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  adminRoute,
  pricingRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
