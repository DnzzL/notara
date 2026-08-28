import type { ReactNode, RefObject } from "react";

export type StripItem = {
	value: string;
	label: ReactNode;
	/** A trailing count, e.g. how many cards are in a board group. */
	count?: number;
	title?: string;
};

/**
 * The narrow-screen tab strip, shared by the field ruler, the board's group
 * strip and the agenda's date-field picker.
 *
 * It was hand-written three times, and all three copies were a tablist in
 * name only: no keyboard navigation, no `aria-controls`, every tab reachable
 * by Tab. This is a real tablist — roving tabindex, arrow keys, Home/End — so
 * the strip is one stop in the tab order and the arrows move within it, which
 * is what a screen reader user expects the role to promise.
 */
export function Strip({
	items,
	value,
	onChange,
	ariaLabel,
	panelId,
	stripRef,
}: {
	items: readonly StripItem[];
	value: string;
	onChange: (value: string) => void;
	ariaLabel: string;
	/** id of the list this strip drives, so `aria-controls` points somewhere. */
	panelId: string;
	stripRef?: RefObject<HTMLDivElement | null>;
}) {
	const index = items.findIndex((i) => i.value === value);

	const onKeyDown = (e: React.KeyboardEvent) => {
		const last = items.length - 1;
		const to =
			e.key === "ArrowRight"
				? Math.min(last, index + 1)
				: e.key === "ArrowLeft"
					? Math.max(0, index - 1)
					: e.key === "Home"
						? 0
						: e.key === "End"
							? last
							: null;
		if (to === null) return;
		e.preventDefault();
		const next = items[to];
		if (next) onChange(next.value);
	};

	return (
		<div
			className="db-strip"
			ref={stripRef}
			role="tablist"
			aria-label={ariaLabel}
			onKeyDown={onKeyDown}
		>
			{items.map((item, i) => {
				const active = i === index;
				return (
					<button
						type="button"
						key={item.value}
						role="tab"
						aria-selected={active}
						aria-controls={panelId}
						// Roving tabindex: the strip is one tab stop, arrows move inside.
						tabIndex={active ? 0 : -1}
						title={item.title}
						className={`db-strip-tab${active ? " is-active" : ""}`}
						onClick={() => onChange(item.value)}
					>
						{item.label}
						{item.count !== undefined && (
							<span className="db-strip-count">{item.count}</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
