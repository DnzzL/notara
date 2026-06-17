import { createRoute, useNavigate, redirect } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { useState, useEffect } from "react";
import { Button } from "../components/ui/index.js";
import { authClient, useSession } from "../auth-client.js";
import { api } from "../rpc-client.js";
import type { Workspace } from "@notara/shared";
import { toaster } from "../toaster.js";
import { capture } from "../analytics.js";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces",
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session?.data) {
      throw redirect({ to: "/login" });
    }
  },
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [joinToken, setJoinToken] = useState("");

  useEffect(() => {
    if (!session) return;
    api.getMyWorkspaces().then((ws) => {
      setWorkspaces(ws);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ws = await api.createWorkspace({ name: newName, slug: newSlug });
      navigate({ to: "/$workspaceSlug", params: { workspaceSlug: ws.slug } });
    } catch (err: any) {
      toaster.create({ title: "Failed to create workspace", description: err.message ?? "Something went wrong.", type: "error" });
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ws = await api.joinWorkspaceByToken({ inviteToken: joinToken });
      capture("workspace_joined");
      navigate({ to: "/$workspaceSlug", params: { workspaceSlug: ws.slug } });
    } catch (err: any) {
      toaster.create({ title: "Invalid invite link", description: err.message ?? "This invite link may have expired.", type: "error" });
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="workspaces-page">
      <h1>Your workspaces</h1>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="workspace-list">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              className="workspace-card"
              onClick={() => navigate({ to: "/$workspaceSlug", params: { workspaceSlug: ws.slug } })}
            >
              <span className="workspace-avatar">{ws.name[0].toUpperCase()}</span>
              <div>
                <p className="workspace-name">{ws.name}</p>
                <p className="workspace-role">{ws.role}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="workspace-actions">
        {creating ? (
          <form onSubmit={handleCreate} className="workspace-form">
            <h2>New workspace</h2>
            <input
              placeholder="Workspace name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
              }}
              required
            />
            <input
              placeholder="slug (url-friendly)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              pattern="[a-z0-9-]+"
              required
            />
            <div className="form-row">
              <Button type="submit" variant="primary">Create</Button>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </form>
        ) : joining ? (
          <form onSubmit={handleJoin} className="workspace-form">
            <h2>Join workspace</h2>
            <input
              placeholder="Paste invite token"
              value={joinToken}
              onChange={(e) => setJoinToken(e.target.value)}
              required
            />
            <div className="form-row">
              <Button type="submit" variant="primary">Join</Button>
              <Button type="button" variant="secondary" onClick={() => setJoining(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="form-row">
            <Button variant="primary" onClick={() => setCreating(true)}>New workspace</Button>
            <Button variant="secondary" onClick={() => setJoining(true)}>Join with invite</Button>
          </div>
        )}
      </div>
    </div>
  );
}
