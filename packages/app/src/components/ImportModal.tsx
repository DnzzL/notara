import { useState, useRef, useEffect, useCallback } from "react";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setStatus("idle");
      setMessage("");
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setStatus("idle");
      setMessage("");
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setStatus("uploading");
    setMessage("Uploading and importing...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch("/import-notion", {
        method: "POST",
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${file.name}"`,
        },
        body: file,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Import failed");
      }
      setStatus("success");
      setMessage(`Imported ${data.pagesImported} page(s) and ${data.databasesImported} database(s).`);
      // Reload pages in background
      window.location.reload();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Import failed.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && status !== "uploading") {
      onClose();
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith(".zip")) {
      setFile(dropped);
      setStatus("idle");
      setMessage("");
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  if (!open) return null;

  return (
    <div className="import-modal-overlay" onClick={onClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="import-modal-header">
          <h3>Import Notion Export</h3>
          <button className="import-modal-close" onClick={onClose} disabled={status === "uploading"}>✕</button>
        </div>

        <div className="import-modal-body">
          {status === "idle" && (
            <>
              <p className="import-modal-hint">
                Upload your <strong>Notion export ZIP file</strong>. No need to extract it first.
              </p>

              <div
                className="import-drop-zone"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="import-file-selected">
                    <span className="import-file-icon">📦</span>
                    <div>
                      <div className="import-file-name">{file.name}</div>
                      <div className="import-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                    </div>
                    <button
                      className="import-file-remove"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="import-drop-prompt">
                    <span className="import-drop-icon">📁</span>
                    <div>Drop your ZIP file here, or <strong>click to browse</strong></div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              <div className="import-modal-actions">
                <button className="import-modal-btn cancel" onClick={onClose}>Cancel</button>
                <button
                  className="import-modal-btn primary"
                  onClick={handleImport}
                  disabled={!file}
                >
                  Import
                </button>
              </div>
            </>
          )}

          {status === "uploading" && (
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
