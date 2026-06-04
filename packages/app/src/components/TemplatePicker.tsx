import { useEffect, useState } from "react";
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

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKey}>
      <div
        className="modal-content template-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose a template"
      >
        <div className="modal-header">
          <h2>New page</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body template-picker-body">
          <button
            className="template-card template-card--blank"
            onClick={() => onSelect(null)}
            autoFocus
          >
            <span className="template-card-icon">📄</span>
            <div className="template-card-text">
              <strong>Blank page</strong>
              <span>Start from scratch</span>
            </div>
          </button>

          {templates.length > 0 && (
            <>
              <div className="template-picker-divider">Start from a template</div>
              <div className="template-card-grid">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    className="template-card"
                    onClick={() => onSelect(t.id)}
                  >
                    <span className="template-card-icon">{t.icon}</span>
                    <div className="template-card-text">
                      <strong>{t.title}</strong>
                      <span>{t.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
