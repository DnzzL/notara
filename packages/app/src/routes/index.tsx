import { createRoute, redirect } from "@tanstack/react-router";
import { createAuthClient } from "better-auth/react";
import { LandingPage } from "../components/LandingPage.js";
import { restCall } from "../lib/restClient.js";
import { api } from "../rpc-client.js";
import { Route as rootRoute } from "./__root.js";

export const Route = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	loader: async () => {
		// Runtime, not build-time: one published image serves demo and non-demo
		// instances, so the CTA cannot be compiled in or out.
		const demoMode = await restCall<{ demoMode?: boolean }>(
			"/api/public-config",
		)
			.then((c) => c.demoMode === true)
			// A landing page that cannot reach the server still has to render.
			.catch(() => false);
		const client = createAuthClient({ baseURL: window.location.origin });
		const session = await client.getSession();
		if (!session?.data) return { demoMode };
		const workspaces = await api.getMyWorkspaces();
		// Demo visitors keep access to the landing page — it's the pitch they came
		// for. Only a real workspace triggers auto-resume.
		const real = workspaces.filter((w) => !w.isDemo);
		if (real.length > 0) {
			// Restore last-active workspace from localStorage, fall back to first workspace
			const lastSlug = (() => {
				try {
					return localStorage.getItem("notara:lastWorkspace");
				} catch {
					return null;
				}
			})();
			const target =
				lastSlug && real.some((w) => w.slug === lastSlug)
					? lastSlug
					: real[0].slug;
			throw redirect({
				to: "/$workspaceSlug",
				params: { workspaceSlug: target },
			});
		}
		// No workspace at all means a real account that hasn't created one yet.
		// Holding only a demo workspace falls through to the landing page.
		if (workspaces.length === 0) throw redirect({ to: "/workspaces" });
		return { demoMode };
	},
	component: IndexPage,
});

function IndexPage() {
	const { demoMode } = Route.useLoaderData();
	return <LandingPage demoMode={demoMode} />;
}
