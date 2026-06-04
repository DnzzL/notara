import { useEffect, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn.js";

export interface ModalProps {
  /** Heading shown in the modal header. */
  title: ReactNode;
  /** Called on close button, overlay click (unless disabled), and Escape. */
  onClose: () => void;
  children: ReactNode;
  /** Extra class on the content shell, e.g. "apikeys-modal" or "template-picker". */
  className?: string;
  /** Extra class on the body wrapper, e.g. "template-picker-body". */
  bodyClassName?: string;
  /** Set false to keep the modal open when the backdrop is clicked. */
  closeOnOverlay?: boolean;
  ariaLabel?: string;
  /** Forwarded to the content element — used for in-modal keyboard navigation. */
  onContentKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

export function Modal({
  title,
  onClose,
  children,
  className,
  bodyClassName,
  closeOnOverlay = true,
  ariaLabel,
  onContentKeyDown,
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-[rgba(15,18,30,0.45)] backdrop-blur-[6px] [animation:fade-in_0.15s_var(--ease)]"
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={cn(
          "bg-surface border border-border-mid rounded-lg shadow-[var(--shadow-xl)] w-full max-w-[520px] max-h-[85vh] flex flex-col overflow-hidden [animation:modal-pop_0.2s_var(--ease-spring)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onContentKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="flex items-center justify-between px-6 pt-[18px] pb-4 border-b border-border shrink-0">
          <h2 className="text-[15px] font-semibold text-text tracking-[-0.01em]">{title}</h2>
          <button
            className="bg-transparent border-none text-base cursor-pointer text-text-3 px-1.5 py-[5px] rounded-lg leading-none transition-all duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div
          className={cn(
            "px-6 pt-5 pb-6 overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-surface-4 [&::-webkit-scrollbar-thumb]:rounded-[3px]",
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
