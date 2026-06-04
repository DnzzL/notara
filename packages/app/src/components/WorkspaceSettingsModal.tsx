import { useState, useEffect } from "react";
import { Modal, Button } from "./ui/index.js";
import { api } from "../rpc-client.js";
import type { Workspace, WorkspaceMember } from "@notion-alt/shared";
import { useSession } from "../auth-client.js";
import { toaster } from "../toaster.js";

interface Props {
  workspace: Workspace;
  onClose: () => void;
}

export function WorkspaceSettingsModal({ workspace, onClose }: Props) {
  const { data: session } = useSession();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [inviteToken, setInviteToken] = useState(workspace.inviteToken ?? "");
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  useEffect(() => {
    api.getWorkspaceMembers({ workspaceId: workspace.id }).then(setMembers);
  }, [workspace.id]);

  const inviteUrl = `${window.location.origin}/join/${inviteToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    const { inviteToken: newToken } = await api.regenerateInviteLink({ workspaceId: workspace.id });
    setInviteToken(newToken);
  };

  const handleRemove = async (userId: string) => {
    await api.removeMember({ workspaceId: workspace.id, userId });
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteSending(true);
    try {
      await api.inviteMemberByEmail({ workspaceId: workspace.id, email: inviteEmail });
      setInviteSent(true);
      setInviteEmail("");
      setTimeout(() => setInviteSent(false), 3000);
    } catch (err: any) {
      toaster.create({ title: "Invite failed", description: err.message ?? "Failed to send invite.", type: "error" });
    } finally {
      setInviteSending(false);
    }
  };

  const isOwner = workspace.role === "owner";

  return (
    <Modal title={`Workspace settings — ${workspace.name}`} onClose={onClose}>
      {isOwner && (
        <section className="mb-5">
          <h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">Invite members</h3>
          <form className="flex gap-1.5" onSubmit={handleEmailInvite}>
            <input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-2.5 py-[7px] border border-border rounded-lg text-[12px] [font-family:var(--font-mono)] bg-surface-2 text-text outline-none"
            />
            <Button type="submit" variant="primary" size="sm" disabled={inviteSending}>
              {inviteSending ? "Sending…" : inviteSent ? "Sent!" : "Send invite"}
            </Button>
          </form>
          <div className="mt-3.5">
            <h4 className="text-[12px] font-semibold text-text-3 uppercase tracking-[0.05em] mb-2">Or share invite link</h4>
            <div className="flex gap-1.5">
              <input readOnly value={inviteUrl} className="flex-1 px-2.5 py-[7px] border border-border rounded-lg text-[12px] [font-family:var(--font-mono)] bg-surface-2 text-text outline-none" />
              <Button variant="secondary" size="sm" onClick={handleCopy}>{copied ? "Copied!" : "Copy"}</Button>
              <Button variant="secondary" size="sm" onClick={handleRegenerate} title="Generate a new link (old link will stop working)">Regenerate</Button>
            </div>
          </div>
        </section>
      )}

      <section className="mb-5">
        <h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">Members</h3>
        <ul className="list-none p-0 m-0 flex flex-col gap-1">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2.5 py-[7px] px-1">
              <span className="w-[30px] h-[30px] rounded-full bg-accent-dim border border-[rgba(43,77,255,0.2)] flex items-center justify-center text-[13px] font-semibold shrink-0 text-accent-2">
                {(m.name || m.email)[0].toUpperCase()}
              </span>
              <div className="flex-1">
                <span className="text-[13.5px] font-medium block text-text">{m.name || m.email}</span>
                <span className="text-[11.5px] text-text-3 capitalize">{m.role}</span>
              </div>
              {isOwner && m.role !== "owner" && m.userId !== session?.user?.id && (
                <button
                  className="bg-transparent border-none text-text-3 cursor-pointer text-[12px] p-1 rounded-[5px] transition-all duration-[var(--t)] ease-[var(--ease)] hover:text-danger hover:bg-danger-dim"
                  onClick={() => handleRemove(m.userId)}
                  title="Remove member"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Modal>
  );
}
