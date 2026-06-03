import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router.js";
import { enableAnalyticsIfConsented } from "./consent.js";
import "./styles.css";

// Analytics boots only if the user has previously accepted. Fresh visitors get
// the banner first; PostHog stays uninitialised until they choose.
enableAnalyticsIfConsented();

createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
);
