import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { api, setCurrentWorkspaceId } from "../rpc-client.js";
import { signOut } from "../auth-client.js";
import type { Workspace } from "@notara/shared";

interface WorkspaceSwitcherProps {
  onCollapse?: () => void;
  onOpenBackups?: () => void;
  onOpenApiKeys?: () => void;
}

export function WorkspaceSwitcher({ onCollapse, onOpenBackups, onOpenApiKeys }: WorkspaceSwitcherProps = {}) {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { workspaceSlug?: string };
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrent] = useState<Workspace | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getMyWorkspaces().then((ws) => {
      setWorkspaces(ws);
      const found = ws.find((w) => w.slug === params.workspaceSlug);
      setCurrent(found ?? ws[0] ?? null);
    });
  }, [params.workspaceSlug]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const switchTo = (ws: Workspace) => {
    setCurrentWorkspaceId(ws.id);
    setOpen(false);
    navigate({ to: "/$workspaceSlug", params: { workspaceSlug: ws.slug } });
  };

  const handleSignOut = async () => {
    await signOut();
    setCurrentWorkspaceId(null);
    navigate({ to: "/login" });
  };

  return (
    <div className="workspace-switcher" ref={ref}>
      <div className="workspace-switcher-row">
        <button
          className="workspace-switcher-trigger"
          onClick={() => setOpen(!open)}
          title="Switch workspace"
        >
          <span className="workspace-avatar-sm">
            {current ? current.name[0].toUpperCase() : "?"}
          </span>
          <span className="workspace-switcher-name">{current?.name ?? "Select workspace"}</span>
          <span className="workspace-switcher-chevron">▾</span>
        </button>
        {onCollapse && (
          <button
            className="sidebar-collapse-btn"
            onClick={onCollapse}
            title="Collapse sidebar (⌘\\)"
            aria-label="Collapse sidebar"
          >
            «
          </button>
        )}
      </div>

      {open && (
        <div className="workspace-switcher-dropdown">
          <div className="workspace-switcher-section">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className={`workspace-switcher-item ${ws.id === current?.id ? "active" : ""}`}
                onClick={() => switchTo(ws)}
              >
                <span className="workspace-avatar-sm">{ws.name[0].toUpperCase()}</span>
                <span>{ws.name}</span>
                {ws.id === current?.id && <span className="workspace-check">✓</span>}
              </button>
            ))}
          </div>

          <div className="workspace-switcher-section workspace-switcher-actions">
            <div className="workspace-switcher-label">Settings</div>
            {current && (
              <button
                className="workspace-switcher-item"
                onClick={() => { setOpen(false); navigate({ to: "/settings/$workspaceSlug", params: { workspaceSlug: current.slug } }); }}
              >
                Workspace settings
              </button>
            )}
            {onOpenBackups && (
              <button
                className="workspace-switcher-item"
                onClick={() => { setOpen(false); onOpenBackups(); }}
              >
                Backups
              </button>
            )}
            {onOpenApiKeys && (
              <button
                className="workspace-switcher-item"
                onClick={() => { setOpen(false); onOpenApiKeys(); }}
              >
                API keys
              </button>
            )}
          </div>

          <div className="workspace-switcher-section workspace-switcher-actions">
            <div className="workspace-switcher-label">Account</div>
            <button
              className="workspace-switcher-item"
              onClick={() => { setOpen(false); navigate({ to: "/workspaces" }); }}
            >
              + New workspace
            </button>
            <button
              className="workspace-switcher-item"
              onClick={() => { setOpen(false); navigate({ to: "/workspaces" }); }}
            >
              Join with invite
            </button>
            <button
              className="workspace-switcher-item"
              onClick={() => { setOpen(false); navigate({ to: "/admin" }); }}
            >
              Admin panel
            </button>
            <button className="workspace-switcher-item workspace-signout" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
