import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router.js";
import { initAnalytics } from "./analytics.js";
import "./styles.css";

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
);
