import { createRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Route as rootRoute } from "./__root.js";

export const Route = createRoute({
	getParentRoute: () => rootRoute,
	path: "/docs",
	component: function DocsRedirect() {
		useEffect(() => {
			window.location.replace("/api/docs");
		}, []);
		return null;
	},
});
