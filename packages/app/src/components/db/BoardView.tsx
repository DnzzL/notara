import {
	closestCorners,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	MouseSensor,
	TouchSensor,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	horizontalListSortingStrategy,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fieldTypeSpec } from "@notara/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsCompact } from "../../lib/useIsCompact.js";
import { api } from "../../rpc-client.js";
import {
	selectBoardGroupBy,
	selectBoardHidden,
	selectFilters,
	selectSorts,
	useDatabaseStore,
} from "../../stores/databaseStore.js";
import { cn } from "../ui/cn.js";
import { Button, IconButton } from "../ui/index.js";
import { Tabs } from "../ui/Tabs.js";
import { CellDisplay, SelectPill } from "./CellComponents.js";
import { DatabaseToolbar } from "./DatabaseToolbar.js";
import { MobileBoard } from "./MobileBoard.js";
import { FilterBar, makeDefaultFilter, SortBar } from "./QueryBar.js";
import { ViewSwitcher } from "./ViewSwitcher.js";
import { VIEW_TYPES } from "./viewTypes.js";

/** The single column a board shows when it has no group-by field. */
const UNGROUPED = "All";

export function BoardView({
	database,
	fields,
	records,
	databases,
	currentView,
	onChangeView,
	allRecords = {},
	onOpenRecord,
}: {
	database: any;
	fields: any[];
	records: any[];
	databases: any[];
	currentView: "table" | "board" | "calendar";
	onChangeView: (v: "table" | "board" | "calendar") => void;
	allRecords?: Record<string, any[]>;
	onOpenRecord?: (record: any) => void;
}) {
	const isCompact = useIsCompact();
	const setBoardGroupBy = useDatabaseStore((s) => s.setBoardGroupBy);
	const toggleBoardField = useDatabaseStore((s) => s.toggleBoardField);
	const updateFieldValue = useDatabaseStore((s) => s.updateFieldValue);
	const updateField = useDatabaseStore((s) => s.updateField);
	const loadDbRecords = useDatabaseStore((s) => s.loadDbRecords);
	const createDbRecord = useDatabaseStore((s) => s.createDbRecord);
	const loadDbFields = useDatabaseStore((s) => s.loadDbFields);
	const addSort = useDatabaseStore((s) => s.addSort);
	const removeSort = useDatabaseStore((s) => s.removeSort);
	const setSort = useDatabaseStore((s) => s.setSort);
	const addFilter = useDatabaseStore((s) => s.addFilter);
	const removeFilter = useDatabaseStore((s) => s.removeFilter);
	const setFilter = useDatabaseStore((s) => s.setFilter);
	const boardGroupByFieldId = useDatabaseStore((s) =>
		selectBoardGroupBy(s, database.id),
	);
	const boardHiddenFieldIds = useDatabaseStore((s) =>
		selectBoardHidden(s, database.id),
	);
	const activeSorts = useDatabaseStore((s) => selectSorts(s, database.id));
	const activeFilters = useDatabaseStore((s) => selectFilters(s, database.id));
	const [showFieldsPicker, setShowFieldsPicker] = useState(false);
	const fieldsPickerRef = useRef<HTMLDivElement>(null);

	const groupField =
		fields.find((f: any) => f.id === boardGroupByFieldId) ||
		fields.find((f: any) => f.type === "select") ||
		null;

	const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
	const [activeRecord, setActiveRecord] = useState<any>(null);
	const [activeGroupValue, setActiveGroupValue] = useState("");
	const [dropTarget, setDropTarget] = useState<{
		columnId: string;
		index: number;
	} | null>(null);
	const [overColumnId, setOverColumnId] = useState<string | null>(null);
	const [dragType, setDragType] = useState<"card" | "column" | null>(null);
	const [activeColumnName, setActiveColumnName] = useState<string | null>(null);
	const [columnOrder, setColumnOrder] = useState<string[]>([]);

	// MouseSensor (small drag threshold) for pointer devices, TouchSensor (long-press)
	// for touch so a tap-scroll on mobile isn't mistaken for a drag.
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 200, tolerance: 6 },
		}),
	);

	useEffect(() => {
		if (!showFieldsPicker) return;
		const handler = (e: MouseEvent) => {
			if (
				fieldsPickerRef.current &&
				!fieldsPickerRef.current.contains(e.target as Node)
			) {
				setShowFieldsPicker(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showFieldsPicker]);

	// Build groups
	const { groups, groupOrder } = useMemo(() => {
		const g: Record<string, typeof records> = {};
		const order: string[] = [];
		if (!groupField) {
			g[UNGROUPED] = records;
			order.push(UNGROUPED);
		} else {
			const fieldOptions: string[] = groupField.options || [];
			for (const r of records) {
				let key: string;
				if (groupField.type === "select") {
					key = String(r.values[groupField.name] || "Untitled");
				} else if (groupField.type === "multiSelect") {
					// Decoding a stored cell is the registry's job. This copy did not
					// handle the legacy comma-joined form that Notion imports produced,
					// so those rows grouped as "Untitled".
					const raw = r.values[groupField.name];
					const vals = Array.isArray(raw)
						? raw
						: (fieldTypeSpec("multiSelect").decode(
								typeof raw === "string" ? raw : "",
							) as string[]);
					key = vals.length > 0 ? vals.join(", ") : "Untitled";
				} else {
					key = String(r.values[groupField.name] || "Untitled");
				}
				if (!g[key]) {
					g[key] = [];
					order.push(key);
				}
				g[key].push(r);
			}
			for (const opt of fieldOptions) {
				if (!g[opt]) {
					g[opt] = [];
					order.push(opt);
				}
			}
			order.sort((a, b) => {
				const aI = fieldOptions.indexOf(a),
					bI = fieldOptions.indexOf(b);
				if (aI >= 0 && bI >= 0) return aI - bI;
				if (aI >= 0) return -1;
				if (bI >= 0) return 1;
				return 0;
			});
		}
		return { groups: g, groupOrder: order };
	}, [groupField, records]);

	// Reset column order when group field changes
	const _groupFieldId = groupField?.id;
	useEffect(() => {
		setColumnOrder([]);
	}, []);

	// Merge user column order with computed groupOrder (add new groups at end)
	const displayOrder = useMemo(() => {
		const known = new Set(columnOrder);
		return [
			...columnOrder.filter((c) => groupOrder.includes(c)),
			...groupOrder.filter((g) => !known.has(g)),
		];
	}, [columnOrder, groupOrder]);

	const handleDragStart = useCallback(
		({ active }: DragStartEvent) => {
			const id = String(active.id);
			if (id.startsWith("column-")) {
				setDragType("column");
				setActiveColumnName(id.slice(7));
				return;
			}
			setDragType("card");
			const entry = records.find((r) => r.record.id === id);
			if (entry) {
				setActiveRecordId(id);
				setActiveRecord(entry.record);
				setActiveGroupValue(
					groupField
						? String(entry.values[groupField.name] || "Untitled")
						: UNGROUPED,
				);
			}
		},
		[records, groupField],
	);

	const handleDragOver = useCallback(
		({ active, over }: DragOverEvent) => {
			if (dragType === "column") return;
			if (!over) {
				setOverColumnId(null);
				setDropTarget(null);
				return;
			}
			const overId = String(over.id);
			// Hovering the column body droppable ("col-…") or the column wrapper
			// ("column-…") → append to the end of that column.
			if (overId.startsWith("col-")) {
				const colId = overId.slice(4);
				setOverColumnId(colId);
				setDropTarget({ columnId: colId, index: (groups[colId] || []).length });
				return;
			}
			if (overId.startsWith("column-")) {
				const colId = overId.slice(7);
				setOverColumnId(colId);
				setDropTarget({ columnId: colId, index: (groups[colId] || []).length });
				return;
			}
			// Hovering another card → insert at that card's position in its column.
			const overRecord = records.find((r) => r.record.id === overId);
			if (overRecord && groupField) {
				const colId = String(overRecord.values[groupField.name] || "Untitled");
				setOverColumnId(colId);
				const idx = (groups[colId] || []).findIndex(
					(r) => r.record.id === overId,
				);
				if (idx >= 0) setDropTarget({ columnId: colId, index: idx });
			} else {
				setOverColumnId(null);
				setDropTarget(null);
			}
		},
		[dragType, records, groupField, groups],
	);

	const handleDragEnd = useCallback(
		async ({ active, over }: DragEndEvent) => {
			if (dragType === "column") {
				setDragType(null);
				setActiveColumnName(null);
				if (over && activeColumnName) {
					const overId = String(over.id);
					const toCol = overId.startsWith("column-") ? overId.slice(7) : null;
					if (toCol && toCol !== activeColumnName) {
						setColumnOrder((prev) => {
							const base = prev.length > 0 ? prev : displayOrder;
							const from = base.indexOf(activeColumnName);
							const to = base.indexOf(toCol);
							if (from < 0 || to < 0) return base;
							return arrayMove(base, from, to);
						});
					}
				}
				return;
			}
			setActiveRecordId(null);
			setActiveRecord(null);
			setActiveGroupValue("");
			setOverColumnId(null);
			setDropTarget(null);
			if (!over || !activeRecord || !groupField) return;
			const targetCol = dropTarget?.columnId || overColumnId;
			if (!targetCol) return;

			if (targetCol === activeGroupValue) {
				const col = groups[targetCol] || [];
				const ids = col.map((r) => r.record.id);
				const from = ids.indexOf(activeRecord.id);
				let to = dropTarget?.index ?? col.length;
				if (from >= 0 && from < to) to -= 1;
				if (from >= 0 && from !== to) {
					ids.splice(from, 1);
					ids.splice(to, 0, activeRecord.id);
					await api.reorderRecords({ databaseId: database.id, recordIds: ids });
				}
				await loadDbRecords(database.id);
				return;
			}

			if (groupField.type === "select" && !groups[targetCol]) {
				await updateField(groupField.id, {
					options: [...(groupField.options || []), targetCol],
				});
				await loadDbFields(database.id);
			}
			if (groupField.type === "select") {
				await updateFieldValue(
					activeRecord.id,
					groupField.id,
					targetCol === "Untitled" ? "" : targetCol,
				);
			}
			await loadDbRecords(database.id);
		},
		[
			dragType,
			activeColumnName,
			displayOrder,
			activeRecord,
			activeGroupValue,
			groupField,
			groups,
			database.id,
			dropTarget,
			overColumnId,
			updateField,
			updateFieldValue,
			loadDbRecords,
			loadDbFields,
		],
	);

	const SortableColumn = ({
		colName,
		children,
	}: {
		colName: string;
		children: React.ReactNode;
	}) => {
		const {
			attributes,
			listeners,
			setNodeRef,
			transform,
			transition,
			isDragging,
		} = useSortable({ id: `column-${colName}` });
		const style: React.CSSProperties = {
			transform: CSS.Transform.toString(transform),
			transition,
			opacity: isDragging ? 0.5 : 1,
		};
		return (
			<div
				ref={setNodeRef}
				style={style}
				className="group min-w-[268px] max-w-[300px] bg-surface-2 border border-border rounded px-2.5 py-3 flex flex-col max-h-[62vh] transition-[background,border-color] duration-[var(--t)] ease-[var(--ease)] relative"
				data-column-id={colName}
			>
				<div
					className="absolute top-2.5 right-2 opacity-0 transition-opacity duration-[var(--t)] ease-[var(--ease)] cursor-grab p-[3px] rounded-sm text-text-3 flex items-center touch-action-none group-hover:opacity-100 hover:bg-surface-3 hover:text-text-2 hover:opacity-100"
					{...listeners}
					{...attributes}
					title="Drag to reorder column"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 16 16"
						fill="currentColor"
						style={{ opacity: 0.4 }}
					>
						<circle cx="5" cy="3" r="1.5" />
						<circle cx="11" cy="3" r="1.5" />
						<circle cx="5" cy="8" r="1.5" />
						<circle cx="11" cy="8" r="1.5" />
						<circle cx="5" cy="13" r="1.5" />
						<circle cx="11" cy="13" r="1.5" />
					</svg>
				</div>
				{children}
			</div>
		);
	};

	const SortableCard = ({
		record,
		isDragging,
	}: {
		record: any;
		isDragging: boolean;
	}) => {
		const {
			attributes,
			listeners,
			setNodeRef,
			transform,
			transition,
			isDragging: sd,
		} = useSortable({ id: record.record.id });
		const style: React.CSSProperties = {
			transform: CSS.Transform.toString(transform),
			transition,
			opacity: sd ? 0.3 : 1,
		};
		const hasPage = !!record.record.pageId;

		return (
			<div ref={setNodeRef} style={style}>
				<div
					className={cn(
						"group bg-surface border border-border rounded py-2.5 px-3 cursor-pointer transition-[border-color,box-shadow] duration-[var(--t)] ease-[var(--ease)] relative hover:border-[var(--accent-glow)] hover:shadow-sm",
						(isDragging || sd) && "opacity-30",
					)}
				>
					<div
						className="absolute top-2 left-1 opacity-0 transition-opacity duration-[var(--t)] ease-[var(--ease)] cursor-grab p-1 rounded-sm text-text-3 flex items-center touch-action-none group-hover:opacity-100 hover:bg-surface-3 hover:text-text-2"
						{...listeners}
						{...attributes}
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
							<circle cx="5" cy="3" r="1.5" />
							<circle cx="11" cy="3" r="1.5" />
							<circle cx="5" cy="8" r="1.5" />
							<circle cx="11" cy="8" r="1.5" />
							<circle cx="5" cy="13" r="1.5" />
							<circle cx="11" cy="13" r="1.5" />
						</svg>
					</div>
					<IconButton
						variant="ghost"
						className={cn(
							"absolute top-1.5 right-1.5 text-[13px] z-[1] hover:text-accent",
							hasPage ? "opacity-100" : "opacity-0 group-hover:opacity-100",
						)}
						onClick={() => onOpenRecord?.(record.record)}
						title={hasPage ? "Open page" : "Open record"}
					>
						{hasPage ? "📄" : "↗"}
					</IconButton>
					<span
						className={cn(
							"text-[13.5px] font-medium text-text block leading-[1.45]",
							hasPage ? "pl-5 pr-[22px]" : "pl-5",
						)}
					>
						{record.record.title}
					</span>
					<div
						style={{
							marginTop: 8,
							display: "flex",
							flexDirection: "column",
							gap: 4,
						}}
					>
						{fields
							.filter(
								(f: any) =>
									f.id !== groupField?.id &&
									!boardHiddenFieldIds.includes(f.id),
							)
							.map((f: any) => {
								const val = record.values[f.name];
								if (!val && f.type !== "checkbox") return null;
								return (
									<div
										key={f.id}
										className="flex items-baseline gap-[5px] text-[12px]"
									>
										<span className="font-medium text-text-3 shrink-0">
											{f.name}
										</span>
										<CellDisplay
											field={f}
											value={val}
											databases={databases}
											allRecords={allRecords}
										/>
									</div>
								);
							})}
					</div>
				</div>
			</div>
		);
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCorners}
			onDragStart={handleDragStart}
			onDragOver={handleDragOver}
			onDragEnd={handleDragEnd}
		>
			<div className="w-full" data-database-view>
				<DatabaseToolbar name={database.name}>
					<ViewSwitcher
						databaseId={database.id}
						currentViewType={currentView}
					/>
					<Tabs
						variant="toggle"
						aria-label="View type"
						value={currentView}
						onChange={onChangeView}
						items={VIEW_TYPES}
					/>

					<div
						style={{
							marginLeft: 16,
							display: "flex",
							alignItems: "center",
							gap: 6,
							fontSize: 13,
							color: "var(--text-2)",
						}}
					>
						<span style={{ fontWeight: 500 }}>Group by:</span>
						<select
							name="board-group-by"
							value={boardGroupByFieldId || groupField?.id || ""}
							onChange={(e) =>
								setBoardGroupBy(database.id, e.target.value || null)
							}
							className="border border-border rounded px-2 py-[3px] text-[13px] bg-surface text-text cursor-pointer [font-family:var(--font-ui)]"
						>
							<option value="">None</option>
							{fields.map((f: any) => (
								<option key={f.id} value={f.id}>
									{f.name} ({f.type})
								</option>
							))}
						</select>
					</div>

					<div
						style={{ marginLeft: 8, position: "relative" }}
						ref={fieldsPickerRef}
					>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowFieldsPicker((v) => !v)}
						>
							Fields
							{boardHiddenFieldIds.length > 0
								? ` (${fields.filter((f: any) => boardHiddenFieldIds.includes(f.id)).length} hidden)`
								: ""}
						</Button>
						{showFieldsPicker && (
							<div className="absolute top-[calc(100%+6px)] left-0 z-[200] bg-surface border border-border-mid rounded p-2.5 min-w-[200px] shadow-[var(--shadow-lg)]">
								<div className="text-[11px] font-bold text-text-3 uppercase tracking-[0.07em] mb-2">
									Card fields
								</div>
								{fields
									.filter((f: any) => f.id !== groupField?.id)
									.map((f: any) => {
										const hidden = boardHiddenFieldIds.includes(f.id);
										return (
											<label
												key={f.id}
												className="flex items-center gap-2 py-[5px] cursor-pointer text-[13px] text-text rounded"
											>
												<input
													type="checkbox"
													name="field-visibility"
													checked={!hidden}
													onChange={() => toggleBoardField(database.id, f.id)}
												/>
												<span>{f.name}</span>
												<span className="ml-auto text-[11px] text-text-3 bg-surface-3 px-1.5 py-px rounded">
													{f.type}
												</span>
											</label>
										);
									})}
								{fields.filter((f: any) => f.id !== groupField?.id).length ===
									0 && (
									<div
										style={{
											fontSize: 12,
											color: "var(--text-3)",
											padding: "4px 0",
										}}
									>
										No fields to configure
									</div>
								)}
							</div>
						)}
					</div>

					<div
						style={{
							marginLeft: 12,
							display: "flex",
							alignItems: "center",
							gap: 12,
							flexWrap: "wrap",
						}}
					>
						<FilterBar
							fields={fields}
							filters={activeFilters}
							onAdd={() => addFilter(database.id, makeDefaultFilter(fields[0]))}
							onRemove={(idx) => removeFilter(database.id, idx)}
							onChange={(idx, updates) => {
								const ex = activeFilters[idx];
								setFilter(database.id, idx, { ...ex, ...updates });
							}}
						/>
						<SortBar
							fields={fields}
							sorts={activeSorts}
							onAdd={() =>
								addSort(database.id, {
									fieldId: fields[0]?.id || "",
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
				</DatabaseToolbar>

				{/* Below the compact breakpoint the columns are a different
				    interaction model, not a reflowed one: a horizontal row of
				    columns has no honest thumb equivalent. The toolbar above stays
				    — losing it would strand you in a view you cannot leave.
				    See components/db/MobileBoard.tsx. */}
				{isCompact ? (
					<MobileBoard
						groupOrder={displayOrder}
						groups={groups}
						groupFieldName={groupField?.name ?? null}
						visibleFields={fields.filter(
							(f: any) =>
								f.id !== groupField?.id && !boardHiddenFieldIds.includes(f.id),
						)}
						databases={databases}
						allRecords={allRecords}
						onOpenRecord={(r) => onOpenRecord?.(r)}
						onNewRecord={async (groupName) => {
							const record = await createDbRecord(database.id, "");
							if (groupField && groupName !== UNGROUPED)
								await updateFieldValue(record.id, groupField.id, groupName);
							await loadDbRecords(database.id);
							onOpenRecord?.(record);
						}}
					/>
				) : (
					<SortableContext
						items={displayOrder.map((c) => `column-${c}`)}
						strategy={horizontalListSortingStrategy}
					>
						<div className="flex gap-3.5 pt-3 pb-5 overflow-x-auto min-h-[300px] [&::-webkit-scrollbar]:h-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-surface-4 [&::-webkit-scrollbar-thumb]:rounded-sm">
							{displayOrder.map((colName) => (
								<SortableColumn key={colName} colName={colName}>
									<h3 className="text-[11px] text-text-3 mb-2.5 ml-0.5 font-bold tracking-[0.07em] uppercase flex items-center gap-1.5">
										{groupField?.type === "select" &&
										groupField.options?.includes(colName) ? (
											<SelectPill
												value={colName}
												colorIdx={groupField.options.indexOf(colName)}
											/>
										) : (
											<span style={{ fontSize: 13 }}>{colName}</span>
										)}
										<span style={{ color: "var(--text-3)", fontWeight: 400 }}>
											{" "}
											({(groups[colName] || []).length})
										</span>
									</h3>
									<SortableContext
										items={(groups[colName] || []).map((r) => r.record.id)}
										strategy={verticalListSortingStrategy}
									>
										<ColumnBody
											colName={colName}
											isOver={overColumnId === colName}
										>
											{(groups[colName] || []).map((item) => (
												<SortableCard
													key={item.record.id}
													record={item}
													isDragging={activeRecordId === item.record.id}
												/>
											))}
										</ColumnBody>
									</SortableContext>
									<div style={{ padding: "8px 4px" }}>
										{/* The dashed add-card affordance is a column footer, not a Button
										    variant — the dashed border is what says "drop or add here". */}
										<button
											className="w-full bg-transparent border-[1.5px] border-dashed border-border-mid rounded py-[7px] px-3 text-[13px] text-text-3 cursor-pointer transition-[border-color,color] duration-[var(--t)] ease-[var(--ease)] hover:border-accent hover:text-accent"
											onClick={async () => {
												const title = prompt("New record title:");
												if (title?.trim()) {
													await createDbRecord(database.id, title.trim());
													await loadDbRecords(database.id);
												}
											}}
										>
											+ New
										</button>
									</div>
								</SortableColumn>
							))}
							{groupField &&
								(groupField.type === "select" ||
									groupField.type === "multiSelect") && (
									<AddBoardColumn
										groupField={groupField}
										existingOptions={groupField.options || []}
										onAdded={() => loadDbFields(database.id)}
									/>
								)}
						</div>
					</SortableContext>
				)}

				<DragOverlay>
					{activeRecord ? (
						<div className="bg-surface border border-border-mid rounded py-2.5 px-3.5 shadow-[var(--shadow-xl)] max-w-[268px]">
							{activeRecord.title}
						</div>
					) : null}
					{activeColumnName ? (
						<div
							className="min-w-[268px] max-w-[300px] bg-surface border-[1.5px] border-dashed border-border-mid rounded px-2.5 py-3 shadow-[var(--shadow-xl)]"
							style={{ opacity: 0.8, pointerEvents: "none" }}
						>
							<h3 className="text-[11px] text-text-3 mb-2.5 ml-0.5 font-bold tracking-[0.07em] uppercase flex items-center gap-1.5">
								{groupField?.type === "select" &&
								groupField.options?.includes(activeColumnName) ? (
									<SelectPill
										value={activeColumnName}
										colorIdx={groupField.options.indexOf(activeColumnName)}
									/>
								) : (
									<span style={{ fontSize: 13 }}>{activeColumnName}</span>
								)}
							</h3>
						</div>
					) : null}
				</DragOverlay>
			</div>
		</DndContext>
	);
}

// ── Droppable column body ─────────────────────────────────────────────────
//
// Registers the cards container as a drop target so a card can be dropped on
// an empty column (or the whitespace below the cards), not just onto another
// card. Defined at module scope so the droppable node isn't torn down and
// re-registered on every BoardView render.

function ColumnBody({
	colName,
	isOver,
	children,
}: {
	colName: string;
	isOver: boolean;
	children: React.ReactNode;
}) {
	const { setNodeRef } = useDroppable({ id: `col-${colName}` });
	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex flex-col gap-[7px] flex-1 overflow-y-auto min-h-[40px] py-0.5 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-surface-4 [&::-webkit-scrollbar-thumb]:rounded-sm",
				isOver &&
					"bg-[var(--accent-dim)] rounded outline-2 outline-dashed outline-border-mid -outline-offset-2",
			)}
			id={`col-${colName}`}
		>
			{children}
		</div>
	);
}

// ── Inline "Add column" tile (creates a new option on the group-by field) ─

function AddBoardColumn({
	groupField,
	existingOptions,
	onAdded,
}: {
	groupField: { id: string; options: string[] | null };
	existingOptions: string[];
	onAdded: () => void | Promise<void>;
}) {
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (editing) inputRef.current?.focus();
	}, [editing]);

	const commit = async () => {
		const v = value.trim();
		setEditing(false);
		setValue("");
		if (!v || existingOptions.includes(v)) return;
		await api.updateField({
			id: groupField.id,
			options: [...existingOptions, v],
		});
		await onAdded();
	};

	if (!editing) {
		return (
			<div
				className="min-w-[268px] max-w-[300px] bg-surface-2 border border-border rounded px-2.5 py-3 flex flex-col max-h-[62vh] transition-[background,border-color] duration-[var(--t)] ease-[var(--ease)] relative"
				style={{
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "center",
					padding: 8,
					opacity: 0.6,
					cursor: "pointer",
					minWidth: 220,
				}}
				onClick={() => setEditing(true)}
				title="Add a new column"
			>
				<span style={{ fontSize: 13, color: "var(--text-2)" }}>
					+ Add column
				</span>
			</div>
		);
	}
	return (
		<div
			className="min-w-[268px] max-w-[300px] bg-surface-2 border border-border rounded px-2.5 py-3 flex flex-col max-h-[62vh] transition-[background,border-color] duration-[var(--t)] ease-[var(--ease)] relative"
			style={{ padding: 8, minWidth: 220 }}
		>
			<input
				ref={inputRef}
				name="new-column-name"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						commit();
					}
					if (e.key === "Escape") {
						setEditing(false);
						setValue("");
					}
				}}
				placeholder="Column name"
				style={{
					width: "100%",
					border: "1px solid var(--accent)",
					borderRadius: 4,
					padding: "4px 6px",
					fontSize: 13,
					outline: "none",
				}}
			/>
		</div>
	);
}
