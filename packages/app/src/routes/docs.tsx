import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/docs")({
  component: function DocsRedirect() {
    useEffect(() => { window.location.replace("/api/docs"); }, []);
    return null;
  },
});
