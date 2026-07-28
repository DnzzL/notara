import type { Database, DatabaseField, DatabaseView } from "@notara/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../rpc-client.js";
import { useDatabaseStore } from "../../stores/databaseStore.js";
import type { BlockRendererProps } from "./renderer-registry.js";
import { tryParseBlockContent } from "./renderer-registry.js";

interface ViewReferenceData {
	databaseId: string;
	viewId: string;
}

interface ViewConfig {
	filters: Array<{ fieldId: string; operator: string; value: string }>;
	sorts: Array<{ fieldId: string; order: "asc" | "desc" }>;
	boardHidden: string[];
}

type ViewType = "table" | "board" | "calendar";

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
	const [viewCfg, setViewCfg] = useState<ViewConfig | null>(null);
	const [viewType, setViewType] = useState<ViewType | null>(null);
	const [groupByFieldId, setGroupByFieldId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// Picker state
	const [pickerOpen, setPickerOpen] = useState(!cfg);
	const [selectedDbId, setSelectedDbId] = useState(cfg?.databaseId ?? "");
	const [selectedViewId, setSelectedViewId] = useState(cfg?.viewId ?? "");

	// Load available databases for the picker
	useEffect(() => {
		api
			.listAllDatabases()
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

	/** Re-fetch the full view definition from the source and apply its config. */
	const applyViewConfig = useCallback(
		(view: {
			id: string;
			type: string;
			groupByFieldId: string | null;
			config: string;
		}) => {
			let config: ViewConfig = { filters: [], sorts: [], boardHidden: [] };
			try {
				const parsed = JSON.parse(view.config);
				config = {
					filters: Array.isArray(parsed.filters) ? parsed.filters : [],
					sorts: Array.isArray(parsed.sorts) ? parsed.sorts : [],
					boardHidden: Array.isArray(parsed.boardHidden)
						? parsed.boardHidden
						: [],
				};
			} catch {
				/* no config */
			}
			setViewType(view.type as ViewType);
			setGroupByFieldId(view.groupByFieldId);
			setViewCfg(config);
		},
		[],
	);

	/**
	 * Subscribe to live config changes from the source view via SSE.
	 * When the view's config/type/groupBy changes on the server, the event
	 * triggers a lightweight re-fetch — records, fields, and full re-parsing.
	 */
	useEffect(() => {
		if (!cfg) return;

		const url = `/api/stream/view-config?databaseId=${encodeURIComponent(cfg.databaseId)}&viewId=${encodeURIComponent(cfg.viewId)}`;
		const source = new EventSource(url, { withCredentials: true });

		source.addEventListener("view.configChanged", () => {
			// Re-fetch the view config and refresh filter/sort/type from source
			api
				.listViews({ databaseId: cfg.databaseId })
				.then((views) => {
					const view = views.find((v) => v.id === cfg.viewId);
					if (!view) {
						setError("View not found");
						return;
					}
					applyViewConfig(view);
				})
				.catch(() => {});
		});

		return () => {
			source.close();
		};
	}, [cfg, applyViewConfig]);

	// Load the referenced view's data
	useEffect(() => {
		if (!cfg) return;

		const load = async () => {
			setLoading(true);
			setError(null);
			try {
				const dbs = await api.listAllDatabases();
				const db = dbs.find((d) => d.id === cfg.databaseId);
				if (!db) {
					setError("Database not found");
					setLoading(false);
					return;
				}

				// Check viewer access to the source database's page
				const permCheck = await api.checkPagePermission({
					pageId: db.pageId,
					relation: "viewer",
				});
				if (!permCheck.allowed) {
					setError("You don't have access to the source page");
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

				// Parse the view config centrally, apply filters + sorts
				applyViewConfig(view);
				let config: ViewConfig = { filters: [], sorts: [], boardHidden: [] };
				try {
					const parsed = JSON.parse(view.config);
					config = {
						filters: Array.isArray(parsed.filters) ? parsed.filters : [],
						sorts: Array.isArray(parsed.sorts) ? parsed.sorts : [],
						boardHidden: Array.isArray(parsed.boardHidden)
							? parsed.boardHidden
							: [],
					};
				} catch {
					/* no config */
				}

				setViewType(view.type as ViewType);
				setGroupByFieldId(view.groupByFieldId);
				setViewCfg(config);

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
	}, [
		cfg, // Parse the view config centrally, apply filters + sorts
		applyViewConfig,
	]);

	const handleConfirmPicker = useCallback(async () => {
		if (!selectedDbId || !selectedViewId) return;
		await onUpdateBlock(
			block.id,
			JSON.stringify({ databaseId: selectedDbId, viewId: selectedViewId }),
		);
		setPickerOpen(false);
	}, [selectedDbId, selectedViewId, block.id, onUpdateBlock]);

	// ── Apply filters and sorts from the view config ───────────────────────
	const processedRecords = useMemo(() => {
		if (!viewCfg || records.length === 0) return records;

		let result = [...records];

		// Apply filters — look up field name from fieldId to check against values
		if (viewCfg.filters.length > 0) {
			result = result.filter(({ values }) => {
				return viewCfg.filters.every((f) => {
					const filterField = fields.find((ff) => ff.id === f.fieldId);
					const val =
						values?.[filterField?.name ?? ""] ?? values?.[f.fieldId] ?? "";
					switch (f.operator) {
						case "equals":
						case "is":
							return String(val).toLowerCase() === f.value.toLowerCase();
						case "contains":
							return String(val).toLowerCase().includes(f.value.toLowerCase());
						case "startsWith":
							return String(val)
								.toLowerCase()
								.startsWith(f.value.toLowerCase());
						case "notEmpty":
							return val !== "" && val != null;
						case "isEmpty":
							return val === "" || val == null;
						default:
							return true;
					}
				});
			});
		}

		// Apply sorts
		if (viewCfg.sorts.length > 0) {
			result.sort((a, b) => {
				for (const s of viewCfg.sorts) {
					const field = fields.find(
						(f) => f.id === s.fieldId || f.name === s.fieldId,
					);
					if (!field) continue;
					const aVal = a.values?.[field.name] ?? a.record?.title ?? "";
					const bVal = b.values?.[field.name] ?? b.record?.title ?? "";
					const cmp =
						typeof aVal === "number" && typeof bVal === "number"
							? aVal - bVal
							: String(aVal).localeCompare(String(bVal));
					if (cmp !== 0) return s.order === "desc" ? -cmp : cmp;
				}
				return 0;
			});
		}

		return result;
	}, [records, viewCfg, fields]);

	// ── Picker ─────────────────────────────────────────────────────────────
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

	// ── Error / Loading ────────────────────────────────────────────────────
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

	// ── Read-only rendering by view type ───────────────────────────────────
	const titleField = fields.length > 0 ? fields[0] : null;
	const dataFields = fields.slice(1);

	if (viewType === "board") {
		// Board view: group records by the groupBy field
		const groupField = groupByFieldId
			? fields.find((f) => f.id === groupByFieldId)
			: null;
		const groups = new Map<string, typeof processedRecords>();
		for (const r of processedRecords) {
			const key = groupField
				? String(r.values?.[groupField.name] ?? r.record?.title ?? "No group")
				: "Records";
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)?.push(r);
		}

		return (
			<div
				className="flex gap-3 overflow-x-auto my-1 pb-2"
				data-block-id={block.id}
			>
				{Array.from(groups.entries()).map(([group, groupRecords]) => (
					<div
						key={group}
						className="bg-surface-2 border border-border rounded-lg min-w-[220px] max-w-[300px] shrink-0"
					>
						<div className="px-2.5 py-1.5 text-[12px] font-semibold text-text-3 uppercase tracking-wider border-b border-border truncate">
							{group}
							<span className="ml-1.5 text-text-3 font-normal">
								{groupRecords.length}
							</span>
						</div>
						<div className="p-1.5 space-y-1">
							{groupRecords.length === 0 && (
								<div className="text-text-3 text-[12px] px-2 py-2 text-center">
									No records
								</div>
							)}
							{groupRecords.map(({ record, values }: any) => (
								<div
									key={record?.id}
									className="bg-surface border border-border rounded px-2.5 py-2 text-[13px] cursor-default hover:bg-surface-3 transition-colors"
								>
									<div className="font-medium text-text truncate">
										{record?.title || "Untitled"}
									</div>
									{dataFields.length > 0 && (
										<div className="text-[11px] text-text-3 mt-0.5 truncate">
											{dataFields
												.slice(0, 2)
												.map((f) => String(values?.[f.name] ?? ""))
												.filter(Boolean)
												.join(" \u00b7 ")}
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		);
	}

	if (viewType === "calendar") {
		// Calendar view: group records by earliest date field
		const dateField = fields.find((f) => f.type === "date");
		const monthGroups = new Map<string, typeof processedRecords>();
		for (const r of processedRecords) {
			const dateStr = dateField ? String(r.values?.[dateField.name] ?? "") : "";
			const monthKey = dateStr ? dateStr.slice(0, 7) : "No date";
			if (!monthGroups.has(monthKey)) monthGroups.set(monthKey, []);
			monthGroups.get(monthKey)?.push(r);
		}

		return (
			<div className="my-1 space-y-3" data-block-id={block.id}>
				{Array.from(monthGroups.entries()).map(([month, monthRecords]) => (
					<div key={month}>
						<div className="text-[13px] font-semibold text-text-2 px-1 py-1">
							{month === "No date" ? "No date" : month}
							<span className="ml-1.5 text-text-3 font-normal text-[12px]">
								{monthRecords.length}
							</span>
						</div>
						<div className="space-y-0.5">
							{monthRecords.map(({ record, values }: any) => (
								<div
									key={record?.id}
									className="flex items-center gap-2 px-2 py-1 text-[13px] hover:bg-surface-2 rounded transition-colors"
								>
									<div className="w-2 h-2 rounded-full bg-accent-dim shrink-0" />
									<span className="text-text truncate">
										{record?.title || "Untitled"}
									</span>
									{dateField && (
										<span className="text-text-3 text-[11px] shrink-0 ml-auto">
											{String(values?.[dateField.name] ?? "")}
										</span>
									)}
								</div>
							))}
						</div>
					</div>
				))}
				{processedRecords.length === 0 && (
					<div className="text-text-3 text-[13px] text-center py-4">
						No records found
					</div>
				)}
			</div>
		);
	}

	// Default: read-only table (also used when viewType is unknown)
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
					{processedRecords.map(({ record, values }: any) => (
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
					{processedRecords.length === 0 && (
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
