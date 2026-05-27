import { useEffect, useState } from "react";
import { api } from "../../rpc-client.js";
import { usePageStore } from "../../stores/pageStore.js";
import { IconButton, Button } from "../ui/index.js";
import { CellDisplay, InlineCellEditor } from "./CellComponents.js";

export function RecordPanel({
  databaseId, record, values, fields, databases, allRecords, onClose, onChanged,
}: {
  databaseId: string;
  record: { id: string; title: string; description: string; pageId?: string | null };
  values: Record<string, unknown>;
  fields: Array<{ id: string; name: string; type: string; options?: string[] | null; relationTargetDbId?: string | null }>;
  databases: any[];
  allRecords: Record<string, any[]>;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState(record.title || "");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(record.pageId ?? null);
  const [openingPage, setOpeningPage] = useState(false);
  const loadPages = usePageStore((s) => s.loadPages);
  const selectPageByIdWithCascade = usePageStore((s) => s.selectPageByIdWithCascade);

  useEffect(() => {
    setTitle(record.title || "");
    setPageId(record.pageId ?? null);
  }, [record.id]);

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

  const setFieldValue = async (fieldId: string, value: string) => {
    await api.updateFieldValue(record.id, fieldId, value);
    setEditingFieldId(null);
    await onChanged();
  };

  const handleOpenAsPage = async () => {
    setOpeningPage(true);
    try {
      const result = await api.openRecordAsPage(record.id);
      setPageId(result.pageId);
      await loadPages();
      onClose();
      await selectPageByIdWithCascade(result.pageId);
    } finally {
      setOpeningPage(false);
    }
  };

  return (
    <div className="record-panel-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="record-panel" role="dialog" aria-label="Record details">
        <header className="record-panel-header">
          <IconButton variant="ghost" size="sm" onClick={onClose} title="Close (Esc)" aria-label="Close">
            ×
          </IconButton>
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

        {pageId ? (
          <Button
            variant="ghost"
            size="sm"
            className="record-panel-page-link"
            onClick={async () => { onClose(); await selectPageByIdWithCascade(pageId); }}
          >
            ↗ Open page
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="record-panel-page-link"
            onClick={handleOpenAsPage}
            disabled={openingPage}
          >
            {openingPage ? "Opening…" : "↗ Open as page"}
          </Button>
        )}

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
      </aside>
    </div>
  );
}
