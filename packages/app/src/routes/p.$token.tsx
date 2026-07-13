import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { ReadOnlyPage } from "../components/ReadOnlyPage.js";
import { useState, useEffect } from "react";
import type { Page, Block } from "@notara/shared";

export const Route = createRoute({
	getParentRoute: () => rootRoute,
	path: "/p/$token",
	component: PublicPageView,
});

function PublicPageView() {
	const { token } = Route.useParams();
	const [state, setState] = useState<
		"loading" | "found" | "not-found" | "error"
	>("loading");
	const [page, setPage] = useState<Page | null>(null);
	const [blocks, setBlocks] = useState<Block[]>([]);

	useEffect(() => {
		let cancelled = false;
		setState("loading");

		fetch(`/api/public/pages/${encodeURIComponent(token)}`)
			.then((res) => {
				if (res.status === 404) {
					if (!cancelled) setState("not-found");
					return null;
				}
				if (!res.ok) {
					if (!cancelled) setState("error");
					return null;
				}
				return res.json();
			})
			.then((data) => {
				if (cancelled || !data) return;
				setPage(data.page);
				setBlocks(data.blocks);
				setState("found");
			})
			.catch(() => {
				if (!cancelled) setState("error");
			});

		return () => {
			cancelled = true;
		};
	}, [token]);

	if (state === "loading") {
		return (
			<div className="max-w-[720px] mx-auto px-6 py-12 text-text-3">
				Loading…
			</div>
		);
	}

	if (state === "not-found") {
		return (
			<div className="max-w-[720px] mx-auto px-6 py-12">
				<h1 className="text-[28px] font-bold text-text mb-3">Not found</h1>
				<p className="text-text-2 text-[15px]">
					This page doesn't exist or its share link has been revoked.
				</p>
			</div>
		);
	}

	if (state === "error" || !page) {
		return (
			<div className="max-w-[720px] mx-auto px-6 py-12">
				<h1 className="text-[28px] font-bold text-text mb-3">
					Something went wrong
				</h1>
				<p className="text-text-2 text-[15px]">
					Couldn't load this page. Please try again.
				</p>
			</div>
		);
	}

	return (
		<>
			<ReadOnlyPage page={page} blocks={blocks} />
			<footer className="max-w-[720px] mx-auto px-6 pb-8 text-center text-text-3 text-[12px]">
				Made with{" "}
				<a
					href="https://github.com/dnzzl/notara"
					target="_blank"
					rel="noopener noreferrer"
					className="text-text-2 underline decoration-dotted underline-offset-2 hover:text-text"
				>
					Notara
				</a>
			</footer>
		</>
	);
}
