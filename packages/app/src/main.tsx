import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { enableAnalyticsIfConsented } from "./consent.js";
import { router } from "./router.js";
import { toaster } from "./toaster.js";
import "./styles.css";

// Analytics boots only if the user has previously accepted. Fresh visitors get
// the banner first; PostHog stays uninitialised until they choose.
enableAnalyticsIfConsented();

// Global unhandled rejection handler catches Errors from Zustand stores that
// don't have individual error handling, surfacing them as toasts instead of
// silent swallows (addresses NOT-9 / NOT-70).
window.addEventListener("unhandledrejection", (event) => {
	const message =
		event.reason instanceof Error ? event.reason.message : String(event.reason);
	// Suppress toasts for known error types that callers already special-case
	// (e.g. AccessDeniedError which is handled by the component layer).
	if (event.reason?.name === "AccessDeniedError") return;
	toaster.create({
		type: "error",
		title: "Something went wrong",
		description: message,
	});
});

createRoot(document.getElementById("root")!).render(
	<RouterProvider router={router} />,
);
