import { useEffect, useState, useCallback } from "react";
import { Modal, Button } from "./ui/index.js";
import type { TrashContents } from "@notion-alt/shared";
import { api } from "../rpc-client.js";
import { toaster } from "../toaster.js";

interface Props {
  onClose: () => void;
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

  const act = async (op: "restore" | "purge", kind: Kind, id: string, label: string) => {
    if (op === "purge" && !confirm(`Permanently delete "${label}"? This cannot be undone.`)) return;
    setBusy(id);
    try {
      if (op === "restore") {
        await (kind === "page" ? api.restorePage({ id }) : kind === "database" ? api.restoreDatabase({ id }) : api.restoreRecord({ id }));
      } else {
        await (kind === "page" ? api.purgePage({ id }) : kind === "database" ? api.purgeDatabase({ id }) : api.purgeRecord({ id }));
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
    <li key={id} className="flex flex-col gap-1 px-3.5 py-3 border border-border rounded bg-surface">
      <div className="flex items-center gap-2.5">
        <span className="font-semibold text-sm text-text">{label || "Untitled"}</span>
        <code className="[font-family:var(--font-mono)] text-[12px] bg-surface-3 rounded px-1.5 py-0.5 text-text-3">{kind}</code>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-text-3">Deleted {fmt(deletedAt)}</span>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" disabled={busy === id} onClick={() => act("restore", kind, id, label)}>Restore</Button>
          <Button variant="danger" size="sm" disabled={busy === id} onClick={() => act("purge", kind, id, label)}>Delete forever</Button>
        </div>
      </div>
    </li>
  );

  return (
    <Modal title="Trash" onClose={onClose} className="max-w-[560px]">
      <p className="text-[13.5px] text-text-2 leading-relaxed mb-4">
        Deleted pages, databases, and records are kept here and can be restored.
        Items are permanently removed automatically after the retention period.
      </p>

      {loading ? (
        <p className="text-text-3 text-sm">Loading…</p>
      ) : isEmpty ? (
        <div className="flex flex-col items-center text-center px-4 pt-7 pb-3">
          <p className="[font-family:var(--font-title)] text-[17px] font-bold text-text tracking-[-0.02em] mb-1.5">Trash is empty</p>
          <p className="text-[13.5px] text-text-3 leading-relaxed max-w-[280px]">
            Deleted items will show up here until they're permanently removed.
          </p>
        </div>
      ) : (
        <>
          {trash.pages.length > 0 && (
            <section className="mb-5">
              <h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">Pages</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-0.5">{trash.pages.map((p) => row("page", p.id, p.title, p.deletedAt))}</ul>
            </section>
          )}
          {trash.databases.length > 0 && (
            <section className="mb-5">
              <h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">Databases</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-0.5">{trash.databases.map((d) => row("database", d.id, d.name, d.deletedAt))}</ul>
            </section>
          )}
          {trash.records.length > 0 && (
            <section className="mb-5">
              <h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">Records</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-0.5">{trash.records.map((r) => row("record", r.id, r.title, r.deletedAt))}</ul>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
