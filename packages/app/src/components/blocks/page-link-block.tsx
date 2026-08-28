import { useCallback, useState } from "react";
import { usePageStore } from "../../stores/pageStore.js";
import type { BlockRendererProps } from "./renderer-registry.js";

export function PageLinkBlock({ block, onUpdateBlock }: BlockRendererProps) {
	/** Parse the pageId from block.content. Legacy format is raw HTML; new is the plain pageId string. */
	const pageId = block.content?.startsWith("<") ? "" : block.content;
	const pages = usePageStore((s) => s.pages);
	const page = pages.find((p) => p.id === pageId);
	const [pickerOpen, setPickerOpen] = useState(pageId === "");
	const [query, setQuery] = useState("");

	const navigate = useCallback(
		(e: React.MouseEvent) => {
			if (!pageId) return;
			e.preventDefault();
			e.stopPropagation();
			const url = new URL(window.location.href);
			url.searchParams.set("page", pageId);
			window.history.pushState({ pageId }, "", url);
			window.dispatchEvent(new PopStateEvent("popstate"));
		},
		[pageId],
	);

	if (!pageId || pickerOpen) {
		const q = query.trim().toLowerCase();
		const visible = (
			q
				? pages.filter(
						(p) => !p.isDeleted && (p.title || "").toLowerCase().includes(q),
					)
				: pages.filter((p) => !p.isDeleted)
		).slice(0, 20);
		return (
			<div
				className="flex flex-col w-[320px] max-w-full bg-surface border border-border-mid rounded shadow-[var(--shadow-md)] p-1.5"
				onMouseDown={(e) => e.stopPropagation()}
			>
				<input
					name="page-link-search"
					className="border border-border rounded-lg px-2 py-[7px] text-[13px] outline-none bg-surface-2 text-text [font-family:var(--font-ui)] focus:border-accent"
					placeholder="Link to page\u2026"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							e.preventDefault();
							setPickerOpen(false);
						} else if (e.key === "Enter" && visible[0]) {
							e.preventDefault();
							setPickerOpen(false);
							onUpdateBlock(block.id, visible[0].id);
						}
					}}
				/>
				<div className="flex flex-col gap-px max-h-[280px] overflow-y-auto mt-1">
					{visible.length === 0 ? (
						<div className="p-3 text-text-3 text-[13px] text-center">
							No pages
						</div>
					) : (
						visible.map((p) => (
							<button
								key={p.id}
								className="flex items-center gap-2 px-2 py-[7px] border-none bg-transparent cursor-pointer rounded text-[13px] text-text-2 text-left [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => {
									setPickerOpen(false);
									onUpdateBlock(block.id, p.id);
								}}
							>
								<span>{p.icon || "\uD83D\uDCC4"}</span>
								<span
									style={{
										flex: 1,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{p.title || "Untitled"}
								</span>
							</button>
						))
					)}
				</div>
			</div>
		);
	}

	if (!page) {
		return (
			<div
				className="inline-flex items-center gap-2 max-w-full my-[3px] px-3 py-1.5 rounded bg-danger-dim border border-danger-mid text-danger text-[13px]"
				data-block-id={block.id}
			>
				Page no longer exists
			</div>
		);
	}
	return (
		<a
			className="inline-flex items-center gap-2 px-3 py-1.5 my-[3px] bg-surface-2 border border-border rounded text-[13.5px] text-text-2 no-underline max-w-full cursor-pointer transition-[background,border-color,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:border-border-mid hover:text-text"
			href={`?page=${pageId}`}
			onClick={navigate}
		>
			<span className="text-[15px] shrink-0">
				{page.icon || "\uD83D\uDCC4"}
			</span>
			<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap underline decoration-border-mid">
				{page.title || "Untitled"}
			</span>
		</a>
	);
}
