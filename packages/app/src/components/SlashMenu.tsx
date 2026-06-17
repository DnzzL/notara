import { useState, useEffect, useRef, useCallback } from "react";

interface Command {
  id: string;
  name: string;
  icon: string;
  shortcut?: string;
}

interface SlashMenuProps {
  commands: Command[];
  query: string;
  onSelect: (commandId: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function SlashMenu({ commands, query, onSelect, onClose, position }: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase()) ||
    cmd.id.toLowerCase().includes(query.toLowerCase())
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keep the highlighted item inside the menu's scroll viewport when the
  // user arrows past the visible window — without this, the selection
  // marker would disappear off-screen.
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation. Uses capture phase so it intercepts before
  // TipTap (whose Enter handler would otherwise split the block).
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (filteredCommands.length === 0) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault(); e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        break;
      case "ArrowUp":
        e.preventDefault(); e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        break;
      case "Enter":
        e.preventDefault(); e.stopPropagation();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex].id);
        }
        break;
      case "Tab":
        e.preventDefault(); e.stopPropagation();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault(); e.stopPropagation();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  // Adjust position to keep menu in viewport
  const adjustedPosition = {
    top: Math.min(position.top, window.innerHeight - 300),
    left: Math.min(position.left, window.innerWidth - 250),
  };

  if (filteredCommands.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="bg-surface border border-border-mid rounded-[5px] shadow-[var(--shadow-xl)] p-1.5 min-w-[272px] max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-surface-4 [&::-webkit-scrollbar-thumb]:rounded-[2px]"
      style={{
        position: "fixed",
        top: adjustedPosition.top,
        left: adjustedPosition.left,
        zIndex: 9999,
      }}
    >
      <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold text-text-3 uppercase tracking-[0.07em]">Blocks</div>
      {filteredCommands.map((cmd, index) => (
        <button
          key={cmd.id}
          ref={(el) => { itemRefs.current[index] = el; }}
          className={`flex items-center gap-2.5 w-full px-2.5 py-2 border-none bg-transparent cursor-pointer text-left text-[13.5px] text-text-2 rounded font-[family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text ${index === selectedIndex ? "bg-accent-dim text-accent" : ""}`}
          onClick={() => onSelect(cmd.id)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="flex items-center justify-center w-7 h-7 bg-surface-3 border border-border rounded-lg text-[13px] shrink-0">{cmd.icon}</span>
          <div className="flex items-center flex-1 justify-between gap-2">
            <span className="font-medium">{cmd.name}</span>
            {cmd.shortcut && <span className="text-[11px] text-text-3 [font-family:var(--font-mono)]">{cmd.shortcut}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
