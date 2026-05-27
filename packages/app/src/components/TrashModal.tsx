import { useEffect, useState, useCallback } from "react";
import type { TrashContents } from "@notion-alt/shared";
import { api } from "../rpc-client.js";
import { toaster } from "../toaster.js";

interface Props {
  onClose: () => void;
  /** Called after a restore/purge so the caller can refresh its views. */
  onChanged?: () => void;
}

type Kind = "page" | "database" | "record";

const empty: TrashContents = { pages: [], databases: [], records: [] };

const fmt = (ts: string | null) => (ts ? new Date(ts).toLocaleString() : "—");

export function TrashModal({ onClose, onChanged }: Props) {
  const [trash, setTrash] = useState<TrashContents>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTrash(await api.listTrash());
    } catch (err: any) {
      toaster.create({ title: "Couldn't load trash", description: err?.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (
    op: "restore" | "purge",
    kind: Kind,
    id: string,
    label: string,
  ) => {
    if (op === "purge" && !confirm(`Permanently delete "${label}"? This cannot be undone.`)) return;
    setBusy(id);
    try {
      if (op === "restore") {
        await (kind === "page" ? api.restorePage(id) : kind === "database" ? api.restoreDatabase(id) : api.restoreRecord(id));
      } else {
        await (kind === "page" ? api.purgePage(id) : kind === "database" ? api.purgeDatabase(id) : api.purgeRecord(id));
      }
      await load();
      onChanged?.();
    } catch (err: any) {
      toaster.create({ title: `Couldn't ${op}`, description: err?.message, type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const isEmpty = trash.pages.length === 0 && trash.databases.length === 0 && trash.records.length === 0;

  const row = (kind: Kind, id: string, label: string, deletedAt: string | null) => (
    <li key={id} className="apikeys-row">
      <div className="apikeys-row-main">
        <span className="apikeys-name">{label || "Untitled"}</span>
        <code className="apikeys-prefix">{kind}</code>
      </div>
      <div className="apikeys-row-meta">
        <span className="apikeys-meta-text">Deleted {fmt(deletedAt)}</span>
        <button disabled={busy === id} onClick={() => act("restore", kind, id, label)}>
          Restore
        </button>
        <button className="admin-delete-btn" disabled={busy === id} onClick={() => act("purge", kind, id, label)}>
          Delete forever
        </button>
      </div>
    </li>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content apikeys-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Trash</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p className="apikeys-description">
            Deleted pages, databases, and records are kept here and can be restored.
            Items are permanently removed automatically after the retention period.
          </p>

          {loading ? (
            <p className="apikeys-empty">Loading…</p>
          ) : isEmpty ? (
            <div className="apikeys-empty-state">
              <p className="apikeys-empty-title">Trash is empty</p>
              <p className="apikeys-empty-body">Deleted items will show up here until they're permanently removed.</p>
            </div>
          ) : (
            <>
              {trash.pages.length > 0 && (
                <section className="settings-section">
                  <h3>Pages</h3>
                  <ul className="apikeys-list">{trash.pages.map((p) => row("page", p.id, p.title, p.deletedAt))}</ul>
                </section>
              )}
              {trash.databases.length > 0 && (
                <section className="settings-section">
                  <h3>Databases</h3>
                  <ul className="apikeys-list">{trash.databases.map((d) => row("database", d.id, d.name, d.deletedAt))}</ul>
                </section>
              )}
              {trash.records.length > 0 && (
                <section className="settings-section">
                  <h3>Records</h3>
                  <ul className="apikeys-list">{trash.records.map((r) => row("record", r.id, r.title, r.deletedAt))}</ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
