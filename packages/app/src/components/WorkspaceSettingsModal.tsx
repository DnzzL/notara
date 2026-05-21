import { useState, useEffect } from "react";
import { api } from "../rpc-client.js";
import type { Workspace, WorkspaceMember } from "@notion-alt/shared";
import { useSession } from "../auth-client.js";

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
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    api.getWorkspaceMembers(workspace.id).then(setMembers);
  }, [workspace.id]);

  const inviteUrl = `${window.location.origin}/join/${inviteToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    const { inviteToken: newToken } = await api.regenerateInviteLink(workspace.id);
    setInviteToken(newToken);
  };

  const handleRemove = async (userId: string) => {
    await api.removeMember(workspace.id, userId);
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteError(null);
    setInviteSending(true);
    try {
      await api.inviteMemberByEmail(workspace.id, inviteEmail);
      setInviteSent(true);
      setInviteEmail("");
      setTimeout(() => setInviteSent(false), 3000);
    } catch (err: any) {
      setInviteError(err.message ?? "Failed to send invite");
    } finally {
      setInviteSending(false);
    }
  };

  const isOwner = workspace.role === "owner";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Workspace settings — {workspace.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
        {isOwner && (
          <section className="settings-section">
            <h3>Invite members</h3>
            <form className="invite-email-form" onSubmit={handleEmailInvite}>
              <input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="invite-link-input"
              />
              <button type="submit" disabled={inviteSending}>
                {inviteSending ? "Sending…" : inviteSent ? "Sent!" : "Send invite"}
              </button>
            </form>
            {inviteError && <p className="invite-error">{inviteError}</p>}
            <div className="settings-subsection">
              <h4>Or share invite link</h4>
              <div className="invite-link-row">
                <input readOnly value={inviteUrl} className="invite-link-input" />
                <button onClick={handleCopy}>{copied ? "Copied!" : "Copy"}</button>
                <button onClick={handleRegenerate} title="Generate a new link (old link will stop working)">
                  Regenerate
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="settings-section">
          <h3>Members</h3>
          <ul className="members-list">
            {members.map((m) => (
              <li key={m.userId} className="member-row">
                <span className="member-avatar">{(m.name || m.email)[0].toUpperCase()}</span>
                <div className="member-info">
                  <span className="member-name">{m.name || m.email}</span>
                  <span className="member-role">{m.role}</span>
                </div>
                {isOwner && m.role !== "owner" && m.userId !== session?.user?.id && (
                  <button
                    className="member-remove"
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
        </div>
      </div>
    </div>
  );
}
