import { type FieldType, fieldTypeSpec } from "@notara/shared";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { tryEvaluate } from "../../lib/formula.js";
import { splitMultiSelect } from "../../lib/multiSelect.js";
import { useIsCompact } from "../../lib/useIsCompact.js";
import { api, getCurrentWorkspaceId } from "../../rpc-client.js";
import { usePageStore } from "../../stores/pageStore.js";
import { Badge } from "../ui/Badge.js";

// ── Shared constants ──────────────────────────────────────────────────────

// Option colours — user data, deliberately theme-independent: a green option
// stays green whatever the chrome does. The pastel fills these used to carry
// are gone; the colour now lives in a dot, which is the design system's rule
// for a value that already reads from its colour.
const SELECT_COLORS = [
	{ dot: "var(--text-3)" },
	{ dot: "#A1663B" },
	{ dot: "var(--warning)" },
	{ dot: "#C9A227" },
	{ dot: "var(--success)" },
	{ dot: "#2B7FB8" },
	{ dot: "#5B5BD6" },
	{ dot: "#C2408A" },
	{ dot: "var(--danger)" },
];

export function optionColor(idx: number) {
	return SELECT_COLORS[idx % SELECT_COLORS.length];
}

// ── Autocomplete keyboard navigation hook ──────────────────────────────

function useAutocomplete<T>(
	items: T[],
	onSelect: (item: T) => void,
	onCancel: () => void,
) {
	const [activeIndex, setActiveIndex] = useState(0);

	// Clamp and reset index when items change
	useEffect(() => {
		setActiveIndex((prev) => {
			if (items.length === 0) return 0;
			return Math.min(prev, items.length - 1);
		});
	}, [items.length]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex((prev) => (prev + 1) % Math.max(1, items.length));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setActiveIndex(
					(prev) => (prev - 1 + items.length) % Math.max(1, items.length),
				);
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (items.length > 0 && items[activeIndex] !== undefined) {
					onSelect(items[activeIndex]);
				}
			} else if (e.key === "Escape") {
				onCancel();
			}
		},
		[items, activeIndex, onSelect, onCancel],
	);

	return { activeIndex, setActiveIndex, handleKeyDown };
}

// ── Positioning helpers ────────────────────────────────────────────────────

function calcPopoverPosition(
	triggerRect: DOMRect,
	elWidth: number,
	elHeight: number,
): { top: number; left: number } {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const margin = 8;

	let top = triggerRect.bottom + margin;
	if (top + elHeight > vh - margin) top = triggerRect.top - elHeight - margin;
	if (top < margin) top = margin;

	let left = triggerRect.left;
	if (left + elWidth > vw - margin) left = triggerRect.right - elWidth;
	if (left < margin) left = margin;

	return { top, left };
}

// ── Auto-positioned Popover ───────────────────────────────────────────────

export function Popover({
	triggerRect,
	onClose,
	children,
	minWidth = 240,
}: {
	triggerRect: DOMRect | null;
	onClose: () => void;
	children: React.ReactNode;
	minWidth?: number;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const compact = useIsCompact();
	const [pos, setPos] = useState<{ top: number; left: number }>({
		top: 0,
		left: 0,
	});

	// Initial measurement + position when triggerRect changes.
	// Uses a hide-measure-restore cycle to read natural dimensions before
	// the element is styled with the computed position.
	useEffect(() => {
		if (!triggerRect || !ref.current) return;
		const el = ref.current;
		el.style.visibility = "hidden";
		el.style.display = "block";
		const w = el.offsetWidth;
		const h = el.offsetHeight;
		el.style.display = "";
		el.style.visibility = "";

		setPos(calcPopoverPosition(triggerRect, w, h));
	}, [triggerRect]);

	// ResizeObserver: reposition whenever the popover content grows or shrinks
	// (e.g. options added, "Show advanced" toggled, async DB list loaded).
	// Uses a ref-based copy of triggerRect so the RO callback reads the latest
	// value even if the component re-renders without triggerRect reference
	// changing (which is the common case — content grows without the anchor
	// moving).
	const triggerRectRef = useRef(triggerRect);
	triggerRectRef.current = triggerRect;

	useEffect(() => {
		const el = ref.current;
		if (!el || !triggerRectRef.current) return;
		const ro = new ResizeObserver(() => {
			const tr = triggerRectRef.current;
			const currentEl = ref.current;
			if (!tr || !currentEl) return;
			setPos((prev) => {
				const next = calcPopoverPosition(
					tr,
					currentEl.offsetWidth,
					currentEl.offsetHeight,
				);
				if (prev.top === next.top && prev.left === next.left) return prev;
				return next;
			});
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	useEffect(() => {
		if (!triggerRect) return;
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		};
		const keyHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		setTimeout(() => {
			document.addEventListener("mousedown", handler);
			document.addEventListener("keydown", keyHandler);
		}, 0);
		return () => {
			document.removeEventListener("mousedown", handler);
			document.removeEventListener("keydown", keyHandler);
		};
	}, [triggerRect, onClose]);

	if (!triggerRect) return null;

	// On a phone a floating box anchored to a control fights the surface it is
	// anchored to: inside the mobile edit sheet the trigger already sits at the
	// bottom of the screen, so "below the trigger" is off-screen, and flipping
	// above lands on top of the value you are trying to read. Every picker
	// becomes a sheet of its own instead — one change, and select, multiSelect,
	// relation and page all behave, with no per-type mobile branch.
	if (compact)
		return (
			<div ref={ref} className="db-popover-sheet" style={{ zIndex: 10000 }}>
				{children}
			</div>
		);

	return (
		<div
			ref={ref}
			style={{
				position: "fixed",
				top: pos.top,
				left: pos.left,
				zIndex: 10000,
				minWidth,
				background: "var(--surface)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				boxShadow: "var(--shadow-lg)",
				padding: 8,
				maxHeight: "70vh",
				overflow: "auto",
			}}
		>
			{children}
		</div>
	);
}

// ── Cell-anchored Popover (escapes table overflow) ───────────────────────

/**
 * Portal-mounted popover that anchors itself below the nearest `.db-cell`
 * (or `.record-panel-prop-value`) ancestor of its anchor element. Uses
 * position:fixed so the table's overflow-x:auto wrapper can't clip it.
 * Clamps to the viewport edges with a small margin.
 */
export function CellAnchoredPopover({
	onClose,
	children,
	minWidth = 200,
}: {
	onClose: () => void;
	children: React.ReactNode;
	minWidth?: number;
}) {
	const anchorRef = useRef<HTMLSpanElement>(null);
	const popRef = useRef<HTMLDivElement>(null);
	const compact = useIsCompact();
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

	const calcAnchoredPos = useCallback(() => {
		const anchor = anchorRef.current;
		const pop = popRef.current;
		if (!anchor || !pop) return null;
		const cell = anchor.closest(
			".db-cell, .record-panel-prop-value",
		) as HTMLElement | null;
		if (!cell) return null;
		const cellRect = cell.getBoundingClientRect();
		const popRect = pop.getBoundingClientRect();
		const margin = 6;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		let top = cellRect.bottom + 2;
		if (top + popRect.height > vh - margin)
			top = Math.max(margin, cellRect.top - popRect.height - 2);
		let left = cellRect.left;
		if (left + popRect.width > vw - margin) left = vw - margin - popRect.width;
		if (left < margin) left = margin;
		return { top, left };
	}, []);

	useLayoutEffect(() => {
		const p = calcAnchoredPos();
		if (p) setPos(p);
	}, [calcAnchoredPos]);

	// ResizeObserver: reposition content growth/shrinkage in the popover
	useEffect(() => {
		const el = popRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() => {
			const p = calcAnchoredPos();
			if (!p) return;
			setPos((prev) => {
				if (prev && prev.top === p.top && prev.left === p.left) return prev;
				return p;
			});
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, [calcAnchoredPos]);

	useEffect(() => {
		const onDown = (e: MouseEvent) => {
			if (popRef.current && !popRef.current.contains(e.target as Node))
				onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		// Defer attaching click handler so the click that opened us doesn't close us
		const id = window.setTimeout(() => {
			document.addEventListener("mousedown", onDown);
			document.addEventListener("keydown", onKey);
		}, 0);
		return () => {
			window.clearTimeout(id);
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [onClose]);

	return (
		<>
			<span ref={anchorRef} style={{ display: "none" }} />
			{createPortal(
				compact ? (
					// Same reasoning as Popover: on a phone the picker is the surface.
					<div
						ref={popRef}
						className="db-popover-sheet"
						style={{ zIndex: 10000 }}
						onMouseDown={(e) => e.stopPropagation()}
					>
						{children}
					</div>
				) : (
					<div
						ref={popRef}
						className="bg-surface border border-border-mid rounded shadow-[var(--shadow-lg)] p-1 max-h-[360px] overflow-y-auto"
						style={{
							position: "fixed",
							top: pos?.top ?? -9999,
							left: pos?.left ?? -9999,
							visibility: pos ? "visible" : "hidden",
							minWidth,
							zIndex: 10000,
						}}
						onMouseDown={(e) => e.stopPropagation()}
					>
						{children}
					</div>
				),
				document.body,
			)}
		</>
	);
}

// ── Cell Display Components ───────────────────────────────────────────────

export function SelectPill({
	value,
	colorIdx,
	bare = false,
}: {
	value: string;
	colorIdx: number;
	/** A single value reads from its dot — it does not also need a pill. */
	bare?: boolean;
}) {
	const c = optionColor(colorIdx);
	return (
		<Badge variant={bare ? "dot" : "outline"} dotColor={c.dot}>
			{value}
		</Badge>
	);
}

/**
 * Several values side by side, each needing a boundary — the one case the
 * design system reserves a chip for. Past two they collapse into a count, so a
 * cell with eight tags is still one --row tall instead of wrapping the table
 * out of its rhythm.
 */
export function SelectPills({
	values,
	options,
}: {
	values: string[];
	options: string[];
}) {
	const { shown, hidden } = splitMultiSelect(values);
	return (
		<span className="db-multiselect">
			{shown.map((v) => {
				const i = options.indexOf(v);
				return <SelectPill key={v} value={v} colorIdx={i >= 0 ? i : 0} />;
			})}
			{hidden.length > 0 && (
				<Badge variant="neutral" title={hidden.join(", ")}>
					+{hidden.length}
				</Badge>
			)}
		</span>
	);
}

/**
 * Decode a stored cell into the list its display expects.
 *
 * Four near-identical `JSON.parse` blocks used to do this, each with slightly
 * different fallbacks — which is how a page cell written as a bare id and one
 * written as an array ended up handled in only one of them. The registry owns
 * the stored representations now; this only bridges the case where a caller
 * already handed us a decoded array.
 */
function decodeCell(type: string, value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	const decoded = fieldTypeSpec(type).decode(
		typeof value === "string" ? value : "",
	);
	return Array.isArray(decoded) ? decoded.map(String) : [];
}

export function CellDisplay({
	field,
	value,
	databases,
	allRecords = {},
	recordValues,
}: {
	field: {
		id: string;
		name: string;
		type: FieldType;
		options?: string[];
		relationTargetDbId?: string | null;
		formula?: string | null;
	};
	value: any;
	databases: any[];
	allRecords?: Record<string, any[]>;
	/** All values keyed by field name on the current record — used by formula cells. */
	recordValues?: Record<string, unknown>;
}) {
	if (field.type === "formula") {
		const res = tryEvaluate(field.formula ?? null, recordValues ?? {});
		if (!res.ok) {
			return (
				<span
					title={res.error}
					style={{
						fontSize: 12,
						color: "var(--danger)",
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
					}}
				>
					#ERR
				</span>
			);
		}
		const v = res.value;
		if (v === null || v === undefined || v === "")
			return <span style={{ color: "var(--text-3)" }}>&nbsp;</span>;
		if (typeof v === "number") {
			const display = Number.isFinite(v)
				? v.toLocaleString(undefined, { maximumFractionDigits: 6 })
				: String(v);
			return (
				<span style={{ fontSize: 13, color: "var(--text)" }}>{display}</span>
			);
		}
		if (typeof v === "boolean")
			return (
				<span style={{ fontSize: 13, color: "var(--text)" }}>
					{v ? "✓" : ""}
				</span>
			);
		return (
			<span style={{ fontSize: 13, color: "var(--text)" }}>{String(v)}</span>
		);
	}

	if (value === null || value === undefined || value === "") {
		return <span style={{ color: "var(--text-3)" }}>&nbsp;</span>;
	}

	if (field.type === "checkbox") {
		const checked = String(value) === "true";
		return (
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					height: 24,
				}}
			>
				<div
					style={{
						width: 18,
						height: 18,
						borderRadius: 3,
						border: checked ? "none" : "1.5px solid var(--border-mid)",
						background: checked ? "var(--accent)" : "transparent",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					{checked && (
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
							<path
								d="M10 3L4.5 8.5L2 6"
								stroke="white"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					)}
				</div>
			</div>
		);
	}

	if (field.type === "select") {
		const opts = field.options || [];
		const idx = opts.indexOf(String(value));
		return value ? (
			<SelectPill value={String(value)} colorIdx={idx >= 0 ? idx : 0} bare />
		) : (
			<span style={{ color: "var(--text-3)" }}>&nbsp;</span>
		);
	}

	if (field.type === "multiSelect") {
		const vals = decodeCell(field.type, value);
		if (!vals.length)
			return <span style={{ color: "var(--text-3)" }}>&nbsp;</span>;
		return <SelectPills values={vals} options={field.options || []} />;
	}

	if (field.type === "date")
		return (
			<span style={{ fontSize: 13, color: "var(--text)" }}>
				{String(value)}
			</span>
		);
	if (field.type === "number") {
		if (!value) return <span style={{ color: "var(--text-3)" }}>&nbsp;</span>;
		return (
			<span style={{ fontSize: 13, color: "var(--text)" }}>
				{Number(value).toLocaleString()}
			</span>
		);
	}

	if (field.type === "page") {
		const vals = decodeCell(field.type, value);
		if (!vals.length)
			return <span style={{ color: "var(--text-3)" }}>&nbsp;</span>;
		return (
			<div
				style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "2px 0" }}
			>
				{vals.map((pageId) => (
					<PageChip key={pageId} pageId={pageId} />
				))}
			</div>
		);
	}

	if (field.type === "people") {
		const userIds = decodeCell(field.type, value);
		if (!userIds.length)
			return <span style={{ color: "var(--text-3)" }}>&nbsp;</span>;
		return (
			<div
				style={{
					display: "flex",
					gap: 6,
					flexWrap: "wrap",
					padding: "2px 0",
					alignItems: "center",
				}}
			>
				{userIds.map((uid) => (
					<PeopleChip key={uid} userId={uid} />
				))}
			</div>
		);
	}

	if (field.type === "relation") {
		const vals = decodeCell(field.type, value);
		if (!vals.length)
			return <span style={{ color: "var(--text-3)" }}>&nbsp;</span>;
		const targetDbId = field.relationTargetDbId;
		return (
			<div
				style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "2px 0" }}
			>
				{vals.map((id) => (
					<RelationChip
						key={id}
						recordId={id}
						targetDbId={targetDbId || null}
						databases={databases}
						allRecords={allRecords}
					/>
				))}
			</div>
		);
	}

	return (
		<span style={{ fontSize: 13, color: "var(--text)" }}>{String(value)}</span>
	);
}

/**
 * Inline pill rendering a single page link.
 * Reads from the page store; navigates when clicked.
 */
/**
 * Navigate to a page via pushState — popstate listener in main.tsx will
 * pick it up and load blocks/databases for that page.
 */
function navigateToPage(pageId: string) {
	const url = new URL(window.location.href);
	url.searchParams.set("page", pageId);
	window.history.pushState({ pageId }, "", url);
	window.dispatchEvent(new PopStateEvent("popstate"));
}

function isNavModifier(e: React.MouseEvent): boolean {
	return e.metaKey || e.ctrlKey;
}

function PageChip({ pageId }: { pageId: string }) {
	const pages = usePageStore((s) => s.pages);
	const page = pages.find((p) => p.id === pageId);
	const title = page?.title || pageId.slice(0, 8);
	const icon = page?.icon || "📄";
	const onClick = (e: React.MouseEvent) => {
		if (isNavModifier(e)) {
			e.preventDefault();
			e.stopPropagation();
			navigateToPage(pageId);
		}
		// No modifier: let the click bubble up so the cell opens the picker.
	};
	return (
		<span
			className="inline-flex items-center gap-1 bg-surface-3 border border-border rounded px-2 py-0.5 text-[12.5px] cursor-pointer max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap text-text-2 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-4 hover:text-text"
			onClick={onClick}
			title={`${title} — ${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}-click to open`}
		>
			<span className="opacity-70">{icon}</span>
			<span>{title}</span>
		</span>
	);
}

/**
 * Pill for a relation value. Cmd/Ctrl+click navigates to the host page of
 * the target database (the database's pageId). Without a modifier, click
 * bubbles up to the cell's edit handler so the picker opens.
 */
function RelationChip({
	recordId,
	targetDbId,
	databases,
	allRecords,
}: {
	recordId: string;
	targetDbId: string | null;
	databases: any[];
	allRecords: Record<string, any[]>;
}) {
	const cachedRecords = targetDbId ? allRecords[targetDbId] || [] : [];
	const record = cachedRecords.find((r: any) => r.id === recordId);
	const title = record?.title || recordId.slice(0, 8);
	const [remoteHostPageId, setRemoteHostPageId] = useState<string | null>(null);
	const hostPageId =
		databases.find((d: any) => d.id === targetDbId)?.pageId ?? remoteHostPageId;

	useEffect(() => {
		if (!targetDbId || databases.some((d: any) => d.id === targetDbId)) return;
		api
			.getDatabase({ id: targetDbId })
			.then((db) => setRemoteHostPageId(db.pageId))
			.catch(() => {
				/* ignore */
			});
	}, [targetDbId, databases]);

	const onClick = (e: React.MouseEvent) => {
		if (isNavModifier(e)) {
			e.preventDefault();
			e.stopPropagation();
			if (hostPageId) {
				navigateToPage(hostPageId);
				// After the page loads, ask the host DatabaseView to open this record.
				window.dispatchEvent(
					new CustomEvent("db-open-record", { detail: { recordId } }),
				);
			}
		}
	};

	return (
		<span
			className="inline-block bg-accent-dim border border-[var(--accent-glow)] text-accent-2 rounded px-2 py-0.5 text-[12.5px] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer"
			onClick={onClick}
			title={`${title} — ${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}-click to open`}
		>
			{title}
		</span>
	);
}

// ── People Chip ─────────────────────────────────────────────────────────────

/** Inline avatar + name chip for a workspace member. Fetches member info from
 *  the workspace members cache. */
export function PeopleChip({ userId }: { userId: string }) {
	const [member, setMember] = useState<{ name: string } | null>(null);

	useEffect(() => {
		const wsId = getCurrentWorkspaceId();
		if (!wsId) return;
		api
			.getWorkspaceMembers({ workspaceId: wsId })
			.then((members) => {
				const m = members.find((x: any) => x.userId === userId);
				if (m) setMember(m);
			})
			.catch(() => {
				/* ignore */
			});
	}, [userId]);

	const name = member?.name || userId.slice(0, 8);
	const initial = name.charAt(0).toUpperCase();

	return (
		<span
			className="inline-flex items-center gap-[5px] bg-surface-3 border border-border rounded-full py-px pl-[3px] pr-2 text-[12.5px] max-w-[200px] text-text-2"
			title={name}
		>
			<span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent-dim text-accent-2 text-[10px] font-semibold shrink-0">
				{initial}
			</span>
			<span className="overflow-hidden text-ellipsis whitespace-nowrap">
				{name}
			</span>
		</span>
	);
}

// ── Select / Multi-select Popover (with inline create) ───────────────────

function SelectPopover({
	field,
	value,
	onSave,
	onCancel,
}: {
	field: {
		id: string;
		name: string;
		type: FieldType;
		options?: string[] | null;
	};
	value: any;
	onSave: (val: string) => void;
	onCancel: () => void;
}) {
	const [query, setQuery] = useState("");
	const [options, setOptions] = useState<string[]>(field.options || []);
	useEffect(() => {
		setOptions(field.options || []);
	}, [field.options]);

	const currentArr: string[] =
		field.type === "multiSelect"
			? Array.isArray(value)
				? value
				: typeof value === "string"
					? (() => {
							try {
								return JSON.parse(value);
							} catch {
								return [];
							}
						})()
					: []
			: [value || ""];

	const q = query.trim();
	const filtered = q
		? options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
		: options;
	const exact = options.some((o) => o.toLowerCase() === q.toLowerCase());
	const canCreate = q.length > 0 && !exact;

	const hasValue = field.type !== "multiSelect" && !!currentArr[0];
	const isEmptyQuery = q.length === 0;

	const choose = (opt: string) => {
		if (field.type === "multiSelect") {
			const next = currentArr.includes(opt)
				? currentArr.filter((s) => s !== opt)
				: [...currentArr, opt];
			onSave(JSON.stringify(next));
		} else {
			onSave(opt);
		}
		setQuery("");
	};

	const clear = () => {
		onSave("");
		setQuery("");
	};

	const create = async () => {
		const opt = q;
		const next = [...options, opt];
		setOptions(next);
		await api.updateField({ id: field.id, options: next });
		choose(opt);
	};

	// Build flat nav items for keyboard autocomplete navigation
	type NavItem =
		| { type: "clear" }
		| { type: "option"; value: string }
		| { type: "create" };
	const navItems: NavItem[] = [];
	if (hasValue && isEmptyQuery) navItems.push({ type: "clear" });
	for (const opt of filtered) navItems.push({ type: "option", value: opt });
	if (canCreate) navItems.push({ type: "create" });

	const { activeIndex, handleKeyDown } = useAutocomplete(
		navItems,
		(item) => {
			if (item.type === "clear") clear();
			else if (item.type === "option" && item.value) choose(item.value);
			else if (item.type === "create") create();
		},
		onCancel,
	);

	return (
		<CellAnchoredPopover onClose={onCancel}>
			<input
				name="cell-select-search"
				className="w-full px-2 py-[7px] border border-border rounded text-[13px] outline-none box-border mb-1 bg-surface-2 text-text [font-family:var(--font-ui)] focus:border-accent"
				placeholder="Search or create…"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				onKeyDown={handleKeyDown}
			/>
			<div className="flex flex-col gap-px">
				{navItems.map((item, idx) => {
					const isActive = idx === activeIndex;
					if (item.type === "clear") {
						return (
							<div
								key="clear"
								className="px-2 py-1.5 rounded cursor-pointer flex items-center gap-2 text-text-2 hover:bg-surface-3 hover:text-text"
								onClick={clear}
								style={{
									borderBottom: "1px solid var(--border)",
									marginBottom: 2,
									background: isActive ? "var(--accent-mid)" : undefined,
								}}
							>
								<span style={{ fontSize: 14, opacity: 0.5 }}>✕</span>
								<span style={{ fontSize: 13, color: "var(--text-3)" }}>
									Clear
								</span>
							</div>
						);
					}
					if (item.type === "option") {
						const opt = item.value;
						const i = options.indexOf(opt);
						const isSelected =
							field.type === "multiSelect"
								? currentArr.includes(opt)
								: currentArr[0] === opt;
						const c = optionColor(i);
						return (
							<div
								key={opt}
								className="px-2 py-1.5 rounded cursor-pointer flex items-center gap-2 text-text-2 hover:bg-surface-3 hover:text-text"
								style={{
									background: isActive
										? "var(--accent-mid)"
										: isSelected
											? "var(--hover-ink)"
											: undefined,
								}}
								onClick={() => choose(opt)}
							>
								<span
									style={{
										display: "inline-block",
										background: c.dot,
										borderRadius: "50%",
										width: 8,
										height: 8,
										flexShrink: 0,
									}}
								/>
								<span style={{ fontSize: 13, flex: 1 }}>{opt}</span>
								{isSelected && (
									<span style={{ color: "var(--accent)", fontSize: 14 }}>
										✓
									</span>
								)}
							</div>
						);
					}
					if (item.type === "create") {
						return (
							<div
								key="create"
								className="px-2 py-1.5 rounded cursor-pointer flex items-center gap-2 text-text-2 hover:bg-surface-3 hover:text-text text-accent hover:bg-accent-dim hover:text-accent"
								onClick={create}
								style={{
									background: isActive ? "var(--accent-mid)" : undefined,
								}}
							>
								<span style={{ fontSize: 12, opacity: 0.6 }}>+</span>
								<span style={{ fontSize: 13 }}>
									Create <strong>"{q}"</strong>
								</span>
							</div>
						);
					}
					return null;
				})}
				{filtered.length === 0 && !canCreate && !hasValue && (
					<div
						style={{
							padding: "8px 12px",
							color: "var(--text-3)",
							fontSize: 13,
						}}
					>
						No options
					</div>
				)}
			</div>
		</CellAnchoredPopover>
	);
}

// ── Relation Picker ───────────────────────────────────────────────────────

export function RelationPicker({
	field,
	value,
	onSave,
	onClose,
	databases,
	allRecords,
}: {
	field: {
		id: string;
		name: string;
		type: FieldType;
		relationTargetDbId?: string | null;
	};
	value: any;
	onSave: (val: string) => void;
	onClose: () => void;
	databases: any[];
	allRecords: Record<string, any[]>;
}) {
	const targetDbId = field.relationTargetDbId;
	const [remoteTargetDb, setRemoteTargetDb] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const targetDb = databases.find((d) => d.id === targetDbId) ?? remoteTargetDb;
	const records = targetDbId ? allRecords[targetDbId] || [] : [];
	const currentIds = Array.isArray(value) ? value : [];
	const [query, setQuery] = useState("");

	// Cross-page target: fetch the database metadata so we can show its name.
	useEffect(() => {
		if (!targetDbId || databases.some((d) => d.id === targetDbId)) return;
		api
			.getDatabase({ id: targetDbId })
			.then((db) => setRemoteTargetDb({ id: db.id, name: db.name }))
			.catch(() => {
				/* ignore */
			});
	}, [targetDbId, databases]);

	const q = query.trim().toLowerCase();
	const filteredRecords = q
		? records.filter((r: any) => r.title?.toLowerCase().includes(q))
		: records;

	const toggle = (id: string) => {
		const next = currentIds.includes(id)
			? currentIds.filter((x) => x !== id)
			: [...currentIds, id];
		onSave(JSON.stringify(next));
	};

	const { activeIndex, handleKeyDown } = useAutocomplete(
		filteredRecords,
		(r: any) => toggle(r.id),
		onClose,
	);

	return (
		<CellAnchoredPopover onClose={onClose} minWidth={260}>
			{!targetDb ? (
				<div
					style={{ padding: "8px 12px", color: "var(--text-3)", fontSize: 13 }}
				>
					{targetDbId
						? "Loading related records..."
						: "No relation target set. Edit this property to choose a target database."}
				</div>
			) : (
				<>
					<div
						style={{
							padding: "4px 8px",
							fontSize: 11,
							color: "var(--text-3)",
							fontWeight: 500,
						}}
					>
						LINKED TO: {targetDb.name.toUpperCase()}
					</div>
					{records.length > 0 && (
						<input
							name="cell-relation-search"
							className="w-full px-2 py-[7px] border border-border rounded text-[13px] outline-none box-border mb-1 bg-surface-2 text-text [font-family:var(--font-ui)] focus:border-accent"
							placeholder="Search records…"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={handleKeyDown}
						/>
					)}
					{filteredRecords.length === 0 ? (
						<div
							style={{
								padding: "8px 12px",
								color: "var(--text-3)",
								fontSize: 13,
							}}
						>
							{records.length === 0
								? `No records in ${targetDb.name}`
								: "No matching records found"}
						</div>
					) : (
						filteredRecords.map((r: any, idx: number) => {
							const selected = currentIds.includes(r.id);
							const isActive = idx === activeIndex;
							return (
								<div
									key={r.id}
									style={{
										padding: "4px 8px",
										borderRadius: 4,
										cursor: "pointer",
										display: "flex",
										alignItems: "center",
										gap: 8,
										background: isActive
											? "var(--accent-mid)"
											: selected
												? "var(--hover-ink)"
												: "transparent",
									}}
									onClick={() => toggle(r.id)}
								>
									<div
										style={{
											width: 18,
											height: 18,
											borderRadius: 3,
											border: selected
												? "none"
												: "1.5px solid var(--border-mid)",
											background: selected ? "var(--accent)" : "transparent",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											flexShrink: 0,
										}}
									>
										{selected && (
											<svg
												width="12"
												height="12"
												viewBox="0 0 12 12"
												fill="none"
											>
												<path
													d="M10 3L4.5 8.5L2 6"
													stroke="white"
													strokeWidth="1.5"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										)}
									</div>
									<span
										style={{
											fontSize: 13,
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{r.title || "Untitled"}
									</span>
								</div>
							);
						})
					)}
					<div
						style={{
							padding: "4px 8px",
							color: "var(--text-3)",
							fontSize: 12,
							cursor: "pointer",
							borderTop: "1px solid var(--border)",
							marginTop: 4,
							paddingTop: 4,
						}}
						onClick={onClose}
					>
						Done
					</div>
				</>
			)}
		</CellAnchoredPopover>
	);
}

// ── Inline multi-value autocomplete (replaces popover for page/relation/people) ──

/**
 * Wrapper that fetches workspace members, then renders them as an
 * inline autocomplete inside the cell.
 */
function PeopleInlineAutocomplete({
	value,
	onSave,
	onCancel,
	onNavigate,
}: {
	value: string[];
	onSave: (val: string) => void;
	onCancel: () => void;
	onNavigate?: (direction: "next" | "prev" | "down") => void;
}) {
	const [members, setMembers] = useState<
		Array<{ userId: string; name: string; email: string }>
	>([]);

	useEffect(() => {
		const wsId = getCurrentWorkspaceId();
		if (!wsId) return;
		api
			.getWorkspaceMembers({ workspaceId: wsId })
			.then(setMembers)
			.catch(() => {
				/* ignore */
			});
	}, []);

	// Map members to include `id` and `title` expected by the generic component
	const mapped = members.map((m) => ({ ...m, id: m.userId, title: m.name }));

	return (
		<CellInlineMultiAutocomplete
			items={mapped}
			selectedIds={value}
			onSave={onSave}
			onCancel={onCancel}
			onNavigate={onNavigate}
			placeholder="Search people…"
			renderItem={(m, selected, isActive) => (
				<div
					style={{
						padding: "4px 8px",
						borderRadius: 4,
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						gap: 8,
						background: isActive
							? "var(--accent-mid)"
							: selected
								? "var(--hover-ink)"
								: "transparent",
					}}
				>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							width: 24,
							height: 24,
							borderRadius: "50%",
							background: "var(--accent-mid)",
							color: "var(--accent)",
							fontSize: 11,
							fontWeight: 600,
							flexShrink: 0,
						}}
					>
						{m.name.charAt(0).toUpperCase()}
					</span>
					<div
						style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
					>
						<span
							style={{
								fontSize: 13,
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{m.name}
						</span>
						<span
							style={{
								fontSize: 11,
								color: "var(--text-3)",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{m.email}
						</span>
					</div>
				</div>
			)}
		/>
	);
}

/**
 * Renders a text input inside the cell with a portal-positioned dropdown
 * of suggestions. Supports multiple selections shown as chips.
 * Tab/Enter/Escape follow the same pattern as InlineCellEditor.
 */
function CellInlineMultiAutocomplete<T extends { id: string; title?: string }>({
	items,
	selectedIds,
	onSave,
	onCancel,
	onNavigate,
	placeholder = "Search…",
	renderItem,
}: {
	items: T[];
	selectedIds: string[];
	onSave: (ids: string) => void;
	onCancel: () => void;
	onNavigate?: (direction: "next" | "prev" | "down") => void;
	placeholder?: string;
	renderItem: (
		item: T,
		isSelected: boolean,
		isActive: boolean,
	) => React.ReactNode;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const anchorRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [query, setQuery] = useState("");
	const [focused, setFocused] = useState(false);

	const q = query.trim().toLowerCase();
	const filtered = q
		? items.filter((item) => item.title?.toLowerCase().includes(q))
		: items;

	const toggle = (id: string) => {
		const next = selectedIds.includes(id)
			? selectedIds.filter((x) => x !== id)
			: [...selectedIds, id];
		onSave(JSON.stringify(next));
		setQuery("");
		inputRef.current?.focus();
	};

	const { activeIndex, handleKeyDown } = useAutocomplete(
		filtered,
		(item) => toggle(item.id),
		onCancel,
	);

	// Merge autocomplete nav with cell-navigation keys (Tab/Enter)
	const mergedKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Tab") {
			e.preventDefault();
			// Save current selection before moving
			onSave(JSON.stringify(selectedIds));
			if (onNavigate) onNavigate(e.shiftKey ? "prev" : "next");
			return;
		}
		if (e.key === "Enter" && !filtered.length) {
			e.preventDefault();
			onSave(JSON.stringify(selectedIds));
			if (onNavigate) onNavigate("down");
			return;
		}
		// Let the autocomplete hook handle arrows, Enter-on-item, Escape
		if (
			e.key === "ArrowUp" ||
			e.key === "ArrowDown" ||
			e.key === "Enter" ||
			e.key === "Escape"
		) {
			// If Enter and dropdown is closed (no items), navigate down
			if (e.key === "Enter" && filtered.length === 0) {
				e.preventDefault();
				onSave(JSON.stringify(selectedIds));
				if (onNavigate) onNavigate("down");
				return;
			}
			handleKeyDown(e);
			return;
		}
	};

	// Close dropdown on outside click
	useEffect(() => {
		if (!focused) return;
		const handler = (e: MouseEvent) => {
			if (
				anchorRef.current &&
				!anchorRef.current.contains(e.target as Node) &&
				// Don't close when clicking inside the portal dropdown
				!dropdownRef.current?.contains(e.target as Node)
			) {
				setFocused(false);
				// Save on outside click
				onSave(JSON.stringify(selectedIds));
			}
		};
		setTimeout(() => document.addEventListener("mousedown", handler), 0);
		return () => document.removeEventListener("mousedown", handler);
	}, [focused, selectedIds, onSave]);

	// Focus on mount
	useEffect(() => {
		inputRef.current?.focus();
		setFocused(true);
	}, []);

	const showDropdown =
		focused && (filtered.length > 0 || (q.length > 0 && filtered.length === 0));

	// Compute dropdown position
	const compact = useIsCompact();
	const [dropdownPos, setDropdownPos] = useState<{
		top: number;
		left: number;
		width: number;
	} | null>(null);
	useLayoutEffect(() => {
		if (!showDropdown || !anchorRef.current) {
			setDropdownPos(null);
			return;
		}
		const rect = anchorRef.current.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const margin = 4;
		let top = rect.bottom + margin;
		let left = rect.left;
		const w = Math.max(200, rect.width);
		if (left + w > vw - margin) left = vw - margin - w;
		if (top + 300 > vh - margin) top = rect.top - margin - 300;
		setDropdownPos({ top, left, width: Math.min(w, vw - margin - left) });
	}, [showDropdown]);

	return (
		<>
			<div
				ref={anchorRef}
				className="flex flex-wrap gap-1 items-center"
				style={{
					border: "1px solid var(--accent)",
					borderRadius: 4,
					padding: "2px 4px",
					minHeight: 28,
					cursor: "text",
				}}
				onClick={() => inputRef.current?.focus()}
			>
				<input
					ref={inputRef}
					name="cell-autocomplete"
					className="min-w-[60px] flex-1 border-none outline-none text-[13px] bg-transparent"
					style={{ fontFamily: "var(--font-ui)", padding: 0, margin: 0 }}
					placeholder={selectedIds.length === 0 ? placeholder : ""}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={mergedKeyDown}
					onFocus={() => setFocused(true)}
				/>
			</div>
			{showDropdown &&
				dropdownPos &&
				createPortal(
					<div
						ref={dropdownRef}
						// Third of the three popovers in this file, and the same
						// reasoning: on a phone the picker is the surface.
						className={compact ? "db-popover-sheet" : undefined}
						style={
							compact
								? { zIndex: 10000 }
								: {
										position: "fixed",
										top: dropdownPos.top,
										left: dropdownPos.left,
										width: dropdownPos.width,
										zIndex: 10000,
										background: "var(--surface)",
										border: "1px solid var(--border)",
										borderRadius: 8,
										boxShadow: "var(--shadow-lg)",
										padding: 8,
										maxHeight: 260,
										overflow: "auto",
									}
						}
					>
						{filtered.length === 0 ? (
							<div
								style={{
									padding: "8px 12px",
									color: "var(--text-3)",
									fontSize: 13,
								}}
							>
								No results
							</div>
						) : (
							filtered.map((item, idx) => (
								<div
									key={item.id}
									onClick={() => toggle(item.id)}
									onMouseDown={(e) => e.preventDefault() /* prevent blur */}
								>
									{renderItem(
										item,
										selectedIds.includes(item.id),
										idx === activeIndex,
									)}
								</div>
							))
						)}
					</div>,
					document.body,
				)}
		</>
	);
}

// ── Cell Editor (inline) ──────────────────────────────────────────────────

export function InlineCellEditor({
	field,
	value,
	onSave,
	onCancel,
	allRecords = {},
	onNavigate,
	initialValue,
}: {
	field: {
		id: string;
		name: string;
		type: FieldType;
		options?: string[];
		relationTargetDbId?: string | null;
	};
	value: any;
	onSave: (val: string) => void;
	onCancel: () => void;
	allRecords?: Record<string, any[]>;
	/** Save current value, then move focus. "next" = Tab, "prev" = Shift+Tab, "down" = Enter. */
	onNavigate?: (direction: "next" | "prev" | "down") => void;
	/** Seed text/number inputs with a character typed to start the edit (type-to-replace). */
	initialValue?: string | null;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		const el = inputRef.current;
		if (!el) return;
		el.focus();
		// Place the caret after a seeded character instead of selecting all.
		if (initialValue != null) {
			try {
				el.setSelectionRange(el.value.length, el.value.length);
			} catch {
				/* type without selection support */
			}
		}
	}, [initialValue]);

	const saveAndNavigate = (direction: "next" | "prev" | "down") => {
		if (inputRef.current) onSave(inputRef.current.value);
		if (onNavigate) onNavigate(direction);
	};

	const handleBlur = () => {
		if (inputRef.current) onSave(inputRef.current.value);
	};
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Tab") {
			e.preventDefault();
			saveAndNavigate(e.shiftKey ? "prev" : "next");
			return;
		}
		if (e.key === "Enter") {
			e.preventDefault();
			saveAndNavigate("down");
			return;
		}
		if (e.key === "Escape") onCancel();
	};

	if (field.type === "checkbox") {
		const checked = String(value) === "true";
		return (
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					height: 28,
					cursor: "pointer",
				}}
				onClick={() => onSave(String(!checked))}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onSave(String(!checked));
					}
					if (e.key === "Escape") onCancel();
				}}
			>
				<div
					style={{
						width: 18,
						height: 18,
						borderRadius: 3,
						border: checked ? "none" : "1.5px solid var(--border-mid)",
						background: checked ? "var(--accent)" : "transparent",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					{checked && (
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
							<path
								d="M10 3L4.5 8.5L2 6"
								stroke="white"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					)}
				</div>
			</div>
		);
	}

	if (field.type === "select" || field.type === "multiSelect") {
		return (
			<SelectPopover
				field={field}
				value={value}
				onSave={onSave}
				onCancel={onCancel}
			/>
		);
	}

	if (field.type === "date") {
		return (
			<input
				ref={inputRef}
				type="date"
				name="cell-date"
				defaultValue={value || ""}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				style={{
					width: "100%",
					border: "1px solid var(--accent)",
					borderRadius: 4,
					padding: "2px 4px",
					fontSize: 13,
					outline: "none",
				}}
			/>
		);
	}

	if (field.type === "number") {
		return (
			<input
				ref={inputRef}
				type="number"
				name="cell-number"
				defaultValue={initialValue ?? (value || "")}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				style={{
					width: "100%",
					border: "1px solid var(--accent)",
					borderRadius: 4,
					padding: "2px 4px",
					fontSize: 13,
					outline: "none",
				}}
			/>
		);
	}

	if (field.type === "page") {
		const allPages = usePageStore((s) => s.pages);
		const pIds: string[] =
			typeof value === "string"
				? (() => {
						try {
							return value.startsWith("[")
								? JSON.parse(value)
								: value
									? [value]
									: [];
						} catch {
							return [];
						}
					})()
				: Array.isArray(value)
					? value
					: [];
		return (
			<CellInlineMultiAutocomplete
				items={allPages.filter((p) => !p.isDeleted)}
				selectedIds={pIds}
				onSave={onSave}
				onCancel={onCancel}
				onNavigate={onNavigate}
				placeholder="Search pages…"
				renderItem={(p, selected, isActive) => (
					<div
						style={{
							padding: "4px 8px",
							borderRadius: 4,
							cursor: "pointer",
							display: "flex",
							alignItems: "center",
							gap: 8,
							background: isActive
								? "var(--accent-mid)"
								: selected
									? "var(--hover-ink)"
									: "transparent",
						}}
					>
						<div
							style={{
								width: 18,
								height: 18,
								borderRadius: 3,
								border: selected ? "none" : "1.5px solid var(--border-mid)",
								background: selected ? "var(--accent)" : "transparent",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								flexShrink: 0,
							}}
						>
							{selected && (
								<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
									<path
										d="M10 3L4.5 8.5L2 6"
										stroke="white"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							)}
						</div>
						<span
							style={{
								fontSize: 13,
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{p.title || "Untitled"}
						</span>
					</div>
				)}
			/>
		);
	}

	if (field.type === "relation") {
		const recs = allRecords[field.relationTargetDbId ?? ""] ?? [];
		const rIds: string[] =
			typeof value === "string"
				? (() => {
						try {
							return JSON.parse(value);
						} catch {
							return [];
						}
					})()
				: Array.isArray(value)
					? value
					: [];
		return (
			<CellInlineMultiAutocomplete
				items={recs}
				selectedIds={rIds}
				onSave={onSave}
				onCancel={onCancel}
				onNavigate={onNavigate}
				placeholder="Search records…"
				renderItem={(r, selected, isActive) => (
					<div
						style={{
							padding: "4px 8px",
							borderRadius: 4,
							cursor: "pointer",
							display: "flex",
							alignItems: "center",
							gap: 8,
							background: isActive
								? "var(--accent-mid)"
								: selected
									? "var(--hover-ink)"
									: "transparent",
						}}
					>
						<div
							style={{
								width: 18,
								height: 18,
								borderRadius: 3,
								border: selected ? "none" : "1.5px solid var(--border-mid)",
								background: selected ? "var(--accent)" : "transparent",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								flexShrink: 0,
							}}
						>
							{selected && (
								<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
									<path
										d="M10 3L4.5 8.5L2 6"
										stroke="white"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							)}
						</div>
						<span
							style={{
								fontSize: 13,
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{r.title || "Untitled"}
						</span>
					</div>
				)}
			/>
		);
	}

	if (field.type === "people") {
		const uIds: string[] =
			typeof value === "string"
				? (() => {
						try {
							return JSON.parse(value);
						} catch {
							return [];
						}
					})()
				: Array.isArray(value)
					? value
					: [];
		return (
			<PeopleInlineAutocomplete
				value={uIds}
				onSave={onSave}
				onCancel={onCancel}
				onNavigate={onNavigate}
			/>
		);
	}

	return (
		<input
			ref={inputRef}
			name="cell-text"
			defaultValue={initialValue ?? (typeof value === "string" ? value : "")}
			onBlur={handleBlur}
			onKeyDown={handleKeyDown}
			style={{
				width: "100%",
				border: "1px solid var(--accent)",
				borderRadius: 4,
				padding: "2px 4px",
				fontSize: 13,
				outline: "none",
			}}
		/>
	);
}
