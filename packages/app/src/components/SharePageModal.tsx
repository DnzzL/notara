import { useState, useEffect, useMemo } from "react";
import { Modal, Button } from "./ui/index.js";
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
      .then(([p, m, c]) => { setPerms(p); setMembers(m); setCanManage(c.allowed); })
      .catch((err) => toaster.create({ title: "Couldn't load sharing", description: err.message, type: "error" }))
      .finally(() => setLoading(false));
  }, [pageId, workspaceId]);

  const memberByUserId = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const directUserEntries = useMemo(() => (perms?.direct ?? []).filter(isUserEntry), [perms]);
  const directWorkspaceEntry = useMemo(
    () => (perms?.direct ?? []).find((e) => e.subject.type === "workspace" && e.subject.id === workspaceId),
    [perms, workspaceId],
  );
  const grantedUserIds = useMemo(() => new Set(directUserEntries.map((e) => e.subject.id)), [directUserEntries]);
  const isLocked = directUserEntries.length > 0;

  const runWrite = async (input: Parameters<typeof api.writePagePermissions>[0], successTitle?: string) => {
    if (!perms) return;
    setPending(true);
    try {
      await api.writePagePermissions({ ...input, ifRevision: perms.revision });
      await refresh();
      if (successTitle) toaster.create({ title: successTitle, type: "success" });
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.includes("changed since revision")) {
        toaster.create({ title: "Sharing was changed elsewhere", description: "Refreshed — please retry.", type: "warning" });
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
    runWrite({ pageId, set: [{ subject: userSubject(userId), relation }], remove: [] });
  const handleChangeRelation = (subject: Subject, newRel: AclRelation) =>
    runWrite({ pageId, set: [{ subject, relation: newRel }], remove: [] });
  const handleRemove = (subject: Subject) =>
    runWrite({ pageId, set: [], remove: [{ subject }] });
  const handleSetWorkspaceAccess = (relation: AclRelation | "off") => {
    const subject = workspaceSubject(workspaceId);
    if (relation === "off") return runWrite({ pageId, set: [], remove: [{ subject }] });
    return runWrite({ pageId, set: [{ subject, relation }], remove: [] });
  };

  const availableMembers = members.filter((m) => !grantedUserIds.has(m.userId) && m.userId !== session?.user?.id);

  return (
    <Modal title="Share page" onClose={onClose}>
      {loading ? (
        <p>Loading…</p>
      ) : !perms ? (
        <p>Couldn't load permissions.</p>
      ) : (
        <>
          <section className="mb-5">
            <div className="px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
              <p className="m-0 text-[13px] text-text-2">
                {isLocked
                  ? "🔒 This page is restricted to specific people."
                  : directWorkspaceEntry
                    ? `🌐 All workspace members can ${directWorkspaceEntry.relation === "viewer" ? "view" : "edit"} this page.`
                    : perms.inheritedFromPageId
                      ? "↑ Access inherited from a parent page."
                      : "🌐 Open to all workspace members (workspace default)."}
              </p>
            </div>
            {!canManage && <p className="mt-2 text-[12px] text-text-3">You can view sharing settings but not change them.</p>}
          </section>

          <section className="mb-5">
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="text-[11.5px] font-semibold text-text-3 uppercase tracking-[0.06em]">People with access</h3>
              {canManage && availableMembers.length > 0 && (
                <Button variant="secondary" size="sm" onClick={() => setPickerOpen((o) => !o)} disabled={pending}>
                  {pickerOpen ? "Cancel" : "+ Add member"}
                </Button>
              )}
            </div>

            {pickerOpen && (
              <div className="mt-2 border border-border rounded-lg p-1.5 max-h-[240px] overflow-y-auto bg-surface mb-2">
                {availableMembers.map((m) => (
                  <div key={m.userId} className="flex items-center gap-2.5 px-1 py-1.5">
                    <span className="w-[30px] h-[30px] rounded-full bg-accent-dim border border-[rgba(43,77,255,0.2)] flex items-center justify-center text-[13px] font-semibold shrink-0 text-accent-2">
                      {(m.name || m.email)[0]?.toUpperCase()}
                    </span>
                    <div className="flex-1">
                      <span className="text-[13.5px] font-medium block text-text">{m.name || m.email}</span>
                      <span className="text-[11.5px] text-text-3">{m.email}</span>
                    </div>
                    <div className="flex gap-1 ml-auto">
                      {RELATIONS.map((r) => (
                        <button
                          key={r}
                          disabled={pending}
                          className="px-2 py-1 border border-border rounded text-[11px] cursor-pointer bg-surface-2 text-text-2 hover:bg-surface-3 disabled:opacity-50"
                          onClick={() => handleAddMember(m.userId, r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {availableMembers.length === 0 && <p className="px-2 py-2 text-[12px] text-text-3">No more members to add.</p>}
              </div>
            )}

            <ul className="list-none p-0 m-0 flex flex-col gap-1">
              {directUserEntries.map((e) => {
                const uid = e.subject.id;
                const member = memberByUserId.get(uid);
                const label = member ? member.name || member.email : uid;
                return (
                  <li key={encodeSubject(e.subject)} className="flex items-center gap-2.5 py-[7px] px-1">
                    <span className="w-[30px] h-[30px] rounded-full bg-accent-dim border border-[rgba(43,77,255,0.2)] flex items-center justify-center text-[13px] font-semibold shrink-0 text-accent-2">
                      {label[0]?.toUpperCase()}
                    </span>
                    <div className="flex-1">
                      <span className="text-[13.5px] font-medium block text-text">{label}</span>
                      <span className="text-[11.5px] text-text-3">{member?.email ?? ""}</span>
                    </div>
                    <select
                      value={e.relation}
                      disabled={!canManage || pending}
                      className="px-1.5 py-1 border border-border rounded text-[12px] bg-surface-2 text-text-2 ml-auto"
                      onChange={(ev) => handleChangeRelation(e.subject, ev.target.value as AclRelation)}
                    >
                      {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {canManage && (
                      <button
                        disabled={pending}
                        className="bg-transparent border-none text-text-3 cursor-pointer text-[12px] p-1 rounded-[5px] transition-all duration-[var(--t)] ease-[var(--ease)] hover:text-danger hover:bg-danger-dim disabled:opacity-50"
                        onClick={() => handleRemove(e.subject)}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                );
              })}
              {directUserEntries.length === 0 && (
                <li className="px-1 py-2 text-[12px] text-text-3 list-none">No individual access grants yet.</li>
              )}
            </ul>
          </section>

          {perms.inheritedFromPageId && perms.inherited.length > 0 && (
            <section className="mb-5">
              <h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">Inherited from parent</h3>
              <ul className="list-none p-0 m-0 flex flex-col gap-1">
                {perms.inherited.map((e) => {
                  const key = encodeSubject(e.subject);
                  const label =
                    e.subject.type === "user"
                      ? memberByUserId.get(e.subject.id)?.name ?? memberByUserId.get(e.subject.id)?.email ?? e.subject.id
                      : e.subject.type === "workspace"
                        ? "All workspace members"
                        : "Anyone with link";
                  return (
                    <li key={key} className="flex items-center gap-2.5 py-[7px] px-1">
                      <div className="flex-1">
                        <span className="text-[13.5px] font-medium block text-text">{label}</span>
                        <span className="text-[11.5px] text-text-3 capitalize">{e.relation} (inherited)</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mb-5">
            <h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">Workspace access</h3>
            <label className="flex items-center gap-2 text-[13px] text-text-2 cursor-pointer">
              Workspace members can:
              <select
                value={directWorkspaceEntry?.relation ?? "off"}
                disabled={!canManage || pending}
                className="px-1.5 py-1 border border-border rounded text-[12px] bg-surface-2 text-text-2"
                onChange={(e) => handleSetWorkspaceAccess(e.target.value as AclRelation | "off")}
              >
                <option value="off">No explicit grant</option>
                <option value="viewer">View</option>
                <option value="editor">Edit</option>
                <option value="owner">Full access</option>
              </select>
            </label>
            {!isLocked && !directWorkspaceEntry && (
              <p className="mt-2 text-[12px] text-text-3">With no grants set, the page falls back to workspace defaults.</p>
            )}
          </section>
        </>
      )}
    </Modal>
  );
}
