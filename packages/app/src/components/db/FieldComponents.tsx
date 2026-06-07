import { useState, useEffect, useRef } from "react";
import {
  DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover, optionColor } from "./CellComponents.js";
import { api } from "../../rpc-client.js";
import { usePageStore } from "../../stores/pageStore.js";

export type FieldType = "text" | "number" | "select" | "multiSelect" | "date" | "checkbox" | "relation" | "page" | "formula" | "people";

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

// ── Column Header with Menu ───────────────────────────────────────────────

export function ColumnHeader({
  field, onRename, onDelete, onOptions, onEditFormula, onChangeType, onSortAsc, onSortDesc, onFilter, onDuplicate,
  isTitle, width, onResize, sortDir, sortIndex, onHeaderClick,
  dragRef, dragStyle, dragListeners, dragAttributes,
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

  useEffect(() => { if (editing) setName(field.name); }, [editing, field.name]);

  const handleMenuClose = () => { setShowMenu(false); setEditing(false); setChangingType(false); };

  if (isTitle) {
    return (
      <th className="db-col-header" data-field-id="__title__" style={{ minWidth: width || 200, width: width || undefined }}>
        <div ref={triggerRef} className="db-col-header-content" onClick={() => setShowMenu(!showMenu)}>
          <span style={{ opacity: 0.7, fontSize: 14 }}>🌐</span>
          <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{field.name}</span>
        </div>
        {onResize && (
          <div className="db-col-resize-handle" onMouseDown={(e) => {
            e.preventDefault(); e.stopPropagation();
            const startX = e.clientX;
            const onMove = (ev: MouseEvent) => { onResize("__title__", ev.clientX - startX); };
            const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
            document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
          }} />
        )}
        <Popover triggerRect={showMenu ? triggerRef.current?.getBoundingClientRect() ?? null : null} onClose={handleMenuClose} minWidth={200}>
          {editing ? (
            <div style={{ padding: 4 }}>
              <input value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { if (name.trim()) onRename(name); handleMenuClose(); } if (e.key === "Escape") handleMenuClose(); }}
                onBlur={() => { if (name.trim()) onRename(name); handleMenuClose(); }} autoFocus
                style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "4px 8px", fontSize: 13, outline: "none" }} />
            </div>
          ) : (
            <div>
              <div className="db-menu-item" onClick={() => setEditing(true)}>Rename column</div>
              <div className="db-menu-item" onClick={() => { onDelete(); handleMenuClose(); }}>Hide column</div>
            </div>
          )}
        </Popover>
      </th>
    );
  }

  const sortGlyph = sortDir === "asc" ? "↑" : sortDir === "desc" ? "↓" : null;

  return (
    <th
      ref={dragRef as any}
      className="db-col-header"
      data-field-id={field.id}
      style={{ minWidth: width || 150, width: width || undefined, ...(dragStyle || {}) }}
    >
      {dragListeners && (
        <span
          {...dragListeners}
          {...(dragAttributes || {})}
          className="db-col-drag-handle"
          title="Drag to reorder"
          style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", cursor: "grab", padding: "4px 3px", fontSize: 14, lineHeight: 1, color: "#9b9a97" }}
          onClick={(e) => e.stopPropagation()}
        >⋮⋮</span>
      )}
      <div
        ref={triggerRef}
        className="db-col-header-content"
        onClick={(e) => {
          // Click on the caret area opens the menu; clicking the rest toggles sort.
          const target = e.target as HTMLElement;
          if (target.closest("[data-col-menu-trigger]")) { setShowMenu(!showMenu); return; }
          if (onHeaderClick) onHeaderClick(e);
          else setShowMenu(!showMenu);
        }}
      >
        <span style={{ opacity: 0.5, fontSize: 11, marginRight: 4, width: 16, textAlign: "center" }}>{typeInfo?.icon || "?"}</span>
        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{field.name}</span>
        {sortGlyph && (
          <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4, color: "#2eaadc", fontWeight: 600 }}>
            {sortGlyph}{typeof sortIndex === "number" && sortIndex >= 0 ? <sub style={{ fontSize: 9 }}>{sortIndex + 1}</sub> : null}
          </span>
        )}
        <span
          data-col-menu-trigger
          style={{ fontSize: 10, opacity: 0, transition: "opacity 0.15s", marginLeft: "auto", padding: "0 4px", cursor: "pointer" }}
          className="db-col-arrow"
        >▼</span>
      </div>

      {onResize && (
        <div className="db-col-resize-handle" onMouseDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          const startX = e.clientX;
          const onMove = (ev: MouseEvent) => { onResize(field.id, ev.clientX - startX); };
          const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
          document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
        }} />
      )}

      <Popover triggerRect={showMenu ? triggerRef.current?.getBoundingClientRect() ?? null : null} onClose={handleMenuClose} minWidth={200}>
        {editing ? (
          <div style={{ padding: 4 }}>
            <input value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { if (name.trim()) onRename(name); handleMenuClose(); } if (e.key === "Escape") handleMenuClose(); }}
              onBlur={() => { if (name.trim()) onRename(name); handleMenuClose(); }} autoFocus
              style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "4px 8px", fontSize: 13, outline: "none" }} />
          </div>
        ) : changingType && onChangeType ? (
          <div>
            <div style={{ padding: "4px 8px", fontSize: 11, color: "#999", marginBottom: 4, fontWeight: 500 }}>CHANGE TYPE TO</div>
            {FIELD_TYPES.map((ft) => (
              <div
                key={ft.type}
                className={`db-menu-item ${ft.type === field.type ? "db-menu-item--active" : ""}`}
                onClick={() => { onChangeType(ft.type); handleMenuClose(); }}
              >
                <span style={{ display: "inline-block", width: 20, textAlign: "center", opacity: 0.6 }}>{ft.icon}</span>
                <span>{ft.label}</span>
                {ft.type === field.type && <span style={{ marginLeft: "auto", color: "#2eaadc" }}>✓</span>}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div
              className="db-menu-item"
              onClick={() => onChangeType ? setChangingType(true) : null}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              title={onChangeType ? "Change type" : ""}
            >
              <span style={{ opacity: 0.5 }}>{typeInfo?.icon || "?"}</span>
              <span>{typeInfo?.label || field.type}</span>
              {onChangeType && <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.5 }}>▶</span>}
            </div>
            <div style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0" }} />

            {onSortAsc && (
              <div className="db-menu-item" onClick={() => { onSortAsc(); handleMenuClose(); }}>
                <span style={{ opacity: 0.5 }}>↑</span> Sort ascending
              </div>
            )}
            {onSortDesc && (
              <div className="db-menu-item" onClick={() => { onSortDesc(); handleMenuClose(); }}>
                <span style={{ opacity: 0.5 }}>↓</span> Sort descending
              </div>
            )}
            {onFilter && (
              <div className="db-menu-item" onClick={() => { onFilter(); handleMenuClose(); }}>
                <span style={{ opacity: 0.5 }}>⚲</span> Filter by this property
              </div>
            )}
            {(onSortAsc || onSortDesc || onFilter) && <div style={{ borderTop: "1px solid #f0f0f0", margin: "4px 0" }} />}
            {onOptions && (field.type === "select" || field.type === "multiSelect") && (
              <div className="db-menu-item" onClick={() => { handleMenuClose(); onOptions(); }}>Edit options</div>
            )}
            {onEditFormula && field.type === "formula" && (
              <div className="db-menu-item" onClick={() => { handleMenuClose(); onEditFormula(); }}>Edit formula</div>
            )}
            {onDuplicate && (
              <div className="db-menu-item" onClick={() => { handleMenuClose(); onDuplicate(); }}>Duplicate</div>
            )}
            <div className="db-menu-item" onClick={() => setEditing(true)}>Rename</div>
            <div className="db-menu-item db-menu-item--danger" onClick={() => { onDelete(); handleMenuClose(); }}>Delete</div>
          </div>
        )}
      </Popover>
    </th>
  );
}

// ── Options Editor for Select Fields ──────────────────────────────────────

/** One draggable option row inside OptionsEditor. */
function SortableOptionRow({ opt, colorIdx, onDelete }: { opt: string; colorIdx: number; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opt });
  const c = optionColor(colorIdx);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.5 : 1,
    display: "flex", alignItems: "center", gap: 6, padding: "2px 4px", borderRadius: 4,
    background: isDragging ? "#f7f7f5" : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...listeners}
        {...attributes}
        title="Drag to reorder"
        style={{ cursor: "grab", color: "#c0c0bd", fontSize: 11, lineHeight: 1, touchAction: "none", display: "flex", alignItems: "center", padding: "0 1px" }}
      >⋮⋮</span>
      <span style={{ display: "inline-block", background: c.bg, borderRadius: 3, width: 14, height: 14 }} />
      <span style={{ fontSize: 13, flex: 1 }}>{opt}</span>
      <button onClick={onDelete}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: 2, fontSize: 14, lineHeight: 1 }}>×</button>
    </div>
  );
}

export function OptionsEditor({
  field, onClose, onUpdate, onDeleteOption, onAddOption,
}: {
  field: { id: string; name: string; type: string; options?: string[] | null };
  onClose: () => void;
  /** Persist a reordered options array (drives group ordering on the board). */
  onUpdate: (options: string[]) => void;
  onDeleteOption: (option: string) => void;
  onAddOption: (option: string) => void;
}) {
  const [newOption, setNewOption] = useState("");
  const [options, setOptions] = useState<string[]>(field.options ? [...field.options] : []);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
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
      <div style={{ padding: "4px 8px", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Edit "{field.name}" options</div>
      <div style={{ padding: "0 8px 6px", fontSize: 11, color: "#999" }}>Drag to reorder — groups follow this order.</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={options} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {options.map((opt, i) => (
              <SortableOptionRow key={opt} opt={opt} colorIdx={i} onDelete={() => handleDelete(opt)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
        <span style={{ opacity: 0.5, fontSize: 12 }}>+</span>
        <input ref={inputRef} value={newOption} onChange={(e) => setNewOption(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") onClose(); }}
          onBlur={handleAdd} placeholder="Add option"
          style={{ flex: 1, border: "none", outline: "none", fontSize: 13, padding: "2px 0" }} />
      </div>
    </div>
  );
}

// ── Formula Editor ────────────────────────────────────────────────────────

export function FormulaEditor({
  field, onClose, onSave,
}: {
  field: { id: string; name: string; formula?: string | null };
  onClose: () => void;
  onSave: (formula: string) => void;
}) {
  const [expr, setExpr] = useState(field.formula || "");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div style={{ minWidth: 320 }}>
      <div style={{ padding: "4px 8px", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Formula for "{field.name}"</div>
      <textarea
        ref={inputRef}
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSave(expr.trim()); onClose(); }
          if (e.key === "Escape") onClose();
        }}
        placeholder={`e.g. prop("Price") * prop("Qty")`}
        rows={4}
        style={{ width: "100%", border: "1px solid #e9e9e7", borderRadius: 4, padding: "6px 8px", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", resize: "vertical" }}
      />
      <div style={{ fontSize: 10, color: "#999", marginTop: 4, padding: "0 4px" }}>
        Refs: <code>prop("Field Name")</code> · Ops: <code>+ - * /</code> · Fns: <code>if, sum, round, min, max</code>. <kbd>Cmd</kbd>+<kbd>Enter</kbd> to save.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #e9e9e7", borderRadius: 4, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
        <button onClick={() => { onSave(expr.trim()); onClose(); }} style={{ background: "#2eaadc", color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>Save</button>
      </div>
    </div>
  );
}

// ── Add Field Popover ─────────────────────────────────────────────────────

export function AddFieldPopover({
  triggerRect, onClose, onAdd,
}: {
  triggerRect: DOMRect | null;
  onClose: () => void;
  onAdd: (name: string, type: FieldType, options?: string[], relationTargetDbId?: string | null, formula?: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState("");
  const [relationTarget, setRelationTarget] = useState<string | null>(null);
  const [formula, setFormula] = useState("");
  const [allDbs, setAllDbs] = useState<Array<{ id: string; name: string; pageId: string }>>([]);
  const pages = usePageStore((s) => s.pages);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (nameRef.current) setTimeout(() => nameRef.current?.focus(), 50); }, []);

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
      (type === "select" || type === "multiSelect") ? options : undefined,
      type === "relation" ? relationTarget : null,
      type === "formula" ? (formula.trim() || null) : null,
    );
    onClose();
  };

  return (
    <Popover triggerRect={triggerRect} onClose={onClose} minWidth={300}>
      <div style={{ padding: 4, display: "flex", flexDirection: "column", maxHeight: "calc(70vh - 16px)" }}>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>New property</div>
          <input ref={nameRef} placeholder="Property name" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            style={{ width: "100%", border: "1px solid #e9e9e7", borderRadius: 4, padding: "6px 8px", fontSize: 13, marginBottom: 12, outline: "none", boxSizing: "border-box" }} />

          <div style={{ fontSize: 11, color: "#999", marginBottom: 6, fontWeight: 500 }}>TYPE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
            {FIELD_TYPES.map((ft) => (
              <div key={ft.type} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 4,
                cursor: "pointer", background: type === ft.type ? "rgba(0,0,0,0.05)" : "transparent", fontSize: 13,
              }} onClick={() => setType(ft.type)}>
                <span style={{ width: 20, textAlign: "center", fontSize: 11, opacity: 0.6 }}>{ft.icon}</span>
                <span>{ft.label}</span>
                {type === ft.type && <span style={{ marginLeft: "auto", color: "#2eaadc", fontSize: 12 }}>✓</span>}
              </div>
            ))}
          </div>

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
                      <button onClick={() => setOptions(options.filter((o) => o !== opt))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14, padding: 2, lineHeight: 1 }}>×</button>
                    </div>
                  );
                })}
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px" }}>
                  <span style={{ opacity: 0.5, fontSize: 12 }}>+</span>
                  <input value={optionInput} onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddOption(); } }}
                    placeholder="Add option"
                    style={{ flex: 1, border: "none", outline: "none", fontSize: 13, padding: "2px 0" }} />
                </div>
              </div>
            </div>
          )}

          {type === "formula" && (
            <div style={{ marginBottom: 12, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: "#999", marginBottom: 6, fontWeight: 500 }}>EXPRESSION</div>
              <textarea
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder={`e.g. prop("Price") * prop("Qty")`}
                rows={3}
                style={{ width: "100%", border: "1px solid #e9e9e7", borderRadius: 4, padding: "6px 8px", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", resize: "vertical" }}
              />
              <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
                Refs: <code>prop("Field Name")</code> · Ops: <code>+ - * /</code> · Fns: <code>if, sum, round, min, max</code>
              </div>
            </div>
          )}

          {type === "relation" && (
            <div style={{ marginBottom: 12, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: "#999", marginBottom: 6, fontWeight: 500 }}>RELATE TO</div>
              <select value={relationTarget || ""} onChange={(e) => setRelationTarget(e.target.value || null)}
                style={{ width: "100%", border: "1px solid #e9e9e7", borderRadius: 4, padding: "6px 8px", fontSize: 13, boxSizing: "border-box" }}>
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

        <div style={{ flexShrink: 0, paddingTop: 8, borderTop: "1px solid #f0f0f0", marginTop: 8 }}>
          <button onClick={handleCreate} style={{
            width: "100%", background: "#2eaadc", color: "#fff", border: "none", borderRadius: 4,
            padding: "7px 12px", fontSize: 13, fontWeight: 500, cursor: name.trim() ? "pointer" : "not-allowed",
            opacity: name.trim() ? 1 : 0.5,
          }}>Create</button>
        </div>
      </div>
    </Popover>
  );
}
