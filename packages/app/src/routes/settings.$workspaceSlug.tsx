import { createRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { createAuthClient } from "better-auth/react";
import { useState, useEffect } from "react";
import { api } from "../rpc-client.js";
import { useSession } from "../auth-client.js";
import type { Workspace, WorkspaceMember } from "@notion-alt/shared";
import { toaster } from "../toaster.js";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/$workspaceSlug",
  beforeLoad: async () => {
    const client = createAuthClient({ baseURL: window.location.origin });
    const session = await client.getSession();
    if (!session?.data) throw redirect({ to: "/login" });
  },
  component: WorkspaceSettingsPage,
});

function WorkspaceSettingsPage() {
  const navigate = useNavigate();
  const { workspaceSlug } = useParams({ from: "/settings/$workspaceSlug" });
  const { data: session } = useSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [inviteToken, setInviteToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.getMyWorkspaces().then((ws) => {
      const found = ws.find((w) => w.slug === workspaceSlug);
      if (!found) { setNotFound(true); setLoading(false); return; }
      setWorkspace(found);
      setInviteToken(found.inviteToken ?? "");
      api.getWorkspaceMembers(found.id).then(setMembers).finally(() => setLoading(false));
    });
  }, [workspaceSlug]);

  const goBack = () => navigate({ to: "/$workspaceSlug", params: { workspaceSlug } });

  const inviteUrl = inviteToken ? `${window.location.origin}/join/${inviteToken}` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!workspace) return;
    const { inviteToken: newToken } = await api.regenerateInviteLink(workspace.id);
    setInviteToken(newToken);
  };

  const handleRemove = async (userId: string) => {
    if (!workspace) return;
    await api.removeMember(workspace.id, userId);
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !inviteEmail) return;
    setInviteSending(true);
    try {
      await api.inviteMemberByEmail(workspace.id, inviteEmail);
      setInviteSent(true);
      setInviteEmail("");
      setTimeout(() => setInviteSent(false), 3000);
    } catch (err: any) {
      toaster.create({ title: "Invite failed", description: err.message ?? "Failed to send invite.", type: "error" });
    } finally {
      setInviteSending(false);
    }
  };

  if (notFound) {
    return (
      <div className="admin-forbidden">
        <h2>Workspace not found</h2>
        <p>You don't have access to this workspace.</p>
        <button onClick={() => navigate({ to: "/" })} className="auth-toggle">Go home</button>
      </div>
    );
  }

  const isOwner = workspace?.role === "owner";

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-brand">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="2" fill="currentColor" opacity="0.9"/>
              <rect x="11" y="2" width="7" height="7" rx="2" fill="currentColor" opacity="0.5"/>
              <rect x="2" y="11" width="7" height="7" rx="2" fill="currentColor" opacity="0.5"/>
              <rect x="11" y="11" width="7" height="7" rx="2" fill="currentColor" opacity="0.25"/>
            </svg>
            <span>{workspace ? `${workspace.name} — Settings` : "Workspace settings"}</span>
          </div>
          <button onClick={goBack} className="admin-back-btn">← Back to workspace</button>
        </div>
      </header>

      <div className="admin-content">
        {loading ? (
          <div className="admin-loading">Loading…</div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
