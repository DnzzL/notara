import { useState, useCallback } from "react";
import { usePageStore } from "../../stores/pageStore.js";
import type { BlockRendererProps } from "./renderer-registry.js";

export function PageLinkBlock({ block, onUpdateBlock }: BlockRendererProps) {
  /** Parse the pageId from block.content. Legacy format is raw HTML; new is the plain pageId string. */
  const pageId = block.content?.startsWith("<") ? "" : block.content;
  const pages = usePageStore((s) => s.pages);
  const page = pages.find((p) => p.id === pageId);
  const [pickerOpen, setPickerOpen] = useState(pageId === "");
  const [query, setQuery] = useState("");

  const navigate = useCallback((e: React.MouseEvent) => {
    if (!pageId) return;
    e.preventDefault();
    e.stopPropagation();
    const url = new URL(window.location.href);
    url.searchParams.set("page", pageId);
    window.history.pushState({ pageId }, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [pageId]);

  if (!pageId || pickerOpen) {
    const q = query.trim().toLowerCase();
    const visible = (q
      ? pages.filter((p) => !p.isDeleted && (p.title || "").toLowerCase().includes(q))
      : pages.filter((p) => !p.isDeleted)
    ).slice(0, 20);
    return (
      <div className="page-link-picker" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="page-link-picker-input"
          placeholder="Link to page\u2026"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); setPickerOpen(false); }
            else if (e.key === "Enter" && visible[0]) {
              e.preventDefault();
              setPickerOpen(false);
              onUpdateBlock(block.id, visible[0].id);
            }
          }}
        />
        <div className="page-link-picker-list">
          {visible.length === 0 ? (
            <div className="page-link-picker-empty">No pages</div>
          ) : visible.map((p) => (
            <button
              key={p.id}
              className="page-link-picker-item"
              onClick={() => { setPickerOpen(false); onUpdateBlock(block.id, p.id); }}
            >
              <span>{p.icon || "\uD83D\uDCC4"}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title || "Untitled"}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="page-link-block page-link-block--missing" data-block-id={block.id}>
        Page no longer exists
      </div>
    );
  }
  return (
    <a className="page-link-block" href={`?page=${pageId}`} onClick={navigate}>
      <span className="page-link-block-icon">{page.icon || "\uD83D\uDCC4"}</span>
      <span className="page-link-block-title">{page.title || "Untitled"}</span>
    </a>
  );
}
