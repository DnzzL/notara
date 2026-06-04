import { useEffect, useRef } from "react";
import { cn } from "./ui/cn.js";

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
      className="bg-surface border border-border-mid rounded shadow-[var(--shadow-xl)] p-1 min-w-[200px] flex flex-col"
      style={{ position: "fixed", top, left, zIndex: 1000 }}
      role="menu"
      data-testid="block-context-menu"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={cn(
            "flex items-center gap-2.5 w-full px-2.5 py-[7px] border-none bg-transparent cursor-pointer text-left text-[13px] text-text-2 rounded-lg transition-[background,color] duration-[var(--t)] ease-[var(--ease)] disabled:opacity-40 disabled:cursor-default disabled:pointer-events-none hover:bg-surface-3 hover:text-text",
            item.danger && "text-danger hover:bg-danger-dim hover:text-danger"
          )}
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
          data-testid={`block-context-menu-${item.id}`}
        >
          {item.icon && (
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] text-[13px] shrink-0">
              {item.icon}
            </span>
          )}
          <span className="flex-1">{item.label}</span>
          {item.shortcut && (
            <span className="text-[11px] text-text-3 tracking-[0.04em]">
              {item.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
