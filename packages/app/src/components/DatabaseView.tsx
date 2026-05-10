import { useState, useEffect } from "react";
import { useStore } from "../store.js";

export function DatabaseView({ database }: { database: any }) {
  const { dbFields, records, loadDbFields, loadDbRecords, createDbRecord, updateFieldValue, dbViews } = useStore();
  const [viewType, setViewType] = useState("table");
  const [newTitle, setNewTitle] = useState("");
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldId: string } | null>(null);
  const [editValue, setEditValue] = useState("");

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
    setEditingCell(null);
    setEditValue("");
  };

  if (viewType === "board") {
    return <BoardView database={database} fields={dbFields} records={records} />;
  }

  return (
    <div className="table-view">
      <div className="db-toolbar">
        <button className={viewType === "table" ? "active" : ""} onClick={() => setViewType("table")}>Table</button>
        <button className={viewType === "board" ? "active" : ""} onClick={() => setViewType("board")}>Board</button>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#666" }}>{database.name}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Title</th>
            {dbFields.map((f: any) => <th key={f.id}>{f.name}</th>)}
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
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BoardView({ database, fields, records }: { database: any; fields: any[]; records: any[] }) {
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
        <button onClick={() => {}}>Table</button>
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
