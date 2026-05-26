import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "../../store.js";
import { api } from "../../rpc-client.js";
import { SelectPill, CellDisplay } from "./CellComponents.js";

export function BoardView({
  database, fields, records, databases, onSwitchView, allRecords = {},
}: {
  database: any; fields: any[]; records: any[]; databases: any[];
  onSwitchView: () => void; allRecords?: Record<string, any[]>;
}) {
  const { boardGroupByFieldId, setBoardGroupBy, boardHiddenFieldIds, toggleBoardField, updateFieldValue, updateField, loadDbRecords, createDbRecord, loadDbFields } = useStore();
  const [showFieldsPicker, setShowFieldsPicker] = useState(false);
  const fieldsPickerRef = useRef<HTMLDivElement>(null);

  const groupField = fields.find((f: any) => f.id === boardGroupByFieldId) || fields.find((f: any) => f.type === "select") || null;

  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<any>(null);
  const [activeGroupValue, setActiveGroupValue] = useState("");
  const [dropTarget, setDropTarget] = useState<{ columnId: string; index: number } | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"card" | "column" | null>(null);
  const [activeColumnName, setActiveColumnName] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (!showFieldsPicker) return;
    const handler = (e: MouseEvent) => {
      if (fieldsPickerRef.current && !fieldsPickerRef.current.contains(e.target as Node)) {
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
      g["All"] = records;
      order.push("All");
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
        if (!g[key]) { g[key] = []; order.push(key); }
        g[key].push(r);
      }
      for (const opt of fieldOptions) {
        if (!g[opt]) { g[opt] = []; order.push(opt); }
      }
      order.sort((a, b) => {
        const aI = fieldOptions.indexOf(a), bI = fieldOptions.indexOf(b);
        if (aI >= 0 && bI >= 0) return aI - bI;
        if (aI >= 0) return -1;
        if (bI >= 0) return 1;
        return 0;
      });
    }
    return { groups: g, groupOrder: order };
  }, [groupField, records]);

  // Reset column order when group field changes
  const groupFieldId = groupField?.id;
  useEffect(() => { setColumnOrder([]); }, [groupFieldId]);

  // Merge user column order with computed groupOrder (add new groups at end)
  const displayOrder = useMemo(() => {
    const known = new Set(columnOrder);
    return [
      ...columnOrder.filter((c) => groupOrder.includes(c)),
      ...groupOrder.filter((g) => !known.has(g)),
    ];
  }, [columnOrder, groupOrder]);

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
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
      setActiveGroupValue(groupField ? String(entry.values[groupField.name] || "Untitled") : "All");
    }
  }, [records, groupField]);

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (dragType === "column") return;
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
  }, [dragType, records, groupField, groups]);

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
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
    setActiveRecordId(null); setActiveRecord(null); setActiveGroupValue("");
    setOverColumnId(null); setDropTarget(null);
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
        await api.reorderRecords(database.id, ids);
      }
      await loadDbRecords(database.id);
      return;
    }

    if (groupField.type === "select" && !groups[targetCol]) {
      await updateField(groupField.id, { options: [...(groupField.options || []), targetCol] });
    }
    if (groupField.type === "select") {
      await updateFieldValue(activeRecord.id, groupField.id, targetCol === "Untitled" ? "" : targetCol);
    }
    await loadDbRecords(database.id);
  }, [dragType, activeColumnName, displayOrder, activeRecord, activeGroupValue, groupField, groups, database.id, dropTarget, overColumnId, updateField, updateFieldValue, loadDbRecords]);

  const SortableColumn = ({ colName, children }: { colName: string; children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `column-${colName}` });
    const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
    return (
      <div ref={setNodeRef} style={style} className="board-column" data-column-id={colName}>
        <div className="board-column-drag-handle" {...listeners} {...attributes} title="Drag to reorder column">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.4 }}>
            <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
        {children}
      </div>
    );
  };

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
              .filter((f: any) => f.id !== groupField?.id && !boardHiddenFieldIds.includes(f.id))
              .map((f: any) => {
                const val = record.values[f.name];
                if (!val && f.type !== "checkbox") return null;
                return (
                  <div key={f.id} className="board-card-field">
                    <span className="board-card-field-name">{f.name}</span>
                    <CellDisplay field={f} value={val} databases={databases} allRecords={allRecords} />
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
              {fields.map((f: any) => (<option key={f.id} value={f.id}>{f.name} ({f.type})</option>))}
            </select>
          </div>

          <div style={{ marginLeft: 8, position: "relative" }} ref={fieldsPickerRef}>
            <button
              className={showFieldsPicker ? "active" : ""}
              onClick={() => setShowFieldsPicker((v) => !v)}
            >
              Fields{boardHiddenFieldIds.length > 0 ? ` (${fields.filter((f: any) => boardHiddenFieldIds.includes(f.id)).length} hidden)` : ""}
            </button>
            {showFieldsPicker && (
              <div className="board-fields-picker">
                <div className="board-fields-picker-title">Card fields</div>
                {fields
                  .filter((f: any) => f.id !== groupField?.id)
                  .map((f: any) => {
                    const hidden = boardHiddenFieldIds.includes(f.id);
                    return (
                      <label key={f.id} className="board-fields-picker-row">
                        <input
                          type="checkbox"
                          checked={!hidden}
                          onChange={() => toggleBoardField(f.id)}
                        />
                        <span>{f.name}</span>
                        <span className="board-fields-picker-type">{f.type}</span>
                      </label>
                    );
                  })}
                {fields.filter((f: any) => f.id !== groupField?.id).length === 0 && (
                  <div style={{ fontSize: 12, color: "#999", padding: "4px 0" }}>No fields to configure</div>
                )}
              </div>
            )}
          </div>

          <span style={{ marginLeft: "auto", fontSize: 13, color: "#666" }}>{database.name}</span>
        </div>

        <SortableContext items={displayOrder.map((c) => `column-${c}`)} strategy={horizontalListSortingStrategy}>
          <div className="board">
            {displayOrder.map((colName) => (
              <SortableColumn key={colName} colName={colName}>
                <h3 className="board-column-header">
                  {groupField?.type === "select" && groupField.options?.includes(colName) ? (
                    <SelectPill value={colName} colorIdx={groupField.options.indexOf(colName)} />
                  ) : (<span style={{ fontSize: 13 }}>{colName}</span>)}
                  <span style={{ color: "#999", fontWeight: 400 }}> ({(groups[colName] || []).length})</span>
                </h3>
                <SortableContext items={(groups[colName] || []).map((r) => r.record.id)} strategy={verticalListSortingStrategy}>
                  <div className="board-cards-container" id={`col-${colName}`}>
                    {(groups[colName] || []).map((item) => (
                      <SortableCard key={item.record.id} record={item} isDragging={activeRecordId === item.record.id} />
                    ))}
                  </div>
                </SortableContext>
                <div style={{ padding: "8px 4px" }}>
                  <button className="board-add-card" onClick={async () => {
                    const title = prompt("New record title:");
                    if (title?.trim()) {
                      await createDbRecord(database.id, title.trim());
                      await loadDbRecords(database.id);
                    }
                  }}>+ New</button>
                </div>
              </SortableColumn>
            ))}
            {groupField && (groupField.type === "select" || groupField.type === "multiSelect") && (
              <AddBoardColumn
                groupField={groupField}
                existingOptions={groupField.options || []}
                onAdded={() => loadDbFields(database.id)}
              />
            )}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeRecord ? (<div className="board-card board-card-overlay">{activeRecord.title}</div>) : null}
          {activeColumnName ? (
            <div className="board-column board-column-overlay" style={{ opacity: 0.8, pointerEvents: "none" }}>
              <h3 className="board-column-header">
                {groupField?.type === "select" && groupField.options?.includes(activeColumnName) ? (
                  <SelectPill value={activeColumnName} colorIdx={groupField.options.indexOf(activeColumnName)} />
                ) : (<span style={{ fontSize: 13 }}>{activeColumnName}</span>)}
              </h3>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

// ── Inline "Add column" tile (creates a new option on the group-by field) ─

function AddBoardColumn({ groupField, existingOptions, onAdded }: { groupField: { id: string; options: string[] | null }; existingOptions: string[]; onAdded: () => void | Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    const v = value.trim();
    setEditing(false);
    setValue("");
    if (!v || existingOptions.includes(v)) return;
    await api.updateField(groupField.id, { options: [...existingOptions, v] });
    await onAdded();
  };

  if (!editing) {
    return (
      <div
        className="board-column"
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 8, opacity: 0.6, cursor: "pointer", minWidth: 220 }}
        onClick={() => setEditing(true)}
        title="Add a new column"
      >
        <span style={{ fontSize: 13, color: "#666" }}>+ Add column</span>
      </div>
    );
  }
  return (
    <div className="board-column" style={{ padding: 8, minWidth: 220 }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setEditing(false); setValue(""); }
        }}
        placeholder="Column name"
        style={{ width: "100%", border: "1px solid #2eaadc", borderRadius: 4, padding: "4px 6px", fontSize: 13, outline: "none" }}
      />
    </div>
  );
}
