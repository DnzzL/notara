import { useId } from "react";
import { useStripNavigation } from "../../lib/useStripNavigation.js";
import { CellDisplay } from "./CellComponents.js";
import { Strip } from "./Strip.js";

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
	const {
		index: idx,
		select,
		stripRef,
		listProps,
		onRowActivate,
	} = useStripNavigation(groupOrder.length);
	const panelId = useId();

	const group = groupOrder[idx];
	const rows = group ? (groups[group] ?? []) : [];

	if (groupOrder.length === 0)
		return <div className="db-ruler-empty">No records yet.</div>;

	return (
		<div className="db-ruler">
			{/* Raw buttons on purpose, here and in the rows below: the strip is a
			    styled set (`.db-strip-tab`, with counts and an active rule) and the
			    cards are full-width list rows. Neither is one of ui/Button's
			    variants, and ui/Tabs cannot scroll horizontally or carry counts. */}
			<Strip
				stripRef={stripRef}
				ariaLabel={groupFieldName ?? "Group"}
				panelId={panelId}
				value={group ?? ""}
				onChange={(name) => select(groupOrder.indexOf(name))}
				items={groupOrder.map((name) => ({
					value: name,
					label: name,
					count: groups[name]?.length ?? 0,
				}))}
			/>

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
			<div {...listProps} id={panelId}>
				{rows.length === 0 && (
					<div className="db-ruler-empty">Nothing in this group.</div>
				)}
				{rows.map(({ record, values }) => (
					<button
						type="button"
						key={record.id}
						className="db-board-card"
						onClick={onRowActivate(() => onOpenRecord(record))}
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
