import { useEffect, type KeyboardEvent, type ReactNode } from "react";

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

/**
 * Shared overlay + content + header + body shell for the app's manual modals.
 * Handles Escape-to-close and backdrop click; content clicks are stopped so they
 * don't bubble to the overlay.
 */
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

  const contentClasses = ["modal-content", className].filter(Boolean).join(" ");
  const bodyClasses = ["modal-body", bodyClassName].filter(Boolean).join(" ");

  return (
    <div className="modal-overlay" onClick={closeOnOverlay ? onClose : undefined}>
      <div
        className={contentClasses}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onContentKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={bodyClasses}>{children}</div>
      </div>
    </div>
  );
}
