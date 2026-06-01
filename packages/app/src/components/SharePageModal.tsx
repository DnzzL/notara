import { useState, useEffect, useMemo } from "react";
import { api, type AclRelation } from "../rpc-client.js";
import type {
  AclEntry,
  PagePermissions,
  Subject,
  WorkspaceMember,
} from "@notion-alt/shared";
import { encodeSubject } from "@notion-alt/shared";
import { useSession } from "../auth-client.js";
import { toaster } from "../toaster.js";

interface Props {
  pageId: string;
  workspaceId: string;
  onClose: () => void;
}

const RELATIONS: AclRelation[] = ["viewer", "editor", "owner"];

function workspaceSubject(workspaceId: string): Subject {
  return { type: "workspace", id: workspaceId, relation: "member" };
}

function userSubject(userId: string): Subject {
  return { type: "user", id: userId };
}

function isUserEntry(e: AclEntry): e is AclEntry & { subject: { type: "user"; id: string } } {
  return e.subject.type === "user";
}

export function SharePageModal({ pageId, workspaceId, onClose }: Props) {
  const { data: session } = useSession();
  const [perms, setPerms] = useState<PagePermissions | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const refresh = () => api.getPagePermissions({ pageId }).then(setPerms);

  useEffect(() => {
    Promise.all([
      api.getPagePermissions({ pageId }),
      api.getWorkspaceMembers({ workspaceId }),
      api.checkPagePermission({ pageId, relation: "owner" }),
    ])
      .then(([p, m, c]) => {
        setPerms(p);
        setMembers(m);
        setCanManage(c.allowed);
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

  const directUserEntries = useMemo(
    () => (perms?.direct ?? []).filter(isUserEntry),
    [perms],
  );
  const directWorkspaceEntry = useMemo(
    () =>
      (perms?.direct ?? []).find(
        (e) => e.subject.type === "workspace" && e.subject.id === workspaceId,
      ),
    [perms, workspaceId],
  );
  const grantedUserIds = useMemo(
    () => new Set(directUserEntries.map((e) => e.subject.id)),
    [directUserEntries],
  );

  // "Locked" means the page restricts access to a specific set of principals.
  // A workspace-wide grant or inherited grants don't count as locked.
  const isLocked = directUserEntries.length > 0;

  const runWrite = async (
    input: Parameters<typeof api.writePagePermissions>[0],
    successTitle?: string,
  ) => {
    if (!perms) return;
    setPending(true);
    try {
      await api.writePagePermissions({ ...input, ifRevision: perms.revision });
      await refresh();
      if (successTitle) toaster.create({ title: successTitle, type: "success" });
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.includes("changed since revision")) {
        toaster.create({
          title: "Sharing was changed elsewhere",
          description: "Refreshed — please retry.",
          type: "warning",
        });
        await refresh();
      } else {
        toaster.create({ title: "Failed", description: err.message, type: "error" });
      }
    } finally {
      setPending(false);
      setPickerOpen(false);
    }
  };

  const handleAddMember = (userId: string, relation: AclRelation) =>
    runWrite({
      pageId,
      set: [{ subject: userSubject(userId), relation }],
      remove: [],
    });

  const handleChangeRelation = (subject: Subject, newRel: AclRelation) =>
    runWrite({
      pageId,
      set: [{ subject, relation: newRel }],
      remove: [],
    });

  const handleRemove = (subject: Subject) =>
    runWrite({
      pageId,
      set: [],
      remove: [{ subject }],
    });

  const handleSetWorkspaceAccess = (relation: AclRelation | "off") => {
    const subject = workspaceSubject(workspaceId);
    if (relation === "off") {
      return runWrite({ pageId, set: [], remove: [{ subject }] });
    }
    return runWrite({ pageId, set: [{ subject, relation }], remove: [] });
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
          {loading ? (
            <p>Loading…</p>
          ) : !perms ? (
            <p>Couldn't load permissions.</p>
          ) : (
            <>
              <section className="settings-section">
                <div className="share-status">
                  {isLocked ? (
                    <p className="share-status-text">
                      🔒 This page is restricted to specific people.
                    </p>
                  ) : directWorkspaceEntry ? (
                    <p className="share-status-text">
                      🌐 All workspace members can {directWorkspaceEntry.relation === "viewer" ? "view" : "edit"} this page.
                    </p>
                  ) : perms.inheritedFromPageId ? (
                    <p className="share-status-text">
                      ↑ Access inherited from a parent page.
                    </p>
                  ) : (
                    <p className="share-status-text">
                      🌐 Open to all workspace members (workspace default).
                    </p>
                  )}
                </div>
                {!canManage && (
                  <p className="share-help-text">
                    You can view sharing settings but not change them.
                  </p>
                )}
              </section>

              <section className="settings-section">
                <div className="share-add-row">
                  <h3>People with access</h3>
                  {canManage && availableMembers.length > 0 && (
                    <button onClick={() => setPickerOpen((o) => !o)} disabled={pending}>
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
                            <button
                              key={r}
                              disabled={pending}
                              onClick={() => handleAddMember(m.userId, r)}
                            >
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
                  {directUserEntries.map((e) => {
                    const uid = e.subject.id;
                    const member = memberByUserId.get(uid);
                    const label = member ? member.name || member.email : uid;
                    return (
                      <li key={encodeSubject(e.subject)} className="member-row">
                        <span className="member-avatar">{label[0]?.toUpperCase()}</span>
                        <div className="member-info">
                          <span className="member-name">{label}</span>
                          <span className="member-role">{member?.email ?? ""}</span>
                        </div>
                        <select
                          value={e.relation}
                          disabled={!canManage || pending}
                          onChange={(ev) =>
                            handleChangeRelation(e.subject, ev.target.value as AclRelation)
                          }
                        >
                          {RELATIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        {canManage && (
                          <button
                            className="member-remove"
                            disabled={pending}
                            onClick={() => handleRemove(e.subject)}
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    );
                  })}
                  {directUserEntries.length === 0 && (
                    <li className="member-row-empty">No individual access grants yet.</li>
                  )}
                </ul>
              </section>

              {perms.inheritedFromPageId && perms.inherited.length > 0 && (
                <section className="settings-section">
                  <h3>Inherited from parent</h3>
                  <ul className="members-list">
                    {perms.inherited.map((e) => {
                      const key = encodeSubject(e.subject);
                      const label =
                        e.subject.type === "user"
                          ? memberByUserId.get(e.subject.id)?.name ??
                            memberByUserId.get(e.subject.id)?.email ??
                            e.subject.id
                          : e.subject.type === "workspace"
                            ? "All workspace members"
                            : "Anyone with link";
                      return (
                        <li key={key} className="member-row member-row-inherited">
                          <div className="member-info">
                            <span className="member-name">{label}</span>
                            <span className="member-role">{e.relation} (inherited)</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section className="settings-section">
                <h3>Workspace access</h3>
                <label className="share-workspace-toggle">
                  Workspace members can:
                  <select
                    value={directWorkspaceEntry?.relation ?? "off"}
                    disabled={!canManage || pending}
                    onChange={(e) =>
                      handleSetWorkspaceAccess(e.target.value as AclRelation | "off")
                    }
                  >
                    <option value="off">No explicit grant</option>
                    <option value="viewer">View</option>
                    <option value="editor">Edit</option>
                    <option value="owner">Full access</option>
                  </select>
                </label>
                {!isLocked && !directWorkspaceEntry && (
                  <p className="share-help-text">
                    With no grants set, the page falls back to workspace defaults.
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
