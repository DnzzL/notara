import type { Backlink } from "@notara/shared";
import { useEffect, useState } from "react";
import { selectPageByIdWithCascade } from "../lib/page-loader.js";
import { usePageStore } from "../store.js";

export function BacklinksPanel() {
	const currentPage = usePageStore((s) => s.currentPage);
	const backlinks = usePageStore((s) => s.backlinks);
	const backlinksLoading = usePageStore((s) => s.backlinksLoading);
	const loadBacklinks = usePageStore((s) => s.loadBacklinks);
	const selectPageById = selectPageByIdWithCascade;
	const [isExpanded, setIsExpanded] = useState(false);

	useEffect(() => {
		if (currentPage?.id) {
			loadBacklinks(currentPage.id);
		}
	}, [currentPage?.id, loadBacklinks]);

	if (!currentPage) return null;

	const count = backlinks.length;

	return (
		<div className="mt-6 pt-2 border-t border-border">
			<button
				className="hover:bg-surface-2 rounded w-full"
				onClick={() => setIsExpanded(!isExpanded)}
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					padding: "8px 12px",
					width: "100%",
					background: "transparent",
					border: "none",
					cursor: "pointer",
					fontSize: "13px",
					color: "var(--text-2)",
				}}
			>
				<span className="text-[10px]">{isExpanded ? "▼" : "▶"}</span>
				<span>
					{backlinksLoading
						? "Loading..."
						: `${count} backlink${count !== 1 ? "s" : ""}`}
				</span>
			</button>

			{isExpanded && (
				<div
					className="backlinks-list"
					style={{ padding: "4px 0", maxHeight: "200px", overflowY: "auto" }}
				>
					{backlinksLoading && (
						<div style={{ padding: "8px 12px", color: "var(--text-2)" }}>
							Loading backlinks...
						</div>
					)}
					{!backlinksLoading && backlinks.length === 0 && (
						<div style={{ padding: "8px 12px", color: "var(--text-2)" }}>
							No pages reference this page
						</div>
					)}
					{!backlinksLoading &&
						backlinks.map((link) => (
							<BacklinkItem
								key={link.blockId}
								backlink={link}
								onNavigate={selectPageById}
							/>
						))}
				</div>
			)}
		</div>
	);
}

function BacklinkItem({
	backlink,
	onNavigate,
}: {
	backlink: Backlink;
	onNavigate: (id: string) => void;
}) {
	const snippet =
		backlink.blockType === "pageLink"
			? "🔗 Linked page"
			: backlink.content.length > 100
				? `${backlink.content.slice(0, 100)}...`
				: backlink.content;

	return (
		<button
			className="hover:bg-surface-2 rounded block w-full"
			onClick={() => onNavigate(backlink.pageId)}
			style={{
				display: "block",
				width: "100%",
				padding: "8px 16px",
				background: "transparent",
				border: "none",
				cursor: "pointer",
				textAlign: "left",
				fontSize: "13px",
			}}
		>
			<div
				className="backlink-page-title"
				style={{ fontWeight: "500", marginBottom: "4px", color: "var(--text)" }}
			>
				📄 {backlink.pageTitle}
			</div>
			<div
				className="backlink-snippet"
				style={{ color: "var(--text-2)", fontSize: "12px", lineHeight: "1.4" }}
			>
				{snippet}
			</div>
		</button>
	);
}

export default BacklinksPanel;
