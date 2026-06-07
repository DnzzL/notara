import { useState, useEffect } from "react";
import { api, getCurrentWorkspaceId } from "../../rpc-client.js";
import type { BlockRendererProps } from "./renderer-registry.js";

/** A people-assignment block. Content is a JSON array of user IDs. */
export function PeopleBlock({ block, onUpdateBlock }: BlockRendererProps) {
  const userIds: string[] = (() => {
    try { return JSON.parse(block.content || "[]"); } catch { return []; }
  })();
  const [members, setMembers] = useState<Array<{ userId: string; name: string; email: string }>>([]);
  const [pickerOpen, setPickerOpen] = useState(userIds.length === 0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const wsId = getCurrentWorkspaceId();
    if (!wsId) return;
    api.getWorkspaceMembers({ workspaceId: wsId }).then(setMembers).catch(() => { /* ignore */ });
  }, []);

  const toggle = (uid: string) => {
    const next = userIds.includes(uid) ? userIds.filter((x) => x !== uid) : [...userIds, uid];
    onUpdateBlock(block.id, JSON.stringify(next));
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
    : members;

  return (
    <div className="people-block" data-block-id={block.id}>
      {userIds.length > 0 && !pickerOpen && (
        <div className="people-block-chips">
          {userIds.map((uid) => {
            const m = members.find((x) => x.userId === uid);
            const name = m?.name || uid.slice(0, 8);
            const initial = name.charAt(0).toUpperCase();
            return (
              <span
                key={uid}
                className="people-block-chip"
                onClick={() => setPickerOpen(true)}
                title="Click to edit"
              >
                <span className="people-block-chip-avatar">{initial}</span>
                <span className="people-block-chip-name">{name}</span>
                <button
                  className="people-block-chip-remove"
                  onClick={(e) => { e.stopPropagation(); toggle(uid); }}
                  title="Remove"
                >×</button>
              </span>
            );
          })}
          <button className="people-block-add-btn" onClick={() => setPickerOpen(true)}>+</button>
        </div>
      )}
      {pickerOpen && (
        <div className="people-block-picker" onMouseDown={(e) => e.stopPropagation()}>
          <input
            autoFocus
            className="people-block-picker-input"
            placeholder="Search people\u2026"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); setPickerOpen(false); }
            }}
          />
          <div className="people-block-picker-list">
            {visible.length === 0 ? (
              <div className="people-block-picker-empty">No people found</div>
            ) : visible.map((m) => {
              const selected = userIds.includes(m.userId);
              return (
                <button
                  key={m.userId}
                  className="people-block-picker-item"
                  onClick={() => { toggle(m.userId); if (selected && userIds.length <= 1) setPickerOpen(false); }}
                >
                  <span className="people-block-picker-avatar">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="people-block-picker-name">{m.name}</span>
                  <span className="people-block-picker-email">{m.email}</span>
                  {selected && <span className="people-block-picker-check">✓</span>}
                </button>
              );
            })}
          </div>
          {userIds.length > 0 && (
            <button
              className="people-block-picker-done"
              onClick={() => setPickerOpen(false)}
            >Done</button>
          )}
        </div>
      )}
    </div>
  );
}
