import { useEffect, useState } from "react";
import { api } from "../../rpc-client.js";
import { CellDisplay, InlineCellEditor } from "./CellComponents.js";

/**
 * Slide-in side panel showing all properties of a record + a free-form
 * description textarea. Intentionally NOT a nested page — keeps the data
 * model flat (no blocks per record) while still giving users a place for
 * longer-form context.
 */
export function RecordPanel({
  databaseId, record, values, fields, databases, allRecords, onClose, onChanged,
}: {
  databaseId: string;
  record: { id: string; title: string; description: string };
  values: Record<string, unknown>;
  fields: Array<{ id: string; name: string; type: string; options?: string[] | null; relationTargetDbId?: string | null }>;
  databases: any[];
  allRecords: Record<string, any[]>;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState(record.title || "");
  const [description, setDescription] = useState(record.description || "");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  useEffect(() => { setTitle(record.title || ""); setDescription(record.description || ""); }, [record.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveTitle = async () => {
    if (title === record.title) return;
    await api.updateRecord(record.id, { title });
    await onChanged();
  };
  const saveDescription = async () => {
    if (description === record.description) return;
    await api.updateRecord(record.id, { description });
    await onChanged();
  };

  const setFieldValue = async (fieldId: string, value: string) => {
    await api.updateFieldValue(record.id, fieldId, value);
    setEditingFieldId(null);
    await onChanged();
  };

  return (
    <div className="record-panel-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="record-panel" role="dialog" aria-label="Record details">
        <header className="record-panel-header">
          <button className="record-panel-close" onClick={onClose} title="Close (Esc)">×</button>
        </header>

        <input
          autoFocus
          className="record-panel-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
          placeholder="Untitled"
        />

        <section className="record-panel-props">
          {fields.map((field) => {
            const val = values[field.name] ?? "";
            const isEditing = editingFieldId === field.id;
            return (
              <div key={field.id} className="record-panel-prop">
                <div className="record-panel-prop-label">{field.name}</div>
                <div className="record-panel-prop-value">
                  {isEditing ? (
                    <InlineCellEditor
                      field={field as any}
                      value={val}
                      onSave={(v) => setFieldValue(field.id, v)}
                      onCancel={() => setEditingFieldId(null)}
                      databases={databases}
                      allRecords={allRecords}
                    />
                  ) : (
                    <div className="record-panel-prop-display" onClick={() => setEditingFieldId(field.id)}>
                      <CellDisplay field={field as any} value={val} databases={databases} allRecords={allRecords} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {fields.length === 0 && (
            <div className="record-panel-empty">No properties yet. Add one from the table header.</div>
          )}
        </section>

        <section className="record-panel-description">
          <div className="record-panel-prop-label">Description</div>
          <textarea
            className="record-panel-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="Add notes, context, or anything else…"
            rows={6}
          />
        </section>
      </aside>
    </div>
  );
}
