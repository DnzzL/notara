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
  
  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase()) ||
    cmd.id.toLowerCase().includes(query.toLowerCase())
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (filteredCommands.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
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
      className="slash-menu"
      style={{
        position: "fixed",
        top: adjustedPosition.top,
        left: adjustedPosition.left,
        zIndex: 9999,
      }}
    >
      <div className="slash-menu-header">Blocks</div>
      {filteredCommands.map((cmd, index) => (
        <button
          key={cmd.id}
          className={`slash-menu-item ${index === selectedIndex ? "selected" : ""}`}
          onClick={() => onSelect(cmd.id)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="slash-icon">{cmd.icon}</span>
          <div className="slash-item-content">
            <span className="slash-item-name">{cmd.name}</span>
            {cmd.shortcut && <span className="slash-item-shortcut">{cmd.shortcut}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
