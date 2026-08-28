import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Arrow-key navigation for a popover menu.
 *
 * Six menus in this app render a list of choices and handle no keys at all —
 * open one and the keyboard has nowhere to go, because the trigger that opened
 * it keeps focus and nothing below is reachable. `SlashMenu` had this right and
 * everything else copied its markup without its behaviour.
 *
 * Listens on `document` in the capture phase for the same reason SlashMenu
 * does: the menu is a portal over an editor that also wants arrow keys, and the
 * menu must win while it is open.
 *
 * The caller owns the items; this owns the cursor.
 */
export function useMenuKeyboard({
	count,
	onSelect,
	onClose,
	enabled = true,
}: {
	count: number;
	onSelect: (index: number) => void;
	onClose?: () => void;
	enabled?: boolean;
}) {
	const [index, setIndex] = useState(0);
	const itemRefs = useRef<(HTMLElement | null)[]>([]);

	// A menu can be filtered while open; never point past the end.
	useEffect(() => {
		setIndex((c) => (count === 0 ? 0 : Math.min(c, count - 1)));
	}, [count]);

	useEffect(() => {
		itemRefs.current[index]?.scrollIntoView({ block: "nearest" });
	}, [index]);

	const onKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!enabled || count === 0) return;
			const stop = () => {
				e.preventDefault();
				e.stopPropagation();
			};
			switch (e.key) {
				case "ArrowDown":
					stop();
					setIndex((c) => (c + 1) % count);
					break;
				case "ArrowUp":
					stop();
					setIndex((c) => (c - 1 + count) % count);
					break;
				case "Home":
					stop();
					setIndex(0);
					break;
				case "End":
					stop();
					setIndex(count - 1);
					break;
				case "Enter":
					stop();
					onSelect(index);
					break;
				case "Escape":
					stop();
					onClose?.();
					break;
			}
		},
		[enabled, count, index, onSelect, onClose],
	);

	useEffect(() => {
		if (!enabled) return;
		document.addEventListener("keydown", onKeyDown, true);
		return () => document.removeEventListener("keydown", onKeyDown, true);
	}, [enabled, onKeyDown]);

	/** Spread onto each row: marks the cursor and keeps hover and keys in sync. */
	const itemProps = (i: number) => ({
		ref: (el: HTMLElement | null) => {
			itemRefs.current[i] = el;
		},
		"data-active": i === index ? true : undefined,
		onMouseEnter: () => setIndex(i),
	});

	return { index, setIndex, itemProps };
}
