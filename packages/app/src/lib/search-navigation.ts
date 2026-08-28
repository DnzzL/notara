/** What the palette can move to with the keyboard, whatever section drew it. */
export type SearchItem = {
	/** "recent" rows are pages you have been on; the others come from a query. */
	kind: "recent" | "page" | "block";
	id: string;
	pageId: string;
	title: string;
};

type RecentPage = { id: string; title: string };
type Result = { id: string; pageId: string; title: string };

/**
 * One list for the arrow keys and the highlight.
 *
 * They used to disagree: the flat list was empty while the query was empty —
 * the palette's default state, which shows recent pages — so ArrowDown clamped
 * the selection to -1 and Enter had nothing to open. The Recent and Pages
 * sections then each indexed from their own zero against the same
 * `selectedIndex`, so only row 0 ever highlighted correctly.
 *
 * Every rendered row must come from here, in this order, or the two drift apart
 * again.
 */
export function flattenSearchItems({
	query,
	recentPages,
	pageResults,
	blockResults,
}: {
	query: string;
	recentPages: readonly RecentPage[];
	pageResults: readonly Result[];
	blockResults: readonly Result[];
}): SearchItem[] {
	if (!query.trim())
		return recentPages.map((p) => ({
			kind: "recent" as const,
			id: p.id,
			pageId: p.id,
			title: p.title,
		}));

	return [
		...pageResults.map((r) => ({
			kind: "page" as const,
			id: r.id,
			pageId: r.pageId,
			title: r.title,
		})),
		...blockResults.map((r) => ({
			kind: "block" as const,
			id: r.id,
			pageId: r.pageId,
			title: r.title,
		})),
	];
}
