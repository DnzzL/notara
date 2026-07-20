import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../../rpc-client.js";
import { useDatabaseStore } from "../../stores/databaseStore.js";
import { tryParseBlockContent } from "./renderer-registry.js";
import type { BlockRendererProps } from "./renderer-registry.js";
import type { Database, DatabaseField, DatabaseView } from "@notara/shared";

export interface ViewReferenceData {
	databaseId: string;
	viewId: string;
}

/**
 * A block that renders a saved database view from another page in read-only
 * mode.  The view definition stays centralized on the source database.
 */
export function ViewReferenceBlock({
	block,
	onUpdateBlock,
}: BlockRendererProps) {
	const cfg = tryParseBlockContent<ViewReferenceData>(block.content);
	const [databases, setDatabases] = useState<Database[]>([]);
	const [dbViews, setDbViews] = useState<DatabaseView[]>([]);
	const [fields, setFields] = useState<DatabaseField[]>([]);
	const [records, setRecords] = useState<any[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// Picker state
	const [pickerOpen, setPickerOpen] = useState(!cfg);
	const [selectedDbId, setSelectedDbId] = useState(cfg?.databaseId ?? "");
	const [selectedViewId, setSelectedViewId] = useState(cfg?.viewId ?? "");

	// Load available databases for the picker
	useEffect(() => {
		api
			.listDatabases({ pageId: "" })
			.then(setDatabases)
			.catch(() => {});
	}, []);

	// Load views for the selected database
	useEffect(() => {
		if (!selectedDbId) {
			setDbViews([]);
			return;
		}
		const views = useDatabaseStore.getState().dbViewsByDb[selectedDbId];
		if (views) {
			setDbViews(views);
			return;
		}
		useDatabaseStore
			.getState()
			.loadDbViews(selectedDbId)
			.then(() => {
				const v = useDatabaseStore.getState().dbViewsByDb[selectedDbId];
				if (v) setDbViews(v);
			});
	}, [selectedDbId]);

	// Load the referenced view's data
	useEffect(() => {
		if (!cfg) return;

		const load = async () => {
			setLoading(true);
			setError(null);
			try {
				// Load database info
				const dbs = await api.listDatabases({ pageId: "" });
				const db = dbs.find((d) => d.id === cfg.databaseId);
				if (!db) {
					setError("Database not found");
					setLoading(false);
					return;
				}

				// Load view info
				const views = await api.listViews({ databaseId: cfg.databaseId });
				const view = views.find((v) => v.id === cfg.viewId);
				if (!view) {
					setError("View not found");
					setLoading(false);
					return;
				}

				// Load fields and records
				const [loadedFields, loadedRecords] = await Promise.all([
					api.listFields({ databaseId: cfg.databaseId }),
					api.listRecordsWithValues({ databaseId: cfg.databaseId }),
				]);
				setFields(loadedFields);
				setRecords(loadedRecords);
				setDbViews(views);
			} catch (err: any) {
				setError(err?.message || "Failed to load view");
			}
			setLoading(false);
		};
		load();
	}, [cfg]);

	const handleConfirmPicker = useCallback(async () => {
		if (!selectedDbId || !selectedViewId) return;
		await onUpdateBlock(
			block.id,
			JSON.stringify({ databaseId: selectedDbId, viewId: selectedViewId }),
		);
		setPickerOpen(false);
	}, [selectedDbId, selectedViewId, block.id, onUpdateBlock]);

	if (pickerOpen) {
		return (
			<div
				className="bg-surface border border-border rounded-lg p-3 my-1"
				data-block-id={block.id}
			>
				<div className="text-[13px] font-medium mb-2">
					Reference a saved view
				</div>
				<select
					name="view-ref-db"
					value={selectedDbId}
					onChange={(e) => {
						setSelectedDbId(e.target.value);
						setSelectedViewId("");
					}}
					className="w-full mb-1.5 border border-border rounded px-2 py-1.5 text-[13px] bg-surface-2 text-text outline-none"
				>
					<option value="">Select a database\u2026</option>
					{databases.map((db) => (
						<option key={db.id} value={db.id}>
							{db.name || "Untitled"}
						</option>
					))}
				</select>
				<select
					name="view-ref-view"
					value={selectedViewId}
					onChange={(e) => setSelectedViewId(e.target.value)}
					className="w-full mb-2 border border-border rounded px-2 py-1.5 text-[13px] bg-surface-2 text-text outline-none"
					disabled={!selectedDbId}
				>
					<option value="">Select a view\u2026</option>
					{dbViews.map((v) => (
						<option key={v.id} value={v.id}>
							{v.name}
						</option>
					))}
				</select>
				<div className="flex gap-1.5 justify-end">
					<button
						className="bg-transparent border border-border rounded px-2 py-1 text-[12px] cursor-pointer text-text-2 hover:bg-surface-3"
						onClick={() => setPickerOpen(false)}
					>
						Cancel
					</button>
					<button
						className="bg-accent text-white border-none rounded px-2 py-1 text-[12px] cursor-pointer hover:opacity-90 disabled:opacity-50"
						disabled={!selectedDbId || !selectedViewId}
						onClick={handleConfirmPicker}
					>
						Insert
					</button>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div
				className="border border-border rounded-lg p-4 my-1 bg-surface-2 text-text-3 text-[13px] text-center"
				data-block-id={block.id}
			>
				<div className="mb-1">🔒</div>
				<div>{error}</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div
				className="border border-border rounded-lg p-4 my-1 bg-surface-2 text-text-3 text-[13px] text-center"
				data-block-id={block.id}
			>
				Loading\u2026
			</div>
		);
	}

	// Read-only table rendering
	const titleField = fields.length > 0 ? fields[0] : null;
	const dataFields = fields.slice(1);

	return (
		<div className="overflow-x-auto my-1" data-block-id={block.id}>
			<table className="w-full border-collapse text-[13px]">
				<thead>
					<tr>
						{titleField && (
							<th className="text-left font-medium text-text-3 text-[11px] uppercase tracking-wider px-2 py-1.5 border-b border-border">
								{titleField.name}
							</th>
						)}
						{dataFields.map((f) => (
							<th
								key={f.id}
								className="text-left font-medium text-text-3 text-[11px] uppercase tracking-wider px-2 py-1.5 border-b border-border"
							>
								{f.name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{records.map(({ record, values }: any) => (
						<tr
							key={record?.id}
							className="hover:bg-surface-2 transition-colors"
						>
							{titleField && (
								<td className="px-2 py-1.5 border-b border-border text-text max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
									{record?.title || ""}
								</td>
							)}
							{dataFields.map((f) => {
								const val = values?.[f.name] ?? "";
								return (
									<td
										key={f.id}
										className="px-2 py-1.5 border-b border-border text-text-2 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap"
									>
										{String(val)}
									</td>
								);
							})}
						</tr>
					))}
					{records.length === 0 && (
						<tr>
							<td
								colSpan={fields.length}
								className="text-center text-text-3 text-[12px] py-4"
							>
								No records found
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
