import { createRoute, redirect, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BlockEditor } from "../components/BlockEditor.js";
import { DemoBanner } from "../components/DemoBanner.js";
import { KeyboardShortcuts } from "../components/KeyboardShortcuts.js";
import { OnboardingTour } from "../components/OnboardingTour.js";
import { SearchModal } from "../components/SearchModal.js";
import { Sidebar } from "../components/Sidebar.js";
import { selectPageByIdWithCascade } from "../lib/page-loader.js";
import { api, setCurrentWorkspaceId } from "../rpc-client.js";
import { usePageStore } from "../stores/pageStore.js";
import { Route as rootRoute } from "./__root.js";

export const Route = createRoute({
	getParentRoute: () => rootRoute,
	path: "/$workspaceSlug",
	beforeLoad: async ({ params }) => {
		const { createAuthClient } = await import("better-auth/react");
		const client = createAuthClient({ baseURL: window.location.origin });
		const session = await client.getSession();
		if (!session?.data) {
			throw redirect({ to: "/login" });
		}

		const workspaces = await api.getMyWorkspaces();
		const ws = workspaces.find((w) => w.slug === params.workspaceSlug);
		if (!ws) {
			throw redirect({ to: "/workspaces" });
		}

		setCurrentWorkspaceId(ws.id);
		return { workspaceId: ws.id, workspace: ws };
	},
	component: WorkspaceLayout,
});

function HamburgerIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			aria-hidden="true"
		>
			<rect x="2" y="4" width="14" height="2" rx="1" fill="currentColor" />
			<rect x="2" y="8" width="14" height="2" rx="1" fill="currentColor" />
			<rect x="2" y="12" width="14" height="2" rx="1" fill="currentColor" />
		</svg>
	);
}

function WorkspaceLayout() {
	const loadPages = usePageStore((s) => s.loadPages);
	const { workspaceSlug } = useParams({ from: "/$workspaceSlug" });
	const { workspace } = Route.useRouteContext();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [tourStartKey, setTourStartKey] = useState(0);
	const closeSidebar = () => setSidebarOpen(false);

	useEffect(() => {
		usePageStore.setState({ pages: [], currentPage: null });
		let cancelled = false;
		loadPages().then(() => {
			if (cancelled) return;
			const pages = usePageStore.getState().pages.filter((p) => !p.isDeleted);
			if (pages.length === 0) return;
			// 1) If URL already has ?page=X and that page exists, honor it.
			const url = new URL(window.location.href);
			const pageParam = url.searchParams.get("page");
			if (pageParam && pages.some((p) => p.id === pageParam)) {
				selectPageByIdWithCascade(pageParam);
				return;
			}
			// 2) Last visited page in this workspace from per-workspace storage.
			try {
				const lastPageId = localStorage.getItem(
					`notara:lastPage:${workspaceSlug}`,
				);
				if (lastPageId && pages.some((p) => p.id === lastPageId)) {
					selectPageByIdWithCascade(lastPageId);
					return;
				}
			} catch {
				/* ignore corrupt localStorage */
			}
			// 3) Fallback: first top-level page (or first page if none are root).
			const firstRoot = pages.find((p) => p.parentId === null) ?? pages[0];
			selectPageByIdWithCascade(firstRoot.id);
		});
		return () => {
			cancelled = true;
		};
	}, [workspaceSlug, loadPages]);

	// Close sidebar on escape
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeSidebar();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [closeSidebar]);

	// Handle programmatic navigation via pushState (page-link blocks, relation chips)
	useEffect(() => {
		const onPopState = () => {
			const pageId = new URL(window.location.href).searchParams.get("page");
			if (pageId) selectPageByIdWithCascade(pageId);
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	return (
		<div className="app">
			{/* Mobile backdrop */}
			<div
				className={`sidebar-backdrop ${sidebarOpen ? "sidebar-backdrop--open" : ""}`}
				onClick={closeSidebar}
				aria-hidden="true"
			/>

			<Sidebar
				className={sidebarOpen ? "sidebar--open" : ""}
				onNavigate={closeSidebar}
				onStartTour={() => setTourStartKey((k) => k + 1)}
			/>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					flex: 1,
					minWidth: 0,
				}}
			>
				{workspace.isDemo && <DemoBanner />}

				{/* Mobile topbar */}
				<div className="mobile-topbar">
					<button
						className="mobile-menu-btn"
						onClick={() => setSidebarOpen((o) => !o)}
						aria-label="Toggle sidebar"
					>
						<HamburgerIcon />
					</button>
					<span
						style={{
							fontSize: 14,
							fontWeight: 600,
							color: "var(--text)",
							opacity: 0.7,
						}}
					>
						Notara
					</span>
				</div>

				<BlockEditor />
			</div>

			<SearchModal onNavigate={closeSidebar} />
			<KeyboardShortcuts />
			<OnboardingTour startKey={tourStartKey} />
		</div>
	);
}
