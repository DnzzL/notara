import { useEffect, useRef, useState } from "react";
import { api } from "../rpc-client.js";
import { SharePageModal } from "./SharePageModal.js";

/** Shared dropdown menu-item style (matches WorkspaceSwitcher). */
const MENU_ITEM =
  "flex items-center gap-2 w-full px-2.5 py-[7px] bg-transparent border-none cursor-pointer text-[13px] text-text-2 text-left rounded-lg [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text";

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

export function PageMenu({ pageId, workspaceId }: { pageId: string; workspaceId: string | null }) {
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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
    const result = await api.exportPage({ pageId, includeDatabases: false });
    download(`${result.title || "page"}.md`, result.markdown, "text/markdown");
    setOpen(false);
  };

  const exportFullMarkdown = async () => {
    const result = await api.exportPage({ pageId, includeDatabases: true });
    download(`${result.title || "page"}.md`, result.markdown, "text/markdown");
    setOpen(false);
  };

  return (
    <>
      <div ref={ref} className="relative">
        <button className="text-[18px] bg-transparent border-none cursor-pointer text-text-3 px-2.5 py-1.5 rounded-[5px] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text-2" title="More actions" onClick={() => setOpen((o) => !o)}>
          ⋯
        </button>
        {open && (
          <div className="absolute right-0 top-[calc(100%+5px)] bg-surface border border-border-mid rounded shadow-[var(--shadow-lg)] min-w-[200px] z-[100] p-1">
            {workspaceId && (
              <button className={MENU_ITEM} onClick={() => { setShareOpen(true); setOpen(false); }}>Share…</button>
            )}
            <button className={MENU_ITEM} onClick={exportMarkdown}>Export as Markdown</button>
            <button className={MENU_ITEM} onClick={exportFullMarkdown}>Export with databases</button>
          </div>
        )}
      </div>
      {shareOpen && workspaceId && (
        <SharePageModal
          pageId={pageId}
          workspaceId={workspaceId}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
