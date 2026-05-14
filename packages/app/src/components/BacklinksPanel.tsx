import { useEffect, useState } from "react";
import { api } from "../rpc-client";
import { useStore } from "../store";

/**
 * BacklinksPanel - Shows pages that reference the current page.
 * 
 * Displays a collapsible panel with links to pages that contain
 * [[page name]] references to the currently viewed page.
 */

interface Backlink {
  blockId: string;
  pageId: string;
  pageTitle: string;
  content: string;
}

export function BacklinksPanel() {
  const currentPageId = useStore((state) => state.currentPageId);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentPageId) {
      setBacklinks([]);
      return;
    }

    const fetchBacklinks = async () => {
      setLoading(true);
      try {
        const results = await api.getBacklinks(currentPageId);
        setBacklinks(results);
      } catch (error) {
        console.error("Failed to fetch backlinks:", error);
        setBacklinks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBacklinks();
  }, [currentPageId]);

  if (!currentPageId) return null;

  const count = backlinks.length;

  return (
    <div className="backlinks-panel">
      <button
        className="backlinks-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          width: "100%",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "13px",
          color: "#6b7280",
        }}
      >
        <span className="backlinks-icon">
          {isExpanded ? "▼" : "▶"}
        </span>
        <span className="backlinks-label">
          {loading ? "Loading..." : `${count} backlink${count !== 1 ? "s" : ""}`}
        </span>
      </button>

      {isExpanded && (
        <div className="backlinks-list" style={{
          padding: "4px 0",
          maxHeight: "200px",
          overflowY: "auto",
        }}>
          {loading && (
            <div style={{ padding: "8px 12px", color: "#6b7280" }}>
              Loading backlinks...
            </div>
          )}
          
          {!loading && backlinks.length === 0 && (
            <div style={{ padding: "8px 12px", color: "#6b7280" }}>
              No pages reference this page
            </div>
          )}
          
          {!loading && backlinks.map((link) => (
            <BacklinkItem key={link.blockId} backlink={link} />
          ))}
        </div>
      )}
    </div>
  );
}

function BacklinkItem({ backlink }: { backlink: Backlink }) {
  const setCurrentPageId = useStore((state) => state.setCurrentPageId);

  const handleClick = () => {
    // Navigate to the page that contains the backlink
    setCurrentPageId(backlink.pageId);
  };

  // Extract context snippet from content (first 100 chars)
  const snippet = backlink.content.length > 100 
    ? backlink.content.slice(0, 100) + "..."
    : backlink.content;

  return (
    <button
      className="backlink-item"
      onClick={handleClick}
      style={{
        display: "block",
        width: "100%",
        padding: "8px 16px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        fontSize: "13px",
      }}
    >
      <div className="backlink-page-title" style={{
        fontWeight: "500",
        marginBottom: "4px",
        color: "#37352f",
      }}>
        📄 {backlink.pageTitle}
      </div>
      <div className="backlink-snippet" style={{
        color: "#6b7280",
        fontSize: "12px",
        lineHeight: "1.4",
      }}>
        {snippet}
      </div>
    </button>
  );
}

export default BacklinksPanel;