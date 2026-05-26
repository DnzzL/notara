import { useEffect, useRef } from "react";

export type BlockMenuItem = {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

/** Context menu for a block (right-click or drag-handle click). */
export function BlockContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: BlockMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Clamp to viewport so the menu doesn't render off-screen.
  const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
  const vh = typeof window !== "undefined" ? window.innerHeight : 9999;
  const left = Math.min(x, vw - 220);
  const top = Math.min(y, vh - items.length * 32 - 20);

  return (
    <div
      ref={ref}
      className="block-context-menu"
      style={{ position: "fixed", top, left, zIndex: 1000 }}
      role="menu"
      data-testid="block-context-menu"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={`block-context-menu-item${item.danger ? " danger" : ""}`}
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
          data-testid={`block-context-menu-${item.id}`}
        >
          {item.icon && <span className="block-context-menu-icon">{item.icon}</span>}
          <span className="block-context-menu-label">{item.label}</span>
          {item.shortcut && <span className="block-context-menu-shortcut">{item.shortcut}</span>}
        </button>
      ))}
    </div>
  );
}
