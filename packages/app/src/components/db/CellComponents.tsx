import { useState, useEffect, useRef } from "react";

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
  field, value, databases, allRecords = {},
}: {
  field: { id: string; name: string; type: string; options?: string[]; relationTargetDbId?: string | null };
  value: any;
  databases: any[];
  allRecords?: Record<string, any[]>;
}) {
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

  if (field.type === "relation") {
    let vals: string[] = [];
    try { vals = Array.isArray(value) ? value : (typeof value === "string" ? JSON.parse(value) : []); } catch { /* ignore */ }
    if (!vals.length) return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
    const targetDbId = field.relationTargetDbId;
    const cachedRecords = targetDbId ? (allRecords[targetDbId] || []) : [];
    const recordMap = new Map(cachedRecords.map((r) => [r.id, r.title]));
    return (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "2px 0" }}>
        {vals.map((id) => {
          const title = recordMap.get(id) || id.slice(0, 8);
          return (
            <span key={id} style={{ display: "inline-block", background: "#fdecc8", borderRadius: 4, padding: "1px 7px", fontSize: 13 }}>
              {title}
            </span>
          );
        })}
      </div>
    );
  }

  return <span style={{ fontSize: 13, color: "#37352f" }}>{String(value)}</span>;
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
  const targetDb = databases.find((d) => d.id === targetDbId);
  const records = targetDbId ? (allRecords[targetDbId] || []) : [];
  const currentIds = Array.isArray(value) ? value : [];

  const toggle = (id: string) => {
    const next = currentIds.includes(id) ? currentIds.filter((x) => x !== id) : [...currentIds, id];
    onSave(JSON.stringify(next));
  };

  return (
    <div style={{
      position: "fixed", zIndex: 10001, background: "#fff", border: "1px solid #e9e9e7",
      borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", padding: 4, minWidth: 260, maxHeight: 350, overflow: "auto",
    }} onMouseDown={(e) => e.stopPropagation()}>
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
    </div>
  );
}

// ── Cell Editor (inline) ──────────────────────────────────────────────────

export function InlineCellEditor({
  field, value, onSave, onCancel, databases, allRecords = {},
}: {
  field: { id: string; name: string; type: string; options?: string[]; relationTargetDbId?: string | null };
  value: any; onSave: (val: string) => void; onCancel: () => void;
  databases: any[]; allRecords?: Record<string, any[]>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleBlur = () => { if (inputRef.current) onSave(inputRef.current.value); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); if (inputRef.current) onSave(inputRef.current.value); }
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
    const options = field.options || [];
    const currentArr = field.type === "multiSelect"
      ? (Array.isArray(value) ? value : (typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return []; } })() : []))
      : [value || ""];

    return (
      <div style={{
        position: "fixed", zIndex: 10001, background: "#fff", border: "1px solid #e9e9e7",
        borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", padding: 4, minWidth: 200, maxHeight: 300, overflow: "auto",
      }} onMouseDown={(e) => e.stopPropagation()}>
        {options.length === 0 ? (
          <div style={{ padding: "8px 12px", color: "#888", fontSize: 13 }}>No options yet. Edit this property to add options.</div>
        ) : options.map((opt, i) => {
          const isSelected = field.type === "multiSelect" ? currentArr.includes(opt) : currentArr[0] === opt;
          const c = optionColor(i);
          return (
            <div key={opt} style={{
              padding: "4px 8px", borderRadius: 4, cursor: "pointer", display: "flex",
              alignItems: "center", gap: 8, background: isSelected ? "rgba(0,0,0,0.05)" : "transparent",
            }} onClick={() => {
              if (field.type === "multiSelect") {
                const next = isSelected ? currentArr.filter((s: string) => s !== opt) : [...currentArr, opt];
                onSave(JSON.stringify(next));
              } else { onSave(opt); }
            }}>
              <span style={{ display: "inline-block", background: c.bg, borderRadius: 3, width: 12, height: 12 }} />
              <span style={{ fontSize: 13, flex: 1 }}>{opt}</span>
              {isSelected && <span style={{ color: "#2eaadc", fontSize: 14 }}>✓</span>}
            </div>
          );
        })}
        <div style={{ padding: "4px 8px", color: "#888", fontSize: 12, cursor: "pointer", borderTop: "1px solid #f0f0f0", marginTop: 4, paddingTop: 4 }} onClick={onCancel}>
          Done
        </div>
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <input ref={inputRef} type="date" defaultValue={value || ""}
        onBlur={handleBlur} onKeyDown={handleKeyDown}
        style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "2px 4px", fontSize: 13, outline: "none" }} />
    );
  }

  if (field.type === "number") {
    return (
      <input ref={inputRef} type="number" defaultValue={value || ""}
        onBlur={handleBlur} onKeyDown={handleKeyDown}
        style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "2px 4px", fontSize: 13, outline: "none" }} />
    );
  }

  if (field.type === "relation") {
    return (
      <RelationPicker field={field}
        value={typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return []; } })() : (Array.isArray(value) ? value : [])}
        onSave={onSave} onClose={onCancel} databases={databases} allRecords={allRecords} />
    );
  }

  return (
    <input ref={inputRef} defaultValue={typeof value === "string" ? value : ""}
      onBlur={handleBlur} onKeyDown={handleKeyDown}
      style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "2px 4px", fontSize: 13, outline: "none" }} />
  );
}
