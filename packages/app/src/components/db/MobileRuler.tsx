import { fieldTypeSpec } from "@notara/shared";
import { useEffect, useId, useMemo, useState } from "react";
import {
	AGG_LABEL,
	type AggType,
	aggregate,
	supportsNumericAggregation,
} from "../../lib/aggregate.js";
import { useStripNavigation } from "../../lib/useStripNavigation.js";
import { CellDisplay, InlineCellEditor } from "./CellComponents.js";
import { Strip } from "./Strip.js";

/**
 * The database table, held in one hand.
 *
 * A table on a phone is a table you push sideways: the row you care about
 * scrolls out of view before the column you care about scrolls in. This flips
 * the axis — you navigate the *field*, not the row. The record list stays put
 * while a swipe (or a tap on the field strip) changes which column it shows,
 * so setting one property across thirty records is thirty taps in one place
 * instead of thirty round trips.
 *
 * Editing raises a bottom sheet around the same `InlineCellEditor` the desktop
 * table uses, so per-type behaviour (option lists, relation pickers, date
 * parsing) has exactly one implementation.
 */

const TYPE_GLYPH: Record<string, string> = {
	text: "Aa",
	number: "#",
	select: "◉",
	multiSelect: "◈",
	date: "▤",
	checkbox: "☑",
	relation: "⇄",
	page: "▸",
	formula: "ƒ",
	people: "☺",
};

type Row = { record: any; values: Record<string, unknown> };

export function MobileRuler({
	fields,
	rows,
	databases,
	allRecords,
	onEdit,
	onOpenRecord,
	onNewRecord,
	footerAggs,
	onFooterAggChange,
}: {
	fields: any[];
	rows: Row[];
	databases: any[];
	allRecords: Record<string, any[]>;
	onEdit: (recordId: string, fieldId: string, value: string) => void;
	onOpenRecord: (record: any) => void;
	onNewRecord: () => void;
	footerAggs: Record<string, AggType>;
	onFooterAggChange: (key: string, agg: AggType) => void;
}) {
	const {
		index: idx,
		select,
		stripRef,
		listProps,
		onRowActivate,
	} = useStripNavigation(fields.length);
	const panelId = useId();
	const [editing, setEditing] = useState<{
		recordId: string;
		fieldId: string;
	} | null>(null);

	const field = fields[idx];
	// Read-only is a property of the field type (a formula computes itself),
	// exactly as in the desktop table — not a property of the database.
	const fieldReadOnly = field ? fieldTypeSpec(field.type).readOnly : true;

	// Same summary as the desktop table's column footer, one field at a time —
	// keyed by field.id so the choice is shared with the desktop tfoot.
	const footerAgg = field ? (footerAggs[field.id] ?? "none") : "none";
	const footerNumeric = field ? supportsNumericAggregation(field.type) : false;
	const footerResult = useMemo(
		() => (field ? aggregate(rows, field, footerAgg) : null),
		[rows, field, footerAgg],
	);
	const footerFormatted =
		typeof footerResult === "number"
			? footerResult.toLocaleString(undefined, { maximumFractionDigits: 2 })
			: "";

	useEffect(() => {
		if (!editing) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setEditing(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [editing]);

	if (fields.length === 0)
		return (
			<div className="db-ruler-empty">
				Empty database — add a property to get started.
			</div>
		);

	const editRow = editing
		? rows.find((r) => r.record.id === editing.recordId)
		: null;
	const editField = editing
		? fields.find((f) => f.id === editing.fieldId)
		: null;

	return (
		<div className="db-ruler">
			<Strip
				stripRef={stripRef}
				ariaLabel="Field"
				panelId={panelId}
				value={field?.id ?? ""}
				onChange={(id) => select(fields.findIndex((f) => f.id === id))}
				items={fields.map((f) => ({
					value: f.id,
					label: (
						<>
							<span className="g">{TYPE_GLYPH[f.type] ?? "•"}</span>
							{f.name}
						</>
					),
				}))}
			/>

			<div className="db-strip-caption">
				<span>
					field {idx + 1}/{fields.length}
				</span>
				<span>·</span>
				<span>{field?.type}</span>
				<span className="right">
					{rows.length} {rows.length === 1 ? "record" : "records"}
				</span>
				{/* No floating button: the page editor already owns the bottom-right
				    corner with its own add-block FAB, and two would overlap. */}
				<button type="button" className="db-strip-new" onClick={onNewRecord}>
					+ New
				</button>
			</div>

			{/* Swipe is an enhancement, not the only route: every field is also
			    reachable by tapping the strip above, which is a real tablist. */}
			<div {...listProps} id={panelId}>
				{rows.length === 0 && (
					<div className="db-ruler-empty">
						No records yet. Press New below to create one.
					</div>
				)}
				{rows.map(({ record, values }) => (
					<div className="db-ruler-row" key={record.id}>
						<button
							type="button"
							className="n"
							onClick={onRowActivate(() => onOpenRecord(record))}
						>
							{record.title || "Untitled"}
						</button>
						<button
							type="button"
							className="v"
							disabled={fieldReadOnly}
							onClick={onRowActivate(() => {
								if (fieldReadOnly || !field) return;
								setEditing({ recordId: record.id, fieldId: field.id });
							})}
						>
							{field && (
								<CellDisplay
									field={field}
									value={values[field.name] ?? ""}
									databases={databases}
									allRecords={allRecords}
									recordValues={values}
								/>
							)}
						</button>
					</div>
				))}
			</div>

			{field && (
				<div className="db-ruler-footer">
					{footerAgg === "none" ? (
						<span className="calc">Calculate</span>
					) : (
						<span className="result">
							<span className="label">{AGG_LABEL[footerAgg]}</span>
							{footerFormatted}
						</span>
					)}
					<select
						name="mobile-column-summary"
						value={footerAgg}
						onChange={(e) =>
							onFooterAggChange(field.id, e.target.value as AggType)
						}
						title="Summary"
						aria-label={`Summary for ${field.name}`}
					>
						<option value="none">Calculate</option>
						<option value="count">Count all</option>
						<option value="filled">Count values</option>
						<option value="empty">Count empty</option>
						{footerNumeric && <option value="sum">Sum</option>}
						{footerNumeric && <option value="avg">Average</option>}
						{footerNumeric && <option value="min">Min</option>}
						{footerNumeric && <option value="max">Max</option>}
					</select>
				</div>
			)}

			{editing && editRow && editField && (
				<>
					<button
						type="button"
						className="db-sheet-scrim"
						aria-label="Close editor"
						onClick={() => setEditing(null)}
					/>
					<div
						className="db-sheet"
						role="dialog"
						aria-label={`Edit ${editField.name}`}
					>
						<div className="db-sheet-grab" />
						<div className="db-sheet-head">
							<span className="f">
								<span className="db-type-glyph">
									{TYPE_GLYPH[editField.type] ?? "•"}
								</span>{" "}
								{editField.name}
							</span>
							<span className="r">{editRow.record.title || "Untitled"}</span>
						</div>
						{/* db-cell is the anchor CellComponents' popovers position against. */}
						<div className="db-cell db-sheet-slot">
							<InlineCellEditor
								field={editField}
								value={editRow.values[editField.name] ?? ""}
								allRecords={allRecords}
								onSave={(v) => {
									onEdit(editRow.record.id, editField.id, v);
									setEditing(null);
								}}
								onCancel={() => setEditing(null)}
							/>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
