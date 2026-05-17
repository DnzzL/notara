import { useState, useRef, useEffect } from "react";
import { useStore } from "../store.js";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const { importNotion, loadPages } = useStore();
  const [directory, setDirectory] = useState("");
  const [status, setStatus] = useState<"idle" | "importing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (!open) {
      setDirectory("");
      setStatus("idle");
      setMessage("");
    }
  }, [open]);

  const handleImport = async () => {
    const dir = directory.trim();
    if (!dir) return;

    setStatus("importing");
    setMessage("Importing pages and databases...");

    try {
      const result = await importNotion(dir);
      setStatus("success");
      setMessage(`Imported ${result.pagesImported} page(s) and ${result.databasesImported} database(s).`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Import failed.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (status === "idle") {
        handleImport();
      } else {
        onClose();
      }
    } else if (e.key === "Escape") {
      if (status !== "importing") {
        onClose();
      }
    }
  };

  if (!open) return null;

  const isWorking = status === "importing";

  return (
    <div className="import-modal-overlay" onClick={onClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="import-modal-header">
          <h3>Import Notion Export</h3>
          <button className="import-modal-close" onClick={onClose} disabled={isWorking}>✕</button>
        </div>

        <div className="import-modal-body">
          {status === "idle" && (
            <>
              <p className="import-modal-hint">
                Enter the path to your <strong>unzipped</strong> Notion export directory.
                Notion exports as a ZIP — extract it first, then paste the folder path here.
              </p>
              <input
                ref={inputRef}
                type="text"
                className="import-modal-input"
                placeholder="/path/to/Notion Export (May 17, 2026)/"
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="import-modal-actions">
                <button className="import-modal-btn cancel" onClick={onClose}>Cancel</button>
                <button
                  className="import-modal-btn primary"
                  onClick={handleImport}
                  disabled={!directory.trim()}
                >
                  Import
                </button>
              </div>
            </>
          )}

          {status === "importing" && (
            <div className="import-modal-status">
              <div className="import-modal-spinner" />
              <p>{message}</p>
            </div>
          )}

          {status === "success" && (
            <div className="import-modal-status success">
              <span className="import-modal-icon">✓</span>
              <p>{message}</p>
              <button className="import-modal-btn primary" onClick={onClose}>Done</button>
            </div>
          )}

          {status === "error" && (
            <div className="import-modal-status error">
              <span className="import-modal-icon">✗</span>
              <p>{message}</p>
              <div className="import-modal-actions">
                <button className="import-modal-btn cancel" onClick={onClose}>Close</button>
                <button
                  className="import-modal-btn primary"
                  onClick={() => { setStatus("idle"); setMessage(""); }}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
