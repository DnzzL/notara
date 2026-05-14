import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useStore } from "../store.js";
import { api } from "../rpc-client.js";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Field type definitions ──────────────────────────────────────────────────

type FieldType = "text" | "number" | "select" | "multiSelect" | "date" | "checkbox" | "relation";

interface FieldTypeInfo {
  type: FieldType;
  label: string;
  icon: string;
}

const FIELD_TYPES: FieldTypeInfo[] = [
  { type: "text", label: "Text", icon: "Aa" },
  { type: "number", label: "Number", icon: "#" },
  { type: "select", label: "Select", icon: "◆" },
  { type: "multiSelect", label: "Multi-select", icon: "◆◆" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "checkbox", label: "Checkbox", icon: "☑" },
  { type: "relation", label: "Relation", icon: "🔗" },
];

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

function optionColor(idx: number) {
  return SELECT_COLORS[idx % SELECT_COLORS.length];
}

// ── Auto-positioned Popover ─────────────────────────────────────────────────

function Popover({
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
    // Measure first
    el.style.visibility = "hidden";
    el.style.display = "block";
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    el.style.display = "";
    el.style.visibility = "";

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    // Try below first, then above
    let top = triggerRect.bottom + margin;
    if (top + h > vh - margin) {
      top = triggerRect.top - h - margin;
    }
    if (top < margin) top = margin;

    // Try aligning to left edge of trigger
    let left = triggerRect.left;
    if (left + w > vw - margin) {
      // Try aligning to right edge
      left = triggerRect.right - w;
    }
    if (left < margin) left = margin;

    setPos({ top, left });
  }, [triggerRect]);

  useEffect(() => {
    if (!triggerRect) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
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
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 10000,
        minWidth,
        background: "#fff",
        border: "1px solid #e9e9e7",
        borderRadius: 8,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        padding: 8,
        maxHeight: "70vh",
        overflow: "auto",
      }}
    >
      {children}
    </div>
  );
}

// ── Cell Display Components ─────────────────────────────────────────────────

function SelectPill({ value, colorIdx }: { value: string; colorIdx: number }) {
  const c = optionColor(colorIdx);
  return (
    <span
      style={{
        display: "inline-block",
        background: c.bg,
        color: c.fg,
        borderRadius: 4,
        padding: "1px 7px",
        fontSize: 13,
        fontWeight: 500,
        lineHeight: "20px",
      }}
    >
      {value}
    </span>
  );
}

function CellDisplay({
  field,
  value,
  databases,
  allRecords = {},
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
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            border: checked ? "none" : "1.5px solid #c0c0bd",
            background: checked ? "#2eaadc" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
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
    try {
      vals = Array.isArray(value) ? value : (typeof value === "string" ? JSON.parse(value) : []);
    } catch { /* ignore */ }
    if (!vals.length) return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
    const opts = field.options || [];
    return (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "2px 0" }}>
        {vals.map((v) => {
          const i = opts.indexOf(v);
          return <SelectPill key={v} value={v} colorIdx={i >= 0 ? i : 0} />;
        })}
      </div>
    );
  }

  if (field.type === "date") {
    return <span style={{ fontSize: 13, color: "#37352f" }}>{String(value)}</span>;
  }

  if (field.type === "number") {
    if (!value) return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;
    return <span style={{ fontSize: 13, color: "#37352f" }}>{Number(value).toLocaleString()}</span>;
  }

  if (field.type === "relation") {
    let vals: string[] = [];
    try {
      vals = Array.isArray(value) ? value : (typeof value === "string" ? JSON.parse(value) : []);
    } catch { /* ignore */ }
    if (!vals.length) return <span style={{ color: "#d3d1cb" }}>&nbsp;</span>;

    // Look up record titles from cache
    const targetDbId = field.relationTargetDbId;
    const cachedRecords = targetDbId ? (allRecords[targetDbId] || []) : [];
    const recordMap = new Map(cachedRecords.map((r) => [r.id, r.title]));

    return (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "2px 0" }}>
        {vals.map((id) => {
          const title = recordMap.get(id) || id.slice(0, 8);
          return (
            <span
              key={id}
              style={{
                display: "inline-block",
                background: "#fdecc8",
                borderRadius: 4,
                padding: "1px 7px",
                fontSize: 13,
              }}
            >
              {title}
            </span>
          );
        })}
      </div>
    );
  }

  // text
  return <span style={{ fontSize: 13, color: "#37352f" }}>{String(value)}</span>;
}

// ── Relation Picker ─────────────────────────────────────────────────────────

function RelationPicker({
  field,
  value,
  onSave,
  onClose,
  databases,
  allRecords,
}: {
  field: { id: string; name: string; type: string; relationTargetDbId?: string | null };
  value: any;
  onSave: (val: string) => void;
  onClose: () => void;
  databases: any[];
  allRecords: Record<string, any[]>;
}) {
  const targetDbId = field.relationTargetDbId;
  const targetDb = databases.find((d) => d.id === targetDbId);
  const records = targetDbId ? (allRecords[targetDbId] || []) : [];

  const currentIds = Array.isArray(value) ? value : [];

  const toggle = (id: string) => {
    const next = currentIds.includes(id)
      ? currentIds.filter((x) => x !== id)
      : [...currentIds, id];
    onSave(JSON.stringify(next));
  };

  return (
    <div style={{
      position: "fixed", zIndex: 10001, background: "#fff", border: "1px solid #e9e9e7",
      borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", padding: 4, minWidth: 260, maxHeight: 350, overflow: "auto",
    }}
      onMouseDown={(e) => e.stopPropagation()}
    >
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
              <div
                key={r.id}
                style={{
                  padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  background: selected ? "rgba(0,0,0,0.05)" : "transparent",
                }}
                onClick={() => toggle(r.id)}
              >
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
          <div
            style={{ padding: "4px 8px", color: "#888", fontSize: 12, cursor: "pointer", borderTop: "1px solid #f0f0f0", marginTop: 4, paddingTop: 4 }}
            onClick={onClose}
          >
            Done
          </div>
        </>
      )}
    </div>
  );
}

// ── Cell Editor (inline) ────────────────────────────────────────────────────

function InlineCellEditor({
  field,
  value,
  onSave,
  onCancel,
  databases,
  allRecords = {},
}: {
  field: { id: string; name: string; type: string; options?: string[]; relationTargetDbId?: string | null };
  value: any;
  onSave: (val: string) => void;
  onCancel: () => void;
  databases: any[];
  allRecords?: Record<string, any[]>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleBlur = () => {
    if (inputRef.current) onSave(inputRef.current.value);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); if (inputRef.current) onSave(inputRef.current.value); }
    if (e.key === "Escape") onCancel();
  };

  if (field.type === "checkbox") {
    const checked = String(value) === "true";
    return (
      <div
        style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 28, cursor: "pointer" }}
        onClick={() => onSave(String(!checked))}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSave(String(!checked)); } if (e.key === "Escape") onCancel(); }}
      >
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
        position: "fixed",
        zIndex: 10001,
        background: "#fff",
        border: "1px solid #e9e9e7",
        borderRadius: 8,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        padding: 4,
        minWidth: 200,
        maxHeight: 300,
        overflow: "auto",
      }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {options.length === 0 ? (
          <div style={{ padding: "8px 12px", color: "#888", fontSize: 13 }}>No options yet. Edit this property to add options.</div>
        ) : options.map((opt, i) => {
          const isSelected = field.type === "multiSelect"
            ? currentArr.includes(opt)
            : currentArr[0] === opt;
          const c = optionColor(i);
          return (
            <div
              key={opt}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: isSelected ? "rgba(0,0,0,0.05)" : "transparent",
              }}
              onClick={() => {
                if (field.type === "multiSelect") {
                  const next = isSelected ? currentArr.filter((s: string) => s !== opt) : [...currentArr, opt];
                  onSave(JSON.stringify(next));
                } else {
                  onSave(opt);
                }
              }}
            >
              <span style={{ display: "inline-block", background: c.bg, borderRadius: 3, width: 12, height: 12 }} />
              <span style={{ fontSize: 13, flex: 1 }}>{opt}</span>
              {isSelected && <span style={{ color: "#2eaadc", fontSize: 14 }}>✓</span>}
            </div>
          );
        })}
        <div
          style={{ padding: "4px 8px", color: "#888", fontSize: 12, cursor: "pointer", borderTop: "1px solid #f0f0f0", marginTop: 4, paddingTop: 4 }}
          onClick={onCancel}
        >
          Done
        </div>
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={value || ""}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "2px 4px", fontSize: 13, outline: "none" }}
      />
    );
  }

  if (field.type === "number") {
    return (
      <input
        ref={inputRef}
        type="number"
        defaultValue={value || ""}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "2px 4px", fontSize: 13, outline: "none" }}
      />
    );
  }

  // relation - show picker
  if (field.type === "relation") {
    return (
      <RelationPicker
        field={field}
        value={typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return []; } })() : (Array.isArray(value) ? value : [])}
        onSave={onSave}
        onClose={onCancel}
        databases={databases}
        allRecords={allRecords}
      />
    );
  }

  // text
  return (
    <input
      ref={inputRef}
      defaultValue={typeof value === "string" ? value : ""}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={field.type === "relation" ? "Record IDs (comma-sep)" : ""}
      style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "2px 4px", fontSize: 13, outline: "none" }}
    />
  );
}

// ── Column Header with Menu ─────────────────────────────────────────────────

function ColumnHeader({
  field,
  onRename,
  onDelete,
  onOptions,
  isTitle,
  width,
  onResize,
}: {
  field: { id: string; name: string; type: string };
  onRename: (name: string) => void;
  onDelete: () => void;
  onOptions?: () => void;
  isTitle?: boolean;
  width?: number;
  onResize?: (fieldId: string, delta: number) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(field.name);
  const triggerRef = useRef<HTMLDivElement>(null);

  const typeInfo = FIELD_TYPES.find((f) => f.type === field.type);

  useEffect(() => {
    if (editing) setName(field.name);
  }, [editing, field.name]);

  if (isTitle) {
    return (
      <th
        className="db-col-header"
        data-field-id="__title__"
        style={{ minWidth: width || 200, width: width || undefined }}
      >
        <div className="db-col-header-content">
          <span style={{ opacity: 0.7, fontSize: 14 }}>🌐</span>
          <span style={{ fontWeight: 500 }}>Name</span>
        </div>
        {onResize && (
          <div
            className="db-col-resize-handle"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const startX = e.clientX;
              const onMove = (ev: MouseEvent) => {
                onResize("__title__", ev.clientX - startX);
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
      </th>
    );
  }

  const handleMenuClose = () => { setShowMenu(false); setEditing(false); };

  return (
    <th
      className="db-col-header"
      data-field-id={field.id}
      style={{ minWidth: width || 150, width: width || undefined }}
    >
      <div
        ref={triggerRef}
        className="db-col-header-content"
        onClick={() => setShowMenu(!showMenu)}
      >
        <span style={{ opacity: 0.5, fontSize: 11, marginRight: 4, width: 16, textAlign: "center" }}>
          {typeInfo?.icon || "?"}
        </span>
        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{field.name}</span>
        <span style={{ fontSize: 10, opacity: 0, transition: "opacity 0.15s", marginLeft: 2 }} className="db-col-arrow">▼</span>
      </div>

      {/* Resize handle */}
      {onResize && (
        <div
          className="db-col-resize-handle"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startW = width || 150;
            const onMove = (ev: MouseEvent) => {
              const delta = ev.clientX - startX;
              onResize(field.id, delta);
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

      <Popover triggerRect={showMenu ? triggerRef.current?.getBoundingClientRect() ?? null : null} onClose={handleMenuClose} minWidth={200}>
        {editing ? (
          <div style={{ padding: 4 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { if (name.trim()) { onRename(name); } handleMenuClose(); }
                if (e.key === "Escape") handleMenuClose();
              }}
              onBlur={() => { if (name.trim()) onRename(name); handleMenuClose(); }}
              autoFocus
              style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "4px 8px", fontSize: 13, outline: "none" }}
            />
          </div>
        ) : (
          <div>
            <div style={{ padding: "4px 8px", fontSize: 11, color: "#999", marginBottom: 4, fontWeight: 500 }}>
              PROPERTY TYPE
            </div>
            <div style={{ padding: "4px 8px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ opacity: 0.5 }}>{typeInfo?.icon || "?"}</span>
              <span>{typeInfo?.label || field.type}</span>
            </div>
            <div style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0" }} />

            {onOptions && (field.type === "select" || field.type === "multiSelect") && (
              <div
                className="db-menu-item"
                onClick={() => { handleMenuClose(); onOptions(); }}
              >
                Edit options
              </div>
            )}
            <div className="db-menu-item" onClick={() => setEditing(true)}>Rename</div>
            <div className="db-menu-item db-menu-item--danger" onClick={() => { onDelete(); handleMenuClose(); }}>
              Delete
            </div>
          </div>
        )}
      </Popover>
    </th>
  );
}

// ── Options Editor for Select Fields ────────────────────────────────────────

function OptionsEditor({
  field,
  onClose,
  onUpdate,
  onDeleteOption,
  onAddOption,
}: {
  field: { id: string; name: string; type: string; options?: string[] };
  onClose: () => void;
  onUpdate: (options: string[]) => void;
  onDeleteOption: (option: string) => void;
  onAddOption: (option: string) => void;
}) {
  const [newOption, setNewOption] = useState("");
  const [options, setOptions] = useState<string[]>(field.options || []);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  return (
    <div>
      <div style={{ padding: "4px 8px", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        Edit "{field.name}" options
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {options.map((opt, i) => {
          const c = optionColor(i);
          return (
            <div key={opt} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px", borderRadius: 4 }}>
              <span style={{ display: "inline-block", background: c.bg, borderRadius: 3, width: 14, height: 14 }} />
              <span style={{ fontSize: 13, flex: 1 }}>{opt}</span>
              <button
                onClick={() => handleDelete(opt)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: 2, fontSize: 14, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
        <span style={{ opacity: 0.5, fontSize: 12 }}>+</span>
        <input
          ref={inputRef}
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") onClose(); }}
          onBlur={handleAdd}
          placeholder="Add option"
          style={{ flex: 1, border: "none", outline: "none", fontSize: 13, padding: "2px 0" }}
        />
      </div>
    </div>
  );
}

// ── Add Field Popover ───────────────────────────────────────────────────────

function AddFieldPopover({
  triggerRect,
  onClose,
  onAdd,
  databases,
}: {
  triggerRect: DOMRect | null;
  onClose: () => void;
  onAdd: (name: string, type: FieldType, options?: string[], relationTargetDbId?: string | null) => void;
  databases: any[];
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState("");
  const [relationTarget, setRelationTarget] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nameRef.current) setTimeout(() => nameRef.current?.focus(), 50);
  }, []);

  const handleAddOption = () => {
    const opt = optionInput.trim();
    if (!opt || options.includes(opt)) return;
    setOptions([...options, opt]);
    setOptionInput("");
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), type, (type === "select" || type === "multiSelect") ? options : undefined, type === "relation" ? relationTarget : null);
    onClose();
  };

  return (
    <Popover triggerRect={triggerRect} onClose={onClose} minWidth={300}>
      <div style={{ padding: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>New property</div>
        <input
          ref={nameRef}
          placeholder="Property name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          style={{ width: "100%", border: "1px solid #e9e9e7", borderRadius: 4, padding: "6px 8px", fontSize: 13, marginBottom: 12, outline: "none", boxSizing: "border-box" }}
        />

        <div style={{ fontSize: 11, color: "#999", marginBottom: 6, fontWeight: 500 }}>TYPE</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
          {FIELD_TYPES.map((ft) => (
            <div
              key={ft.type}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 4,
                cursor: "pointer", background: type === ft.type ? "rgba(0,0,0,0.05)" : "transparent", fontSize: 13,
              }}
              onClick={() => setType(ft.type)}
            >
              <span style={{ width: 20, textAlign: "center", fontSize: 11, opacity: 0.6 }}>{ft.icon}</span>
              <span>{ft.label}</span>
              {type === ft.type && <span style={{ marginLeft: "auto", color: "#2eaadc", fontSize: 12 }}>✓</span>}
            </div>
          ))}
        </div>

        {/* Options for select types */}
        {(type === "select" || type === "multiSelect") && (
          <div style={{ marginBottom: 12, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 6, fontWeight: 500 }}>OPTIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {options.map((opt, i) => {
                const c = optionColor(i);
                return (
                  <div key={opt} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px" }}>
                    <span style={{ display: "inline-block", background: c.bg, borderRadius: 3, width: 14, height: 14 }} />
                    <span style={{ fontSize: 13, flex: 1 }}>{opt}</span>
                    <button
                      onClick={() => setOptions(options.filter((o) => o !== opt))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14, padding: 2, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px" }}>
                <span style={{ opacity: 0.5, fontSize: 12 }}>+</span>
                <input
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddOption(); } }}
                  placeholder="Add option"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 13, padding: "2px 0" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Relation target selector */}
        {type === "relation" && (
          <div style={{ marginBottom: 12, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 6, fontWeight: 500 }}>RELATE TO</div>
            <select
              value={relationTarget || ""}
              onChange={(e) => setRelationTarget(e.target.value || null)}
              style={{ width: "100%", border: "1px solid #e9e9e7", borderRadius: 4, padding: "6px 8px", fontSize: 13, boxSizing: "border-box" }}
            >
              <option value="">Select a database...</option>
              {databases.map((db) => (
                <option key={db.id} value={db.id}>{db.name}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleCreate}
          style={{
            width: "100%", background: "#2eaadc", color: "#fff", border: "none", borderRadius: 4,
            padding: "7px 12px", fontSize: 13, fontWeight: 500, cursor: name.trim() ? "pointer" : "not-allowed",
            opacity: name.trim() ? 1 : 0.5,
          }}
          disabled={!name.trim()}
        >
          Create property
        </button>
      </div>
    </Popover>
  );
}

// ── Filter / Sort Bars ──────────────────────────────────────────────────────

const FILTER_OPS = [
  { value: "contains", label: "contains" },
  { value: "does_not_contain", label: "does not contain" },
  { value: "is", label: "is" },
  { value: "is_not", label: "is not" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

function FilterBar({
  fields,
  filters,
  onAdd,
  onRemove,
  onChange,
}: {
  fields: any[];
  filters: Array<{ fieldId: string; operator: string; value: string }>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, updates: Partial<{ fieldId: string; operator: string; value: string }>) => void;
}) {
  if (filters.length === 0) {
    return (
      <button onClick={onAdd} className="db-filter-btn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h12M4 8h8M6 13h4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
        Filter
      </button>
    );
  }

  return (
    <div className="db-filter-bar">
      <span style={{ fontSize: 12, color: "#666", fontWeight: 500, marginRight: 4 }}>Filter</span>
      {filters.map((filter, idx) => (
        <div key={idx} className="db-filter-rule">
          <select
            value={filter.fieldId}
            onChange={(e) => onChange(idx, { fieldId: e.target.value })}
            style={{ border: "1px solid #e9e9e7", borderRadius: 4, padding: "2px 4px", fontSize: 12, background: "#fff" }}
          >
            <option value="">Field</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <select
            value={filter.operator}
            onChange={(e) => onChange(idx, { operator: e.target.value })}
            style={{ border: "1px solid #e9e9e7", borderRadius: 4, padding: "2px 4px", fontSize: 12, background: "#fff" }}
          >
            {FILTER_OPS.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          {!["is_empty", "is_not_empty"].includes(filter.operator) && (
            <input
              value={filter.value}
              onChange={(e) => onChange(idx, { value: e.target.value })}
              placeholder="Value"
              style={{ border: "1px solid #e9e9e7", borderRadius: 4, padding: "2px 4px", fontSize: 12, width: 100 }}
            />
          )}
          <button onClick={() => onRemove(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: 2, fontSize: 14 }}>&times;</button>
        </div>
      ))}
      <button onClick={onAdd} className="db-filter-add">+ Add filter</button>
    </div>
  );
}

function SortBar({
  fields,
  sorts,
  onAdd,
  onRemove,
  onChange,
}: {
  fields: any[];
  sorts: Array<{ fieldId: string; direction: "asc" | "desc" }>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, updates: Partial<{ fieldId: string; direction: "asc" | "desc" }>) => void;
}) {
  if (sorts.length === 0) {
    return (
      <button onClick={onAdd} className="db-filter-btn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 3v10M4 3l-2 2M4 3l2 2M12 13V3M12 13l-2-2M12 13l2-2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Sort
      </button>
    );
  }

  return (
    <div className="db-filter-bar">
      <span style={{ fontSize: 12, color: "#666", fontWeight: 500, marginRight: 4 }}>Sort</span>
      {sorts.map((sort, idx) => (
        <div key={idx} className="db-filter-rule">
          <select
            value={sort.fieldId}
            onChange={(e) => onChange(idx, { fieldId: e.target.value })}
            style={{ border: "1px solid #e9e9e7", borderRadius: 4, padding: "2px 4px", fontSize: 12, background: "#fff" }}
          >
            <option value="">Field</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <select
            value={sort.direction}
            onChange={(e) => onChange(idx, { direction: e.target.value as "asc" | "desc" })}
            style={{ border: "1px solid #e9e9e7", borderRadius: 4, padding: "2px 4px", fontSize: 12, background: "#fff" }}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <button onClick={() => onRemove(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: 2, fontSize: 14 }}>&times;</button>
        </div>
      ))}
      <button onClick={onAdd} className="db-filter-add">+ Add sort</button>
    </div>
  );
}

// ── Sortable Row ────────────────────────────────────────────────────────────

function SortableRow({
  id,
  children,
  isDragging,
  onDelete,
}: {
  id: string;
  children: React.ReactNode;
  isDragging: boolean;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sortableDragging } = useSortable({ id });

  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: sortableDragging ? 0.4 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`db-table-row ${isDragging || sortableDragging ? "db-row-dragging" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td className="db-drag-cell">
        <div className="db-drag-handle" {...listeners} {...attributes}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
        <button
          className="db-delete-btn"
          style={{ opacity: hovered ? 1 : 0 }}
          onClick={onDelete}
          title="Delete record"
        >
          ×
        </button>
      </td>
      {children}
    </tr>
  );
}

// ── Board View ──────────────────────────────────────────────────────────────

function BoardView({
  database,
  fields,
  records,
  databases,
  onSwitchView,
  allRecords = {},
}: {
  database: any;
  fields: any[];
  records: any[];
  databases: any[];
  onSwitchView: () => void;
  allRecords?: Record<string, any[]>;
}) {
  const { boardGroupByFieldId, setBoardGroupBy, updateFieldValue, updateField, loadDbRecords, createDbRecord } = useStore();

  const groupField = fields.find((f: any) => f.id === boardGroupByFieldId) || fields.find((f: any) => f.type === "select") || null;

  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<any>(null);
  const [activeGroupValue, setActiveGroupValue] = useState("");
  const [dropTarget, setDropTarget] = useState<{ columnId: string; index: number } | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Build groups
  const groups: Record<string, typeof records> = {};
  const groupOrder: string[] = [];

  if (!groupField) {
    groups["All"] = records;
    groupOrder.push("All");
  } else {
    const fieldOptions: string[] = groupField.options || [];
    for (const r of records) {
      let key: string;
      if (groupField.type === "select") {
        key = String(r.values[groupField.name] || "Untitled");
      } else if (groupField.type === "multiSelect") {
        const vals = typeof r.values[groupField.name] === "string" ? (r.values[groupField.name] ? JSON.parse(r.values[groupField.name]) : []) : (r.values[groupField.name] || []);
        key = vals.length > 0 ? vals.join(", ") : "Untitled";
      } else {
        key = String(r.values[groupField.name] || "Untitled");
      }
      if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
      groups[key].push(r);
    }
    for (const opt of fieldOptions) {
      if (!groups[opt]) { groups[opt] = []; groupOrder.push(opt); }
    }
    groupOrder.sort((a, b) => {
      const aI = fieldOptions.indexOf(a), bI = fieldOptions.indexOf(b);
      if (aI >= 0 && bI >= 0) return aI - bI;
      if (aI >= 0) return -1;
      if (bI >= 0) return 1;
      return 0;
    });
  }

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const id = String(active.id);
    const entry = records.find((r) => r.record.id === id);
    if (entry) {
      setActiveRecordId(id);
      setActiveRecord(entry.record);
      setActiveGroupValue(groupField ? String(entry.values[groupField.name] || "Untitled") : "All");
    }
  }, [records, groupField]);

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) { setOverColumnId(null); setDropTarget(null); return; }
    const overId = String(over.id);
    if (overId.startsWith("col-")) {
      const colId = overId.slice(4);
      setOverColumnId(colId);
      setDropTarget({ columnId: colId, index: (groups[colId] || []).length });
      return;
    }
    const overRecord = records.find((r) => r.record.id === overId);
    if (overRecord && groupField) {
      const colId = String(overRecord.values[groupField.name] || "Untitled");
      setOverColumnId(colId);
      const idx = (groups[colId] || []).findIndex((r) => r.record.id === overId);
      if (idx >= 0) setDropTarget({ columnId: colId, index: idx });
    } else { setOverColumnId(null); setDropTarget(null); }
  }, [records, groupField, groups]);

  const handleDragEnd = useCallback(async ({ over }: DragEndEvent) => {
    setActiveRecordId(null); setActiveRecord(null); setActiveGroupValue("");
    setOverColumnId(null); setDropTarget(null);
    if (!over || !activeRecord || !groupField) return;
    const targetCol = dropTarget?.columnId || overColumnId;
    if (!targetCol) return;

    if (targetCol === activeGroupValue) {
      // Reorder within same column
      const col = groups[targetCol] || [];
      const ids = col.map((r) => r.record.id);
      const from = ids.indexOf(activeRecord.id);
      let to = dropTarget?.index ?? col.length;
      if (from >= 0 && from < to) to -= 1;
      if (from >= 0 && from !== to) {
        ids.splice(from, 1);
        ids.splice(to, 0, activeRecord.id);
        await api.reorderRecords(database.id, ids);
      }
      await loadDbRecords(database.id);
      return;
    }

    // Move to different column
    if (groupField.type === "select" && !groups[targetCol]) {
      await updateField(groupField.id, { options: [...(groupField.options || []), targetCol] });
    }
    if (groupField.type === "select") {
      await updateFieldValue(activeRecord.id, groupField.id, targetCol === "Untitled" ? "" : targetCol);
    }
    await loadDbRecords(database.id);
  }, [activeRecord, activeGroupValue, groupField, groups, database.id, dropTarget, overColumnId, updateField, updateFieldValue, loadDbRecords]);

  const SortableCard = ({ record, isDragging }: { record: any; isDragging: boolean }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging: sd } = useSortable({ id: record.record.id });
    const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: sd ? 0.3 : 1 };

    return (
      <div ref={setNodeRef} style={style}>
        <div className={`board-card ${isDragging || sd ? "board-card-dragging" : ""}`}>
          <div className="board-card-drag-handle" {...listeners} {...attributes}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
            </svg>
          </div>
          <span className="board-card-title">{record.record.title}</span>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {fields
              .filter((f: any) => f.id !== groupField?.id && f.type !== "checkbox")
              .slice(0, 2)
              .map((f: any) => {
                const val = record.values[f.name];
                if (!val) return null;
                return (
                  <div key={f.id} style={{ fontSize: 12, color: "#666" }}>
                    <span style={{ fontWeight: 500 }}>{f.name}:</span>{" "}
                    <CellDisplay field={f} value={val} databases={databases} allRecords={dbRecordCache} />
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="board-view">
        <div className="db-toolbar">
          <button className="active" onClick={onSwitchView}>Board</button>
          <button onClick={onSwitchView}>Table</button>

          <div style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#666" }}>
            <span style={{ fontWeight: 500 }}>Group by:</span>
            <select
              value={boardGroupByFieldId || groupField?.id || ""}
              onChange={(e) => setBoardGroupBy(e.target.value || null)}
              className="db-select"
            >
              <option value="">None</option>
              {fields.map((f: any) => (
                <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
              ))}
            </select>
          </div>

          <span style={{ marginLeft: "auto", fontSize: 13, color: "#666" }}>{database.name}</span>
        </div>

        <div className="board">
          {groupOrder.map((colName) => (
            <div key={colName} className="board-column" data-column-id={colName}>
              <h3 className="board-column-header">
                {groupField?.type === "select" && groupField.options?.includes(colName) ? (
                  <SelectPill value={colName} colorIdx={groupField.options.indexOf(colName)} />
                ) : (
                  <span style={{ fontSize: 13 }}>{colName}</span>
                )}
                <span style={{ color: "#999", fontWeight: 400 }}> ({(groups[colName] || []).length})</span>
              </h3>
              <SortableContext items={(groups[colName] || []).map((r) => r.record.id)} strategy={verticalListSortingStrategy}>
                <div className="board-cards-container">
                  {(groups[colName] || []).map((item) => (
                    <SortableCard key={item.record.id} record={item} isDragging={activeRecordId === item.record.id} />
                  ))}
                </div>
              </SortableContext>
              <div style={{ padding: "8px 4px" }}>
                <button
                  className="board-add-card"
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
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeRecord ? (
            <div className="board-card board-card-overlay">{activeRecord.title}</div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

// ── Main DatabaseView ───────────────────────────────────────────────────────

export function DatabaseView({ database, isNew }: { database: any; isNew?: boolean }) {
  const {
    dbFields, records, loadDbFields, loadDbRecords, createDbRecord, updateFieldValue,
    createField, deleteField, deleteRecord, databases, renameDatabase,
    activeFilters, activeSorts, setFilter, setSort, addFilter, removeFilter, addSort, removeSort,
  } = useStore();

  const [viewType, setViewType] = useState<"table" | "board">("table");
  const [newTitle, setNewTitle] = useState("");
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldId: string } | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [showOptionsFor, setShowOptionsFor] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(isNew);
  const [dbName, setDbName] = useState(database.name || "Untitled");
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Cache all records per database for relation picking
  const [dbRecordCache, setDbRecordCache] = useState<Record<string, any[]>>({});

  const addFieldBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    loadDbFields(database.id);
    loadDbRecords(database.id);

    // Pre-load records from all databases for relation picking
    databases.forEach(async (db: any) => {
      if (!dbRecordCache[db.id]) {
        try {
          const recs = await api.listRecords(db.id);
          setDbRecordCache((prev) => ({ ...prev, [db.id]: recs }));
        } catch { /* ignore */ }
      }
    });
  }, [database.id]);

  // ── Apply filters ───────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    let result = [...records];
    for (const filter of activeFilters) {
      const field = dbFields.find((f) => f.id === filter.fieldId);
      if (!field) continue;
      result = result.filter(({ values }: any) => {
        const val = values[field.name];
        const fv = filter.value.toLowerCase();
        switch (filter.operator) {
          case "contains": return String(val || "").toLowerCase().includes(fv);
          case "does_not_contain": return !String(val || "").toLowerCase().includes(fv);
          case "is": return String(val || "").toLowerCase() === fv;
          case "is_not": return String(val || "").toLowerCase() !== fv;
          case "is_empty": return !val || val === "" || val === "[]" || val === "null";
          case "is_not_empty": return val && val !== "" && val !== "[]" && val !== "null";
          default: return true;
        }
      });
    }
    return result;
  }, [records, activeFilters, dbFields]);

  // ── Apply sorts ─────────────────────────────────────────────────────────
  const sortedRecords = useMemo(() => {
    const result = [...filteredRecords];
    for (let i = activeSorts.length - 1; i >= 0; i--) {
      const sort = activeSorts[i];
      const field = dbFields.find((f) => f.id === sort.fieldId);
      if (!field) continue;
      result.sort((a: any, b: any) => {
        const aV = a.values[field.name] ?? "";
        const bV = b.values[field.name] ?? "";
        let cmp = field.type === "number" ? Number(aV) - Number(bV) : String(aV).localeCompare(String(bV));
        return sort.direction === "desc" ? -cmp : cmp;
      });
    }
    return result;
  }, [filteredRecords, activeSorts, dbFields]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleAddRecord = async () => {
    if (!newTitle.trim()) return;
    await createDbRecord(database.id, newTitle.trim());
    setNewTitle("");
    // Refresh the record cache for this database
    try {
      const recs = await api.listRecords(database.id);
      setDbRecordCache((prev) => ({ ...prev, [database.id]: recs }));
    } catch { /* ignore */ }
  };

  const handleCellEdit = async (recordId: string, fieldId: string, value: string) => {
    await updateFieldValue(recordId, fieldId, value);
    await loadDbRecords(database.id);
    setEditingCell(null);
  };

  const handleAddField = async (name: string, type: FieldType, options?: string[], relationTargetDbId?: string | null) => {
    await createField({ databaseId: database.id, name, type, options: options || null, relationTargetDbId: relationTargetDbId || null });
    await loadDbFields(database.id);
  };

  const handleRenameField = async (fieldId: string, name: string) => {
    if (!name.trim()) return;
    await api.updateField(fieldId, { name: name.trim() });
    await loadDbFields(database.id);
  };

  const handleDeleteField = async (fieldId: string) => {
    await deleteField(fieldId);
  };

  const handleDeleteRecord = async (recordId: string) => {
    await deleteRecord(recordId);
    // Refresh the record cache
    try {
      const recs = await api.listRecords(database.id);
      setDbRecordCache((prev) => ({ ...prev, [database.id]: recs }));
    } catch { /* ignore */ }
  };

  const handleDeleteOption = async (fieldId: string, option: string) => {
    const field = dbFields.find((f) => f.id === fieldId);
    if (!field) return;
    const newOpts = (field.options || []).filter((o) => o !== option);
    await api.updateField(fieldId, { options: newOpts.length ? newOpts : null });
    await loadDbFields(database.id);
    await loadDbRecords(database.id);
  };

  const handleAddOption = async (fieldId: string, option: string) => {
    const field = dbFields.find((f) => f.id === fieldId);
    if (!field) return;
    const newOpts = [...(field.options || []), option];
    await api.updateField(fieldId, { options: newOpts });
    await loadDbFields(database.id);
  };

  const handleColumnResize = useCallback((fieldId: string, delta: number) => {
    setColumnWidths((prev) => {
      const current = prev[fieldId] || 0;
      const next = Math.max(80, current + delta);
      return { ...prev, [fieldId]: next };
    });
  }, []);

  const handleNameSave = async () => {
    if (dbName.trim() && dbName !== database.name) await renameDatabase(database.id, dbName.trim());
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleNameSave(); }
    if (e.key === "Escape") setIsEditingName(false);
  };

  // ── Table DnD ───────────────────────────────────────────────────────────
  const tableSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleRowDragStart = useCallback(({ active }: DragStartEvent) => setActiveRowId(String(active.id)), []);
  const handleRowDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setActiveRowId(null);
    if (!over || active.id === over.id) return;
    const oldI = sortedRecords.findIndex((r) => r.record.id === active.id);
    const newI = sortedRecords.findIndex((r) => r.record.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const order = sortedRecords.map((r) => r.record.id);
    const [moved] = order.splice(oldI, 1);
    order.splice(newI, 0, moved);
    await api.reorderRecords(database.id, order);
    await loadDbRecords(database.id);
  }, [sortedRecords, database.id, loadDbRecords]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (viewType === "board") {
    return (
      <BoardView database={database} fields={dbFields} records={sortedRecords} databases={databases} onSwitchView={() => setViewType("table")} allRecords={dbRecordCache} />
    );
  }

  return (
    <DndContext sensors={tableSensors} onDragStart={handleRowDragStart} onDragEnd={handleRowDragEnd}>
      <div className="table-view">
        {/* Toolbar */}
        <div className="db-toolbar">
          <button className={viewType === "table" ? "active" : ""} onClick={() => setViewType("table")}>Table</button>
          <button className={viewType === "board" ? "active" : ""} onClick={() => setViewType("board")}>Board</button>

          <div style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <FilterBar
              fields={dbFields}
              filters={activeFilters}
              onAdd={() => addFilter({ fieldId: dbFields[0]?.id || "", operator: "contains", value: "" })}
              onRemove={removeFilter}
              onChange={(idx, updates) => { const ex = activeFilters[idx]; setFilter(idx, { ...ex, ...updates }); }}
            />
            <SortBar
              fields={dbFields}
              sorts={activeSorts}
              onAdd={() => addSort({ fieldId: dbFields[0]?.id || "", direction: "asc" })}
              onRemove={removeSort}
              onChange={(idx, updates) => { const ex = activeSorts[idx]; setSort(idx, { ...ex, ...updates }); }}
            />
          </div>

          <span style={{ marginLeft: "auto", fontSize: 13, color: "#666", display: "flex", alignItems: "center", gap: 8 }}>
            {isEditingName ? (
              <input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)} onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown} autoFocus style={{ fontSize: 13, padding: "2px 6px", border: "1px solid #2eaadc", borderRadius: 4, width: 140, outline: "none" }} />
            ) : (
              <span onClick={() => setIsEditingName(true)} style={{ cursor: "pointer", fontWeight: 500 }}>{database.name || "Untitled"}</span>
            )}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="db-table">
            <thead>
              <tr>
                <th className="db-drag-header" />
                <ColumnHeader
                  field={{ id: "title", name: "Name", type: "text" }}
                  onRename={() => {}}
                  onDelete={() => {}}
                  isTitle
                  width={columnWidths["__title__"]}
                  onResize={handleColumnResize}
                />
                {dbFields.map((f: any) => (
                  <ColumnHeader
                    key={f.id}
                    field={f}
                    onRename={(name) => handleRenameField(f.id, name)}
                    onDelete={() => handleDeleteField(f.id)}
                    onOptions={() => setShowOptionsFor(showOptionsFor === f.id ? null : f.id)}
                    width={columnWidths[f.id]}
                    onResize={handleColumnResize}
                  />
                ))}
                <th style={{ width: 40 }}>
                  <button ref={addFieldBtnRef} onClick={() => setShowAddField(true)} className="db-add-col-btn" title="Add property">+</button>
                </th>
              </tr>
            </thead>
            <SortableContext items={sortedRecords.map((r: any) => r.record.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {sortedRecords.map(({ record, values }: any) => (
                  <SortableRow
                    key={record.id}
                    id={record.id}
                    isDragging={activeRowId === record.id}
                    onDelete={() => handleDeleteRecord(record.id)}
                  >
                    <td className="db-cell db-title-cell" style={columnWidths["__title__"] ? { minWidth: columnWidths["__title__"], width: columnWidths["__title__"] } : undefined}>
                      {record.title || <span style={{ color: "#d3d1cb" }}>Untitled</span>}
                    </td>
                    {dbFields.map((field: any) => {
                      const val = values[field.name] ?? "";
                      const isEditing = editingCell?.recordId === record.id && editingCell?.fieldId === field.id;
                      const colW = columnWidths[field.id];
                      return (
                        <td key={field.id} className="db-cell" style={colW ? { minWidth: colW, width: colW } : undefined}>
                          {isEditing ? (
                            <InlineCellEditor
                              field={field}
                              value={val}
                              onSave={(v) => handleCellEdit(record.id, field.id, v)}
                              onCancel={() => setEditingCell(null)}
                              databases={databases}
                              allRecords={dbRecordCache}
                            />
                          ) : (
                            <div
                              onClick={() => setEditingCell({ recordId: record.id, fieldId: field.id })}
                              className="db-cell-content"
                            >
                              <CellDisplay field={field} value={val} databases={databases} allRecords={dbRecordCache} />
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td />
                  </SortableRow>
                ))}

                {/* Add row */}
                <tr className="db-add-row">
                  <td colSpan={dbFields.length + 2} style={{ padding: "2px 12px" }}>
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddRecord(); if (e.key === "Escape") setNewTitle(""); }}
                      onBlur={handleAddRecord}
                      placeholder="+ New record"
                      className="db-new-record-input"
                    />
                  </td>
                </tr>
              </tbody>
            </SortableContext>
          </table>
        </div>

        {/* Add Field Popover */}
        {showAddField && (
          <AddFieldPopover
            triggerRect={addFieldBtnRef.current?.getBoundingClientRect() ?? null}
            onClose={() => setShowAddField(false)}
            onAdd={handleAddField}
            databases={databases}
          />
        )}

        {/* Options Editor Popover */}
        {showOptionsFor && (() => {
          const f = dbFields.find((x: any) => x.id === showOptionsFor);
          if (!f) return null;
          const el = document.querySelector(`[data-field-id="${f.id}"]`);
          const rect = el ? (el as HTMLElement).getBoundingClientRect() : null;
          return (
            <Popover triggerRect={rect} onClose={() => setShowOptionsFor(null)} minWidth={260}>
              <OptionsEditor
                field={f}
                onClose={() => setShowOptionsFor(null)}
                onUpdate={() => {}}
                onDeleteOption={(opt) => handleDeleteOption(f.id, opt)}
                onAddOption={(opt) => handleAddOption(f.id, opt)}
              />
            </Popover>
          );
        })()}

        <DragOverlay>
          {activeRowId ? (
            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "8px 16px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontSize: 14 }}>
              {sortedRecords.find((r) => r.record.id === activeRowId)?.record.title || "Record"}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
