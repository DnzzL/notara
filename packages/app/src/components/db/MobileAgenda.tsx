import { useId } from "react";
import {
	type AgendaRow,
	buildAgenda,
	formatAgendaDay,
} from "../../lib/agenda.js";
import { CellDisplay } from "./CellComponents.js";
import { Strip } from "./Strip.js";

/**
 * The calendar, held in one hand.
 *
 * A month grid at 390px gives 50px cells: room for a number and nothing else,
 * so you can see that something is happening but not what. The narrow layout
 * is an agenda instead — days in order, records under their day, undated ones
 * last. You lose the shape of the month and gain the ability to read it.
 *
 * Grouping lives in lib/agenda.ts and is tested there.
 */

export function MobileAgenda({
	rows,
	dateFields,
	dateField,
	onPickDateField,
	visibleFields,
	databases,
	allRecords,
	onOpenRecord,
	onNewRecord,
}: {
	rows: AgendaRow[];
	dateFields: any[];
	dateField: any | null;
	onPickDateField: (id: string) => void;
	/** Properties shown beside a row's title. Keep it short — this is 390px. */
	visibleFields: any[];
	databases: any[];
	allRecords: Record<string, any[]>;
	onOpenRecord: (record: any) => void;
	onNewRecord: () => void;
}) {
	const panelId = useId();
	const groups = buildAgenda(rows, dateField?.name ?? null);
	const today = new Date();
	const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

	return (
		<div className="db-ruler">
			{dateFields.length > 1 && (
				<Strip
					ariaLabel="Date field"
					panelId={panelId}
					value={dateField?.id ?? ""}
					onChange={onPickDateField}
					items={dateFields.map((f: any) => ({
						value: f.id,
						label: (
							<>
								<span className="g">▤</span>
								{f.name}
							</>
						),
					}))}
				/>
			)}

			<div className="db-strip-caption">
				<span>agenda</span>
				<span>·</span>
				<span>{dateField ? dateField.name : "no date field"}</span>
				<span className="right">
					{rows.length} {rows.length === 1 ? "record" : "records"}
				</span>
				<button type="button" className="db-strip-new" onClick={onNewRecord}>
					+ New
				</button>
			</div>

			<div id={panelId}>
				{groups.length === 0 && (
					<div className="db-ruler-empty">No records yet.</div>
				)}

				{groups.map((g) => (
					<section className="db-agenda-day" key={g.day ?? "__undated__"}>
						<h3 className={g.day === todayKey ? "is-today" : undefined}>
							{g.day ? formatAgendaDay(g.day) : "No date"}
							<span>{g.rows.length}</span>
						</h3>
						{g.rows.map(({ record, values }) => (
							<button
								type="button"
								key={record.id}
								className="db-agenda-row"
								onClick={() => onOpenRecord(record)}
							>
								<span className="t">{record.title || "Untitled"}</span>
								<span className="f">
									{visibleFields.map((f: any) => {
										const val = values[f.name];
										if (!val && f.type !== "checkbox") return null;
										return (
											<CellDisplay
												key={f.id}
												field={f}
												value={val ?? ""}
												databases={databases}
												allRecords={allRecords}
												recordValues={values}
											/>
										);
									})}
								</span>
							</button>
						))}
					</section>
				))}
			</div>
		</div>
	);
}
