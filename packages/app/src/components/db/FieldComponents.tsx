import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import { api } from "../../rpc-client.js";
import { usePageStore } from "../../stores/pageStore.js";
import { Button } from "../ui/index.js";
import { optionColor, Popover } from "./CellComponents.js";

export type FieldType =
	| "text"
	| "number"
	| "select"
	| "multiSelect"
	| "date"
	| "checkbox"
	| "relation"
	| "page"
	| "formula"
	| "people";

interface FieldTypeInfo {
	type: FieldType;
	label: string;
	icon: string;
}

export const FIELD_TYPES: FieldTypeInfo[] = [
	{ type: "text", label: "Text", icon: "Aa" },
	{ type: "number", label: "Number", icon: "#" },
	{ type: "select", label: "Select", icon: "◆" },
	{ type: "multiSelect", label: "Multi-select", icon: "◆◆" },
	{ type: "date", label: "Date", icon: "📅" },
	{ type: "checkbox", label: "Checkbox", icon: "☑" },
	{ type: "page", label: "Page link", icon: "📄" },
	{ type: "relation", label: "Relation", icon: "🔗" },
	{ type: "formula", label: "Formula", icon: "ƒ" },
	{ type: "people", label: "People", icon: "👤" },
];

const BASIC_TYPES = new Set<FieldType>([
	"text",
	"number",
	"select",
	"date",
	"checkbox",
]);

// ── Default column widths by field type ──────────────────────────────
const DEFAULT_WIDTH_BY_TYPE: Record<string, number> = {
	text: 120,
	number: 90,
	select: 120,
	multiSelect: 140,
	date: 130,
	checkbox: 80,
	page: 120,
	relation: 140,
	formula: 120,
	people: 140,
};
export function getDefaultWidthForType(type: string): number {
	return DEFAULT_WIDTH_BY_TYPE[type] ?? 120;
}

// ── Column Header with Menu ───────────────────────────────────────────────

export function ColumnHeader({
	field,
	onRename,
	onDelete,
	onOptions,
	onEditFormula,
	onChangeType,
	onSortAsc,
	onSortDesc,
	onFilter,
	onDuplicate,
	isTitle,
	width,
	onResize,
	sortDir,
	sortIndex,
	onHeaderClick,
	dragRef,
	dragStyle,
	dragListeners,
	dragAttributes,
}: {
	field: { id: string; name: string; type: string };
	onRename: (name: string) => void;
	onDelete: () => void;
	onOptions?: () => void;
	onEditFormula?: () => void;
	onChangeType?: (type: FieldType) => void;
	onSortAsc?: () => void;
	onSortDesc?: () => void;
	onFilter?: () => void;
	onDuplicate?: () => void;
	isTitle?: boolean;
	width?: number;
	onResize?: (fieldId: string, delta: number) => void;
	sortDir?: "asc" | "desc" | null;
	sortIndex?: number | null;
	/** Cycle sort: none → asc → desc → none. Receives shiftKey for multi-sort. */
	onHeaderClick?: (e: React.MouseEvent) => void;
	/** dnd-kit drag wiring for column reorder. */
	dragRef?: (el: HTMLElement | null) => void;
	dragStyle?: React.CSSProperties;
	dragListeners?: any;
	dragAttributes?: any;
}) {
	const [showMenu, setShowMenu] = useState(false);
	const [editing, setEditing] = useState(false);
	const [changingType, setChangingType] = useState(false);
	const [name, setName] = useState(field.name);
	const triggerRef = useRef<HTMLDivElement>(null);

	const typeInfo = FIELD_TYPES.find((f) => f.type === field.type);

	useEffect(() => {
		if (editing) setName(field.name);
	}, [editing, field.name]);

	const handleMenuClose = () => {
		setShowMenu(false);
		setEditing(false);
		setChangingType(false);
	};

	if (isTitle) {
		const defaultW = getDefaultWidthForType("text");
		return (
			<th
				className="relative px-2.5 py-1.5 align-middle border-r border-border last:border-r-0 font-medium text-[11.5px] text-text-2 sticky top-0 z-[3] text-left"
				data-field-id="__title__"
				style={{ minWidth: width || 180, width: width || defaultW }}
			>
				<div
					ref={triggerRef}
					className="flex items-center gap-2 cursor-pointer select-none pl-[18px]"
					onClick={() => setShowMenu(!showMenu)}
				>
					<span style={{ opacity: 0.7, fontSize: 14 }}>🌐</span>
					<span
						style={{
							fontWeight: 500,
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{field.name}
					</span>
				</div>
				{onResize && (
					<div
						className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-[3] hover:bg-accent hover:opacity-30"
						onMouseDown={(e) => {
							e.preventDefault();
							e.stopPropagation();
							const startX = e.clientX;
							const startWidth =
								(e.currentTarget as HTMLElement)
									.closest("th")
									?.getBoundingClientRect().width ??
								(width || 200);
							const onMove = (ev: MouseEvent) => {
								onResize("__title__", startWidth + (ev.clientX - startX));
							};
							const onUp = () => {
								document.removeEventListener("mousemove", onMove);
								document.removeEventListener("mouseup", onUp);
							};
							document.addEventListener("mousemove", onMove);
							document.addEventListener("mouseup", onUp);
						}}
					/>
				)}
				<Popover
					triggerRect={
						showMenu
							? (triggerRef.current?.getBoundingClientRect() ?? null)
							: null
					}
					onClose={handleMenuClose}
					minWidth={200}
				>
					{editing ? (
						<div style={{ padding: 4 }}>
							<input
								name="field-rename"
								value={name}
								onChange={(e) => setName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										if (name.trim()) onRename(name);
										handleMenuClose();
									}
									if (e.key === "Escape") handleMenuClose();
								}}
								onBlur={() => {
									if (name.trim()) onRename(name);
									handleMenuClose();
								}}
								style={{
									width: "100%",
									border: "1px solid #2eaadc",
									borderRadius: 4,
									padding: "4px 8px",
									fontSize: 13,
									outline: "none",
								}}
							/>
						</div>
					) : (
						<div>
							<div
								className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => setEditing(true)}
							>
								Rename column
							</div>
							<div
								className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => {
									onDelete();
									handleMenuClose();
								}}
							>
								Hide column
							</div>
						</div>
					)}
				</Popover>
			</th>
		);
	}

	const defaultW = getDefaultWidthForType(field.type);
	const sortGlyph = sortDir === "asc" ? "↑" : sortDir === "desc" ? "↓" : null;

	return (
		<th
			ref={dragRef as any}
			className="relative px-2.5 py-1.5 align-middle border-r border-border last:border-r-none font-medium text-[11.5px] text-text-2 sticky top-0 z-[3] text-left hover:bg-surface-3"
			data-field-id={field.id}
			style={{
				minWidth: width || defaultW,
				width: width || defaultW,
				...(dragStyle || {}),
			}}
		>
			{dragListeners && (
				<span
					{...dragListeners}
					{...(dragAttributes || {})}
					className="touch-none select-none hover:text-text! cursor-grab"
					title="Drag to reorder"
					style={{
						position: "absolute",
						left: 0,
						top: "50%",
						transform: "translateY(-50%)",
						cursor: "grab",
						padding: "4px 3px",
						fontSize: 14,
						lineHeight: 1,
						color: "#9b9a97",
					}}
					onClick={(e) => e.stopPropagation()}
				>
					⋮⋮
				</span>
			)}
			<div
				ref={triggerRef}
				className="flex items-center gap-2 cursor-pointer select-none pl-[18px]"
				onClick={(e) => {
					// Click on the caret area opens the menu; clicking the rest toggles sort.
					const target = e.target as HTMLElement;
					if (target.closest("[data-col-menu-trigger]")) {
						setShowMenu(!showMenu);
						return;
					}
					if (onHeaderClick) onHeaderClick(e);
					else setShowMenu(!showMenu);
				}}
			>
				<span
					style={{
						opacity: 0.5,
						fontSize: 11,
						marginRight: 4,
						width: 16,
						textAlign: "center",
					}}
				>
					{typeInfo?.icon || "?"}
				</span>
				<span
					style={{
						fontWeight: 500,
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{field.name}
				</span>
				{sortGlyph && (
					<span
						style={{
							fontSize: 11,
							opacity: 0.7,
							marginLeft: 4,
							color: "#2eaadc",
							fontWeight: 600,
						}}
					>
						{sortGlyph}
						{typeof sortIndex === "number" && sortIndex >= 0 ? (
							<sub style={{ fontSize: 9 }}>{sortIndex + 1}</sub>
						) : null}
					</span>
				)}
				<span
					data-col-menu-trigger
					style={{
						fontSize: 10,
						opacity: 0,
						transition: "opacity 0.15s",
						marginLeft: "auto",
						padding: "0 4px",
						cursor: "pointer",
					}}
					className="text-[10px] opacity-0 transition-opacity duration-[150ms] ml-auto px-1 cursor-pointer group-hover/th:opacity-50!"
				>
					▼
				</span>
			</div>

			{onResize && (
				<div
					className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-[3] hover:bg-accent hover:opacity-30"
					onMouseDown={(e) => {
						e.preventDefault();
						e.stopPropagation();
						const startX = e.clientX;
						const startWidth =
							(e.currentTarget as HTMLElement)
								.closest("th")
								?.getBoundingClientRect().width ??
							(width || 150);
						const onMove = (ev: MouseEvent) => {
							onResize(field.id, startWidth + (ev.clientX - startX));
						};
						const onUp = () => {
							document.removeEventListener("mousemove", onMove);
							document.removeEventListener("mouseup", onUp);
						};
						document.addEventListener("mousemove", onMove);
						document.addEventListener("mouseup", onUp);
					}}
				/>
			)}

			<Popover
				triggerRect={
					showMenu
						? (triggerRef.current?.getBoundingClientRect() ?? null)
						: null
				}
				onClose={handleMenuClose}
				minWidth={200}
			>
				{editing ? (
					<div style={{ padding: 4 }}>
						<input
							name="field-rename"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									if (name.trim()) onRename(name);
									handleMenuClose();
								}
								if (e.key === "Escape") handleMenuClose();
							}}
							onBlur={() => {
								if (name.trim()) onRename(name);
								handleMenuClose();
							}}
							style={{
								width: "100%",
								border: "1px solid #2eaadc",
								borderRadius: 4,
								padding: "4px 8px",
								fontSize: 13,
								outline: "none",
							}}
						/>
					</div>
				) : changingType && onChangeType ? (
					<div>
						<div
							style={{
								padding: "4px 8px",
								fontSize: 11,
								color: "#999",
								marginBottom: 4,
								fontWeight: 500,
							}}
						>
							CHANGE TYPE TO
						</div>
						{FIELD_TYPES.map((ft) => (
							<div
								key={ft.type}
								className={`px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text ${ft.type === field.type ? "bg-accent-dim text-accent" : ""}`}
								onClick={() => {
									onChangeType(ft.type);
									handleMenuClose();
								}}
							>
								<span
									style={{
										display: "inline-block",
										width: 20,
										textAlign: "center",
										opacity: 0.6,
									}}
								>
									{ft.icon}
								</span>
								<span>{ft.label}</span>
								{ft.type === field.type && (
									<span style={{ marginLeft: "auto", color: "#2eaadc" }}>
										✓
									</span>
								)}
							</div>
						))}
					</div>
				) : (
					<div>
						<div
							className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
							onClick={() => (onChangeType ? setChangingType(true) : null)}
							style={{ display: "flex", alignItems: "center", gap: 6 }}
							title={onChangeType ? "Change type" : ""}
						>
							<span style={{ opacity: 0.5 }}>{typeInfo?.icon || "?"}</span>
							<span>{typeInfo?.label || field.type}</span>
							{onChangeType && (
								<span
									style={{ marginLeft: "auto", fontSize: 10, opacity: 0.5 }}
								>
									▶
								</span>
							)}
						</div>
						<div style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0" }} />

						{onSortAsc && (
							<div
								className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => {
									onSortAsc();
									handleMenuClose();
								}}
							>
								<span style={{ opacity: 0.5 }}>↑</span> Sort ascending
							</div>
						)}
						{onSortDesc && (
							<div
								className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => {
									onSortDesc();
									handleMenuClose();
								}}
							>
								<span style={{ opacity: 0.5 }}>↓</span> Sort descending
							</div>
						)}
						{onFilter && (
							<div
								className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => {
									onFilter();
									handleMenuClose();
								}}
							>
								<span style={{ opacity: 0.5 }}>⚲</span> Filter by this property
							</div>
						)}
						{(onSortAsc || onSortDesc || onFilter) && (
							<div
								style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0" }}
							/>
						)}
						{onOptions &&
							(field.type === "select" || field.type === "multiSelect") && (
								<div
									className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
									onClick={() => {
										handleMenuClose();
										onOptions();
									}}
								>
									Edit options
								</div>
							)}
						{onEditFormula && field.type === "formula" && (
							<div
								className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => {
									handleMenuClose();
									onEditFormula();
								}}
							>
								Edit formula
							</div>
						)}
						{onDuplicate && (
							<div
								className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => {
									handleMenuClose();
									onDuplicate();
								}}
							>
								Duplicate
							</div>
						)}
						<div
							className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
							onClick={() => {
								onDelete();
								handleMenuClose();
							}}
						>
							Hide column
						</div>
						<div
							className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
							onClick={() => setEditing(true)}
						>
							Rename
						</div>
						<div
							className="px-2.5 py-1.5 rounded-lg cursor-pointer text-[13px] text-text-2 flex items-center gap-1.5 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text text-danger hover:bg-danger-dim! hover:text-danger!"
							onClick={() => {
								onDelete();
								handleMenuClose();
							}}
						>
							Delete
						</div>
					</div>
				)}
			</Popover>
		</th>
	);
}

// ── Options Editor for Select Fields ──────────────────────────────────────

/** One draggable option row inside OptionsEditor. */
function SortableOptionRow({
	opt,
	colorIdx,
	onDelete,
}: {
	opt: string;
	colorIdx: number;
	onDelete: () => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: opt });
	const c = optionColor(colorIdx);
	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
		display: "flex",
		alignItems: "center",
		gap: 6,
		padding: "2px 4px",
		borderRadius: 4,
		background: isDragging ? "#f7f7f5" : undefined,
	};
	return (
		<div ref={setNodeRef} style={style}>
			<span
				{...listeners}
				{...attributes}
				title="Drag to reorder"
				style={{
					cursor: "grab",
					color: "#c0c0bd",
					fontSize: 11,
					lineHeight: 1,
					touchAction: "none",
					display: "flex",
					alignItems: "center",
					padding: "0 1px",
				}}
			>
				⋮⋮
			</span>
			<span
				style={{
					display: "inline-block",
					background: c.bg,
					borderRadius: 3,
					width: 14,
					height: 14,
				}}
			/>
			<span style={{ fontSize: 13, flex: 1 }}>{opt}</span>
			<button
				onClick={onDelete}
				style={{
					background: "none",
					border: "none",
					cursor: "pointer",
					color: "#ccc",
					padding: 2,
					fontSize: 14,
					lineHeight: 1,
				}}
			>
				×
			</button>
		</div>
	);
}

export function OptionsEditor({
	field,
	onClose,
	onUpdate,
	onDeleteOption,
	onAddOption,
}: {
	field: { id: string; name: string; type: string; options?: string[] | null };
	onClose: () => void;
	/** Persist a reordered options array (drives group ordering on the board). */
	onUpdate: (options: string[]) => void;
	onDeleteOption: (option: string) => void;
	onAddOption: (option: string) => void;
}) {
	const [newOption, setNewOption] = useState("");
	const [options, setOptions] = useState<string[]>(
		field.options ? [...field.options] : [],
	);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 200, tolerance: 6 },
		}),
	);

	const handleAdd = () => {
		const opt = newOption.trim();
		if (!opt || options.includes(opt)) return;
		const next = [...options, opt];
		setOptions(next);
		onAddOption(opt);
		setNewOption("");
		inputRef.current?.focus();
	};

	const handleDelete = (opt: string) => {
		const next = options.filter((o) => o !== opt);
		setOptions(next);
		onDeleteOption(opt);
	};

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = options.indexOf(String(active.id));
		const to = options.indexOf(String(over.id));
		if (from < 0 || to < 0) return;
		const next = arrayMove(options, from, to);
		setOptions(next);
		onUpdate(next);
	};

	return (
		<div>
			<div
				style={{
					padding: "4px 8px",
					fontSize: 13,
					fontWeight: 600,
					marginBottom: 4,
				}}
			>
				Edit "{field.name}" options
			</div>
			<div style={{ padding: "0 8px 6px", fontSize: 11, color: "#999" }}>
				Drag to reorder — groups follow this order.
			</div>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
			>
				<SortableContext items={options} strategy={verticalListSortingStrategy}>
					<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
						{options.map((opt, i) => (
							<SortableOptionRow
								key={opt}
								opt={opt}
								colorIdx={i}
								onDelete={() => handleDelete(opt)}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 6,
					marginTop: 8,
					borderTop: "1px solid #f0f0f0",
					paddingTop: 8,
				}}
			>
				<span style={{ opacity: 0.5, fontSize: 12 }}>+</span>
				<input
					ref={inputRef}
					name="new-select-option"
					value={newOption}
					onChange={(e) => setNewOption(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleAdd();
						if (e.key === "Escape") onClose();
					}}
					onBlur={handleAdd}
					placeholder="Add option"
					style={{
						flex: 1,
						border: "none",
						outline: "none",
						fontSize: 13,
						padding: "2px 0",
					}}
				/>
			</div>
		</div>
	);
}

// ── Formula Editor ────────────────────────────────────────────────────────

export function FormulaEditor({
	field,
	onClose,
	onSave,
}: {
	field: { id: string; name: string; formula?: string | null };
	onClose: () => void;
	onSave: (formula: string) => void;
}) {
	const [expr, setExpr] = useState(field.formula || "");
	const inputRef = useRef<HTMLTextAreaElement>(null);
	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	return (
		<div style={{ minWidth: 320 }}>
			<div
				style={{
					padding: "4px 8px",
					fontSize: 13,
					fontWeight: 600,
					marginBottom: 8,
				}}
			>
				Formula for "{field.name}"
			</div>
			<textarea
				ref={inputRef}
				name="formula"
				value={expr}
				onChange={(e) => setExpr(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						onSave(expr.trim());
						onClose();
					}
					if (e.key === "Escape") onClose();
				}}
				placeholder={`e.g. prop("Price") * prop("Qty")`}
				rows={4}
				style={{
					width: "100%",
					border: "1px solid #e9e9e7",
					borderRadius: 4,
					padding: "6px 8px",
					fontSize: 12,
					outline: "none",
					boxSizing: "border-box",
					fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
					resize: "vertical",
				}}
			/>
			<div
				style={{ fontSize: 10, color: "#999", marginTop: 4, padding: "0 4px" }}
			>
				Refs: <code>prop("Field Name")</code> · Ops: <code>+ - * /</code> · Fns:{" "}
				<code>if, sum, round, min, max</code>. <kbd>Cmd</kbd>+<kbd>Enter</kbd>{" "}
				to save.
			</div>
			<div
				style={{
					display: "flex",
					justifyContent: "flex-end",
					gap: 6,
					marginTop: 8,
				}}
			>
				<Button variant="secondary" size="sm" onClick={onClose}>
					Cancel
				</Button>
				<Button
					variant="primary"
					size="sm"
					onClick={() => {
						onSave(expr.trim());
						onClose();
					}}
				>
					Save
				</Button>
			</div>
		</div>
	);
}

// ── Add Field Popover ─────────────────────────────────────────────────────

export function AddFieldPopover({
	triggerRect,
	onClose,
	onAdd,
}: {
	triggerRect: DOMRect | null;
	onClose: () => void;
	onAdd: (
		name: string,
		type: FieldType,
		options?: string[],
		relationTargetDbId?: string | null,
		formula?: string | null,
	) => void;
}) {
	const [name, setName] = useState("");
	const [type, setType] = useState<FieldType>("text");
	const [options, setOptions] = useState<string[]>([]);
	const [optionInput, setOptionInput] = useState("");
	const [relationTarget, setRelationTarget] = useState<string | null>(null);
	const [formula, setFormula] = useState("");
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [allDbs, setAllDbs] = useState<
		Array<{ id: string; name: string; pageId: string }>
	>([]);
	const pages = usePageStore((s) => s.pages);
	const nameRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (nameRef.current) setTimeout(() => nameRef.current?.focus(), 50);
	}, []);

	// Lazy-load every database in the workspace the first time the relation
	// type is chosen, so the target picker isn't limited to the current page.
	useEffect(() => {
		if (type !== "relation" || allDbs.length > 0) return;
		api.listAllDatabases().then((dbs) => setAllDbs(dbs as any));
	}, [type, allDbs.length]);

	const handleAddOption = () => {
		const opt = optionInput.trim();
		if (!opt || options.includes(opt)) return;
		setOptions([...options, opt]);
		setOptionInput("");
	};

	const handleCreate = () => {
		if (!name.trim()) return;
		onAdd(
			name.trim(),
			type,
			type === "select" || type === "multiSelect" ? options : undefined,
			type === "relation" ? relationTarget : null,
			type === "formula" ? formula.trim() || null : null,
		);
		onClose();
	};

	return (
		<Popover triggerRect={triggerRect} onClose={onClose} minWidth={300}>
			<div
				data-add-field
				style={{
					padding: 4,
					display: "flex",
					flexDirection: "column",
					maxHeight: "calc(70vh - 16px)",
				}}
			>
				<div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
					<div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
						New property
					</div>
					<input
						ref={nameRef}
						name="new-property-name"
						placeholder="Property name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleCreate();
						}}
						style={{
							width: "100%",
							border: "1px solid #e9e9e7",
							borderRadius: 4,
							padding: "6px 8px",
							fontSize: 13,
							marginBottom: 12,
							outline: "none",
							boxSizing: "border-box",
						}}
					/>

					<div
						style={{
							fontSize: 11,
							color: "#999",
							marginBottom: 6,
							fontWeight: 500,
						}}
					>
						TYPE
					</div>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 2,
							marginBottom: 12,
						}}
					>
						{FIELD_TYPES.filter((ft) => BASIC_TYPES.has(ft.type)).map((ft) => (
							<div
								key={ft.type}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									padding: "5px 8px",
									borderRadius: 4,
									cursor: "pointer",
									background:
										type === ft.type ? "rgba(0,0,0,0.05)" : "transparent",
									fontSize: 13,
								}}
								onClick={() => setType(ft.type)}
							>
								<span
									style={{
										width: 20,
										textAlign: "center",
										fontSize: 11,
										opacity: 0.6,
									}}
								>
									{ft.icon}
								</span>
								<span>{ft.label}</span>
								{type === ft.type && (
									<span
										style={{
											marginLeft: "auto",
											color: "#2eaadc",
											fontSize: 12,
										}}
									>
										✓
									</span>
								)}
							</div>
						))}

						{/* Advanced types fold */}
						<div
							onClick={() => setShowAdvanced(!showAdvanced)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "5px 8px",
								cursor: "pointer",
								fontSize: 12,
								color: "#999",
								marginTop: 4,
							}}
						>
							<span
								style={{
									fontSize: 10,
									transition: "transform 0.15s",
									transform: showAdvanced ? "rotate(90deg)" : "rotate(0deg)",
								}}
							>
								▶
							</span>
							<span>{showAdvanced ? "Hide advanced" : "Show advanced"}</span>
						</div>

						{showAdvanced &&
							FIELD_TYPES.filter((ft) => !BASIC_TYPES.has(ft.type)).map(
								(ft) => (
									<div
										key={ft.type}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 8,
											padding: "5px 8px",
											borderRadius: 4,
											cursor: "pointer",
											background:
												type === ft.type ? "rgba(0,0,0,0.05)" : "transparent",
											fontSize: 13,
										}}
										onClick={() => setType(ft.type)}
									>
										<span
											style={{
												width: 20,
												textAlign: "center",
												fontSize: 11,
												opacity: 0.6,
											}}
										>
											{ft.icon}
										</span>
										<span>{ft.label}</span>
										{type === ft.type && (
											<span
												style={{
													marginLeft: "auto",
													color: "#2eaadc",
													fontSize: 12,
												}}
											>
												✓
											</span>
										)}
									</div>
								),
							)}
					</div>

					{(type === "select" || type === "multiSelect") && (
						<div
							style={{
								marginBottom: 12,
								borderTop: "1px solid #f0f0f0",
								paddingTop: 8,
							}}
						>
							<div
								style={{
									fontSize: 11,
									color: "#999",
									marginBottom: 6,
									fontWeight: 500,
								}}
							>
								OPTIONS
							</div>
							<div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
								{options.map((opt, i) => {
									const c = optionColor(i);
									return (
										<div
											key={opt}
											style={{
												display: "flex",
												alignItems: "center",
												gap: 6,
												padding: "2px 4px",
											}}
										>
											<span
												style={{
													display: "inline-block",
													background: c.bg,
													borderRadius: 3,
													width: 14,
													height: 14,
												}}
											/>
											<span style={{ fontSize: 13, flex: 1 }}>{opt}</span>
											<button
												onClick={() =>
													setOptions(options.filter((o) => o !== opt))
												}
												style={{
													background: "none",
													border: "none",
													cursor: "pointer",
													color: "#ccc",
													fontSize: 14,
													padding: 2,
													lineHeight: 1,
												}}
											>
												×
											</button>
										</div>
									);
								})}
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 6,
										padding: "2px 4px",
									}}
								>
									<span style={{ opacity: 0.5, fontSize: 12 }}>+</span>
									<input
										name="new-option"
										value={optionInput}
										onChange={(e) => setOptionInput(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddOption();
											}
										}}
										placeholder="Add option"
										style={{
											flex: 1,
											border: "none",
											outline: "none",
											fontSize: 13,
											padding: "2px 0",
										}}
									/>
								</div>
							</div>
						</div>
					)}

					{type === "formula" && (
						<div
							style={{
								marginBottom: 12,
								borderTop: "1px solid #f0f0f0",
								paddingTop: 8,
							}}
						>
							<div
								style={{
									fontSize: 11,
									color: "#999",
									marginBottom: 6,
									fontWeight: 500,
								}}
							>
								EXPRESSION
							</div>
							<textarea
								name="formula"
								value={formula}
								onChange={(e) => setFormula(e.target.value)}
								placeholder={`e.g. prop("Price") * prop("Qty")`}
								rows={3}
								style={{
									width: "100%",
									border: "1px solid #e9e9e7",
									borderRadius: 4,
									padding: "6px 8px",
									fontSize: 12,
									outline: "none",
									boxSizing: "border-box",
									fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
									resize: "vertical",
								}}
							/>
							<div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
								Refs: <code>prop("Field Name")</code> · Ops:{" "}
								<code>+ - * /</code> · Fns:{" "}
								<code>if, sum, round, min, max</code>
							</div>
						</div>
					)}

					{type === "relation" && (
						<div
							style={{
								marginBottom: 12,
								borderTop: "1px solid #f0f0f0",
								paddingTop: 8,
							}}
						>
							<div
								style={{
									fontSize: 11,
									color: "#999",
									marginBottom: 6,
									fontWeight: 500,
								}}
							>
								RELATE TO
							</div>
							<select
								name="relation-target"
								value={relationTarget || ""}
								onChange={(e) => setRelationTarget(e.target.value || null)}
								style={{
									width: "100%",
									border: "1px solid #e9e9e7",
									borderRadius: 4,
									padding: "6px 8px",
									fontSize: 13,
									boxSizing: "border-box",
								}}
							>
								<option value="">Select a database…</option>
								{allDbs.map((db) => {
									const page = pages.find((p) => p.id === db.pageId);
									const pageTitle = page?.title || "Untitled page";
									return (
										<option key={db.id} value={db.id}>
											{db.name} — {pageTitle}
										</option>
									);
								})}
							</select>
						</div>
					)}
				</div>

				<div
					style={{
						flexShrink: 0,
						paddingTop: 8,
						borderTop: "1px solid #f0f0f0",
						marginTop: 8,
					}}
				>
					<Button
						variant="primary"
						size="sm"
						className="w-full"
						onClick={handleCreate}
						disabled={!name.trim()}
					>
						Create
					</Button>
				</div>
			</div>
		</Popover>
	);
}
