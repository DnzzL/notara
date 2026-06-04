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
      className="template-picker"
      bodyClassName="template-picker-body"
      ariaLabel="Choose a template"
    >
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
    </Modal>
  );
}
