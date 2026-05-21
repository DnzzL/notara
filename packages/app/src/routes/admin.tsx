import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { createAuthClient } from "better-auth/react";
import { useState, useEffect } from "react";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  beforeLoad: async () => {
    const client = createAuthClient({ baseURL: window.location.origin });
    const session = await client.getSession();
    if (!session?.data) throw redirect({ to: "/login" });
    // Actual admin check happens on first data fetch
  },
  component: AdminPage,
});

type AdminUser = { id: string; name: string; email: string; createdAt: string; workspace_count: number };
type AdminWorkspace = { id: string; name: string; slug: string; created_at: string; member_count: number };

function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"users" | "workspaces">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [usersRes, wsRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/workspaces"),
    ]);
    if (usersRes.status === 403) { setForbidden(true); setLoading(false); return; }
    setUsers(await usersRes.json());
    setWorkspaces(await wsRes.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  if (forbidden) {
    return (
      <div className="admin-forbidden">
        <h2>Access denied</h2>
        <p>Your account is not configured as an admin. Set <code>ADMIN_EMAILS</code> on the server.</p>
        <button onClick={() => navigate({ to: "/" })} className="auth-toggle">Go home</button>
      </div>
    );
  }

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
            <span>Notara Admin</span>
          </div>
          <button onClick={() => navigate({ to: "/" })} className="admin-back-btn">← Back to app</button>
        </div>
      </header>

      <div className="admin-content">
        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === "users" ? "admin-tab--active" : ""}`}
            onClick={() => setTab("users")}
          >
            Users {!loading && `(${users.length})`}
          </button>
          <button
            className={`admin-tab ${tab === "workspaces" ? "admin-tab--active" : ""}`}
            onClick={() => setTab("workspaces")}
          >
            Workspaces {!loading && `(${workspaces.length})`}
          </button>
        </div>

        {loading ? (
          <div className="admin-loading">Loading…</div>
        ) : tab === "users" ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Workspaces</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || "—"}</td>
                  <td>{u.email}</td>
                  <td>{u.workspace_count}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="admin-delete-btn"
                      onClick={() => deleteUser(u.id, u.email)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Members</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((ws) => (
                <tr key={ws.id}>
                  <td>{ws.name}</td>
                  <td><code>{ws.slug}</code></td>
                  <td>{ws.member_count}</td>
                  <td>{new Date(ws.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
