import { useEffect, useRef, useState } from "react";

const CATEGORIES: { name: string; emoji: string[] }[] = [
  {
    name: "Smileys",
    emoji: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶", "🙄", "😏", "😒", "😬", "🤥", "😌", "😔"],
  },
  {
    name: "Objects",
    emoji: ["📄", "📝", "📋", "📑", "📊", "📈", "📉", "📌", "📍", "📎", "🔖", "📚", "📖", "📓", "📔", "📒", "📕", "📗", "📘", "📙", "📰", "📁", "📂", "🗂️", "🗃️", "🗄️", "📅", "📆", "🗓️", "💼", "🧰", "🔧", "🔨", "⚙️", "💡", "🔍", "🔎", "🔑", "🔒", "🔓", "🎯", "🚀", "✏️", "🖊️"],
  },
  {
    name: "Symbols",
    emoji: ["✅", "❌", "⭐", "🌟", "✨", "🔥", "💯", "❗", "❓", "💬", "💭", "🗯️", "♻️", "✔️", "☑️", "⚠️", "🚧", "🆕", "🆙", "🆗", "🆒", "📛", "🎉", "🎊", "🏆", "🏅", "🎖️", "🥇", "🥈", "🥉"],
  },
  {
    name: "Nature",
    emoji: ["🌱", "🌿", "🍀", "🌳", "🌲", "🌴", "🌵", "🌷", "🌸", "🌹", "🌺", "🌻", "🌼", "🌞", "🌝", "🌚", "🌜", "🌛", "🌙", "⭐", "☁️", "⛅", "🌤️", "🌧️", "⛈️", "❄️", "🔥", "💧", "🌊"],
  },
  {
    name: "People",
    emoji: ["👤", "👥", "👶", "🧒", "👦", "👧", "🧑", "👨", "👩", "🧓", "👴", "👵", "🙋", "🙆", "🙅", "🙎", "🙍", "💁", "🙇", "🤝", "👋", "🤚", "✋", "🖖", "👌", "🤌", "🤏", "👍", "👎", "👊", "✊", "👏"],
  },
];

const ALL_EMOJI = CATEGORIES.flatMap((c) => c.emoji);

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

  const filtered = query ? ALL_EMOJI : null;

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
          filtered.map((e) => (
            <button key={e} className="emoji-picker-btn" onClick={() => { onSelect(e); onClose(); }}>
              {e}
            </button>
          ))
        ) : (
          CATEGORIES.map((cat) => (
            <div key={cat.name} className="emoji-picker-category">
              <div className="emoji-picker-category-title">{cat.name}</div>
              <div className="emoji-picker-category-grid">
                {cat.emoji.map((e) => (
                  <button key={e} className="emoji-picker-btn" onClick={() => { onSelect(e); onClose(); }}>
                    {e}
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
