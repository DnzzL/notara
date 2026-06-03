import { useEffect, useRef, useState } from "react";
import emojiData from "emojibase-data/en/data.json" with { type: "json" };
import messages from "emojibase-data/en/messages.json" with { type: "json" };

interface EmojiEntry {
  label: string;
  hexcode: string;
  tags?: string[];
  emoji: string;
  text: string;
  type: number;
  order: number;
  group: number;
  subgroup: number;
  version: number;
}

const ALL_EMOJI = (emojiData as EmojiEntry[]).filter(
  (e) => e.type !== 0 && e.group !== undefined && e.emoji
);

const GROUP_LABELS: Record<number, string> = {};
const GROUP_ORDER: Record<number, number> = {};
for (const g of messages.groups) {
  GROUP_LABELS[g.order] = g.message;
  GROUP_ORDER[g.order] = g.order;
}

const GROUP_IDS = Array.from(new Set(ALL_EMOJI.map((e) => e.group)))
  .sort((a, b) => GROUP_ORDER[a] - GROUP_ORDER[b]);

const CATEGORIES = GROUP_IDS.map((gid) => ({
  name: GROUP_LABELS[gid] ?? `Group ${gid}`,
  emoji: ALL_EMOJI.filter((e) => e.group === gid),
}));

interface Props {
  open: boolean;
  anchor: { top: number; left: number } | null;
  onClose: () => void;
  onSelect: (emoji: string | null) => void;
}

export function EmojiPicker({ open, anchor, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open || !anchor) return null;

  const q = query.toLowerCase().trim();
  const filtered = q
    ? ALL_EMOJI.filter(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          (e.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    : null;

  return (
    <div
      ref={ref}
      className="emoji-picker"
      style={{ position: "fixed", top: anchor.top, left: anchor.left, zIndex: 1000 }}
    >
      <div className="emoji-picker-header">
        <input
          autoFocus
          className="emoji-picker-search"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="emoji-picker-remove" onClick={() => { onSelect(null); onClose(); }} title="Remove icon">
          Remove
        </button>
      </div>
      <div className="emoji-picker-grid">
        {filtered ? (
          filtered.length > 0 ? (
            filtered.map((e) => (
              <button key={e.hexcode} className="emoji-picker-btn" onClick={() => { onSelect(e.emoji); onClose(); }} title={e.label}>
                {e.emoji}
              </button>
            ))
          ) : (
            <div className="emoji-picker-empty">No emojis found</div>
          )
        ) : (
          CATEGORIES.map((cat) => (
            <div key={cat.name} className="emoji-picker-category">
              <div className="emoji-picker-category-title">{cat.name}</div>
              <div className="emoji-picker-category-grid">
                {cat.emoji.map((e) => (
                  <button key={e.hexcode} className="emoji-picker-btn" onClick={() => { onSelect(e.emoji); onClose(); }} title={e.label}>
                    {e.emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
