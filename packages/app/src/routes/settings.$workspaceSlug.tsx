import { createRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { createAuthClient } from "better-auth/react";
import { useState, useEffect } from "react";
import { Button } from "../components/ui/index.js";
import { api } from "../rpc-client.js";
import { useSession } from "../auth-client.js";
import type { Workspace, WorkspaceMember } from "@notara/shared";
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
      api.getWorkspaceMembers({ workspaceId: found.id }).then(setMembers).finally(() => setLoading(false));
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
    const { inviteToken: newToken } = await api.regenerateInviteLink({ workspaceId: workspace.id });
    setInviteToken(newToken);
  };

  const handleRemove = async (userId: string) => {
    if (!workspace) return;
    await api.removeMember({ workspaceId: workspace.id, userId });
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !inviteEmail) return;
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
          <Button variant="secondary" size="sm" onClick={goBack}>← Back to workspace</Button>
        </div>
      </header>

      <div className="admin-content">
        {loading ? (
          <div className="admin-loading">Loading…</div>
        ) : (
          <>
            {isOwner && (
              <section className="mb-5">
                <h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">Invite members</h3>
                <form className="flex gap-1.5" onSubmit={handleEmailInvite}>
                  <input
                    type="email"
                    name="invite-email"
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
                    <input readOnly name="invite-link" value={inviteUrl} className="flex-1 px-2.5 py-[7px] border border-border rounded-lg text-[12px] [font-family:var(--font-mono)] bg-surface-2 text-text outline-none" />
                    <Button variant="secondary" size="sm" onClick={handleCopy}>{copied ? "Copied!" : "Copy"}</Button>
                    <Button variant="secondary" size="sm" onClick={handleRegenerate} title="Generate a new link (old link will stop working)">
                      Regenerate
                    </Button>
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
          </>
        )}
      </div>
    </div>
  );
}
