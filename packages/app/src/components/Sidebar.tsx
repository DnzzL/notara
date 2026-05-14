import { useEffect, useState, useCallback, useRef } from "react";
import { useStore } from "../store.js";
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

export function Sidebar() {
  const { pages, currentPage, selectPage, createPage, deletePage, loadPages, movePage, reorderPages, loading } =
    useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");

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
                  allPages={filtered}
                  dragOverTarget={dragOverTarget}
                  activePageId={activePageId}
                  depth={0}
                />
              ))
            )}
          </nav>
        </aside>
      </SortableContext>

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
    </DndContext>
  );
}

function PageNode({
  page,
  children,
  isSelected,
  onSelect,
  onDelete,
  allPages,
  dragOverTarget,
  activePageId,
  depth,
}: {
  page: any;
  children: any[];
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  allPages: any[];
  dragOverTarget: { id: string; position: "above" | "below" | "nest" } | null;
  activePageId: string | null;
  depth: number;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    paddingLeft: `${depth * 16 + 8}px`,
    position: "relative",
    opacity: isDragging ? 0.3 : 1,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowDelete(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
    setShowDelete(false);
  };

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
    <div ref={setNodeRef} style={style}>
      {showAboveIndicator && !isActive && <div className="sidebar-drop-indicator" />}

      <div
        className={`page-node ${isSelected ? "selected" : ""} ${isNestTarget ? "nest-target" : ""}`}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
        onMouseLeave={() => setShowDelete(false)}
      >
        {/* Expand/collapse chevron */}
        {hasChildren && (
          <span
            className="page-node-chevron"
            onClick={toggleExpand}
            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ▶
          </span>
        )}
        {!hasChildren && <span style={{ width: 12, display: "inline-block" }} />}

        {/* Drag handle */}
        <div
          className="page-drag-handle"
          onMouseDown={(e) => e.stopPropagation()}
          {...listeners}
          {...attributes}
        >
          ⋮⋮
        </div>

        <span className="icon">{page.icon || "📄"}</span>
        <span className="page-title-text">{page.title || "Untitled"}</span>

        {showDelete && onDelete && (
          <button
            className="page-delete-btn"
            onClick={handleDelete}
          >
            Delete
          </button>
        )}
      </div>

      {showBelowIndicator && !isActive && <div className="sidebar-drop-indicator" />}

      {/* Render children if expanded */}
      {isExpanded &&
        children.map((child) => (
          <PageNode
            key={child.id}
            page={child}
            children={allPages.filter((p) => p.parentId === child.id)}
            isSelected={activePageId === child.id}
            onSelect={onSelect}
            onDelete={onDelete}
            allPages={allPages}
            dragOverTarget={dragOverTarget}
            activePageId={activePageId}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}
