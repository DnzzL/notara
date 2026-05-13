import { useState, useEffect, useCallback } from "react";
import { useStore } from "../store.js";
import { api } from "../rpc-client.js";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function DatabaseView({ database, isNew }: { database: any; isNew?: boolean }) {
  const { dbFields, records, loadDbFields, loadDbRecords, createDbRecord, updateFieldValue, dbViews, createField } = useStore();
  const [viewType, setViewType] = useState("table");
  const [newTitle, setNewTitle] = useState("");
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldId: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [isEditingName, setIsEditingName] = useState(isNew);
  const [dbName, setDbName] = useState(database.name || "Untitled");

  useEffect(() => {
    loadDbFields(database.id);
    loadDbRecords(database.id);
  }, [database.id]);

  const handleAddRecord = async () => {
    if (!newTitle.trim()) return;
    await createDbRecord(database.id, newTitle.trim());
    setNewTitle("");
  };

  const handleCellEdit = async (recordId: string, fieldId: string) => {
    await updateFieldValue(recordId, fieldId, editValue);
    await loadDbRecords(database.id); // Refresh records after edit
    setEditingCell(null);
    setEditValue("");
  };

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;
    await createField({
      databaseId: database.id,
      name: newFieldName.trim(),
      type: newFieldType,
      options: null,
      relationTargetDbId: null,
    });
    await loadDbFields(database.id);
    setNewFieldName("");
    setShowAddField(false);
  };

  if (viewType === "board") {
    return <BoardView database={database} fields={dbFields} records={records} onSwitchView={() => setViewType("table")} />;
  }

  const handleNameSave = async () => {
    // TODO: implement database rename on backend
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNameSave();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
    }
  };

  return (
    <div className="table-view">
      <div className="db-toolbar">
        <button className={viewType === "table" ? "active" : ""} onClick={() => setViewType("table")}>Table</button>
        <button className={viewType === "board" ? "active" : ""} onClick={() => setViewType("board")}>Board</button>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#666", display: "flex", alignItems: "center", gap: 8 }}>
          {isEditingName ? (
            <input
              type="text"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              autoFocus
              style={{
                fontSize: 13,
                padding: "2px 6px",
                border: "1px solid #2eaadc",
                borderRadius: 4,
                width: 120,
              }}
            />
          ) : (
            <span onClick={() => setIsEditingName(true)} style={{ cursor: "pointer" }}>
              {database.name || "Untitled"}
            </span>
          )}
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Title</th>
            {dbFields.map((f: any) => <th key={f.id}>{f.name}</th>)}
            <th style={{ width: 40 }}>
              {showAddField ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    placeholder="Field name"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddField();
                      if (e.key === "Escape") setShowAddField(false);
                    }}
                    onBlur={handleAddField}
                    autoFocus
                    style={{ width: 80, fontSize: 12, padding: "2px 4px" }}
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    style={{ width: 60, fontSize: 11 }}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="select">Select</option>
                    <option value="multiSelect">Multi-select</option>
                    <option value="date">Date</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddField(true)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                    color: "#999",
                    padding: "2px 6px",
                  }}
                  title="Add field"
                >
                  +
                </button>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map(({ record, values }: any) => (
            <tr key={record.id}>
              <td>{record.title}</td>
              {dbFields.map((field: any) => {
                const val = values[field.name] ?? "";
                const isEditing = editingCell?.recordId === record.id && editingCell?.fieldId === field.id;
                return (
                  <td key={field.id}>
                    {isEditing ? (
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleCellEdit(record.id, field.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCellEdit(record.id, field.id);
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        autoFocus
                        style={{ width: "100%", border: "1px solid #2eaadc", padding: "2px 4px" }}
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingCell({ recordId: record.id, fieldId: field.id });
                          setEditValue(String(val));
                        }}
                        style={{ cursor: "pointer", display: "block", padding: "2px 4px", minHeight: 20 }}
                      >
                        {String(val) || <span style={{ color: "#ccc" }}>Empty</span>}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="add-row">
            <td>
              <input
                placeholder="New record..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRecord()}
              />
            </td>
            {dbFields.map((f: any) => <td key={f.id}></td>)}
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Unique ID for the "add new column" drop zone */
const NEW_COLUMN_ID = "__new_column__";

/** Drop indicator between cards in a column */
function CardDropIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return <div className="board-drop-indicator" />;
}

/** Sortable board card with drag affordance */
function SortableBoardCard({
  id,
  record,
  isDragging,
  showDropIndicatorAbove,
}: {
  id: UniqueIdentifier;
  record: any;
  isDragging: boolean;
  showDropIndicatorAbove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sortableDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: sortableDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CardDropIndicator active={showDropIndicatorAbove} />
      <div
        className={`board-card ${isDragging || sortableDragging ? "board-card-dragging" : ""}`}
        data-testid={`board-card-${record.id}`}
      >
        <div
          className="board-card-drag-handle"
          {...listeners}
          {...attributes}
          data-testid={`board-card-handle-${record.id}`}
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
        <span className="board-card-title">{record.title}</span>
      </div>
    </div>
  );
}

/** Board column with sortable cards */
function BoardColumn({
  columnId,
  columnName,
  columnRecords,
  activeRecordId,
  dropIndicatorIndex,
  isOver,
}: {
  columnId: string;
  columnName: string;
  columnRecords: any[];
  activeRecordId: string | null;
  dropIndicatorIndex: number | null;
  isOver: boolean;
}) {
  const items = columnRecords.map((r) => r.record.id);

  return (
    <div
      className={`board-column ${isOver ? "board-column-over" : ""}`}
      data-column-id={columnId}
    >
      <h3 className="board-column-header">{columnName} ({columnRecords.length})</h3>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="board-cards-container" data-testid={`board-column-${columnId}`}>
          {columnRecords.map((item, index) => {
            const recordId = item.record.id;
            return (
              <SortableBoardCard
                key={recordId}
                id={recordId}
                record={item.record}
                isDragging={activeRecordId === recordId}
                showDropIndicatorAbove={dropIndicatorIndex === index}
              />
            );
          })}
          {/* Drop indicator at the end of the column */}
          <CardDropIndicator active={dropIndicatorIndex === columnRecords.length} />
        </div>
      </SortableContext>
    </div>
  );
}

function BoardView({ database, fields, records, onSwitchView }: { database: any; fields: any[]; records: any[]; onSwitchView: () => void }) {
  // Find first select field for grouping
  const groupField = fields.find((f: any) => f.type === "select");

  const { updateFieldValue: storeUpdateFieldValue, updateField, loadDbRecords } = useStore();

  // State for drag-drop
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<any>(null);
  const [activeGroupValue, setActiveGroupValue] = useState<string>("");
  const [dropTarget, setDropTarget] = useState<{ columnId: string; index: number } | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [showNewColumnInput, setShowNewColumnInput] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  // Build groups from records
  const groups: Record<string, typeof records> = {};
  const groupOrder: string[] = [];

  // Get available options from the field
  const fieldOptions: string[] = groupField?.options || [];

  for (const r of records) {
    const key = groupField ? String(r.values[groupField.name] || "Untitled") : "All";
    if (!groups[key]) {
      groups[key] = [];
      groupOrder.push(key);
    }
    groups[key].push(r);
  }

  // Add any field options that don't have records yet
  for (const opt of fieldOptions) {
    if (!groups[opt]) {
      groups[opt] = [];
      groupOrder.push(opt);
    }
  }

  // Sort groups: by field option order first, then by record appearance
  groupOrder.sort((a, b) => {
    const aIdx = fieldOptions.indexOf(a);
    const bIdx = fieldOptions.indexOf(b);
    if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
    if (aIdx >= 0) return -1;
    if (bIdx >= 0) return 1;
    return 0;
  });

  // Pointer sensor for drag-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const id = String(active.id);
    const recordEntry = records.find((r) => r.record.id === id);
    if (recordEntry) {
      setActiveRecordId(id);
      setActiveRecord(recordEntry.record);
      setActiveGroupValue(groupField ? String(recordEntry.values[groupField.name] || "Untitled") : "All");
    }
  }, [records, groupField]);

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over || !groupField) return;

    const overId = String(over.id);
    const overRecord = records.find((r) => r.record.id === overId);

    if (overRecord) {
      // Over a card
      const columnId = groupField ? String(overRecord.values[groupField.name] || "Untitled") : "All";
      setOverColumnId(columnId);
      const columnRecords = groups[columnId] || [];
      const index = columnRecords.findIndex((r) => r.record.id === overId);
      if (index >= 0) {
        setDropTarget({ columnId, index });
      }
    } else if (overId === NEW_COLUMN_ID) {
      setOverColumnId(NEW_COLUMN_ID);
      setDropTarget({ columnId: NEW_COLUMN_ID, index: 0 });
    } else {
      setOverColumnId(null);
      setDropTarget(null);
    }
  }, [records, groupField, groups]);

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setActiveRecordId(null);
    setActiveRecord(null);
    setActiveGroupValue("");
    setOverColumnId(null);
    setDropTarget(null);

    if (!over || !groupField || !activeRecord) return;

    const overId = String(over.id);
    const sourceColumnId = activeGroupValue;
    const draggedRecordId = String(active.id);

    // Determine target column and index from dropTarget
    const targetColumnId = dropTarget?.columnId || overColumnId;

    if (!targetColumnId) return;

    // Same column: reorder within the column
    if (targetColumnId === sourceColumnId) {
      const columnRecords = groups[targetColumnId] || [];
      const recordIds = columnRecords.map((r) => r.record.id);
      const fromIndex = recordIds.indexOf(draggedRecordId);
      let toIndex = dropTarget?.index ?? -1;

      // If dropped on the column itself (not a card), append to end
      if (toIndex < 0) {
        toIndex = recordIds.length;
      }

      // Adjust for removal of the dragged item
      if (fromIndex >= 0 && fromIndex < toIndex) {
        toIndex -= 1;
      }

      if (fromIndex >= 0 && fromIndex !== toIndex) {
        recordIds.splice(fromIndex, 1);
        recordIds.splice(toIndex, 0, draggedRecordId);
        await api.reorderRecords(database.id, recordIds);
      }
      await loadDbRecords(database.id);
      return;
    }

    // Different column: update the select field value
    if (targetColumnId === NEW_COLUMN_ID) {
      // Create new column by adding new option to field
      const newColumnName = prompt("New column name:");
      if (!newColumnName || !newColumnName.trim()) return;

      const trimmed = newColumnName.trim();
      const newOptions = [...fieldOptions, trimmed];
      await updateField(groupField.id, newOptions);

      // Update the record's field value to the new option
      await storeUpdateFieldValue(activeRecord.id, groupField.id, trimmed);
      await loadDbRecords(database.id);
    } else {
      // Update record's select field to the target column value
      await storeUpdateFieldValue(activeRecord.id, groupField.id, targetColumnId);
      await loadDbRecords(database.id);
    }
  }, [activeRecord, activeGroupValue, records, groupField, groups, fieldOptions, database.id, dropTarget, overColumnId, updateField, storeUpdateFieldValue, loadDbRecords]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div>
        <div className="db-toolbar">
          <button onClick={onSwitchView}>Table</button>
          <button className="active">Board</button>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#666" }}>{database.name}</span>
        </div>
        <div className="board">
          {groupOrder.map((columnName) => (
            <BoardColumn
              key={columnName}
              columnId={columnName}
              columnName={columnName}
              columnRecords={groups[columnName] || []}
              activeRecordId={activeRecordId}
              dropIndicatorIndex={
                dropTarget?.columnId === columnName ? dropTarget.index : null
              }
              isOver={overColumnId === columnName}
            />
          ))}

          {/* Add new column drop zone */}
          <div
            className="board-column board-new-column"
            data-column-id={NEW_COLUMN_ID}
          >
            <h3 className="board-column-header">+ Add column</h3>
            <div className="board-new-column-zone" data-testid="new-column-zone" />
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeRecord ? (
            <div className="board-card board-card-overlay">{activeRecord.title}</div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
