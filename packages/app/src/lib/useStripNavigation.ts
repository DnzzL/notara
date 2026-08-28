import {
	type PointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

/** Horizontal travel, in px, that counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 56;

/**
 * The narrow-screen strip: a tab bar plus a swipeable list below it.
 *
 * Shared by the table's field ruler and the board's group strip, which navigate
 * the same way — the list stays put, the strip changes what it shows.
 *
 * The reason this is a hook rather than duplicated state: the swipe has to
 * suppress the tap that ends it. Rows are buttons, so without `rowProps` a
 * swipe that starts and ends over a row both changes the column *and* opens
 * that row's record.
 */
export function useStripNavigation(count: number) {
	const [index, setIndex] = useState(0);
	const stripRef = useRef<HTMLDivElement>(null);
	const startX = useRef<number | null>(null);
	const swiped = useRef(false);

	// A field or group can be removed while it is the active one.
	useEffect(() => {
		if (index > count - 1) setIndex(Math.max(0, count - 1));
	}, [count, index]);

	// Keep the active tab in view when the change came from a swipe, not a tap.
	useEffect(() => {
		stripRef.current
			?.querySelectorAll<HTMLElement>(".db-strip-tab")
			[index]?.scrollIntoView({ inline: "center", block: "nearest" });
	}, [index]);

	const select = useCallback((next: number) => {
		swiped.current = false;
		setIndex(next);
	}, []);

	const listProps = {
		onPointerDown: (e: PointerEvent) => {
			startX.current = e.clientX;
			swiped.current = false;
		},
		onPointerUp: (e: PointerEvent) => {
			const from = startX.current;
			startX.current = null;
			if (from === null) return;
			const dx = e.clientX - from;
			if (Math.abs(dx) <= SWIPE_THRESHOLD) return;
			swiped.current = true;
			setIndex((c) => Math.min(count - 1, Math.max(0, c + (dx < 0 ? 1 : -1))));
		},
	};

	/** Wrap a row handler so it is skipped when the click closed a swipe. */
	const onRowActivate = useCallback(
		(handler: () => void) => (e: React.MouseEvent) => {
			if (swiped.current) {
				e.preventDefault();
				return;
			}
			handler();
		},
		[],
	);

	return { index, select, stripRef, listProps, onRowActivate };
}
