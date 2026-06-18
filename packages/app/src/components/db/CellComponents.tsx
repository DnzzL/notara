import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { api, getCurrentWorkspaceId } from "../../rpc-client.js";
import { usePageStore } from "../../stores/pageStore.js";
import { tryEvaluate } from "../../lib/formula.js";

// ── Shared constants ──────────────────────────────────────────────────────

const SELECT_COLORS = [
  { bg: "#e3e2e0", fg: "#1e1e1e" },
  { bg: "#e9d5ca", fg: "#1e1e1e" },
  { bg: "#fad4c0", fg: "#1e1e1e" },
  { bg: "#fdecc8", fg: "#1e1e1e" },
  { bg: "#dcf4d4", fg: "#1e1e1e" },
  { bg: "#d3e5ef", fg: "#1e1e1e" },
  { bg: "#dadfee", fg: "#1e1e1e" },
  { bg: "#f5d6e8", fg: "#1e1e1e" },
  { bg: "#ffe2dd", fg: "#1e1e1e" },
];

export function optionColor(idx: number) {
  return SELECT_COLORS[idx % SELECT_COLORS.length];
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
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!triggerRect || !ref.current) return;
    const el = ref.current;
    el.style.visibility = "hidden";
    el.style.display = "block";
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    el.style.display = "";
    el.style.visibility = "";

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let top = triggerRect.bottom + margin;
    if (top + h > vh - margin) top = triggerRect.top - h - margin;
    if (top < margin) top = margin;

    let left = triggerRect.left;
    if (left + w > vw - margin) left = triggerRect.right - w;
    if (left < margin) left = margin;

    setPos({ top, left });
  }, [triggerRect]);

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

  return (
    <div
      ref={ref}
      style={{
        position: "fixed", top: pos.top, left: pos.left, zIndex: 10000,
        minWidth, background: "#fff", border: "1px solid #e9e9e7",
        borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        padding: 8, maxHeight: "70vh", overflow: "auto",
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
  onClose, children, minWidth = 200,
}: {
  onClose: () => void;
  children: React.ReactNode;
  minWidth?: number;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    const cell = anchor.closest(".db-cell, .record-panel-prop-value") as HTMLElement | null;
    if (!cell) return;
    const cellRect = cell.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const margin = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = cellRect.bottom + 2;
    if (top + popRect.height > vh - margin) top = Math.max(margin, cellRect.top - popRect.height - 2);
    let left = cellRect.left;
    if (left + popRect.width > vw - margin) left = vw - margin - popRect.width;
    if (left < margin) left = margin;
    setPos({ top, left });
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Cell Display Components ───────────────────────────────────────────────

export function SelectPill({ value, colorIdx }: { value: string; colorIdx: number }) {
  const c = optionColor(colorIdx);
  return (
    <span style={{
      display: "inline-block", background: c.bg, color: c.fg,
      borderRadius: 4, padding: "1px 7px", fontSize: 13, fontWeight: 500, lineHeight: "20px",
    }}>
      {value}
    </span>
  );
}

export function CellDisplay({
  field, value, databases, allRecords = {}, recordValues,
}: {
  field: { id: string; name: string; type: string; options?: string[]; relationTargetDbId?: string | null; formula?: string | null };
  value: any;
  databases: any[];
  allRecords?: Record<string, any[]>;
  /** All values keyed by field name on the current record — used by formula cells. */
  recordValues?: Record<string, unknown>;
}) {
  if (field.type === "formula") {
    const res = tryEvaluate(field.formula ?? null, recordValues ?? {});
    if (!res.ok) {
      return <span title={res.error} style={{ fontSize: 12, color: "#c44", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>#ERR</span>;
    }
    const v = res.value;
    if (v === null || v === undefined || v === "") return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
    if (typeof v === "number") {
      const display = Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 6 }) : String(v);
      return <span style={{ fontSize: 13, color: "#37352f" }}>{display}</span>;
    }
    if (typeof v === "boolean") return <span style={{ fontSize: 13, color: "#37352f" }}>{v ? "✓" : ""}</span>;
    return <span style={{ fontSize: 13, color: "#37352f" }}>{String(v)}</span>;
  }

  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
  }

  if (field.type === "checkbox") {
    const checked = String(value) === "true";
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 24 }}>
        <div style={{
          width: 18, height: 18, borderRadius: 3,
          border: checked ? "none" : "1.5px solid #c0c0bd",
          background: checked ? "#2eaadc" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {checked && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    const opts = field.options || [];
    const idx = opts.indexOf(String(value));
    return value ? <SelectPill value={String(value)} colorIdx={idx >= 0 ? idx : 0} /> : <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
  }

  if (field.type === "multiSelect") {
    let vals: string[] = [];
    try { vals = Array.isArray(value) ? value : (typeof value === "string" ? JSON.parse(value) : []); } catch { /* ignore */ }
    if (!vals.length) return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
    const opts = field.options || [];
    return (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "2px 0" }}>
        {vals.map((v) => { const i = opts.indexOf(v); return <SelectPill key={v} value={v} colorIdx={i >= 0 ? i : 0} />; })}
      </div>
    );
  }

  if (field.type === "date") return <span style={{ fontSize: 13, color: "#37352f" }}>{String(value)}</span>;
  if (field.type === "number") {
    if (!value) return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
    return <span style={{ fontSize: 13, color: "#37352f" }}>{Number(value).toLocaleString()}</span>;
  }

  if (field.type === "page") {
    let vals: string[] = [];
    try { vals = Array.isArray(value) ? value : (typeof value === "string" ? (value.startsWith("[") ? JSON.parse(value) : [value]) : []); } catch { /* ignore */ }
    if (!vals.length) return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
    return (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "2px 0" }}>
        {vals.map((pageId) => <PageChip key={pageId} pageId={pageId} />)}
      </div>
    );
  }

  if (field.type === "people") {
    let userIds: string[] = [];
    try { userIds = Array.isArray(value) ? value : (typeof value === "string" ? JSON.parse(value) : []); } catch { /* ignore */ }
    if (!userIds.length) return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "2px 0", alignItems: "center" }}>
        {userIds.map((uid) => <PeopleChip key={uid} userId={uid} />)}
      </div>
    );
  }

  if (field.type === "relation") {
    let vals: string[] = [];
    try { vals = Array.isArray(value) ? value : (typeof value === "string" ? JSON.parse(value) : []); } catch { /* ignore */ }
    if (!vals.length) return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
    const targetDbId = field.relationTargetDbId;
    return (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "2px 0" }}>
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

  return <span style={{ fontSize: 13, color: "#37352f" }}>{String(value)}</span>;
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
      e.preventDefault(); e.stopPropagation();
      navigateToPage(pageId);
    }
    // No modifier: let the click bubble up so the cell opens the picker.
  };
  return (
    <span
      className="inline-flex items-center gap-1 bg-surface-3 border border-border rounded-[5px] px-2 py-0.5 text-[12.5px] cursor-pointer max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap text-text-2 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-4 hover:text-text"
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
  recordId, targetDbId, databases, allRecords,
}: {
  recordId: string;
  targetDbId: string | null;
  databases: any[];
  allRecords: Record<string, any[]>;
}) {
  const cachedRecords = targetDbId ? (allRecords[targetDbId] || []) : [];
  const record = cachedRecords.find((r: any) => r.id === recordId);
  const title = record?.title || recordId.slice(0, 8);
  const [remoteHostPageId, setRemoteHostPageId] = useState<string | null>(null);
  const hostPageId = databases.find((d: any) => d.id === targetDbId)?.pageId ?? remoteHostPageId;

  useEffect(() => {
    if (!targetDbId || databases.some((d: any) => d.id === targetDbId)) return;
    api.getDatabase({ id: targetDbId }).then((db) => setRemoteHostPageId(db.pageId)).catch(() => { /* ignore */ });
  }, [targetDbId, databases]);

  const onClick = (e: React.MouseEvent) => {
    if (isNavModifier(e)) {
      e.preventDefault(); e.stopPropagation();
      if (hostPageId) {
        navigateToPage(hostPageId);
        // After the page loads, ask the host DatabaseView to open this record.
        window.dispatchEvent(new CustomEvent("db-open-record", { detail: { recordId } }));
      }
    }
  };

  return (
    <span
      className="inline-block bg-accent-dim border border-[rgba(43,77,255,0.2)] text-accent-2 rounded-[5px] px-2 py-0.5 text-[12.5px] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer"
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
    api.getWorkspaceMembers({ workspaceId: wsId }).then((members) => {
      const m = members.find((x: any) => x.userId === userId);
      if (m) setMember(m);
    }).catch(() => { /* ignore */ });
  }, [userId]);

  const name = member?.name || userId.slice(0, 8);
  const initial = name.charAt(0).toUpperCase();

  return (
    <span className="inline-flex items-center gap-[5px] bg-surface-3 border border-border rounded-[20px] py-px pl-[3px] pr-2 text-[12.5px] max-w-[200px] text-text-2" title={name}>
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent-dim text-accent-2 text-[10px] font-semibold shrink-0">{initial}</span>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{name}</span>
    </span>
  );
}

// ── People Picker ───────────────────────────────────────────────────────────

function PeoplePicker({
  value, onSave, onClose,
}: {
  value: string[];
  onSave: (val: string) => void;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Array<{ userId: string; name: string; email: string }>>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const wsId = getCurrentWorkspaceId();
    if (!wsId) return;
    api.getWorkspaceMembers({ workspaceId: wsId }).then(setMembers).catch(() => { /* ignore */ });
  }, []);

  const q = query.trim().toLowerCase();
  const visible = q
    ? members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
    : members;

  const toggle = (uid: string) => {
    const next = value.includes(uid) ? value.filter((x) => x !== uid) : [...value, uid];
    onSave(JSON.stringify(next));
  };

  return (
    <CellAnchoredPopover onClose={onClose} minWidth={260}>
      <input
        autoFocus
        name="cell-people-search"
        className="w-full px-2 py-[7px] border border-border rounded-[5px] text-[13px] outline-none box-border mb-1 bg-surface-2 text-text [font-family:var(--font-ui)] focus:border-accent"
        placeholder="Search people…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}
      />
      <div className="flex flex-col gap-px">
        {visible.length === 0 ? (
          <div style={{ padding: "8px 12px", color: "#888", fontSize: 13 }}>No people found</div>
        ) : visible.map((m) => {
          const selected = value.includes(m.userId);
          return (
            <div
              key={m.userId}
              className="px-2 py-1.5 rounded-[5px] cursor-pointer flex items-center gap-2 text-text-2 hover:bg-surface-3 hover:text-text"
              style={{ background: selected ? "rgba(0,0,0,0.05)" : undefined }}
              onClick={() => toggle(m.userId)}
            >
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 22, height: 22, borderRadius: "50%", background: "#e3e2e0",
                fontSize: 11, fontWeight: 600, color: "#37352f", flexShrink: 0,
              }}>
                {m.name.charAt(0).toUpperCase()}
              </span>
              <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.name}
              </span>
              <span style={{ fontSize: 11, color: "#999", marginRight: 4 }}>{m.email}</span>
              {selected && <span style={{ color: "#2eaadc", fontSize: 14 }}>✓</span>}
            </div>
          );
        })}
      </div>
    </CellAnchoredPopover>
  );
}

// ── Select / Multi-select Popover (with inline create) ───────────────────

function SelectPopover({
  field, value, onSave, onCancel,
}: {
  field: { id: string; name: string; type: string; options?: string[] | null };
  value: any;
  onSave: (val: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>(field.options || []);
  useEffect(() => { setOptions(field.options || []); }, [field.id, field.options]);

  const currentArr: string[] = field.type === "multiSelect"
    ? (Array.isArray(value) ? value : (typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return []; } })() : []))
    : [value || ""];

  const q = query.trim();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;
  const exact = options.some((o) => o.toLowerCase() === q.toLowerCase());
  const canCreate = q.length > 0 && !exact;

  const hasValue = field.type !== "multiSelect" && !!currentArr[0];
  const isEmptyQuery = q.length === 0;

  const choose = (opt: string) => {
    if (field.type === "multiSelect") {
      const next = currentArr.includes(opt) ? currentArr.filter((s) => s !== opt) : [...currentArr, opt];
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

  return (
    <CellAnchoredPopover onClose={onCancel}>
      <input
        autoFocus
        name="cell-select-search"
        className="w-full px-2 py-[7px] border border-border rounded-[5px] text-[13px] outline-none box-border mb-1 bg-surface-2 text-text [font-family:var(--font-ui)] focus:border-accent"
        placeholder="Search or create…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          else if (e.key === "Enter") {
            e.preventDefault();
            if (hasValue && isEmptyQuery) { clear(); return; }
            if (filtered.length > 0) choose(filtered[0]);
            else if (canCreate) create();
          }
        }}
      />
      <div className="flex flex-col gap-px">
        {hasValue && isEmptyQuery && (
          <div className="px-2 py-1.5 rounded-[5px] cursor-pointer flex items-center gap-2 text-text-2 hover:bg-surface-3 hover:text-text" onClick={clear} style={{ borderBottom: "1px solid #f0f0f0", marginBottom: 2 }}>
            <span style={{ fontSize: 14, opacity: 0.5 }}>✕</span>
            <span style={{ fontSize: 13, color: "#888" }}>Clear</span>
          </div>
        )}
        {filtered.map((opt) => {
          const i = options.indexOf(opt);
          const isSelected = field.type === "multiSelect" ? currentArr.includes(opt) : currentArr[0] === opt;
          const c = optionColor(i);
          return (
            <div
              key={opt}
              className="px-2 py-1.5 rounded-[5px] cursor-pointer flex items-center gap-2 text-text-2 hover:bg-surface-3 hover:text-text"
              style={{ background: isSelected ? "rgba(0,0,0,0.05)" : undefined }}
              onClick={() => choose(opt)}
            >
              <span style={{ display: "inline-block", background: c.bg, borderRadius: 3, width: 12, height: 12 }} />
              <span style={{ fontSize: 13, flex: 1 }}>{opt}</span>
              {isSelected && <span style={{ color: "#2eaadc", fontSize: 14 }}>✓</span>}
            </div>
          );
        })}
        {canCreate && (
          <div className="px-2 py-1.5 rounded-[5px] cursor-pointer flex items-center gap-2 text-text-2 hover:bg-surface-3 hover:text-text text-accent hover:bg-accent-dim hover:text-accent" onClick={create}>
            <span style={{ fontSize: 12, opacity: 0.6 }}>+</span>
            <span style={{ fontSize: 13 }}>Create <strong>"{q}"</strong></span>
          </div>
        )}
        {filtered.length === 0 && !canCreate && !hasValue && (
          <div style={{ padding: "8px 12px", color: "#888", fontSize: 13 }}>No options</div>
        )}
      </div>
    </CellAnchoredPopover>
  );
}

// ── Page Picker ───────────────────────────────────────────────────────────

function PagePicker({
  value, onSave, onClose,
}: {
  value: string[];
  onSave: (val: string) => void;
  onClose: () => void;
}) {
  const pages = usePageStore((s) => s.pages);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = (q
    ? pages.filter((p) => !p.isDeleted && (p.title || "").toLowerCase().includes(q))
    : pages.filter((p) => !p.isDeleted)
  ).slice(0, 50);

  const toggle = (pageId: string) => {
    const next = value.includes(pageId) ? value.filter((x) => x !== pageId) : [...value, pageId];
    onSave(JSON.stringify(next));
  };

  return (
    <CellAnchoredPopover onClose={onClose} minWidth={280}>
      <input
        autoFocus
        name="cell-relation-search"
        className="w-full px-2 py-[7px] border border-border rounded-[5px] text-[13px] outline-none box-border mb-1 bg-surface-2 text-text [font-family:var(--font-ui)] focus:border-accent"
        placeholder="Search pages…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}
      />
      <div className="flex flex-col gap-px">
        {visible.length === 0 ? (
          <div style={{ padding: "8px 12px", color: "#888", fontSize: 13 }}>No pages found</div>
        ) : visible.map((p) => {
          const selected = value.includes(p.id);
          return (
            <div
              key={p.id}
              className="px-2 py-1.5 rounded-[5px] cursor-pointer flex items-center gap-2 text-text-2 hover:bg-surface-3 hover:text-text"
              style={{ background: selected ? "rgba(0,0,0,0.05)" : undefined }}
              onClick={() => toggle(p.id)}
            >
              <span style={{ width: 18 }}>{p.icon || "📄"}</span>
              <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title || "Untitled"}
              </span>
              {selected && <span style={{ color: "#2eaadc", fontSize: 14 }}>✓</span>}
            </div>
          );
        })}
      </div>
    </CellAnchoredPopover>
  );
}

// ── Relation Picker ───────────────────────────────────────────────────────

export function RelationPicker({
  field, value, onSave, onClose, databases, allRecords,
}: {
  field: { id: string; name: string; type: string; relationTargetDbId?: string | null };
  value: any; onSave: (val: string) => void; onClose: () => void;
  databases: any[]; allRecords: Record<string, any[]>;
}) {
  const targetDbId = field.relationTargetDbId;
  const [remoteTargetDb, setRemoteTargetDb] = useState<{ id: string; name: string } | null>(null);
  const targetDb = databases.find((d) => d.id === targetDbId) ?? remoteTargetDb;
  const records = targetDbId ? (allRecords[targetDbId] || []) : [];
  const currentIds = Array.isArray(value) ? value : [];

  // Cross-page target: fetch the database metadata so we can show its name.
  useEffect(() => {
    if (!targetDbId || databases.some((d) => d.id === targetDbId)) return;
    api.getDatabase({ id: targetDbId }).then((db) => setRemoteTargetDb({ id: db.id, name: db.name })).catch(() => { /* ignore */ });
  }, [targetDbId, databases]);

  const toggle = (id: string) => {
    const next = currentIds.includes(id) ? currentIds.filter((x) => x !== id) : [...currentIds, id];
    onSave(JSON.stringify(next));
  };

  return (
    <CellAnchoredPopover onClose={onClose} minWidth={260}>
      {!targetDb ? (
        <div style={{ padding: "8px 12px", color: "#888", fontSize: 13 }}>
          {targetDbId ? "Loading related records..." : "No relation target set. Edit this property to choose a target database."}
        </div>
      ) : (
        <>
          <div style={{ padding: "4px 8px", fontSize: 11, color: "#999", fontWeight: 500 }}>
            LINKED TO: {targetDb.name.toUpperCase()}
          </div>
          {records.length === 0 ? (
            <div style={{ padding: "8px 12px", color: "#888", fontSize: 13 }}>No records in {targetDb.name}</div>
          ) : records.map((r) => {
            const selected = currentIds.includes(r.id);
            return (
              <div key={r.id} style={{
                padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                background: selected ? "rgba(0,0,0,0.05)" : "transparent",
              }} onClick={() => toggle(r.id)}>
                <div style={{
                  width: 18, height: 18, borderRadius: 3,
                  border: selected ? "none" : "1.5px solid #c0c0bd",
                  background: selected ? "#2eaadc" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {selected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>{r.title || "Untitled"}</span>
              </div>
            );
          })}
          <div style={{ padding: "4px 8px", color: "#888", fontSize: 12, cursor: "pointer", borderTop: "1px solid #f0f0f0", marginTop: 4, paddingTop: 4 }} onClick={onClose}>
            Done
          </div>
        </>
      )}
    </CellAnchoredPopover>
  );
}

// ── Cell Editor (inline) ──────────────────────────────────────────────────

export function InlineCellEditor({
  field, value, onSave, onCancel, databases, allRecords = {}, onNavigate, initialValue,
}: {
  field: { id: string; name: string; type: string; options?: string[]; relationTargetDbId?: string | null };
  value: any; onSave: (val: string) => void; onCancel: () => void;
  databases: any[]; allRecords?: Record<string, any[]>;
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
    if (initialValue != null) { try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* type without selection support */ } }
  }, [initialValue]);

  const saveAndNavigate = (direction: "next" | "prev" | "down") => {
    if (inputRef.current) onSave(inputRef.current.value);
    if (onNavigate) onNavigate(direction);
  };

  const handleBlur = () => { if (inputRef.current) onSave(inputRef.current.value); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") { e.preventDefault(); saveAndNavigate(e.shiftKey ? "prev" : "next"); return; }
    if (e.key === "Enter") { e.preventDefault(); saveAndNavigate("down"); return; }
    if (e.key === "Escape") onCancel();
  };

  if (field.type === "checkbox") {
    const checked = String(value) === "true";
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 28, cursor: "pointer" }}
        onClick={() => onSave(String(!checked))} tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSave(String(!checked)); } if (e.key === "Escape") onCancel(); }}>
        <div style={{
          width: 18, height: 18, borderRadius: 3,
          border: checked ? "none" : "1.5px solid #c0c0bd",
          background: checked ? "#2eaadc" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {checked && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
      <input ref={inputRef} type="date" name="cell-date" defaultValue={value || ""}
        onBlur={handleBlur} onKeyDown={handleKeyDown}
        style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "2px 4px", fontSize: 13, outline: "none" }} />
    );
  }

  if (field.type === "number") {
    return (
      <input ref={inputRef} type="number" name="cell-number" defaultValue={initialValue ?? (value || "")}
        onBlur={handleBlur} onKeyDown={handleKeyDown}
        style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "2px 4px", fontSize: 13, outline: "none" }} />
    );
  }

  if (field.type === "page") {
    return (
      <PagePicker
        value={typeof value === "string" ? (() => { try { return value.startsWith("[") ? JSON.parse(value) : (value ? [value] : []); } catch { return []; } })() : (Array.isArray(value) ? value : [])}
        onSave={onSave}
        onClose={onCancel}
      />
    );
  }

  if (field.type === "relation") {
    return (
      <RelationPicker field={field}
        value={typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return []; } })() : (Array.isArray(value) ? value : [])}
        onSave={onSave} onClose={onCancel} databases={databases} allRecords={allRecords} />
    );
  }

  if (field.type === "people") {
    return (
      <PeoplePicker
        value={typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return []; } })() : (Array.isArray(value) ? value : [])}
        onSave={onSave}
        onClose={onCancel}
      />
    );
  }

  return (
    <input ref={inputRef} name="cell-text" defaultValue={initialValue ?? (typeof value === "string" ? value : "")}
      onBlur={handleBlur} onKeyDown={handleKeyDown}
      style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "2px 4px", fontSize: 13, outline: "none" }} />
  );
}
