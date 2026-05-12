import { useEffect, useState } from "react";
import { useStore } from "../store.js";

export function Sidebar() {
  const { pages, currentPage, selectPage, createPage, deletePage, loadPages, loading } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");

  useEffect(() => {
    loadPages();
  }, []);

  const handleCreateClick = () => {
    setIsCreating(true);
    setNewPageTitle("");
  };

  const handleCreateSubmit = async () => {
    const title = newPageTitle.trim() || "Untitled";
    await createPage(title);
    setIsCreating(false);
    setNewPageTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateSubmit();
    } else if (e.key === "Escape") {
      setIsCreating(false);
    }
  };

  const filtered = searchQuery
    ? pages.filter((p) => !p.isDeleted && p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : pages.filter((p) => !p.isDeleted);

  const roots = filtered.filter((p) => !p.parentId);
  const childrenOf = (parentId: string) => filtered.filter((p) => p.parentId === parentId);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <input
          type="text"
          placeholder="Search pages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {isCreating ? (
          <input
            type="text"
            placeholder="Page title..."
            value={newPageTitle}
            onChange={(e) => setNewPageTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleCreateSubmit}
            autoFocus
          />
        ) : (
          <button onClick={handleCreateClick}>+ New Page</button>
        )}
      </div>

      <nav>
        {loading ? (
          <div style={{ padding: 8, color: "#999", fontSize: 13 }}>Loading...</div>
        ) : roots.length === 0 ? (
          <div style={{ padding: 8, color: "#999", fontSize: 13 }}>No pages yet</div>
        ) : (
          roots.map((page) => (
            <PageNode
              key={page.id}
              page={page}
              children={childrenOf(page.id)}
              isSelected={currentPage?.id === page.id}
              onSelect={() => selectPage(page)}
              onDelete={() => deletePage(page.id)}
              depth={0}
            />
          ))
        )}
      </nav>
    </aside>
  );
}

function PageNode({ page, children, isSelected, onSelect, onDelete, depth }: {
  page: any;
  children: any[];
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  depth: number;
}) {
  const [showDelete, setShowDelete] = useState(false);
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowDelete(true);
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
    setShowDelete(false);
  };

  return (
    <div>
      <div
        className={`page-node ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 8}px`, position: "relative" }}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
        onMouseLeave={() => setShowDelete(false)}
      >
        <span className="icon">📄</span>
        {page.title || "Untitled"}
        {showDelete && onDelete && (
          <button
            onClick={handleDelete}
            style={{
              position: "absolute",
              right: 4,
              top: "50%",
              transform: "translateY(-50%)",
              background: "#ff4444",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        )}
      </div>
      {children.map((child) => (
        <PageNode
          key={child.id}
          page={child}
          children={[]}
          isSelected={isSelected}
          onSelect={() => {}}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
