import { createRoute, redirect } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";

export const Route = createRoute({
	getParentRoute: () => rootRoute,
	path: "/pricing",
	beforeLoad: () => {
		throw redirect({ to: "/", hash: "pricing" });
	},
	component: () => null,
});
