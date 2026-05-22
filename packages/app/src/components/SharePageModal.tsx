import { useState, useEffect, useMemo } from "react";
import { api, type AclRelation } from "../rpc-client.js";
import type { AclEntry, WorkspaceMember } from "@notion-alt/shared";
import { useSession } from "../auth-client.js";
import { toaster } from "../toaster.js";

interface Props {
  pageId: string;
  workspaceId: string;
  onClose: () => void;
}

const RELATIONS: AclRelation[] = ["viewer", "editor", "owner"];

export function SharePageModal({ pageId, workspaceId, onClose }: Props) {
  const { data: session } = useSession();
  const [entries, setEntries] = useState<AclEntry[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refresh = () => api.getPagePermissions(pageId).then(setEntries);

  useEffect(() => {
    Promise.all([
      api.getPagePermissions(pageId),
      api.getWorkspaceMembers(workspaceId),
    ])
      .then(([e, m]) => {
        setEntries(e);
        setMembers(m);
      })
      .catch((err) =>
        toaster.create({ title: "Couldn't load sharing", description: err.message, type: "error" }),
      )
      .finally(() => setLoading(false));
  }, [pageId, workspaceId]);

  const memberByUserId = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  const grantedUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of entries) {
      if (e.subject.startsWith("user:")) ids.add(e.subject.slice(5));
    }
    return ids;
  }, [entries]);

  const workspaceMemberEntry = entries.find((e) => e.subject === `workspace:${workspaceId}#member`);
  const isLocked = entries.length > 0;

  const handleAddMember = async (userId: string, relation: AclRelation) => {
    try {
      await api.setPagePermission(pageId, `user:${userId}`, relation);
      await refresh();
      setPickerOpen(false);
    } catch (err: any) {
      toaster.create({ title: "Failed to share", description: err.message, type: "error" });
    }
  };

  const handleChangeRelation = async (subject: string, oldRel: AclRelation, newRel: AclRelation) => {
    if (oldRel === newRel) return;
    try {
      await api.removePagePermission(pageId, subject, oldRel);
      await api.setPagePermission(pageId, subject, newRel);
      await refresh();
    } catch (err: any) {
      toaster.create({ title: "Failed to update", description: err.message, type: "error" });
    }
  };

  const handleRemove = async (subject: string, relation: AclRelation) => {
    try {
      await api.removePagePermission(pageId, subject, relation);
      await refresh();
    } catch (err: any) {
      toaster.create({ title: "Failed to remove", description: err.message, type: "error" });
    }
  };

  const handleToggleWorkspaceAccess = async () => {
    try {
      if (workspaceMemberEntry) {
        await api.removePagePermission(pageId, workspaceMemberEntry.subject, workspaceMemberEntry.relation);
      } else {
        await api.setPagePermission(pageId, `workspace:${workspaceId}#member`, "editor");
      }
      await refresh();
    } catch (err: any) {
      toaster.create({ title: "Failed", description: err.message, type: "error" });
    }
  };

  const availableMembers = members.filter(
    (m) => !grantedUserIds.has(m.userId) && m.userId !== session?.user?.id,
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share page</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <section className="settings-section">
            <div className="share-status">
              {isLocked ? (
                <p className="share-status-text">
                  🔒 This page is restricted. Only the people listed below have access.
                </p>
              ) : (
                <p className="share-status-text">
                  🌐 Open to all workspace members. Add a person below to restrict access.
                </p>
              )}
            </div>
          </section>

          {loading ? (
            <p>Loading…</p>
          ) : (
            <>
              <section className="settings-section">
                <div className="share-add-row">
                  <h3>People with access</h3>
                  {availableMembers.length > 0 && (
                    <button onClick={() => setPickerOpen((o) => !o)}>
                      {pickerOpen ? "Cancel" : "+ Add member"}
                    </button>
                  )}
                </div>

                {pickerOpen && (
                  <div className="share-picker">
                    {availableMembers.map((m) => (
                      <div key={m.userId} className="share-picker-row">
                        <span className="member-avatar">{(m.name || m.email)[0]?.toUpperCase()}</span>
                        <div className="member-info">
                          <span className="member-name">{m.name || m.email}</span>
                          <span className="member-role">{m.email}</span>
                        </div>
                        <div className="share-picker-actions">
                          {RELATIONS.map((r) => (
                            <button key={r} onClick={() => handleAddMember(m.userId, r)}>
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {availableMembers.length === 0 && <p>No more members to add.</p>}
                  </div>
                )}

                <ul className="members-list">
                  {entries
                    .filter((e) => e.subject.startsWith("user:"))
                    .map((e) => {
                      const uid = e.subject.slice(5);
                      const member = memberByUserId.get(uid);
                      const label = member ? member.name || member.email : uid;
                      return (
                        <li key={`${e.subject}-${e.relation}`} className="member-row">
                          <span className="member-avatar">{label[0]?.toUpperCase()}</span>
                          <div className="member-info">
                            <span className="member-name">{label}</span>
                            <span className="member-role">{member?.email ?? ""}</span>
                          </div>
                          <select
                            value={e.relation}
                            onChange={(ev) =>
                              handleChangeRelation(e.subject, e.relation, ev.target.value as AclRelation)
                            }
                          >
                            {RELATIONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <button className="member-remove" onClick={() => handleRemove(e.subject, e.relation)}>✕</button>
                        </li>
                      );
                    })}
                  {entries.filter((e) => e.subject.startsWith("user:")).length === 0 && (
                    <li className="member-row-empty">No individual access grants yet.</li>
                  )}
                </ul>
              </section>

              <section className="settings-section">
                <h3>Workspace access</h3>
                <label className="share-workspace-toggle">
                  <input
                    type="checkbox"
                    checked={!!workspaceMemberEntry}
                    onChange={handleToggleWorkspaceAccess}
                  />
                  Allow all workspace members to edit this page
                  {workspaceMemberEntry && ` (currently: ${workspaceMemberEntry.relation})`}
                </label>
                {!isLocked && (
                  <p className="share-help-text">
                    When no one is listed above, the page falls back to workspace defaults.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
