import { useState, useEffect } from "react";
import { Button } from "./ui/index.js";
import { toaster } from "../toaster.js";
import {
  DialogRoot,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogTitle,
  DialogCloseTrigger,
} from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";

type BackupSchedule = "manual" | "hourly" | "every6h" | "daily" | "weekly";

interface S3Settings {
  s3Enabled: boolean;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3Prefix: string;
  s3Schedule: BackupSchedule;
}

interface BackupListItem {
  key: string;
  size: number;
  lastModified: string;
}

const DEFAULTS: S3Settings = {
  s3Enabled: false,
  s3Endpoint: "",
  s3Region: "us-east-1",
  s3Bucket: "",
  s3AccessKeyId: "",
  s3SecretAccessKey: "",
  s3Prefix: "backups",
  s3Schedule: "manual",
};

const LAST_BACKUP_KEY = "notion-alt:lastBackup";

const SCHEDULE_LABELS: Record<BackupSchedule, string> = {
  manual: "Manual only",
  hourly: "Every hour",
  every6h: "Every 6 hours",
  daily: "Every day",
  weekly: "Every week",
};

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<S3Settings>(DEFAULTS);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [backupStatus, setBackupStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [backupMessage, setBackupMessage] = useState("");
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupListItem[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [restoreMessage, setRestoreMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setLastBackup(localStorage.getItem(LAST_BACKUP_KEY));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings({ ...DEFAULTS, ...data }))
      .catch(() => {});
  }, [open]);

  const loadBackups = () => {
    fetch("/api/backup/list")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setBackups(data))
      .catch(() => {});
  };

  useEffect(() => {
    if (open && settings.s3Enabled) loadBackups();
  }, [open, settings.s3Enabled]);

  const set = <K extends keyof S3Settings>(key: K, value: S3Settings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      const resp = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!resp.ok) throw new Error(await resp.text());
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveStatus("idle");
      toaster.create({ title: "Failed to save settings", description: err instanceof Error ? err.message : "Something went wrong.", type: "error" });
    }
  };

  const handleBackup = async () => {
    setBackupStatus("running");
    setBackupMessage("Uploading backup…");
    try {
      const resp = await fetch("/api/backup/trigger", { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Backup failed");
      const ts = new Date(data.timestamp).toLocaleString();
      localStorage.setItem(LAST_BACKUP_KEY, ts);
      setLastBackup(ts);
      setBackupStatus("success");
      setBackupMessage(`Backed up to ${data.key} (${(data.size / 1024).toFixed(0)} KB)`);
      toaster.create({ title: "Backup complete", description: `Saved to ${data.key}`, type: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Backup failed";
      setBackupStatus("idle");
      setBackupMessage("");
      toaster.create({ title: "Backup failed", description: msg, type: "error" });
    }
  };

  const handleRestore = async () => {
    if (!selectedKey) return;
    if (
      !confirm(
        "Restore this backup?\n\nThis REPLACES ALL workspaces and attachments with the contents of the selected backup. A snapshot of the current state is saved to S3 first, then the server restarts.",
      )
    )
      return;
    if (prompt('Type RESTORE to confirm overwriting all data:') !== "RESTORE") return;

    setRestoreStatus("running");
    setRestoreMessage("Snapshotting current state, then restoring…");
    try {
      const resp = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: selectedKey }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Restore failed");
      setRestoreStatus("done");
      setRestoreMessage("Restored. The server is restarting — reloading shortly…");
      toaster.create({
        title: "Restore started",
        description: `Safety snapshot saved to ${data.snapshot}. Reloading once the server is back.`,
        type: "success",
      });
      // The server exits and Docker relaunches it. Poll /health, then reload.
      const start = Date.now();
      const poll = setInterval(async () => {
        try {
          const h = await fetch("/health", { cache: "no-store" });
          if (h.ok) {
            clearInterval(poll);
            window.location.reload();
          }
        } catch {
          // server still down — keep polling
        }
        if (Date.now() - start > 60_000) clearInterval(poll);
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Restore failed";
      setRestoreStatus("error");
      setRestoreMessage("");
      toaster.create({ title: "Restore failed", description: msg, type: "error" });
    }
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(details: { open: boolean }) => { if (!details.open) onClose(); }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <DialogBackdrop className="import-modal-overlay" />
        <DialogPositioner className="import-modal-positioner">
          <DialogContent className="settings-modal">
            <div className="import-modal-header">
              <DialogTitle>Backups</DialogTitle>
              <DialogCloseTrigger className="import-modal-close" aria-label="Close">
                ✕
              </DialogCloseTrigger>
            </div>

            <div className="settings-modal-body">
              <div className="settings-section-title">Backup to S3</div>

              <label className="settings-toggle-row">
                <input
                  type="checkbox"
                  checked={settings.s3Enabled}
                  onChange={(e) => set("s3Enabled", e.target.checked)}
                />
                <span>Enable S3 backup</span>
              </label>

              {settings.s3Enabled && (
                <>
                  <div className="settings-fields">
                    <label className="settings-field">
                      <span>Endpoint URL</span>
                      <input
                        type="text"
                        placeholder="https://s3.amazonaws.com (leave blank for AWS)"
                        value={settings.s3Endpoint}
                        onChange={(e) => set("s3Endpoint", e.target.value)}
                      />
                    </label>

                    <label className="settings-field">
                      <span>Region</span>
                      <input
                        type="text"
                        placeholder="us-east-1"
                        value={settings.s3Region}
                        onChange={(e) => set("s3Region", e.target.value)}
                      />
                    </label>

                    <label className="settings-field">
                      <span>Bucket</span>
                      <input
                        type="text"
                        placeholder="my-backup-bucket"
                        value={settings.s3Bucket}
                        onChange={(e) => set("s3Bucket", e.target.value)}
                      />
                    </label>

                    <label className="settings-field">
                      <span>Access Key ID</span>
                      <input
                        type="text"
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        value={settings.s3AccessKeyId}
                        onChange={(e) => set("s3AccessKeyId", e.target.value)}
                      />
                    </label>

                    <label className="settings-field">
                      <span>Secret Access Key</span>
                      <input
                        type="password"
                        placeholder="••••••••••••••••••••"
                        value={settings.s3SecretAccessKey}
                        onChange={(e) => set("s3SecretAccessKey", e.target.value)}
                      />
                    </label>

                    <label className="settings-field">
                      <span>Key prefix</span>
                      <input
                        type="text"
                        placeholder="backups"
                        value={settings.s3Prefix}
                        onChange={(e) => set("s3Prefix", e.target.value)}
                      />
                      <span className="settings-field-hint">
                        Saved as <code>{(settings.s3Prefix ? settings.s3Prefix.replace(/\/$/, "") + "/" : "") + "backup-<timestamp>.zip"}</code>
                      </span>
                    </label>

                    <label className="settings-field">
                      <span>Automatic backup</span>
                      <select
                        value={settings.s3Schedule}
                        onChange={(e) => set("s3Schedule", e.target.value as BackupSchedule)}
                        className="settings-select"
                      >
                        {(Object.entries(SCHEDULE_LABELS) as [BackupSchedule, string][]).map(([v, label]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="settings-backup-row">
                    {backupStatus === "success" && (
                      <span className="settings-backup-msg success">{backupMessage}</span>
                    )}
                    {backupStatus === "running" && (
                      <span className="settings-backup-msg">{backupMessage}</span>
                    )}
                    {backupStatus === "idle" && lastBackup && (
                      <span className="settings-last-backup">Last backup: {lastBackup}</span>
                    )}
                    {backupStatus === "idle" && !lastBackup && (
                      <span className="settings-last-backup">No backup yet</span>
                    )}
                    <Button
                      variant="secondary"
                      onClick={handleBackup}
                      disabled={backupStatus === "running"}
                    >
                      {backupStatus === "running" ? "Backing up…" : "Backup Now"}
                    </Button>
                  </div>

                  <div className="settings-section-title">Restore from backup</div>
                  <p className="settings-field-hint">
                    Replaces <strong>all</strong> workspaces and attachments with the contents of
                    the selected backup. A snapshot of the current state is saved to S3 first, then
                    the server restarts.
                  </p>

                  <div className="settings-fields">
                    <label className="settings-field">
                      <span>Backup to restore</span>
                      <select
                        value={selectedKey}
                        onChange={(e) => setSelectedKey(e.target.value)}
                        className="settings-select"
                        disabled={restoreStatus === "running"}
                      >
                        <option value="">
                          {backups.length ? "Select a backup…" : "No backups found"}
                        </option>
                        {backups.map((b) => (
                          <option key={b.key} value={b.key}>
                            {new Date(b.lastModified).toLocaleString()} ({(b.size / 1024).toFixed(0)} KB)
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="settings-backup-row">
                    {restoreStatus !== "idle" && restoreMessage && (
                      <span className={`settings-backup-msg${restoreStatus === "done" ? " success" : ""}`}>
                        {restoreMessage}
                      </span>
                    )}
                    <Button
                      variant="danger"
                      onClick={handleRestore}
                      disabled={!selectedKey || restoreStatus === "running" || restoreStatus === "done"}
                    >
                      {restoreStatus === "running" ? "Restoring…" : "Restore"}
                    </Button>
                  </div>
                </>
              )}

              <div className="settings-modal-actions">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={saveStatus === "saving"}
                >
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </DialogRoot>
  );
}
