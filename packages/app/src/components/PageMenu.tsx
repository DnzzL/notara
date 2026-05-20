import { useEffect, useRef, useState } from "react";
import { api } from "../rpc-client.js";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function PageMenu({ pageId }: { pageId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const exportMarkdown = async () => {
    const result = await api.exportPage(pageId, false);
    download(`${result.title || "page"}.md`, result.markdown, "text/markdown");
    setOpen(false);
  };

  const exportFullMarkdown = async () => {
    const result = await api.exportPage(pageId, true);
    download(`${result.title || "page"}.md`, result.markdown, "text/markdown");
    setOpen(false);
  };

  return (
    <div ref={ref} className="page-menu-wrap">
      <button className="page-menu-btn" title="More actions" onClick={() => setOpen((o) => !o)}>
        ⋯
      </button>
      {open && (
        <div className="page-menu">
          <button onClick={exportMarkdown}>Export as Markdown</button>
          <button onClick={exportFullMarkdown}>Export with databases</button>
        </div>
      )}
    </div>
  );
}
