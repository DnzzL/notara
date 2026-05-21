import { useState, useEffect } from "react";
import { api } from "../rpc-client.js";
import type { ApiKey, ApiKeyCreated } from "@notion-alt/shared";

interface Props {
  onClose: () => void;
}

export function ApiKeysModal({ onClose }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.listApiKeys().then(setKeys).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setError(null);
    setCreating(true);
    try {
      const key = await api.createApiKey(newKeyName.trim());
      setCreated(key);
      setKeys((prev) => [
        { id: key.id, name: key.name, keyPrefix: key.keyPrefix, createdAt: key.createdAt, lastUsedAt: null },
        ...prev,
      ]);
      setNewKeyName("");
    } catch (err: any) {
      setError(err.message ?? "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Revoke "${name}"? Any scripts using it will stop working.`)) return;
    await api.revokeApiKey(id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const handleCopy = () => {
    if (created) {
      navigator.clipboard.writeText(created.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content apikeys-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>API keys</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="apikeys-description">
          Use API keys to automate Notara from scripts, CI pipelines, or any HTTP client.
          Keys authenticate as you and have access to all your workspaces.{" "}
          <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="apikeys-docs-link">
            API docs ↗
          </a>
        </p>

        {/* New key created — show raw key once */}
        {created && (
          <div className="apikeys-new-key-banner">
            <div className="apikeys-new-key-header">
              <span className="apikeys-new-key-label">
                ✓ Key created — copy it now, it won't be shown again
              </span>
              <button className="apikeys-dismiss" onClick={() => setCreated(null)}>✕</button>
            </div>
            <div className="apikeys-new-key-row">
              <code className="apikeys-raw-key">{created.rawKey}</code>
              <button className="apikeys-copy-btn" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        <section className="settings-section">
          <h3>New key</h3>
          <form className="apikeys-create-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Key name (e.g. CI pipeline)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="invite-link-input"
              maxLength={64}
            />
            <button type="submit" disabled={creating || !newKeyName.trim()}>
              {creating ? "Creating…" : "Create"}
            </button>
          </form>
          {error && <p className="invite-error">{error}</p>}
        </section>

        {/* Key list */}
        <section className="settings-section">
          <h3>Active keys</h3>
          {loading ? (
            <p className="apikeys-empty">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="apikeys-empty">No keys yet.</p>
          ) : (
            <ul className="apikeys-list">
              {keys.map((k) => (
                <li key={k.id} className="apikeys-row">
                  <div className="apikeys-row-main">
                    <span className="apikeys-name">{k.name}</span>
                    <code className="apikeys-prefix">{k.keyPrefix}…</code>
                  </div>
                  <div className="apikeys-row-meta">
                    <span className="apikeys-meta-text">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt && ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                    </span>
                    <button
                      className="admin-delete-btn"
                      onClick={() => handleRevoke(k.id, k.name)}
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
