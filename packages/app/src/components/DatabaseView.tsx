import { useState, useEffect } from "react";
import { useStore } from "../store.js";

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
    return <BoardView database={database} fields={dbFields} records={records} onSwitchView={() => setViewType("table")} isNew={isNew} onNameChange={() => setIsEditingName(true)} />;
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

function BoardView({ database, fields, records, onSwitchView }: { database: any; fields: any[]; records: any[]; onSwitchView: () => void }) {
  // Find first select field for grouping
  const groupField = fields.find((f: any) => f.type === "select");

  const groups: Record<string, typeof records> = {};
  for (const r of records) {
    const key = groupField ? String(r.values[groupField.name] || "Untitled") : "All";
    groups[key] = groups[key] || [];
    groups[key].push(r);
  }

  return (
    <div>
      <div className="db-toolbar">
        <button onClick={onSwitchView}>Table</button>
        <button className="active">Board</button>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#666" }}>{database.name}</span>
      </div>
      <div className="board">
        {Object.entries(groups).map(([name, recs]) => (
          <div key={name} className="board-column">
            <h3>{name} ({recs.length})</h3>
            {recs.map(({ record }: any) => (
              <div key={record.id} className="board-card">{record.title}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
