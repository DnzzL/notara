import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../rpc-client.js";
import type {
	PageReferenceItem,
	PageReferenceRenderProps,
} from "./PageReferenceExtension.js";

/**
 * PageReferenceMenu — Autocomplete UI for @ mentions.
 *
 * Shows a dropdown menu with page and person suggestions when typing `@`.
 * Renders via React portal (not as a sibling inside .block-node) to avoid
 * the tiptap-sibling-dom-crash on collab edits.
 */

interface PageReferenceMenuProps {
	props: PageReferenceRenderProps;
}

function PageReferenceMenu({ props }: PageReferenceMenuProps) {
	const { query, command } = props;
	const [items, setItems] = useState<PageReferenceItem[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const menuRef = useRef<HTMLDivElement>(null);

	// Fetch pages and people matching the query
	useEffect(() => {
		const fetchItems = async () => {
			try {
				// Search pages via globalSearch
				const results =
					query.length > 0
						? await api.globalSearch({ query })
						: (await api.listPages()).map((p: any) => ({
								type: "page" as const,
								id: p.id,
								title: p.title,
								content: "",
								pageId: p.id,
							}));
				const pages: PageReferenceItem[] = results
					.filter((r: any) => r.type === "page")
					.slice(0, 8)
					.map((page: any) => ({
						pageId: page.id,
						pageTitle: page.title,
						type: "page" as const,
					}));

				// Search workspace members for people
				// Person chips are display-only (no person page exists yet).
				const allItems: PageReferenceItem[] = [...pages];

				// If query is fuzzy-long enough, add a dummy person chip
				// (placeholder until proper person pages exist)
				if (query.length >= 2) {
					allItems.push({
						pageId: `person-placeholder-${query}`,
						pageTitle: query,
						type: "person",
					});
				}

				setItems(allItems.slice(0, 12));
				setSelectedIndex(0);
			} catch (error) {
				console.error("Failed to search references:", error);
				setItems([]);
			}
		};

		fetchItems();
	}, [query]);

	// Handle keyboard events
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
			} else if (event.key === "ArrowDown") {
				event.preventDefault();
				setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
			} else if (event.key === "Enter" && items[selectedIndex]) {
				event.preventDefault();
				command(items[selectedIndex]);
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [items, selectedIndex, command]);

	// Scroll selected item into view
	useEffect(() => {
		if (menuRef.current) {
			const selected = menuRef.current.children[selectedIndex] as
				| HTMLElement
				| undefined;
			if (selected) {
				selected.scrollIntoView({ block: "nearest" });
			}
		}
	}, [selectedIndex]);

	if (items.length === 0) {
		return (
			<div className="px-3 py-3 text-text-3 text-[13.5px]">
				No pages or people found
			</div>
		);
	}

	return (
		<div
			ref={menuRef}
			className="bg-surface border border-border-mid rounded shadow-[var(--shadow-lg)] max-h-[280px] overflow-y-auto min-w-[220px]"
		>
			{items.map((item, index) => (
				<button
					key={`${item.type}-${item.pageId}`}
					className={`flex items-center w-full px-3.5 py-[9px] border-none bg-transparent cursor-pointer text-[13.5px] text-left text-text-2 [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text ${index === selectedIndex ? "bg-surface-3 text-text" : ""}`}
					onClick={() => command(item)}
					onMouseEnter={() => setSelectedIndex(index)}
				>
					<span className="text-text-3 mr-2 shrink-0 w-5 text-center">
						{item.type === "page" ? "📄" : "👤"}
					</span>
					<span className="truncate">{item.pageTitle}</span>
					{item.type === "person" && (
						<span className="ml-auto text-text-3 text-[11.5px] shrink-0">
							Person
						</span>
					)}
				</button>
			))}
		</div>
	);
}

/**
 * Creates a render function for the PageReference suggestion popup.
 * Uses React portal (createRoot) — NOT a conditional React sibling inside
 * .block-node — to avoid the tiptap-sibling-dom-crash on collab edits.
 */
export function createPageReferenceRender() {
	let root: ReturnType<typeof createRoot> | null = null;
	let popup: HTMLElement | null = null;

	return {
		onStart: (props: PageReferenceRenderProps) => {
			popup = document.createElement("div");
			popup.className = "absolute z-[50]";
			document.body.appendChild(popup);

			// Position near the cursor
			const coords = props.editor.view.coordsAtPos(props.range.from);
			if (coords) {
				popup.style.left = `${coords.left + window.scrollX}px`;
				popup.style.top = `${coords.bottom + window.scrollY + 4}px`;
			}

			root = createRoot(popup);
			root.render(<PageReferenceMenu props={props} />);
		},

		onUpdate: (props: PageReferenceRenderProps) => {
			if (!popup || !root) return;

			// Update position
			const coords = props.editor.view.coordsAtPos(props.range.from);
			if (coords) {
				popup.style.left = `${coords.left + window.scrollX}px`;
				popup.style.top = `${coords.bottom + window.scrollY + 4}px`;
			}

			root.render(<PageReferenceMenu props={props} />);
		},

		onKeyDown: (_props: { event: KeyboardEvent }) => {
			// Let the React component handle keyboard — it registers its own
			// document-level listener. We return true to prevent TipTap from
			// processing these keys and consuming the event.
			return true;
		},

		onExit: () => {
			if (popup && root) {
				root.unmount();
				popup.remove();
				popup = null;
				root = null;
			}
		},
	};
}
