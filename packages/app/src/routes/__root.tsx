import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { AnalyticsIdentity } from "../components/AnalyticsIdentity.js";
import { ConsentBanner } from "../components/ConsentBanner.js";
import { Toaster } from "../components/Toaster.js";

export const Route = createRootRoute({
	component: () => (
		<>
			<Outlet />
			<Toaster />
			<ConsentBanner />
			<AnalyticsIdentity />
			{import.meta.env.DEV && <TanStackRouterDevtools />}
		</>
	),
});
