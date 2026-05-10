import { useEffect, useState } from "react";
import { useStore } from "../store.js";

export function Sidebar() {
  const { pages, currentPage, selectPage, createPage, loadPages, loading } = useStore();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadPages();
  }, []);

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
        <button onClick={() => createPage("Untitled")}>+ New Page</button>
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
              depth={0}
            />
          ))
        )}
      </nav>
    </aside>
  );
}

function PageNode({ page, children, isSelected, onSelect, depth }: {
  page: any;
  children: any[];
  isSelected: boolean;
  onSelect: () => void;
  depth: number;
}) {
  return (
    <div>
      <div
        className={`page-node ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={onSelect}
      >
        <span className="icon">📄</span>
        {page.title || "Untitled"}
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
