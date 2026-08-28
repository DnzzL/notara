import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	horizontalListSortingStrategy,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fieldTypeSpec } from "@notara/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type AggType,
	aggregate,
	supportsNumericAggregation,
} from "../lib/aggregate.js";
import { applyFiltersAndSorts } from "../lib/filterEngine.js";
import { useIsCompact } from "../lib/useIsCompact.js";
import { api } from "../rpc-client.js";
import {
	selectActiveViewId,
	selectDbViews,
	selectFields,
	selectFilters,
	selectRecords,
	selectSorts,
	useDatabaseStore,
} from "../stores/databaseStore.js";
import { usePageStore } from "../stores/pageStore.js";
import { toaster } from "../toaster.js";
import { BoardView } from "./db/BoardView.js";
import { CalendarView } from "./db/CalendarView.js";
import { CellDisplay, InlineCellEditor, Popover } from "./db/CellComponents.js";
import {
	AddFieldPopover,
	ColumnHeader,
	type FieldType,
	FormulaEditor,
	getDefaultWidthForType,
	OptionsEditor,
} from "./db/FieldComponents.js";
import { MobileRuler } from "./db/MobileRuler.js";
import { FilterBar, makeDefaultFilter, SortBar } from "./db/QueryBar.js";
import { RecordPanel } from "./db/RecordPanel.js";
import { ViewSwitcher } from "./db/ViewSwitcher.js";
import { VIEW_TYPES, type ViewType } from "./db/viewTypes.js";
import { Button, IconButton, MenuItem } from "./ui/index.js";
import { Tabs } from "./ui/Tabs.js";

const COL_WIDTHS_STORAGE_KEY_PREFIX = "db-col-widths:";
/** Sentinel field id for the record-title column in focus navigation. */
const TITLE_COL = "__title__";

// ── Column Footer (summary aggregations, à la Notion) ───────────────────────

const AGG_LABEL: Record<AggType, string> = {
	none: "Calculate",
	count: "Count",
	filled: "Filled",
	empty: "Empty",
	sum: "Sum",
	avg: "Average",
	min: "Min",
	max: "Max",
};

/** Number-capable field types get the numeric aggregations (sum/avg/min/max). */
function ColumnFooter({
	field,
	rows,
	agg,
	onChange,
	isTitle = false,
}: {
	field: { id: string; name: string; type: string; formula?: string | null };
	rows: { record: any; values: Record<string, unknown> }[];
	agg: AggType;
	onChange: (a: AggType) => void;
	isTitle?: boolean;
}) {
	const numeric = !isTitle && supportsNumericAggregation(field.type);

	const result = useMemo(
		() => aggregate(rows, field, agg, isTitle),
		[agg, rows, field, isTitle],
	);

	const formatted =
		typeof result === "number"
			? result.toLocaleString(undefined, { maximumFractionDigits: 2 })
			: "";

	return (
		<div
			style={{
				position: "relative",
				display: "flex",
				alignItems: "center",
				justifyContent: "flex-end",
				gap: 4,
			}}
		>
			{agg === "none" ? (
				<span style={{ fontSize: 12, color: "var(--text-3)" }}>Calculate</span>
			) : (
				<span style={{ fontSize: 12, color: "var(--text)" }}>
					<span style={{ color: "var(--text-3)", marginRight: 4 }}>
						{AGG_LABEL[agg]}
					</span>
					{formatted}
				</span>
			)}
			<select
				name="column-summary"
				value={agg}
				onChange={(e) => onChange(e.target.value as AggType)}
				title="Summary"
				style={{
					position: "absolute",
					inset: 0,
					width: "100%",
					height: "100%",
					opacity: 0,
					cursor: "pointer",
					border: "none",
				}}
			>
				<option value="none">Calculate</option>
				<option value="count">Count all</option>
				<option value="filled">Count values</option>
				<option value="empty">Count empty</option>
				{numeric && <option value="sum">Sum</option>}
				{numeric && <option value="avg">Average</option>}
				{numeric && <option value="min">Min</option>}
				{numeric && <option value="max">Max</option>}
			</select>
		</div>
	);
}

// ── Sortable Row ──────────────────────────────────────────────────────────

function SortableRow({
	id,
	children,
	isDragging,
	onDelete,
	onOpen,
	selected,
	onToggleSelect,
	hasPage,
}: {
	id: string;
	children: React.ReactNode;
	isDragging: boolean;
	onDelete: () => void;
	onOpen: () => void;
	selected: boolean;
	onToggleSelect: (e: React.MouseEvent) => void;
	hasPage?: boolean;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging: sortableDragging,
	} = useSortable({ id });
	const [hovered, setHovered] = useState(false);
	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: sortableDragging ? 0.4 : 1,
		background: selected ? "var(--accent-dim)" : undefined,
	};
	return (
		<tr
			ref={setNodeRef}
			style={style}
			className={`transition-[background] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-2 ${isDragging || sortableDragging ? "bg-surface-3! opacity-60" : ""}`}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<td className="w-11 min-w-[44px] px-0.5 py-1 align-middle relative">
				{/* The checkbox, the drag handle and the open button are three
				    flow-level elements; without this row they stack and set the
				    height of every record to ~78px. */}
				<div className="flex items-center gap-0.5">
					<input
						type="checkbox"
						name="row-select"
						checked={selected}
						onClick={onToggleSelect}
						onChange={() => {
							/* handled in onClick to capture shift/cmd */
						}}
						style={{
							opacity: hovered || selected ? 1 : 0,
							marginRight: 2,
							cursor: "pointer",
						}}
						title="Select row (Shift+click for range)"
					/>
					<div
						className="flex items-center justify-center cursor-grab text-text-3 px-0.5 py-1 rounded transition-[color,background] duration-[var(--t)] ease-[var(--ease)] touch-none select-none text-[16px] leading-none tracking-[1px] hover:bg-surface-3 active:cursor-grabbing active:text-text"
						{...listeners}
						{...attributes}
					>
						⋮⋮
					</div>
					<IconButton
						variant="ghost"
						className="text-[13px] hover:text-accent"
						style={{ opacity: hovered || hasPage ? 1 : 0 }}
						onClick={onOpen}
						title={hasPage ? "Open page" : "Open record"}
					>
						{hasPage ? "📄" : "↗"}
					</IconButton>
				</div>
				<IconButton
					variant="ghost"
					className="absolute top-1 right-1 text-[15px] hover:text-danger hover:bg-danger-dim"
					style={{ opacity: hovered ? 1 : 0 }}
					onClick={onDelete}
					title="Delete record"
				>
					×
				</IconButton>
			</td>
			{children}
		</tr>
	);
}

// ── Sortable Column Header (drag-reorder) ─────────────────────────────────
//
// The actual <th> is rendered by ColumnHeader. We need to (a) feed it dnd-kit
// transform/transition styles and (b) provide drag listeners restricted to a
// small handle so the header itself stays clickable for sort/menu actions.

function useColumnSortable(fieldId: string) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: fieldId });
	const dragStyle: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.4 : 1,
	};
	return {
		setDragRef: setNodeRef,
		dragListeners: listeners,
		dragAttributes: attributes,
		dragStyle,
		isDragging,
	};
}

function DraggableColumnHeader({
	field,
	sortInfo,
	...rest
}: {
	field: { id: string; name: string; type: string };
	sortInfo: { dir: "asc" | "desc"; idx: number } | null;
} & Omit<
	React.ComponentProps<typeof ColumnHeader>,
	| "field"
	| "dragRef"
	| "dragStyle"
	| "dragListeners"
	| "dragAttributes"
	| "sortDir"
	| "sortIndex"
>) {
	const { setDragRef, dragStyle, dragListeners, dragAttributes } =
		useColumnSortable(field.id);
	return (
		<ColumnHeader
			field={field}
			sortDir={sortInfo?.dir ?? null}
			sortIndex={sortInfo?.idx ?? null}
			dragRef={setDragRef}
			dragStyle={dragStyle}
			dragListeners={dragListeners}
			dragAttributes={dragAttributes}
			{...rest}
		/>
	);
}

// ── Title Cell (inline editable) ──────────────────────────────────────────

function TitleCell({
	title,
	onSave,
	editing,
	onEditingChange,
	seedChar,
	isFocused,
}: {
	title: string;
	onSave: (t: string) => Promise<void> | void;
	editing: boolean;
	onEditingChange: (on: boolean) => void;
	seedChar?: string | null;
	isFocused: boolean;
}) {
	const [value, setValue] = useState(title || "");
	// Sync the draft when not editing; when editing begins, seed from a typed
	// character if one started the edit (type-to-replace), otherwise the title.
	useEffect(() => {
		if (editing) setValue(seedChar != null ? seedChar : title || "");
		else setValue(title || "");
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editing, title]);
	if (!editing) {
		return (
			// Select-then-edit: the wrapping <td> focuses on first click; this opens
			// the editor only once the cell is already focused (or on double-click).
			<div
				className="px-1.5 py-1 rounded cursor-text min-h-[24px] text-text font-medium hover:bg-surface-3"
				onClick={() => {
					if (isFocused) onEditingChange(true);
				}}
				onDoubleClick={() => onEditingChange(true)}
			>
				{title || <span style={{ color: "var(--text-3)" }}>Untitled</span>}
			</div>
		);
	}
	return (
		<input
			name="record-title"
			className="w-full border-[1.5px] border-accent rounded px-1.5 py-[3px] text-[14px] font-medium outline-none bg-surface text-text [font-family:var(--font-ui)]"
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={async () => {
				onEditingChange(false);
				if (value !== title) await onSave(value);
			}}
			onKeyDown={async (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					(e.target as HTMLInputElement).blur();
				} else if (e.key === "Escape") {
					setValue(title || "");
					onEditingChange(false);
				}
			}}
		/>
	);
}

// ── Main DatabaseView ─────────────────────────────────────────────────────

export function DatabaseView({
	database,
	isNew,
}: {
	database: any;
	isNew?: boolean;
}) {
	const databases = useDatabaseStore((s) => s.databases);
	const loadDbFields = useDatabaseStore((s) => s.loadDbFields);
	const loadDbRecords = useDatabaseStore((s) => s.loadDbRecords);
	const loadDbViews = useDatabaseStore((s) => s.loadDbViews);
	const createDbRecord = useDatabaseStore((s) => s.createDbRecord);
	const updateFieldValue = useDatabaseStore((s) => s.updateFieldValue);
	const createField = useDatabaseStore((s) => s.createField);
	const deleteField = useDatabaseStore((s) => s.deleteField);
	const deleteRecord = useDatabaseStore((s) => s.deleteRecord);
	const renameDatabase = useDatabaseStore((s) => s.renameDatabase);
	const loadDatabases = useDatabaseStore((s) => s.loadDatabases);
	const setFilter = useDatabaseStore((s) => s.setFilter);
	const setSort = useDatabaseStore((s) => s.setSort);
	const addFilter = useDatabaseStore((s) => s.addFilter);
	const removeFilter = useDatabaseStore((s) => s.removeFilter);
	const addSort = useDatabaseStore((s) => s.addSort);
	const removeSort = useDatabaseStore((s) => s.removeSort);
	const switchView = useDatabaseStore((s) => s.switchView);

	// Per-database state, scoped by databaseId so sibling DatabaseView instances
	// on the same page don't clobber one another.
	const dbFields = useDatabaseStore((s) => selectFields(s, database.id));
	const records = useDatabaseStore((s) => selectRecords(s, database.id));
	const activeFilters = useDatabaseStore((s) => selectFilters(s, database.id));
	const activeSorts = useDatabaseStore((s) => selectSorts(s, database.id));
	const activeViewId = useDatabaseStore((s) =>
		selectActiveViewId(s, database.id),
	);
	const dbViews = useDatabaseStore((s) => selectDbViews(s, database.id));

	const loadPages = usePageStore((s) => s.loadPages);
	const selectPageByIdWithCascade = (id: string) =>
		import("../lib/page-loader.js").then((m) =>
			m.selectPageByIdWithCascade(id),
		);

	const [viewType, setViewType] = useState<string>(() => {
		// Try the active saved view first, then fall back to localStorage
		const avId = useDatabaseStore.getState().activeViewIdByDb[database.id];
		if (avId) {
			const views = useDatabaseStore.getState().dbViewsByDb[database.id] || [];
			const active = views.find((v: any) => v.id === avId);
			if (active?.type) return active.type;
		}
		try {
			const stored: any = JSON.parse(
				localStorage.getItem(`db-view:${database.id}`) || "{}",
			);
			const v = stored.viewType;
			return v === "board" || v === "calendar" ? v : "table";
		} catch {
			return "table";
		}
	});
	const [editingCell, setEditingCell] = useState<{
		recordId: string;
		fieldId: string;
	} | null>(null);
	const [showAddField, setShowAddField] = useState(false);
	const [showOptionsFor, setShowOptionsFor] = useState<string | null>(null);
	const [showFormulaFor, setShowFormulaFor] = useState<string | null>(null);
	const [isEditingName, setIsEditingName] = useState(isNew);
	const [dbName, setDbName] = useState(database.name || "Untitled");
	const [activeRowId, setActiveRowId] = useState<string | null>(null);
	const [, setActiveColId] = useState<string | null>(null);
	const [openRecordId, setOpenRecordId] = useState<string | null>(null);
	const isCompact = useIsCompact();
	const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
		() => {
			try {
				const raw = localStorage.getItem(
					COL_WIDTHS_STORAGE_KEY_PREFIX + database.id,
				);
				if (raw) return JSON.parse(raw);
			} catch {
				/* ignore */
			}
			return {};
		},
	);

	const [dbRecordCache, setDbRecordCache] = useState<Record<string, any[]>>({});
	/** Keyboard focus cursor. `fieldId` is `"__title__"` for the title column. */
	const [focusedCell, setFocusedCell] = useState<{
		recordId: string;
		fieldId: string;
	} | null>(null);
	/** Character that started a type-to-replace edit; seeds the editor, then cleared. */
	const [seedChar, setSeedChar] = useState<string | null>(null);
	/** Selected row IDs for bulk actions. `lastSelected` anchors shift-click ranges. */
	const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
	const lastSelectedRowRef = useRef<string | null>(null);
	const addFieldBtnRef = useRef<HTMLButtonElement>(null);
	const tableWrapRef = useRef<HTMLDivElement>(null);
	const sortedRecordsRef = useRef<any[]>([]);

	useEffect(() => {
		loadDbFields(database.id);
		loadDbRecords(database.id);
		loadDbViews(database.id);
		databases.forEach(async (db: any) => {
			if (!dbRecordCache[db.id]) {
				try {
					const recs = await api.listRecords({ databaseId: db.id });
					setDbRecordCache((prev) => ({ ...prev, [db.id]: recs }));
				} catch {
					/* ignore */
				}
			}
		});
	}, [database.id]);

	// Cross-page Cmd-click on a relation chip dispatches `db-open-record`
	// after navigating. If the record belongs to this database, open the
	// side panel for it.
	useEffect(() => {
		const onEvent = (e: Event) => {
			const id = (e as CustomEvent).detail?.recordId as string | undefined;
			if (id && records.some((r: any) => r.record.id === id))
				setOpenRecordId(id);
		};
		window.addEventListener("db-open-record", onEvent);
		return () => window.removeEventListener("db-open-record", onEvent);
	}, [records]);

	// Lazy-load records for any cross-page relation target so chips show the
	// related record's title instead of a hash.
	useEffect(() => {
		for (const f of dbFields) {
			const targetId = (f as any).relationTargetDbId as string | null;
			if (!targetId || dbRecordCache[targetId]) continue;
			api
				.listRecords({ databaseId: targetId })
				.then((recs) =>
					setDbRecordCache((prev) => ({ ...prev, [targetId]: recs })),
				)
				.catch(() => {
					/* ignore */
				});
		}
	}, [dbFields, dbRecordCache]);

	// Sync viewType when switching saved views
	useEffect(() => {
		if (!activeViewId) {
			// Reset to 'All' — use localStorage fallback
			try {
				const stored = JSON.parse(
					localStorage.getItem(`db-view:${database.id}`) || "{}",
				);
				const sv = stored.viewType;
				setViewType(sv === "board" || sv === "calendar" ? sv : "table");
			} catch {
				setViewType("table");
			}
			return;
		}
		const view = dbViews.find((v) => v.id === activeViewId);
		if (view?.type && view.type !== viewType) {
			setViewType(view.type);
		}
	}, [activeViewId, dbViews]);

	const changeViewType = useCallback(
		(v: "table" | "board" | "calendar") => {
			// A saved view's layout is fixed. Switching the layout tab leaves the
			// active saved view (dropping to an ad-hoc 'All' in the chosen layout)
			// rather than silently rewriting that view's stored type.
			if (activeViewId) switchView(database.id, null);
			setViewType(v);
			localStorage.setItem(
				`db-view:${database.id}`,
				JSON.stringify({ viewType: v }),
			);
		},
		[database.id, activeViewId, switchView],
	);

	// Per-column footer summaries (Count / Sum / …), persisted locally per database.
	const [footerAggs, setFooterAggs] = useState<Record<string, AggType>>({});
	useEffect(() => {
		try {
			const raw = localStorage.getItem(`db-footer-aggs:${database.id}`);
			setFooterAggs(raw ? JSON.parse(raw) : {});
		} catch {
			setFooterAggs({});
		}
	}, [database.id]);
	const setFooterAgg = useCallback(
		(key: string, agg: AggType) => {
			setFooterAggs((prev) => {
				const next = { ...prev, [key]: agg };
				try {
					localStorage.setItem(
						`db-footer-aggs:${database.id}`,
						JSON.stringify(next),
					);
				} catch {
					/* ignore */
				}
				return next;
			});
		},
		[database.id],
	);

	const sortedRecords = useMemo(
		() => applyFiltersAndSorts(records, dbFields, activeFilters, activeSorts),
		[records, dbFields, activeFilters, activeSorts],
	);
	// Mirror for callbacks that need the current ordering without re-binding.
	sortedRecordsRef.current = sortedRecords;

	const handleCellEdit = async (
		recordId: string,
		fieldId: string,
		value: string,
	) => {
		await updateFieldValue(recordId, fieldId, value);
		await loadDbRecords(database.id);
		// Editing a select/multi-select cell can create a brand-new option inline;
		// refresh the field definitions so its options (colors, grouping order)
		// aren't stale until the next manual refresh.
		const f = dbFields.find((x: any) => x.id === fieldId);
		if (f && (f.type === "select" || f.type === "multiSelect")) {
			await loadDbFields(database.id);
		}
		setEditingCell(null);
		setSeedChar(null);
		setFocusedCell({ recordId, fieldId });
	};

	const handleAddField = async (
		name: string,
		type: FieldType,
		options?: string[],
		relationTargetDbId?: string | null,
		formula?: string | null,
	) => {
		await createField({
			databaseId: database.id,
			name,
			type,
			options: options || null,
			relationTargetDbId: relationTargetDbId || null,
			formula: formula ?? null,
		});
		await loadDbFields(database.id);
	};

	/** Cycle sort on a column: none → asc → desc → none. Shift+click adds as a
	 *  secondary sort instead of replacing existing sorts. */
	const handleHeaderSortCycle = useCallback(
		(fieldId: string, shiftKey: boolean) => {
			const existingIdx = activeSorts.findIndex((s) => s.fieldId === fieldId);
			if (existingIdx >= 0) {
				const existing = activeSorts[existingIdx];
				if (existing.direction === "asc")
					setSort(database.id, existingIdx, { ...existing, direction: "desc" });
				else removeSort(database.id, existingIdx);
				return;
			}
			if (!shiftKey) {
				// Replace all sorts with this single ascending sort.
				for (let i = activeSorts.length - 1; i >= 0; i--)
					removeSort(database.id, i);
			}
			addSort(database.id, { fieldId, direction: "asc" });
		},
		[activeSorts, addSort, removeSort, setSort, database.id],
	);

	// Open a record's child page if it has one, otherwise open the record panel.
	// Shared by the table rows and the board cards.
	const handleNewRecord = useCallback(async () => {
		const rec = await createDbRecord(database.id, "");
		await loadDbRecords(database.id);
		if (rec?.id) setOpenRecordId(rec.id);
	}, [createDbRecord, database.id, loadDbRecords]);

	const handleOpenRecord = useCallback(
		(record: any) => {
			if (record.pageId) {
				loadPages().then(() => selectPageByIdWithCascade(record.pageId));
			} else {
				setOpenRecordId(record.id);
			}
		},
		[loadPages, selectPageByIdWithCascade],
	);

	const handleBulkDelete = useCallback(async () => {
		if (selectedRowIds.size === 0) return;
		const n = selectedRowIds.size;
		if (!window.confirm(`Delete ${n} record${n === 1 ? "" : "s"}?`)) return;
		const deletedIds = [...selectedRowIds];
		for (const id of deletedIds) {
			try {
				await deleteRecord(database.id, id);
			} catch {
				/* skip */
			}
		}
		setSelectedRowIds(new Set());
		lastSelectedRowRef.current = null;
		const toastId = `bulk-delete-${Date.now()}`;
		toaster.create({
			id: toastId,
			title: `${n} record${n === 1 ? "" : "s"} deleted`,
			action: {
				label: "Undo",
				onClick: async () => {
					try {
						await Promise.all(
							deletedIds.map((id) => api.restoreRecord({ id })),
						);
						await loadDbRecords(database.id);
					} catch {
						/* ignore */
					}
				},
			},
			type: "info",
			duration: 6000,
		});
	}, [selectedRowIds, deleteRecord, database.id]);

	const handleToggleRowSelect = useCallback(
		(recordId: string, e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setSelectedRowIds((prev) => {
				const next = new Set(prev);
				const recordIds = sortedRecordsRef.current.map((r: any) => r.record.id);
				if (e.shiftKey && lastSelectedRowRef.current) {
					const a = recordIds.indexOf(lastSelectedRowRef.current);
					const b = recordIds.indexOf(recordId);
					if (a >= 0 && b >= 0) {
						const [lo, hi] = a < b ? [a, b] : [b, a];
						for (let i = lo; i <= hi; i++) next.add(recordIds[i]);
						return next;
					}
				}
				if (next.has(recordId)) next.delete(recordId);
				else next.add(recordId);
				lastSelectedRowRef.current = recordId;
				return next;
			});
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[],
	);

	/** Move editing cursor to neighbouring cell. Wraps to next/prev row at row ends. */
	const handleCellNavigate = useCallback(
		(
			from: { recordId: string; fieldId: string },
			direction: "next" | "prev" | "down",
		) => {
			setSeedChar(null);
			const rows = sortedRecordsRef.current;
			const rowIdx = rows.findIndex((r: any) => r.record.id === from.recordId);
			const colIdx = dbFields.findIndex((f: any) => f.id === from.fieldId);
			if (rowIdx < 0 || colIdx < 0) {
				setEditingCell(null);
				return;
			}
			let nextRow = rowIdx;
			let nextCol = colIdx;
			if (direction === "next") {
				nextCol++;
				if (nextCol >= dbFields.length) {
					nextCol = 0;
					nextRow++;
				}
			} else if (direction === "prev") {
				nextCol--;
				if (nextCol < 0) {
					nextCol = dbFields.length - 1;
					nextRow--;
				}
			} else if (direction === "down") {
				nextRow++;
			}
			if (
				nextRow < 0 ||
				nextRow >= rows.length ||
				nextCol < 0 ||
				nextCol >= dbFields.length
			) {
				setEditingCell(null);
				return;
			}
			const targetField = dbFields[nextCol] as any;
			// Skip read-only cells. Which types those are is the registry's to say.
			if (fieldTypeSpec(targetField.type).readOnly) {
				// Try one step further in the same direction; if not found, just clear.
				handleCellNavigate(
					{ recordId: rows[nextRow].record.id, fieldId: targetField.id },
					direction,
				);
				return;
			}
			setEditingCell({
				recordId: rows[nextRow].record.id,
				fieldId: targetField.id,
			});
		},
		[dbFields],
	);

	/** Column ids in visual order for focus navigation: title (if shown) + fields. */
	const navColIds = useMemo(
		() => [
			...(database.titleHidden ? [] : [TITLE_COL]),
			...dbFields.map((f: any) => f.id),
		],
		[database.titleHidden, dbFields],
	);

	/** Move the focus cursor by a row/column delta, clamped to the grid bounds. */
	const moveFocus = useCallback(
		(dRow: number, dCol: number) => {
			const rows = sortedRecordsRef.current;
			if (rows.length === 0 || navColIds.length === 0) return;
			setFocusedCell((prev) => {
				let rowIdx = prev
					? rows.findIndex((r: any) => r.record.id === prev.recordId)
					: -1;
				let colIdx = prev ? navColIds.indexOf(prev.fieldId) : -1;
				if (rowIdx < 0) rowIdx = 0;
				if (colIdx < 0) colIdx = 0;
				rowIdx = Math.min(rows.length - 1, Math.max(0, rowIdx + dRow));
				colIdx = Math.min(navColIds.length - 1, Math.max(0, colIdx + dCol));
				return { recordId: rows[rowIdx].record.id, fieldId: navColIds[colIdx] };
			});
		},
		[navColIds],
	);

	/** Open the editor for the currently focused cell, optionally seeding a typed char. */
	const beginEditFocused = useCallback(
		(char: string | null) => {
			setFocusedCell((cell) => {
				if (!cell) return cell;
				// A read-only cell keeps the focus ring but opens no editor.
				const field = dbFields.find((f: any) => f.id === cell.fieldId);
				if (field && fieldTypeSpec(field.type).readOnly) return cell;
				setSeedChar(char);
				setEditingCell({ recordId: cell.recordId, fieldId: cell.fieldId });
				return cell;
			});
		},
		[dbFields],
	);

	const handleRenameField = async (fieldId: string, name: string) => {
		if (!name.trim()) return;
		await api.updateField({ id: fieldId, name: name.trim() });
		await loadDbFields(database.id);
	};

	const handleDeleteField = async (fieldId: string) => {
		await deleteField(database.id, fieldId);
	};

	const handleDeleteRecord = async (recordId: string) => {
		await deleteRecord(database.id, recordId);
		try {
			const recs = await api.listRecords({ databaseId: database.id });
			setDbRecordCache((prev) => ({ ...prev, [database.id]: recs }));
		} catch {
			/* ignore */
		}
		toaster.create({
			title: "Record deleted",
			action: {
				label: "Undo",
				onClick: async () => {
					try {
						await api.restoreRecord({ id: recordId });
						await loadDbRecords(database.id);
					} catch {
						/* ignore */
					}
				},
			},
			type: "info",
			duration: 5000,
		});
	};

	const handleDeleteOption = async (fieldId: string, option: string) => {
		const field = dbFields.find((f) => f.id === fieldId);
		if (!field) return;
		const newOpts = (field.options || []).filter((o) => o !== option);
		await api.updateField({
			id: fieldId,
			options: newOpts.length ? newOpts : null,
		});
		await loadDbFields(database.id);
		await loadDbRecords(database.id);
	};

	const handleAddOption = async (fieldId: string, option: string) => {
		const field = dbFields.find((f) => f.id === fieldId);
		if (!field) return;
		const newOpts = [...(field.options || []), option];
		await api.updateField({ id: fieldId, options: newOpts });
		await loadDbFields(database.id);
	};

	const handleReorderOptions = async (fieldId: string, options: string[]) => {
		await api.updateField({ id: fieldId, options });
		await loadDbFields(database.id);
		await loadDbRecords(database.id);
	};

	const handleColumnResize = useCallback(
		(fieldId: string, width: number) => {
			setColumnWidths((prev) => {
				const next = { ...prev, [fieldId]: Math.max(80, Math.round(width)) };
				try {
					localStorage.setItem(
						COL_WIDTHS_STORAGE_KEY_PREFIX + database.id,
						JSON.stringify(next),
					);
				} catch {
					/* ignore */
				}
				return next;
			});
		},
		[database.id],
	);

	const handleNameSave = async () => {
		if (dbName.trim() && dbName !== database.name)
			await renameDatabase(database.id, dbName.trim());
		setIsEditingName(false);
	};

	const handleNameKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleNameSave();
		}
		if (e.key === "Escape") setIsEditingName(false);
	};

	// Table DnD — PointerSensor for pointer and touch.
	// Combined DnD sensors for both rows and columns (different distance thresholds).
	const allSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
	);

	/** Dispatch to the right handler based on whether the dragged item is a row or column. */
	const handleAllDragStart = useCallback(
		(event: DragStartEvent) => {
			const id = String(event.active.id);
			// Column IDs look like ULIDs (26 chars) while row IDs also look similar.
			// Check if it's a field (column) by looking at dbFields.
			if (dbFields.some((f: any) => f.id === id)) {
				setActiveColId(id);
			} else {
				setActiveRowId(id);
			}
		},
		[dbFields],
	);

	const handleAllDragEnd = useCallback(
		async (event: DragEndEvent) => {
			const { active, over } = event;
			if (!over || active.id === over.id) {
				setActiveRowId(null);
				setActiveColId(null);
				return;
			}

			const activeId = String(active.id);
			const overId = String(over.id);

			// Column drag (reorder fields)
			if (dbFields.some((f: any) => f.id === activeId)) {
				setActiveColId(null);
				const oldI = dbFields.findIndex((f: any) => f.id === activeId);
				const newI = dbFields.findIndex((f: any) => f.id === overId);
				if (oldI < 0 || newI < 0) return;
				const order = dbFields.map((f: any) => f.id);
				const [moved] = order.splice(oldI, 1);
				order.splice(newI, 0, moved);
				await api.reorderFields({ databaseId: database.id, fieldIds: order });
				await loadDbFields(database.id);
				return;
			}

			// Row drag (reorder records)
			setActiveRowId(null);
			const oldI = sortedRecords.findIndex((r) => r.record.id === activeId);
			const newI = sortedRecords.findIndex((r) => r.record.id === overId);
			if (oldI < 0 || newI < 0) return;
			const order = sortedRecords.map((r) => r.record.id);
			const [moved] = order.splice(oldI, 1);
			order.splice(newI, 0, moved);
			await api.reorderRecords({ databaseId: database.id, recordIds: order });
			await loadDbRecords(database.id);
		},
		[dbFields, sortedRecords, database.id, loadDbFields, loadDbRecords],
	);

	// Bulk delete via Delete key; Esc clears selection.
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape" && selectedRowIds.size > 0) {
				setSelectedRowIds(new Set());
				lastSelectedRowRef.current = null;
				return;
			}
			if (
				(e.key === "Backspace" || e.key === "Delete") &&
				selectedRowIds.size > 0
			) {
				const target = e.target as HTMLElement;
				// Don't hijack the key while typing in an input/textarea.
				if (
					target &&
					(target.tagName === "INPUT" ||
						target.tagName === "TEXTAREA" ||
						target.isContentEditable)
				)
					return;
				e.preventDefault();
				handleBulkDelete();
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [selectedRowIds, handleBulkDelete]);

	// Spreadsheet-style focus navigation. Active only when a cell is focused and
	// no editor is open; the editor handles its own Tab/Enter/Escape keys.
	useEffect(() => {
		if (!focusedCell || editingCell) return;
		const handler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			)
				return;
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					moveFocus(1, 0);
					break;
				case "ArrowUp":
					e.preventDefault();
					moveFocus(-1, 0);
					break;
				case "ArrowRight":
					e.preventDefault();
					moveFocus(0, 1);
					break;
				case "ArrowLeft":
					e.preventDefault();
					moveFocus(0, -1);
					break;
				case "Tab":
					e.preventDefault();
					moveFocus(0, e.shiftKey ? -1 : 1);
					break;
				case "Enter":
					e.preventDefault();
					beginEditFocused(null);
					break;
				case "Escape":
					setFocusedCell(null);
					break;
				default:
					// Type-to-replace: a bare printable character opens the editor seeded with it.
					if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
						e.preventDefault();
						beginEditFocused(e.key);
					}
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [focusedCell, editingCell, moveFocus, beginEditFocused]);

	// Keep the focused cell scrolled into view as the cursor moves.
	useEffect(() => {
		if (!focusedCell || editingCell || !tableWrapRef.current) return;
		const el = tableWrapRef.current.querySelector(
			'[data-focused="true"]',
		) as HTMLElement | null;
		el?.scrollIntoView({ block: "nearest", inline: "nearest" });
	}, [focusedCell, editingCell]);

	// ── Render ──────────────────────────────────────────────────────────────
	const sortByFieldId = useMemo(() => {
		const m = new Map<string, { dir: "asc" | "desc"; idx: number }>();
		activeSorts.forEach((s, i) =>
			m.set(s.fieldId, { dir: s.direction, idx: i }),
		);
		return m;
	}, [activeSorts]);

	const recordPanel = openRecordId
		? (() => {
				const entry = sortedRecords.find(
					(r: any) => r.record.id === openRecordId,
				);
				if (!entry) return null;
				return (
					<RecordPanel
						databaseId={database.id}
						record={entry.record}
						values={entry.values}
						fields={dbFields as any}
						databases={databases}
						allRecords={dbRecordCache}
						onClose={() => setOpenRecordId(null)}
						onChanged={async () => {
							await loadDbRecords(database.id);
							await loadDbFields(database.id);
						}}
					/>
				);
			})()
		: null;

	if (viewType === "calendar") {
		return (
			<>
				<CalendarView
					database={database}
					fields={dbFields}
					records={sortedRecords}
					databases={databases}
					onChangeView={changeViewType}
					allRecords={dbRecordCache}
					onOpenRecord={handleOpenRecord}
				/>
				{recordPanel}
			</>
		);
	}

	if (viewType === "board") {
		return (
			<>
				<BoardView
					database={database}
					fields={dbFields}
					records={sortedRecords}
					databases={databases}
					currentView={viewType as "table" | "board" | "calendar"}
					onChangeView={changeViewType}
					allRecords={dbRecordCache}
					onOpenRecord={handleOpenRecord}
				/>
				{recordPanel}
			</>
		);
	}

	return (
		<DndContext
			sensors={allSensors}
			onDragStart={handleAllDragStart}
			onDragEnd={handleAllDragEnd}
		>
			<div ref={tableWrapRef} data-database-view>
				{/* Toolbar. `db-toolbar-controls` is display:contents on desktop, so
				    the flex layout below is exactly what it was; on a narrow screen
				    it becomes the scrollable second row. See styles.css. */}
				<div className="db-toolbar flex gap-1.5 mb-2.5 items-center flex-wrap py-1">
					<div className="db-toolbar-controls contents">
						<ViewSwitcher
							databaseId={database.id}
							currentViewType={viewType as "table" | "board" | "calendar"}
						/>
						<Tabs
							variant="toggle"
							aria-label="View type"
							value={viewType as ViewType}
							onChange={changeViewType}
							items={VIEW_TYPES}
						/>

						<div
							style={{
								marginLeft: 16,
								display: "flex",
								alignItems: "center",
								gap: 12,
								flexWrap: "wrap",
							}}
						>
							<FilterBar
								fields={dbFields}
								filters={activeFilters}
								onAdd={() =>
									addFilter(database.id, makeDefaultFilter(dbFields[0]))
								}
								onRemove={(idx) => removeFilter(database.id, idx)}
								onChange={(idx, updates) => {
									const ex = activeFilters[idx];
									setFilter(database.id, idx, { ...ex, ...updates });
								}}
							/>
							<SortBar
								fields={dbFields}
								sorts={activeSorts}
								onAdd={() =>
									addSort(database.id, {
										fieldId: dbFields[0]?.id || "",
										direction: "asc",
									})
								}
								onRemove={(idx) => removeSort(database.id, idx)}
								onChange={(idx, updates) => {
									const ex = activeSorts[idx];
									setSort(database.id, idx, { ...ex, ...updates });
								}}
							/>
						</div>
					</div>

					<span
						className="db-toolbar-name"
						style={{
							fontSize: 13,
							color: "var(--text-2)",
							display: "flex",
							alignItems: "center",
							gap: 8,
						}}
					>
						{database.titleHidden && (
							<Button
								variant="ghost"
								size="sm"
								title="Show the title column"
								onClick={async () => {
									await api.updateDatabase({
										id: database.id,
										titleHidden: false,
									});
									await loadDatabases(database.pageId);
								}}
							>
								Show {database.titleLabel || "Name"} column
							</Button>
						)}
						{isEditingName ? (
							<input
								type="text"
								name="database-name"
								value={dbName}
								onChange={(e) => setDbName(e.target.value)}
								onBlur={handleNameSave}
								onKeyDown={handleNameKeyDown}
								style={{
									fontSize: 13,
									padding: "2px 6px",
									border: "1px solid var(--accent)",
									borderRadius: 4,
									width: 140,
									outline: "none",
								}}
							/>
						) : (
							<span
								onClick={() => setIsEditingName(true)}
								style={{ cursor: "pointer", fontWeight: 500 }}
							>
								{database.name || "Untitled"}
							</span>
						)}
					</span>
				</div>

				{/* Table — on a narrow screen this becomes the field ruler, a
				    different interaction model rather than a reflowed table.
				    See components/db/MobileRuler.tsx. */}
				{isCompact ? (
					<MobileRuler
						fields={dbFields}
						rows={sortedRecords}
						databases={databases}
						allRecords={dbRecordCache}
						onEdit={handleCellEdit}
						onOpenRecord={handleOpenRecord}
						onNewRecord={handleNewRecord}
					/>
				) : (
					<div
						style={{
							overflowX: "auto",
							overflowY: "auto",
							maxHeight: "calc(100vh - 200px)",
						}}
					>
						<table className="db-table w-full border-collapse table-auto">
							<thead>
								<tr>
									<th className="w-11 min-w-[44px]" />
									{!database.titleHidden && (
										<ColumnHeader
											field={{
												id: "title",
												name: database.titleLabel || "Name",
												type: "text",
											}}
											onRename={async (label) => {
												await api.updateDatabase({
													id: database.id,
													titleLabel: label,
												});
												await loadDatabases(database.pageId);
											}}
											onDelete={async () => {
												await api.updateDatabase({
													id: database.id,
													titleHidden: true,
												});
												await loadDatabases(database.pageId);
											}}
											isTitle
											width={columnWidths.__title__}
											onResize={handleColumnResize}
										/>
									)}
									<SortableContext
										items={dbFields.map((f: any) => f.id)}
										strategy={horizontalListSortingStrategy}
									>
										{dbFields.map((f: any) => (
											<DraggableColumnHeader
												key={f.id}
												field={f}
												sortInfo={sortByFieldId.get(f.id) ?? null}
												onHeaderClick={(e) =>
													handleHeaderSortCycle(f.id, e.shiftKey)
												}
												onRename={(name) => handleRenameField(f.id, name)}
												onDelete={() => handleDeleteField(f.id)}
												onOptions={() =>
													setShowOptionsFor(
														showOptionsFor === f.id ? null : f.id,
													)
												}
												onEditFormula={() => setShowFormulaFor(f.id)}
												onChangeType={async (type) => {
													await api.updateField({ id: f.id, type });
													await loadDbFields(database.id);
													await loadDbRecords(database.id);
												}}
												onSortAsc={() =>
													addSort(database.id, {
														fieldId: f.id,
														direction: "asc",
													})
												}
												onSortDesc={() =>
													addSort(database.id, {
														fieldId: f.id,
														direction: "desc",
													})
												}
												onFilter={() =>
													addFilter(database.id, {
														fieldId: f.id,
														operator: "contains",
														value: "",
													})
												}
												onDuplicate={() =>
													handleAddField(
														`${f.name} (copy)`,
														f.type,
														f.options || undefined,
														f.relationTargetDbId || null,
														f.formula || null,
													)
												}
												width={columnWidths[f.id]}
												onResize={handleColumnResize}
											/>
										))}
									</SortableContext>
									<th
										style={{
											width: 40,
											position: "sticky",
											right: 0,
											background: "var(--bg)",
											borderLeft: "1px solid var(--border)",
											zIndex: 2,
										}}
									>
										<IconButton
											ref={addFieldBtnRef}
											onClick={() => setShowAddField(true)}
											variant="ghost"
											className="text-[16px]"
											title="Add property"
										>
											+
										</IconButton>
									</th>
								</tr>
							</thead>
							<SortableContext
								items={sortedRecords.map((r: any) => r.record.id)}
								strategy={verticalListSortingStrategy}
							>
								<tbody>
									{sortedRecords.length === 0 && (
										<tr>
											<td
												colSpan={
													dbFields.length + (database.titleHidden ? 2 : 3)
												}
												className="text-text-3 text-[13px] pt-7 pb-3 px-3 text-center italic"
											>
												{dbFields.length === 0
													? "Empty database — add a property from the column ‘+’, or just press New below."
													: "No records yet. Press New below to create one."}
											</td>
										</tr>
									)}
									{sortedRecords.map(({ record, values }: any) => (
										<SortableRow
											key={record.id}
											id={record.id}
											isDragging={activeRowId === record.id}
											onDelete={() => handleDeleteRecord(record.id)}
											onOpen={() => handleOpenRecord(record)}
											selected={selectedRowIds.has(record.id)}
											onToggleSelect={(e) =>
												handleToggleRowSelect(record.id, e)
											}
											hasPage={!!record.pageId}
										>
											{!database.titleHidden &&
												(() => {
													const isFocused =
														focusedCell?.recordId === record.id &&
														focusedCell?.fieldId === TITLE_COL;
													return (
														<td
															data-focused={isFocused || undefined}
															onClick={() =>
																setFocusedCell({
																	recordId: record.id,
																	fieldId: TITLE_COL,
																})
															}
															className="px-2 py-1.5 border-b border-border border-r border-border last:border-r-0 align-middle min-h-[32px] relative font-medium text-[14px] min-w-[180px] text-text"
															style={(() => {
																const w = columnWidths.__title__;
																const base = w
																	? { minWidth: w, width: w }
																	: {
																			minWidth: 180,
																			width: getDefaultWidthForType("text"),
																		};
																return isFocused &&
																	!(
																		editingCell?.recordId === record.id &&
																		editingCell?.fieldId === TITLE_COL
																	)
																	? {
																			...base,
																			boxShadow:
																				"inset 0 0 0 2px var(--accent)",
																		}
																	: base;
															})()}
														>
															<TitleCell
																title={record.title}
																isFocused={isFocused}
																editing={
																	editingCell?.recordId === record.id &&
																	editingCell?.fieldId === TITLE_COL
																}
																onEditingChange={(on) => {
																	if (on) {
																		setEditingCell({
																			recordId: record.id,
																			fieldId: TITLE_COL,
																		});
																	} else {
																		setEditingCell(null);
																		setSeedChar(null);
																		setFocusedCell({
																			recordId: record.id,
																			fieldId: TITLE_COL,
																		});
																	}
																}}
																seedChar={seedChar}
																onSave={async (newTitle) => {
																	await api.updateRecord({
																		id: record.id,
																		title: newTitle,
																	});
																	await loadDbRecords(database.id);
																}}
															/>
														</td>
													);
												})()}
											{dbFields.map((field: any) => {
												const val = values[field.name] ?? "";
												const isEditing =
													editingCell?.recordId === record.id &&
													editingCell?.fieldId === field.id;
												const isFocused =
													focusedCell?.recordId === record.id &&
													focusedCell?.fieldId === field.id;
												const isReadOnly = fieldTypeSpec(field.type).readOnly;
												const colW = columnWidths[field.id];
												const baseStyle = colW
													? { minWidth: colW, width: colW }
													: undefined;
												return (
													<td
														key={field.id}
														data-focused={
															(isFocused && !isEditing) || undefined
														}
														data-field-type={field.type}
														className="db-cell px-2 py-[3px] border-b border-border border-r border-border last:border-r-0 align-middle min-h-[32px] relative"
														style={
															isFocused && !isEditing
																? {
																		...baseStyle,
																		boxShadow: "inset 0 0 0 2px var(--accent)",
																	}
																: baseStyle
														}
													>
														{isEditing && !isReadOnly ? (
															<InlineCellEditor
																field={field}
																value={val}
																initialValue={seedChar}
																onSave={(v) =>
																	handleCellEdit(record.id, field.id, v)
																}
																onCancel={() => {
																	setEditingCell(null);
																	setSeedChar(null);
																	setFocusedCell({
																		recordId: record.id,
																		fieldId: field.id,
																	});
																}}
																onNavigate={(dir) =>
																	handleCellNavigate(
																		{ recordId: record.id, fieldId: field.id },
																		dir,
																	)
																}
																allRecords={dbRecordCache}
															/>
														) : (
															<div
																// Select-then-edit: first click focuses, a click on the
																// already-focused cell (or double-click) opens the editor.
																onClick={() => {
																	if (isFocused && !isReadOnly)
																		setEditingCell({
																			recordId: record.id,
																			fieldId: field.id,
																		});
																	else
																		setFocusedCell({
																			recordId: record.id,
																			fieldId: field.id,
																		});
																}}
																onDoubleClick={() => {
																	if (!isReadOnly)
																		setEditingCell({
																			recordId: record.id,
																			fieldId: field.id,
																		});
																}}
																className="px-1.5 py-1 rounded cursor-pointer min-h-[24px] transition-[background] duration-[var(--t)] ease-[var(--ease)] text-text-2 hover:bg-surface-3 hover:text-text"
																style={
																	isReadOnly ? { cursor: "default" } : undefined
																}
															>
																<CellDisplay
																	field={field}
																	value={val}
																	databases={databases}
																	allRecords={dbRecordCache}
																	recordValues={values}
																/>
															</div>
														)}
													</td>
												);
											})}
											<td
												style={{
													position: "sticky",
													right: 0,
													background: "var(--bg)",
													zIndex: 2,
												}}
											/>
										</SortableRow>
									))}
									<tr>
										<td
											colSpan={dbFields.length + (database.titleHidden ? 2 : 3)}
										>
											<MenuItem
												type="button"
												className="rounded-none border-t border-border px-3.5 py-2.5"
												onClick={handleNewRecord}
											>
												+ New record
											</MenuItem>
										</td>
									</tr>
								</tbody>
							</SortableContext>
							{sortedRecords.length > 0 && (
								<tfoot>
									<tr>
										<td style={{ borderTop: "1px solid var(--border)" }} />
										{!database.titleHidden && (
											<td
												className="px-2 py-1.5 align-middle"
												style={{
													borderTop: "1px solid var(--border)",
													...(() => {
														const w = columnWidths.__title__;
														return w
															? { minWidth: w, width: w }
															: {
																	minWidth: 180,
																	width: getDefaultWidthForType("text"),
																};
													})(),
												}}
											>
												<ColumnFooter
													field={{
														id: "__title__",
														name: database.titleLabel || "Name",
														type: "text",
													}}
													rows={sortedRecords}
													agg={footerAggs.__title__ ?? "none"}
													onChange={(a) => setFooterAgg("__title__", a)}
													isTitle
												/>
											</td>
										)}
										{dbFields.map((field: any) => {
											const colW = columnWidths[field.id];
											return (
												<td
													key={field.id}
													className="px-2 py-[3px] align-middle"
													style={{
														borderTop: "1px solid var(--border)",
														...(colW ? { minWidth: colW, width: colW } : {}),
													}}
												>
													<ColumnFooter
														field={field}
														rows={sortedRecords}
														agg={footerAggs[field.id] ?? "none"}
														onChange={(a) => setFooterAgg(field.id, a)}
													/>
												</td>
											);
										})}
										<td
											style={{
												borderTop: "1px solid var(--border)",
												position: "sticky",
												right: 0,
												background: "var(--bg)",
												zIndex: 2,
											}}
										/>
									</tr>
								</tfoot>
							)}
						</table>
					</div>
				)}

				{/* Status line — the second of the table's two ink rules. It carries
				    both jobs at once: where you are (filters, sort) and what this
				    database is (records, fields). See docs/design-system.md. */}
				<div className="db-statusline">
					<span>
						<i className="lbl">records</i>
						<b>{sortedRecords.length}</b>
						{sortedRecords.length !== records.length && (
							<span style={{ padding: 0, border: "none" }}>
								of {records.length}
							</span>
						)}
					</span>
					<span>
						<i className="lbl">fields</i>
						<b>{dbFields.length}</b>
					</span>
					{activeFilters.length > 0 && (
						<span>
							<i className="lbl">filters</i>
							<b>{activeFilters.length}</b>
						</span>
					)}
					{activeSorts.length > 0 && (
						<span>
							<i className="lbl">sort</i>
							<b>
								{dbFields.find((f: any) => f.id === activeSorts[0]?.fieldId)
									?.name ?? "—"}{" "}
								{activeSorts[0]?.direction === "desc" ? "↓" : "↑"}
							</b>
							{activeSorts.length > 1 && <>+{activeSorts.length - 1}</>}
						</span>
					)}
					<span>{viewType}</span>
				</div>

				{showAddField && (
					<AddFieldPopover
						triggerRect={
							addFieldBtnRef.current?.getBoundingClientRect() ?? null
						}
						onClose={() => setShowAddField(false)}
						onAdd={handleAddField}
					/>
				)}

				{showOptionsFor &&
					(() => {
						const f = dbFields.find((x: any) => x.id === showOptionsFor);
						if (!f) return null;
						const el = document.querySelector(`[data-field-id="${f.id}"]`);
						const rect = el
							? (el as HTMLElement).getBoundingClientRect()
							: null;
						return (
							<Popover
								triggerRect={rect}
								onClose={() => setShowOptionsFor(null)}
								minWidth={260}
							>
								<OptionsEditor
									field={f as any}
									onClose={() => setShowOptionsFor(null)}
									onUpdate={(opts) => handleReorderOptions(f.id, opts)}
									onDeleteOption={(opt) => handleDeleteOption(f.id, opt)}
									onAddOption={(opt) => handleAddOption(f.id, opt)}
								/>
							</Popover>
						);
					})()}

				{showFormulaFor &&
					(() => {
						const f = dbFields.find((x: any) => x.id === showFormulaFor);
						if (!f) return null;
						const el = document.querySelector(`[data-field-id="${f.id}"]`);
						const rect = el
							? (el as HTMLElement).getBoundingClientRect()
							: null;
						return (
							<Popover
								triggerRect={rect}
								onClose={() => setShowFormulaFor(null)}
								minWidth={340}
							>
								<FormulaEditor
									field={f as any}
									onClose={() => setShowFormulaFor(null)}
									onSave={async (expr) => {
										await api.updateField({ id: f.id, formula: expr || null });
										await loadDbFields(database.id);
									}}
								/>
							</Popover>
						);
					})()}

				{selectedRowIds.size > 0 && (
					<div
						style={{
							position: "fixed",
							bottom: 20,
							left: "50%",
							transform: "translateX(-50%)",
							background: "var(--text)",
							color: "var(--surface)",
							borderRadius: 8,
							padding: "8px 14px",
							display: "flex",
							alignItems: "center",
							gap: 12,
							fontSize: 13,
							boxShadow: "0 4px 16px var(--shadow-xl)",
							zIndex: 9999,
						}}
					>
						<span>{selectedRowIds.size} selected</span>
						<Button variant="danger" size="sm" onClick={handleBulkDelete}>
							Delete
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setSelectedRowIds(new Set());
								lastSelectedRowRef.current = null;
							}}
						>
							Clear
						</Button>
					</div>
				)}

				<DragOverlay>
					{activeRowId ? (
						<div
							style={{
								background: "var(--surface)",
								border: "1px solid var(--border-mid)",
								borderRadius: 6,
								padding: "8px 16px",
								boxShadow: "0 4px 12px var(--shadow-lg)",
								fontSize: 14,
							}}
						>
							{sortedRecords.find((r) => r.record.id === activeRowId)?.record
								.title || "Record"}
						</div>
					) : null}
				</DragOverlay>

				{recordPanel}
			</div>
		</DndContext>
	);
}
