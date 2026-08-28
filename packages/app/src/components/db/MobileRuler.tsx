import { fieldTypeSpec } from "@notara/shared";
import { useEffect, useState } from "react";
import { useStripNavigation } from "../../lib/useStripNavigation.js";
import { CellDisplay, InlineCellEditor } from "./CellComponents.js";

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
}: {
	fields: any[];
	rows: Row[];
	databases: any[];
	allRecords: Record<string, any[]>;
	onEdit: (recordId: string, fieldId: string, value: string) => void;
	onOpenRecord: (record: any) => void;
	onNewRecord: () => void;
}) {
	const {
		index: idx,
		select,
		stripRef,
		listProps,
		onRowActivate,
	} = useStripNavigation(fields.length);
	const [editing, setEditing] = useState<{
		recordId: string;
		fieldId: string;
	} | null>(null);

	const field = fields[idx];
	// Read-only is a property of the field type (a formula computes itself),
	// exactly as in the desktop table — not a property of the database.
	const fieldReadOnly = field ? fieldTypeSpec(field.type).readOnly : true;

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
			<div className="db-strip" ref={stripRef} role="tablist">
				{fields.map((f, i) => (
					<button
						type="button"
						key={f.id}
						role="tab"
						aria-selected={i === idx}
						className={`db-strip-tab${i === idx ? " is-active" : ""}`}
						onClick={() => select(i)}
					>
						<span className="g">{TYPE_GLYPH[f.type] ?? "•"}</span>
						{f.name}
					</button>
				))}
			</div>

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
			<div {...listProps}>
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
