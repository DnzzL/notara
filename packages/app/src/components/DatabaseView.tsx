import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "../store.js";
import { api } from "../rpc-client.js";
import { CellDisplay, InlineCellEditor, Popover } from "./db/CellComponents.js";
import { ColumnHeader, AddFieldPopover, OptionsEditor, type FieldType } from "./db/FieldComponents.js";
import { BoardView } from "./db/BoardView.js";

// ── Filter Bar ────────────────────────────────────────────────────────────

function FilterBar({
  fields, filters, onAdd, onRemove, onChange,
}: {
  fields: any[]; filters: Array<{ fieldId: string; operator: string; value: string }>;
  onAdd: () => void; onRemove: (index: number) => void;
  onChange: (index: number, updates: Partial<{ fieldId: string; operator: string; value: string }>) => void;
}) {
  if (filters.length === 0) {
    return (<button onClick={onAdd} className="db-filter-btn">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 3h12M4 8h8M6 13h4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>Filter</button>);
  }
  return (
    <div className="db-filter-bar">
      <span style={{ fontSize: 12, color: "#666", fontWeight: 500, marginRight: 4 }}>Filter</span>
      {filters.map((filter, idx) => (
        <div key={idx} className="db-filter-rule">
          <select value={filter.fieldId} onChange={(e) => onChange(idx, { fieldId: e.target.value })}
            style={{ border: "1px solid #e9e9e7", borderRadius: 4, padding: "2px 4px", fontSize: 12, background: "#fff" }}>
            <option value="">Field</option>
            {fields.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
          </select>
          <select value={filter.operator} onChange={(e) => onChange(idx, { operator: e.target.value })}
            style={{ border: "1px solid #e9e9e7", borderRadius: 4, padding: "2px 4px", fontSize: 12, background: "#fff" }}>
            <option value="contains">Contains</option>
            <option value="does_not_contain">Does not contain</option>
            <option value="is">Is</option>
            <option value="is_not">Is not</option>
            <option value="is_empty">Is empty</option>
            <option value="is_not_empty">Is not empty</option>
          </select>
          <input value={filter.value} onChange={(e) => onChange(idx, { value: e.target.value })}
            placeholder="Value" style={{ border: "1px solid #e9e9e7", borderRadius: 4, padding: "2px 6px", fontSize: 12, outline: "none", width: 100 }} />
          <button onClick={() => onRemove(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: 2, fontSize: 14 }}>&times;</button>
        </div>
      ))}
      <button onClick={onAdd} className="db-filter-add">+ Add filter</button>
    </div>
  );
}

// ── Sort Bar ──────────────────────────────────────────────────────────────

function SortBar({
  fields, sorts, onAdd, onRemove, onChange,
}: {
  fields: any[]; sorts: Array<{ fieldId: string; direction: "asc" | "desc" }>;
  onAdd: () => void; onRemove: (index: number) => void;
  onChange: (index: number, updates: Partial<{ fieldId: string; direction: "asc" | "desc" }>) => void;
}) {
  if (sorts.length === 0) {
    return (<button onClick={onAdd} className="db-filter-btn">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 3v10M4 3l-2 2M4 3l2 2M12 13V3M12 13l-2-2M12 13l2-2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>Sort</button>);
  }
  return (
    <div className="db-filter-bar">
      <span style={{ fontSize: 12, color: "#666", fontWeight: 500, marginRight: 4 }}>Sort</span>
      {sorts.map((sort, idx) => (
        <div key={idx} className="db-filter-rule">
          <select value={sort.fieldId} onChange={(e) => onChange(idx, { fieldId: e.target.value })}
            style={{ border: "1px solid #e9e9e7", borderRadius: 4, padding: "2px 4px", fontSize: 12, background: "#fff" }}>
            <option value="">Field</option>
            {fields.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
          </select>
          <select value={sort.direction} onChange={(e) => onChange(idx, { direction: e.target.value as "asc" | "desc" })}
            style={{ border: "1px solid #e9e9e7", borderRadius: 4, padding: "2px 4px", fontSize: 12, background: "#fff" }}>
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

// ── Sortable Row ──────────────────────────────────────────────────────────

function SortableRow({
  id, children, isDragging, onDelete,
}: {
  id: string; children: React.ReactNode; isDragging: boolean; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sortableDragging } = useSortable({ id });
  const [hovered, setHovered] = useState(false);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: sortableDragging ? 0.4 : 1,
  };
  return (
    <tr ref={setNodeRef} style={style} className={`db-table-row ${isDragging || sortableDragging ? "db-row-dragging" : ""}`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <td className="db-drag-cell">
        <div className="db-drag-handle" {...listeners} {...attributes}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
        <button className="db-delete-btn" style={{ opacity: hovered ? 1 : 0 }} onClick={onDelete} title="Delete record">×</button>
      </td>
      {children}
    </tr>
  );
}

// ── Main DatabaseView ─────────────────────────────────────────────────────

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
  const [dbRecordCache, setDbRecordCache] = useState<Record<string, any[]>>({});
  const addFieldBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    loadDbFields(database.id);
    loadDbRecords(database.id);
    databases.forEach(async (db: any) => {
      if (!dbRecordCache[db.id]) {
        try {
          const recs = await api.listRecords(db.id);
          setDbRecordCache((prev) => ({ ...prev, [db.id]: recs }));
        } catch { /* ignore */ }
      }
    });
  }, [database.id]);

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

  const handleAddRecord = async () => {
    if (!newTitle.trim()) return;
    await createDbRecord(database.id, newTitle.trim());
    setNewTitle("");
    try { const recs = await api.listRecords(database.id); setDbRecordCache((prev) => ({ ...prev, [database.id]: recs })); } catch { /* ignore */ }
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

  const handleDeleteField = async (fieldId: string) => { await deleteField(fieldId); };

  const handleDeleteRecord = async (recordId: string) => {
    await deleteRecord(recordId);
    try { const recs = await api.listRecords(database.id); setDbRecordCache((prev) => ({ ...prev, [database.id]: recs })); } catch { /* ignore */ }
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
      return { ...prev, [fieldId]: Math.max(80, current + delta) };
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

  // Table DnD
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
    return (<BoardView database={database} fields={dbFields} records={sortedRecords} databases={databases} onSwitchView={() => setViewType("table")} allRecords={dbRecordCache} />);
  }

  return (
    <DndContext sensors={tableSensors} onDragStart={handleRowDragStart} onDragEnd={handleRowDragEnd}>
      <div className="table-view">
        {/* Toolbar */}
        <div className="db-toolbar">
          <button className={viewType === "table" ? "active" : ""} onClick={() => setViewType("table")}>Table</button>
          <button className={viewType === "board" ? "active" : ""} onClick={() => setViewType("board")}>Board</button>

          <div style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <FilterBar fields={dbFields} filters={activeFilters} onAdd={() => addFilter({ fieldId: dbFields[0]?.id || "", operator: "contains", value: "" })}
              onRemove={removeFilter} onChange={(idx, updates) => { const ex = activeFilters[idx]; setFilter(idx, { ...ex, ...updates }); }} />
            <SortBar fields={dbFields} sorts={activeSorts} onAdd={() => addSort({ fieldId: dbFields[0]?.id || "", direction: "asc" })}
              onRemove={removeSort} onChange={(idx, updates) => { const ex = activeSorts[idx]; setSort(idx, { ...ex, ...updates }); }} />
          </div>

          <span style={{ marginLeft: "auto", fontSize: 13, color: "#666", display: "flex", alignItems: "center", gap: 8 }}>
            {isEditingName ? (
              <input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)} onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown} autoFocus style={{ fontSize: 13, padding: "2px 6px", border: "1px solid #2eaadc", borderRadius: 4, width: 140, outline: "none" }} />
            ) : (<span onClick={() => setIsEditingName(true)} style={{ cursor: "pointer", fontWeight: 500 }}>{database.name || "Untitled"}</span>)}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="db-table">
            <thead>
              <tr>
                <th className="db-drag-header" />
                <ColumnHeader field={{ id: "title", name: "Name", type: "text" }} onRename={() => {}} onDelete={() => {}} isTitle width={columnWidths["__title__"]} onResize={handleColumnResize} />
                {dbFields.map((f: any) => (
                  <ColumnHeader key={f.id} field={f} onRename={(name) => handleRenameField(f.id, name)} onDelete={() => handleDeleteField(f.id)}
                    onOptions={() => setShowOptionsFor(showOptionsFor === f.id ? null : f.id)} width={columnWidths[f.id]} onResize={handleColumnResize} />
                ))}
                <th style={{ width: 40 }}>
                  <button ref={addFieldBtnRef} onClick={() => setShowAddField(true)} className="db-add-col-btn" title="Add property">+</button>
                </th>
              </tr>
            </thead>
            <SortableContext items={sortedRecords.map((r: any) => r.record.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {sortedRecords.map(({ record, values }: any) => (
                  <SortableRow key={record.id} id={record.id} isDragging={activeRowId === record.id} onDelete={() => handleDeleteRecord(record.id)}>
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
                            <InlineCellEditor field={field} value={val} onSave={(v) => handleCellEdit(record.id, field.id, v)} onCancel={() => setEditingCell(null)} databases={databases} allRecords={dbRecordCache} />
                          ) : (
                            <div onClick={() => setEditingCell({ recordId: record.id, fieldId: field.id })} className="db-cell-content">
                              <CellDisplay field={field} value={val} databases={databases} allRecords={dbRecordCache} />
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td />
                  </SortableRow>
                ))}
                <tr className="db-add-row">
                  <td colSpan={dbFields.length + 2} style={{ padding: "2px 12px" }}>
                    <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddRecord(); if (e.key === "Escape") setNewTitle(""); }}
                      onBlur={handleAddRecord} placeholder="+ New record" className="db-new-record-input" />
                  </td>
                </tr>
              </tbody>
            </SortableContext>
          </table>
        </div>

        {showAddField && (<AddFieldPopover triggerRect={addFieldBtnRef.current?.getBoundingClientRect() ?? null} onClose={() => setShowAddField(false)} onAdd={handleAddField} databases={databases} />)}

        {showOptionsFor && (() => {
          const f = dbFields.find((x: any) => x.id === showOptionsFor);
          if (!f) return null;
          const el = document.querySelector(`[data-field-id="${f.id}"]`);
          const rect = el ? (el as HTMLElement).getBoundingClientRect() : null;
          return (<Popover triggerRect={rect} onClose={() => setShowOptionsFor(null)} minWidth={260}>
            <OptionsEditor field={f as any} onClose={() => setShowOptionsFor(null)} onUpdate={() => {}} onDeleteOption={(opt) => handleDeleteOption(f.id, opt)} onAddOption={(opt) => handleAddOption(f.id, opt)} />
          </Popover>);
        })()}

        <DragOverlay>
          {activeRowId ? (<div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "8px 16px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontSize: 14 }}>
            {sortedRecords.find((r) => r.record.id === activeRowId)?.record.title || "Record"}
          </div>) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
