import { usePresenceStore } from "../stores/presenceStore.js";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

function colorFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 55%)`;
}

export function PresenceAvatars() {
  const others = usePresenceStore((s) => s.others);
  if (others.length === 0) return null;
  return (
    <div className="presence-avatars" aria-label={`${others.length} other collaborator${others.length === 1 ? "" : "s"} here`}>
      {others.slice(0, 4).map((u) => (
        <span
          key={u.userId}
          className="presence-avatar"
          title={u.name}
          style={{ background: colorFromId(u.userId) }}
        >
          {initials(u.name)}
        </span>
      ))}
      {others.length > 4 && (
        <span className="presence-avatar presence-avatar--overflow" title={`${others.length - 4} more`}>
          +{others.length - 4}
        </span>
      )}
    </div>
  );
}
