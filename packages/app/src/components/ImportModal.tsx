import { useState, useRef, useEffect, useCallback } from "react";
import { getCurrentWorkspaceId } from "../rpc-client.js";
import {
  DialogRoot,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogCloseTrigger,
} from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Accessible import dialog built on Ark UI's Dialog primitive. Ark handles
 * focus trapping, scroll lock, Escape-to-close, and aria wiring — we just
 * style the parts. The dialog is `controlled` via the `open` prop so the
 * parent (sidebar footer button) can drive open/close.
 */
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
    setMessage("Uploading and importing…");

    try {
      const workspaceId = getCurrentWorkspaceId();
      const importHeaders: Record<string, string> = {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${file.name}"`,
      };
      if (workspaceId) importHeaders["X-Workspace-Id"] = workspaceId;
      const resp = await fetch("/import-notion", {
        method: "POST",
        headers: importHeaders,
        body: file,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Import failed");
      }
      if (data.pagesImported === 0 && data.databasesImported === 0) {
        throw new Error("Nothing was imported. Make sure the export contains .md, .html, or .csv files.");
      }
      setStatus("success");
      setMessage(`Imported ${data.pagesImported} page(s) and ${data.databasesImported} database(s).`);
      // Refresh so the new pages show up in the sidebar.
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Import failed.");
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

  return (
    <DialogRoot
      open={open}
      onOpenChange={(details: { open: boolean }) => { if (!details.open && status !== "uploading") onClose(); }}
      closeOnEscape={status !== "uploading"}
      closeOnInteractOutside={status !== "uploading"}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <DialogBackdrop className="import-modal-overlay" />
        <DialogPositioner className="import-modal-positioner">
          <DialogContent className="import-modal">
            <div className="import-modal-header">
              <DialogTitle>Import Notion export</DialogTitle>
              <DialogCloseTrigger
                className="import-modal-close"
                disabled={status === "uploading"}
                aria-label="Close"
              >
                ✕
              </DialogCloseTrigger>
            </div>

            <div className="import-modal-body">
              {status === "idle" && (
                <>
                  <DialogDescription className="import-modal-hint">
                    Upload your Notion export ZIP file — no need to extract it.
                  </DialogDescription>

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
                          aria-label="Remove file"
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
                      Try again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </DialogRoot>
  );
}
