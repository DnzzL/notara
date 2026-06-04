import { useEffect, useState } from "react";
import { Modal } from "./ui/index.js";
import { api } from "../rpc-client.js";

interface TemplateItem {
  id: string;
  title: string;
  icon: string;
  description: string;
}

interface Props {
  onClose: () => void;
  onSelect: (templateId: string | null) => void;
}

export function TemplatePicker({ onClose, onSelect }: Props) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  return (
    <Modal
      title="New page"
      onClose={onClose}
      className="w-[480px] max-w-[calc(100vw-32px)]"
      bodyClassName="flex flex-col gap-1.5 pb-2"
      ariaLabel="Choose a template"
    >
      <button
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded border border-border bg-surface-2 cursor-pointer text-left transition-[background,border-color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        onClick={() => onSelect(null)}
        autoFocus
      >
        <span className="text-[22px] shrink-0 w-8 text-center">📄</span>
        <div className="flex flex-col gap-px min-w-0">
          <strong className="text-[13.5px] font-semibold text-text">Blank page</strong>
          <span className="text-[12px] text-text-3 whitespace-nowrap overflow-hidden text-ellipsis">Start from scratch</span>
        </div>
      </button>

      {templates.length > 0 && (
        <>
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-text-3 pt-2.5 pb-1">Start from a template</div>
          <div className="flex flex-col gap-1">
            {templates.map((t) => (
              <button
                key={t.id}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded border border-transparent bg-transparent cursor-pointer text-left transition-[background,border-color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-2 hover:border-border focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                onClick={() => onSelect(t.id)}
              >
                <span className="text-[22px] shrink-0 w-8 text-center">{t.icon}</span>
                <div className="flex flex-col gap-px min-w-0">
                  <strong className="text-[13.5px] font-semibold text-text">{t.title}</strong>
                  <span className="text-[12px] text-text-3 whitespace-nowrap overflow-hidden text-ellipsis">{t.description}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
