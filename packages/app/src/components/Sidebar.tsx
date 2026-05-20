import { useEffect, useState, useCallback, useRef } from "react";
import { useStore } from "../store.js";
import { ImportModal } from "./ImportModal.js";
import { EmojiPicker } from "./EmojiPicker.js";
import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** Get all descendant page IDs for a given page. */
function getDescendants(pageId: string, pages: any[]): Set<string> {
  const descendants = new Set<string>();
  function walk(id: string) {
    for (const p of pages) {
      if (p.parentId === id) {
        descendants.add(p.id);
        walk(p.id);
      }
    }
  }
  walk(pageId);
  return descendants;
}

/** Build a flat sortable list of all pages in tree order. */
function buildTreeOrder(pages: any[]): string[] {
  const order: string[] = [];
  function walk(pageList: any[]) {
    for (const page of pageList) {
      order.push(page.id);
      const children = pages.filter((p) => p.parentId === page.id);
      walk(children);
    }
  }
  walk(pages.filter((p) => !p.parentId));
  return order;
}

/** Shared pointer position tracker — updated by onDragMove, read by onDragOver/onDragEnd. */
const pointerPos = { x: 0, y: 0 };
/** Starting position of the drag, set on drag start. */
const dragStartPos = { x: 0, y: 0 };

const SIDEBAR_WIDTH_KEY = "notion-alt:sidebarWidth";
const SIDEBAR_COLLAPSED_KEY = "notion-alt:sidebarCollapsed";
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 260;

export function Sidebar() {
  const { pages, currentPage, selectPage, createPage, deletePage, loadPages, movePage, reorderPages, loading, setPageIcon, toggleFavorite } =
    useStore();
  const [iconPickerFor, setIconPickerFor] = useState<{ pageId: string; top: number; left: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [showImport, setShowImport] = useState(false);

  // Width + collapsed state, persisted across sessions.
  const [width, setWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH;
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width)); }, [width]);
  useEffect(() => { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0"); }, [collapsed]);

  // Cmd+\ toggles collapse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drag-to-resize the sidebar's right edge.
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + (ev.clientX - startX)));
      setWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Drag state
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ id: string; position: "above" | "below" | "nest" } | null>(null);
  const dragOverTargetRef = useRef<{ id: string; position: "above" | "below" | "nest" } | null>(null);

  useEffect(() => {
    loadPages();
  }, []);

  const filtered = searchQuery
    ? pages.filter(
        (p) => !p.isDeleted && p.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pages.filter((p) => !p.isDeleted);

  const treeOrder = buildTreeOrder(filtered);

  // Sensor for drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    setActivePageId(active.id as string);
    // Capture initial pointer position from the activator event
    let startX = 0, startY = 0;
    if (activatorEvent instanceof MouseEvent || activatorEvent instanceof PointerEvent) {
      startX = activatorEvent.clientX;
      startY = activatorEvent.clientY;
    } else if (active.rect.current.translated) {
      const rect = active.rect.current.translated;
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
    }
    dragStartPos.x = startX;
    dragStartPos.y = startY;
    pointerPos.x = startX;
    pointerPos.y = startY;
  };

  /** Track pointer position on every drag move. delta is total translation from start. */
  const handleDragMove = useCallback(({ delta }: DragMoveEvent) => {
    if (delta) {
      pointerPos.x = dragStartPos.x + delta.x;
      pointerPos.y = dragStartPos.y + delta.y;
    }
  }, []);

  const handleDragCancel = () => {
    setActivePageId(null);
    setDragOverTarget(null);
    dragOverTargetRef.current = null;
  };

  const handleDragOver = useCallback(({ over }: DragOverEvent) => {
    if (!over) {
      setDragOverTarget(null);
      dragOverTargetRef.current = null;
      return;
    }

    const overId = String(over.id);
    const rect = over.rect;
    if (!rect) {
      setDragOverTarget(null);
      dragOverTargetRef.current = null;
      return;
    }

    const { x, y } = pointerPos;
    if (y < rect.top || y > rect.bottom || x < rect.left || x > rect.right) {
      setDragOverTarget(null);
      dragOverTargetRef.current = null;
      return;
    }

    // Nest zone is the right 60% of the node (title area)
    const nestZoneLeft = rect.left + rect.width * 0.4;
    let target: { id: string; position: "above" | "below" | "nest" };
    if (x >= nestZoneLeft) {
      target = { id: overId, position: "nest" };
    } else {
      const midY = rect.top + rect.height / 2;
      target = { id: overId, position: y < midY ? "above" : "below" };
    }

    dragOverTargetRef.current = target;
    setDragOverTarget(target);
  }, []);

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      const target = dragOverTargetRef.current;
      setActivePageId(null);
      setDragOverTarget(null);
      dragOverTargetRef.current = null;

      if (!over || active.id === over.id) return;

      const draggedId = String(active.id);
      const targetId = String(over.id);
      const position = target?.position ?? "above";

      const draggedPage = filtered.find((p) => p.id === draggedId);
      const targetPage = filtered.find((p) => p.id === targetId);
      if (!draggedPage || !targetPage) return;

      // Prevent circular move: can't drag into self or descendants
      const descendants = getDescendants(draggedId, pages);
      if (descendants.has(targetId)) return;

      if (position === "nest") {
        // Nest under target page
        await movePage(draggedId, targetId);
      } else {
        // Reorder: place above or below target within same sibling group
        const targetParentId = targetPage.parentId || null;
        const parentId = draggedPage.parentId || null;

        // Only call reorderPages if dragged page is a sibling of target
        if (parentId === targetParentId) {
          // Build the reordered sibling list
          const siblings = filtered
            .filter((p) => (p.parentId || null) === parentId)
            .map((p) => p.id);

          const draggedIdx = siblings.indexOf(draggedId);
          const targetIdx = siblings.indexOf(targetId);

          if (draggedIdx !== -1 && targetIdx !== -1) {
            // Remove dragged from its position
            siblings.splice(draggedIdx, 1);
            // Recalculate target index after removal
            const newTargetIdx = siblings.indexOf(targetId);
            // Insert dragged at target position
            const insertIdx = position === "above" ? newTargetIdx : newTargetIdx + 1;
            siblings.splice(insertIdx, 0, draggedId);

            await reorderPages(parentId, siblings);
            return;
          }
        }

        // Fallback: just update parentId (for cross-level moves)
        await movePage(draggedId, targetParentId);
      }
    },
    [filtered, pages, movePage, reorderPages]
  );

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

  const roots = filtered.filter((p) => !p.parentId);
  const childrenOf = (parentId: string) => filtered.filter((p) => p.parentId === parentId);
  const favorites = filtered.filter((p) => p.isFavorite);

  const handleIconClick = (pageId: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setIconPickerFor({ pageId, top: rect.bottom + 4, left: rect.left });
  };

  if (collapsed) {
    return (
      <aside className="sidebar-collapsed" aria-label="Sidebar (collapsed)">
        <button
          className="sidebar-collapsed-btn"
          title="Expand sidebar (⌘\\)"
          onClick={() => setCollapsed(false)}
        >
          »
        </button>
      </aside>
    );
  }

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k", metaKey: true, ctrlKey: true, bubbles: true,
    }));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={treeOrder} strategy={verticalListSortingStrategy}>
        <aside className="sidebar" style={{ width }}>
          <div className="sidebar-header">
            <div className="sidebar-topbar">
              <button
                className="sidebar-icon-btn"
                title="Collapse sidebar (⌘\\)"
                onClick={() => setCollapsed(true)}
              >
                «
              </button>
              <button
                className="sidebar-search"
                onClick={openSearch}
                title="Open quick search"
              >
                <span>Search…</span>
                <kbd>⌘K</kbd>
              </button>
            </div>
            <input
              type="text"
              className="sidebar-filter"
              placeholder="Filter visible pages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <nav className="sidebar-tree">
            {favorites.length > 0 && (
              <>
                <div className="sidebar-section-header">Favorites</div>
                <div className="sidebar-section">
                  {favorites.map((page) => (
                    <div
                      key={"fav-" + page.id}
                      className={`page-node ${currentPage?.id === page.id ? "selected" : ""}`}
                      onClick={() => selectPage(page)}
                    >
                      <span className="page-node-spacer" />
                      <span className="icon">{page.icon || "📄"}</span>
                      <span className="page-title-text">{page.title || "Untitled"}</span>
                    </div>
                  ))}
                </div>
                <div className="sidebar-section-header sidebar-section-header--gap">Pages</div>
              </>
            )}
            {loading ? (
              <div className="sidebar-hint">Loading…</div>
            ) : roots.length === 0 ? (
              <div className="sidebar-empty">
                <div>No pages yet</div>
                <button className="sidebar-action-btn" onClick={handleCreateClick}>+ New page</button>
              </div>
            ) : (
              roots.map((page) => (
                <PageNode
                  key={page.id}
                  page={page}
                  children={childrenOf(page.id)}
                  currentPageId={currentPage?.id ?? null}
                  onSelect={selectPage}
                  onDelete={deletePage}
                  onToggleFavorite={(pid) => toggleFavorite(pid)}
                  onIconClick={handleIconClick}
                  allPages={filtered}
                  dragOverTarget={dragOverTarget}
                  activePageId={activePageId}
                  depth={0}
                />
              ))
            )}
          </nav>

          <div className="sidebar-footer">
            {isCreating ? (
              <input
                type="text"
                className="sidebar-new-input"
                placeholder="Page title…"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleCreateSubmit}
                autoFocus
              />
            ) : (
              <button className="sidebar-footer-btn" onClick={handleCreateClick}>
                <span>+</span> New page
              </button>
            )}
            <button className="sidebar-footer-btn" onClick={() => setShowImport(true)} title="Import Notion export">
              <span>⤓</span> Import
            </button>
          </div>

          <div
            className="sidebar-resize"
            onMouseDown={startResize}
            title="Drag to resize"
            aria-label="Resize sidebar"
          />
        </aside>
      </SortableContext>
      <EmojiPicker
        open={iconPickerFor !== null}
        anchor={iconPickerFor}
        onClose={() => setIconPickerFor(null)}
        onSelect={(icon) => iconPickerFor && setPageIcon(iconPickerFor.pageId, icon)}
      />

      <DragOverlay>
        {activePageId ? (
          <div className="sidebar-drag-overlay">
            {(() => {
              const page = pages.find((p) => p.id === activePageId);
              if (!page) return null;
              return (
                <div className="sidebar-drag-preview">
                  <span className="icon">{page.icon || "📄"}</span>
                  {page.title || "Untitled"}
                </div>
              );
            })()}
          </div>
        ) : null}
      </DragOverlay>
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
    </DndContext>
  );
}

function PageNode({
  page,
  children,
  currentPageId,
  onSelect,
  onDelete,
  onToggleFavorite,
  onIconClick,
  allPages,
  dragOverTarget,
  activePageId,
  depth,
}: {
  page: any;
  children: any[];
  currentPageId: string | null;
  onSelect: (page: any) => void;
  onDelete?: (pageId: string) => void;
  onToggleFavorite?: (pageId: string) => void;
  onIconClick?: (pageId: string, target: HTMLElement) => void;
  allPages: any[];
  dragOverTarget: { id: string; position: "above" | "below" | "nest" } | null;
  activePageId: string | null;
  depth: number;
}) {
  const isSelected = currentPageId === page.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    paddingLeft: depth === 0 ? 0 : depth * 14,
    position: "relative",
    opacity: isDragging ? 0.3 : 1,
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Drop indicator: show above or below this node
  const showAboveIndicator = dragOverTarget?.id === page.id && dragOverTarget?.position === "above";
  const showBelowIndicator = dragOverTarget?.id === page.id && dragOverTarget?.position === "below";
  const isNestTarget = dragOverTarget?.id === page.id && dragOverTarget?.position === "nest";
  const isActive = activePageId === page.id;

  const hasChildren = children.length > 0;

  return (
    <div ref={setNodeRef} style={style} className={depth > 0 ? "page-node-indent" : undefined}>
      {showAboveIndicator && !isActive && <div className="sidebar-drop-indicator" />}

      <div
        className={`page-node ${isSelected ? "selected" : ""} ${isNestTarget ? "nest-target" : ""}`}
        onClick={() => onSelect(page)}
      >
        <div
          className="page-drag-handle"
          onMouseDown={(e) => e.stopPropagation()}
          {...listeners}
          {...attributes}
          title="Drag to move"
        >
          ⋮⋮
        </div>

        <span
          className={`page-node-chevron ${hasChildren ? "" : "page-node-chevron--ghost"}`}
          onClick={hasChildren ? toggleExpand : undefined}
          style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </span>

        <span
          className="icon"
          onClick={(e) => { e.stopPropagation(); onIconClick?.(page.id, e.currentTarget); }}
          title="Change icon"
        >
          {page.icon || "📄"}
        </span>
        <span className="page-title-text">{page.title || "Untitled"}</span>

        {page.isFavorite && (
          <span className="page-fav-mini" data-active="true" aria-label="Favorited">★</span>
        )}

        <div className="page-node-actions" ref={menuRef}>
          <button
            className="page-node-action"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            title="More actions"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="page-node-menu" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { onToggleFavorite?.(page.id); setMenuOpen(false); }}>
                {page.isFavorite ? "Remove from favorites" : "Add to favorites"}
              </button>
              <button onClick={(e) => {
                setMenuOpen(false);
                onIconClick?.(page.id, e.currentTarget as HTMLElement);
              }}>Change icon</button>
              {onDelete && (
                <button className="page-node-menu-danger" onClick={() => { onDelete(page.id); setMenuOpen(false); }}>
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showBelowIndicator && !isActive && <div className="sidebar-drop-indicator" />}

      {/* Render children if expanded */}
      {isExpanded &&
        children.map((child) => (
          <PageNode
            key={child.id}
            page={child}
            children={allPages.filter((p) => p.parentId === child.id)}
            currentPageId={currentPageId}
            onSelect={onSelect}
            onDelete={onDelete}
            onToggleFavorite={onToggleFavorite}
            onIconClick={onIconClick}
            allPages={allPages}
            dragOverTarget={dragOverTarget}
            activePageId={activePageId}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}
