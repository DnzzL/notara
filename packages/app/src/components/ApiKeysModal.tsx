import { useState, useEffect } from "react";
import { useApiKeyStore } from "../store.js";
import type { ApiKeyCreated } from "@notion-alt/shared";
import { toaster } from "../toaster.js";

interface Props {
  onClose: () => void;
}

export function ApiKeysModal({ onClose }: Props) {
  const { apiKeys, apiKeysLoading, loadApiKeys, createApiKey, revokeApiKey } = useApiKeyStore();
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadApiKeys(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const key = await createApiKey(newKeyName.trim());
      setCreated(key);
      setNewKeyName("");
    } catch (err: any) {
      toaster.create({ title: "Failed to create key", description: err.message ?? "Something went wrong.", type: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Revoke "${name}"? Any scripts using it will stop working.`)) return;
    await revokeApiKey(id);
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

        <div className="modal-body">
          <p className="apikeys-description">
            Use API keys to automate Notara from scripts, CI pipelines, or any HTTP client.
            Keys authenticate as you and have access to all your workspaces.{" "}
            <a href="/docs" target="_blank" rel="noopener noreferrer" className="apikeys-docs-link">
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
          </section>

          {/* Key list */}
          <section className="settings-section">
            <h3>Active keys</h3>
            {apiKeysLoading ? (
              <p className="apikeys-empty">Loading…</p>
            ) : apiKeys.length === 0 ? (
              <div className="apikeys-empty-state">
                <div className="apikeys-empty-illustration" aria-hidden="true">
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <rect x="4" y="4" width="48" height="48" rx="14" fill="#EEEFFE"/>
                    <circle cx="22" cy="24" r="8" stroke="#5B5EF4" strokeWidth="2" fill="none"/>
                    <circle cx="22" cy="24" r="3" fill="#5B5EF4" opacity="0.3"/>
                    <path d="M28 30l10 10" stroke="#5B5EF4" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M35 37l3-1.5 1 2.5" stroke="#5B5EF4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="apikeys-empty-title">No keys yet</p>
                <p className="apikeys-empty-body">Create a key above to start automating Notara from scripts or CI pipelines.</p>
              </div>
            ) : (
              <ul className="apikeys-list">
                {apiKeys.map((k) => (
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
    </div>
  );
}
