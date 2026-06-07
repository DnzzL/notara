import { useEffect, useState } from "react";
import { usePageStore } from "../store.js";
import { selectPageByIdWithCascade } from "../lib/page-loader.js";
import type { Backlink } from "@notara/shared";

export function BacklinksPanel() {
  const currentPage = usePageStore(s => s.currentPage);
  const backlinks = usePageStore(s => s.backlinks);
  const backlinksLoading = usePageStore(s => s.backlinksLoading);
  const loadBacklinks = usePageStore(s => s.loadBacklinks);
  const selectPageById = selectPageByIdWithCascade;
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (currentPage?.id) {
      loadBacklinks(currentPage.id);
    }
  }, [currentPage?.id]);

  if (!currentPage) return null;

  const count = backlinks.length;

  return (
    <div className="backlinks-panel">
      <button
        className="backlinks-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 12px", width: "100%",
          background: "transparent", border: "none",
          cursor: "pointer", fontSize: "13px", color: "#6b7280",
        }}
      >
        <span className="backlinks-icon">{isExpanded ? "▼" : "▶"}</span>
        <span className="backlinks-label">
          {backlinksLoading ? "Loading..." : `${count} backlink${count !== 1 ? "s" : ""}`}
        </span>
      </button>

      {isExpanded && (
        <div className="backlinks-list" style={{ padding: "4px 0", maxHeight: "200px", overflowY: "auto" }}>
          {backlinksLoading && (<div style={{ padding: "8px 12px", color: "#6b7280" }}>Loading backlinks...</div>)}
          {!backlinksLoading && backlinks.length === 0 && (<div style={{ padding: "8px 12px", color: "#6b7280" }}>No pages reference this page</div>)}
          {!backlinksLoading && backlinks.map((link) => (
            <BacklinkItem key={link.blockId} backlink={link} onNavigate={selectPageById} />
          ))}
        </div>
      )}
    </div>
  );
}

function BacklinkItem({ backlink, onNavigate }: { backlink: Backlink; onNavigate: (id: string) => void }) {
  const snippet = backlink.blockType === "pageLink"
    ? "🔗 Linked page"
    : backlink.content.length > 100
      ? backlink.content.slice(0, 100) + "..."
      : backlink.content;

  return (
    <button className="backlink-item" onClick={() => onNavigate(backlink.pageId)}
      style={{ display: "block", width: "100%", padding: "8px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontSize: "13px" }}>
      <div className="backlink-page-title" style={{ fontWeight: "500", marginBottom: "4px", color: "#37352f" }}>
        📄 {backlink.pageTitle}
      </div>
      <div className="backlink-snippet" style={{ color: "#6b7280", fontSize: "12px", lineHeight: "1.4" }}>
        {snippet}
      </div>
    </button>
  );
}

export default BacklinksPanel;
