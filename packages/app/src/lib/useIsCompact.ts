import { useEffect, useState } from "react";

/**
 * True on the narrow layout — the same 880px breakpoint the stylesheet uses.
 *
 * Almost all responsive behaviour in this app is CSS-only, and should stay
 * that way. This hook exists for the cases where narrow means a *different
 * component*, not a reflowed one: the database table becomes the field ruler,
 * which is a different interaction model and cannot be expressed as a media
 * query. Reach for CSS first; reach for this only when the markup differs.
 */
const QUERY = "(max-width: 880px)";

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
