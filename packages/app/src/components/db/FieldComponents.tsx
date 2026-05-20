import { useState, useEffect, useRef } from "react";
import { Popover, optionColor } from "./CellComponents.js";

export type FieldType = "text" | "number" | "select" | "multiSelect" | "date" | "checkbox" | "relation";

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
  { type: "relation", label: "Relation", icon: "🔗" },
];

// ── Column Header with Menu ───────────────────────────────────────────────

export function ColumnHeader({
  field, onRename, onDelete, onOptions, onChangeType, isTitle, width, onResize,
}: {
  field: { id: string; name: string; type: string };
  onRename: (name: string) => void;
  onDelete: () => void;
  onOptions?: () => void;
  onChangeType?: (type: FieldType) => void;
  isTitle?: boolean;
  width?: number;
  onResize?: (fieldId: string, delta: number) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [changingType, setChangingType] = useState(false);
  const [name, setName] = useState(field.name);
  const triggerRef = useRef<HTMLDivElement>(null);

  const typeInfo = FIELD_TYPES.find((f) => f.type === field.type);

  useEffect(() => { if (editing) setName(field.name); }, [editing, field.name]);

  if (isTitle) {
    return (
      <th className="db-col-header" data-field-id="__title__" style={{ minWidth: width || 200, width: width || undefined }}>
        <div className="db-col-header-content">
          <span style={{ opacity: 0.7, fontSize: 14 }}>🌐</span>
          <span style={{ fontWeight: 500 }}>Name</span>
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
      </th>
    );
  }

  const handleMenuClose = () => { setShowMenu(false); setEditing(false); setChangingType(false); };

  return (
    <th className="db-col-header" data-field-id={field.id} style={{ minWidth: width || 150, width: width || undefined }}>
      <div ref={triggerRef} className="db-col-header-content" onClick={() => setShowMenu(!showMenu)}>
        <span style={{ opacity: 0.5, fontSize: 11, marginRight: 4, width: 16, textAlign: "center" }}>{typeInfo?.icon || "?"}</span>
        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{field.name}</span>
        <span style={{ fontSize: 10, opacity: 0, transition: "opacity 0.15s", marginLeft: 2 }} className="db-col-arrow">▼</span>
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

            {onOptions && (field.type === "select" || field.type === "multiSelect") && (
              <div className="db-menu-item" onClick={() => { handleMenuClose(); onOptions(); }}>Edit options</div>
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

export function OptionsEditor({
  field, onClose, onUpdate, onDeleteOption, onAddOption,
}: {
  field: { id: string; name: string; type: string; options?: string[] | null };
  onClose: () => void;
  onUpdate: (options: string[]) => void;
  onDeleteOption: (option: string) => void;
  onAddOption: (option: string) => void;
}) {
  const [newOption, setNewOption] = useState("");
  const [options, setOptions] = useState<string[]>(field.options ? [...field.options] : []);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
      <div style={{ padding: "4px 8px", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Edit "{field.name}" options</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {options.map((opt, i) => {
          const c = optionColor(i);
          return (
            <div key={opt} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px", borderRadius: 4 }}>
              <span style={{ display: "inline-block", background: c.bg, borderRadius: 3, width: 14, height: 14 }} />
              <span style={{ fontSize: 13, flex: 1 }}>{opt}</span>
              <button onClick={() => handleDelete(opt)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: 2, fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          );
        })}
      </div>
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

// ── Add Field Popover ─────────────────────────────────────────────────────

export function AddFieldPopover({
  triggerRect, onClose, onAdd, databases,
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

  useEffect(() => { if (nameRef.current) setTimeout(() => nameRef.current?.focus(), 50); }, []);

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

        {type === "relation" && (
          <div style={{ marginBottom: 12, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 6, fontWeight: 500 }}>RELATE TO</div>
            <select value={relationTarget || ""} onChange={(e) => setRelationTarget(e.target.value || null)}
              style={{ width: "100%", border: "1px solid #e9e9e7", borderRadius: 4, padding: "6px 8px", fontSize: 13, boxSizing: "border-box" }}>
              <option value="">Select a database...</option>
              {databases.map((db) => (<option key={db.id} value={db.id}>{db.name}</option>))}
            </select>
          </div>
        )}

        <button onClick={handleCreate} style={{
          width: "100%", background: "#2eaadc", color: "#fff", border: "none", borderRadius: 4,
          padding: "7px 12px", fontSize: 13, fontWeight: 500, cursor: name.trim() ? "pointer" : "not-allowed",
          opacity: name.trim() ? 1 : 0.5,
        }}>Create</button>
      </div>
    </Popover>
  );
}
