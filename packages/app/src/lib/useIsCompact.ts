import { useEffect, useState } from "react";

/**
 * True on the narrow layout — the same 880px breakpoint the stylesheet uses.
 *
 * Almost all responsive behaviour in this app is CSS-only, and should stay
 * that way. This hook exists for the cases where narrow means a *different
 * component*, not a reflowed one — three so far, all in the database views:
 * the table becomes a field ruler, the board a group strip, the calendar an
 * agenda. None of those is a media query away from its desktop form. The
 * pickers in CellComponents.tsx use it too, to become sheets.
 *
 * Reach for CSS first; reach for this only when the markup differs.
 */
/**
 * The compact breakpoint, in px. CSS has the same number in its `@media` blocks;
 * a custom property cannot be used inside a media query, so this is the one
 * place to change it and `styles.css` has to follow.
 */
export const COMPACT_MAX_WIDTH = 880;

const QUERY = `(max-width: ${COMPACT_MAX_WIDTH}px)`;

export function useIsCompact(): boolean {
	const [compact, setCompact] = useState(
		() => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
	);

	useEffect(() => {
		const mql = window.matchMedia(QUERY);
		const onChange = (e: MediaQueryListEvent) => setCompact(e.matches);
		setCompact(mql.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	return compact;
}
