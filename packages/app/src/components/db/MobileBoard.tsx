import { useCallback, useEffect, useRef, useState } from "react";
import { CellDisplay } from "./CellComponents.js";

/**
 * The board, held in one hand.
 *
 * A kanban on a phone is columns you push sideways, which means the card you
 * want and the column you want are never on screen together. This uses the
 * same move as the field ruler: you navigate the *group*, and the cards for
 * that group get the full width. Swipe the list or tap the strip.
 *
 * Cards are read-only here. Editing a value goes through the record, which is
 * one tap away — dragging a card between columns is a pointer gesture that has
 * no honest thumb equivalent at this width.
 */

type Row = { record: any; values: Record<string, unknown> };

const SWIPE_THRESHOLD = 56;

export function MobileBoard({
	groupOrder,
	groups,
	groupFieldName,
	visibleFields,
	databases,
	allRecords,
	onOpenRecord,
	onNewRecord,
}: {
	groupOrder: string[];
	groups: Record<string, Row[]>;
	/** Null when the board has no group-by field and everything is one column. */
	groupFieldName: string | null;
	/** Fields shown on a card, already filtered by the board's hidden-field set. */
	visibleFields: any[];
	databases: any[];
	allRecords: Record<string, any[]>;
	onOpenRecord: (record: any) => void;
	onNewRecord: (groupName: string) => void;
}) {
	const [idx, setIdx] = useState(0);
	const stripRef = useRef<HTMLDivElement>(null);
	const startX = useRef<number | null>(null);

	const group = groupOrder[idx];
	const rows = group ? (groups[group] ?? []) : [];

	useEffect(() => {
		if (idx > groupOrder.length - 1) setIdx(Math.max(0, groupOrder.length - 1));
	}, [groupOrder.length, idx]);

	const step = useCallback(
		(delta: number) =>
			setIdx((c) => Math.min(groupOrder.length - 1, Math.max(0, c + delta))),
		[groupOrder.length],
	);

	useEffect(() => {
		stripRef.current
			?.querySelectorAll<HTMLElement>(".db-strip-tab")
			[idx]?.scrollIntoView({ inline: "center", block: "nearest" });
	}, [idx]);

	if (groupOrder.length === 0)
		return <div className="db-ruler-empty">No records yet.</div>;

	return (
		<div className="db-ruler">
			<div className="db-strip" ref={stripRef} role="tablist">
				{groupOrder.map((name, i) => (
					<button
						type="button"
						key={name}
						role="tab"
						aria-selected={i === idx}
						className={`db-strip-tab${i === idx ? " is-active" : ""}`}
						onClick={() => setIdx(i)}
					>
						{name}
						<span className="db-strip-count">{groups[name]?.length ?? 0}</span>
					</button>
				))}
			</div>

			<div className="db-strip-caption">
				<span>
					{groupFieldName ? `${groupFieldName} ` : ""}
					{idx + 1}/{groupOrder.length}
				</span>
				<span className="right">
					{rows.length} {rows.length === 1 ? "card" : "cards"}
				</span>
				<button
					type="button"
					className="db-strip-new"
					onClick={() => group && onNewRecord(group)}
				>
					+ New
				</button>
			</div>

			{/* Swipe is an enhancement: every group is also reachable from the
			    strip above, which is a real tablist. */}
			<div
				className="db-board-list"
				onPointerDown={(e) => {
					startX.current = e.clientX;
				}}
				onPointerUp={(e) => {
					const from = startX.current;
					startX.current = null;
					if (from === null) return;
					const dx = e.clientX - from;
					if (Math.abs(dx) > SWIPE_THRESHOLD) step(dx < 0 ? 1 : -1);
				}}
			>
				{rows.length === 0 && (
					<div className="db-ruler-empty">Nothing in this group.</div>
				)}
				{rows.map(({ record, values }) => (
					<button
						type="button"
						key={record.id}
						className="db-board-card"
						onClick={() => onOpenRecord(record)}
					>
						<span className="t">{record.title || "Untitled"}</span>
						<span className="f">
							{visibleFields.map((f: any) => {
								// An empty property is not information. The desktop card
								// drops it too; a label with nothing after it is worse
								// than nothing at all at this width.
								const val = values[f.name];
								if (!val && f.type !== "checkbox") return null;
								return (
									<span className="p" key={f.id}>
										<i>{f.name}</i>
										<CellDisplay
											field={f}
											value={val ?? ""}
											databases={databases}
											allRecords={allRecords}
											recordValues={values}
										/>
									</span>
								);
							})}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
