import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { usePageStore } from "../store.js";
import { selectPageWithCascade } from "../lib/page-loader.js";
import { api } from "../rpc-client.js";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher.js";
import { TemplatePicker } from "./TemplatePicker.js";
import { ImportModal } from "./ImportModal.js";
import { SettingsModal } from "./SettingsModal.js";
import { ApiKeysModal } from "./ApiKeysModal.js";
import { TrashModal } from "./TrashModal.js";
import { EmojiPicker } from "./EmojiPicker.js";
import { createTreeCollection, TreeView } from "@ark-ui/react/tree-view";
import { Menu } from "@ark-ui/react/menu";
import { Portal } from "@ark-ui/react/portal";
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

interface TreeNodeData {
  id: string;
  children?: TreeNodeData[];
}

function buildTree(pages: any[], parentId: string | null): TreeNodeData[] {
  return pages
    .filter((p) => (p.parentId ?? null) === parentId)
    .map((p) => ({ id: p.id, children: buildTree(pages, p.id) }));
}

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

const SIDEBAR_WIDTH_KEY = "notara:sidebarWidth";
const SIDEBAR_COLLAPSED_KEY = "notara:sidebarCollapsed";
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 260;

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps = {}) {
  const pages = usePageStore(s => s.pages);
  const currentPage = usePageStore(s => s.currentPage);
  const loading = usePageStore(s => s.loading);
  const createPage = usePageStore(s => s.createPage);
  const createPageFromTemplate = usePageStore(s => s.createPageFromTemplate);
  const deletePage = usePageStore(s => s.deletePage);
  const loadPages = usePageStore(s => s.loadPages);
  const movePage = usePageStore(s => s.movePage);
  const reorderPages = usePageStore(s => s.reorderPages);
  const setPageIcon = usePageStore(s => s.setPageIcon);
  const toggleFavorite = usePageStore(s => s.toggleFavorite);
  const [iconPickerFor, setIconPickerFor] = useState<{ pageId: string; top: number; left: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [lockedPageIds, setLockedPageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const fetchLocked = () =>
      api.listLockedPageIds().then((ids) => {
        if (!cancelled) setLockedPageIds(new Set(ids));
      }).catch(() => { /* ignore — non-critical */ });
    fetchLocked();
    return () => { cancelled = true; };
  }, [pages.length]);

  const [width, setWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH;
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width)); }, [width]);
  useEffect(() => { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0"); }, [collapsed]);

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

  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ id: string; position: "above" | "below" | "nest" } | null>(null);
  const dragOverTargetRef = useRef<{ id: string; position: "above" | "below" | "nest" } | null>(null);

  // Track expanded nodes — initialised to all page IDs once pages load
  const [expandedValue, setExpandedValue] = useState<string[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    loadPages();
  }, []);

  const filtered = searchQuery
    ? pages.filter((p) => !p.isDeleted && p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : pages.filter((p) => !p.isDeleted);

  // Expand all nodes on first load; expand newly added nodes on subsequent updates
  useEffect(() => {
    if (filtered.length === 0) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      setExpandedValue(filtered.map((p) => p.id));
    } else {
      setExpandedValue((prev) => {
        const prevSet = new Set(prev);
        const newIds = filtered.filter((p) => !prevSet.has(p.id)).map((p) => p.id);
        return newIds.length > 0 ? [...prev, ...newIds] : prev;
      });
    }
  }, [filtered.length]);

  // When the selected page changes, ensure all its ancestors are expanded so the item is visible
  useEffect(() => {
    if (!currentPage?.parentId) return;
    const ancestors: string[] = [];
    let p = pageMap.get(currentPage.parentId);
    while (p) {
      ancestors.push(p.id);
      p = p.parentId ? pageMap.get(p.parentId) : undefined;
    }
    if (ancestors.length === 0) return;
    setExpandedValue((prev) => {
      const prevSet = new Set(prev);
      const missing = ancestors.filter((id) => !prevSet.has(id));
      return missing.length > 0 ? [...prev, ...missing] : prev;
    });
  }, [currentPage?.id]);

  const treeOrder = buildTreeOrder(filtered);

  const pageMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of filtered) m.set(p.id, p);
    return m;
  }, [filtered]);

  const tree = useMemo(() => buildTree(filtered, null), [filtered]);

  const collection = useMemo(
    () =>
      createTreeCollection<TreeNodeData>({
        nodeToValue: (n: TreeNodeData) => n.id,
        nodeToString: (n: TreeNodeData) => pageMap.get(n.id)?.title ?? "Untitled",
        rootNode: { id: "ROOT", children: tree },
      }),
    [tree, pageMap],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    setActivePageId(active.id as string);
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

      const descendants = getDescendants(draggedId, pages);
      if (descendants.has(targetId)) return;

      if (position === "nest") {
        await movePage(draggedId, targetId);
      } else {
        const targetParentId = targetPage.parentId || null;
        const parentId = draggedPage.parentId || null;

        if (parentId === targetParentId) {
          const siblings = filtered
            .filter((p) => (p.parentId || null) === parentId)
            .map((p) => p.id);
          const draggedIdx = siblings.indexOf(draggedId);
          const targetIdx = siblings.indexOf(targetId);
          if (draggedIdx !== -1 && targetIdx !== -1) {
            siblings.splice(draggedIdx, 1);
            const newTargetIdx = siblings.indexOf(targetId);
            const insertIdx = position === "above" ? newTargetIdx : newTargetIdx + 1;
            siblings.splice(insertIdx, 0, draggedId);
            await reorderPages(parentId, siblings);
            return;
          }
        }
        await movePage(draggedId, targetParentId);
      }
    },
    [filtered, pages, movePage, reorderPages],
  );

  const handleCreateClick = () => setShowTemplatePicker(true);

  const handleTemplateSelect = async (templateId: string | null) => {
    setShowTemplatePicker(false);
    const page = templateId
      ? await createPageFromTemplate(templateId)
      : await createPage("Untitled");
    selectPageWithCascade(page);
    onNavigate?.();
  };

  const favorites = filtered.filter((p) => p.isFavorite);

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k", metaKey: true, ctrlKey: true, bubbles: true,
    }));
  };

  if (collapsed) {
    return (
      <aside className="w-8 shrink-0 bg-sb border-r border-border-sb flex items-start justify-center pt-3.5" aria-label="Sidebar (collapsed)">
        <button
          className="bg-transparent border-none cursor-pointer text-text-sb-3 text-[15px] px-[7px] py-[5px] rounded-lg transition-[color,background] duration-[var(--t)] ease-[var(--ease)] hover:bg-sb-2 hover:text-text-sb"
          title="Expand sidebar (⌘\\)"
          onClick={() => setCollapsed(false)}
        >
          »
        </button>
      </aside>
    );
  }

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
        <aside className={`bg-sb border-r border-border-sb flex flex-col shrink-0 relative min-w-[200px] max-w-[480px]${className ? ` ${className}` : ""}`} style={{ width }}>
          <WorkspaceSwitcher
            onCollapse={() => setCollapsed(true)}
            onOpenBackups={() => setShowSettings(true)}
            onOpenApiKeys={() => setShowApiKeys(true)}
          />
          <div className="sticky top-0 z-[2] bg-sb px-2.5 pt-2.5 pb-[7px] flex flex-col gap-1.5 border-b border-transparent transition-[border-color] duration-[var(--t)] ease-[var(--ease)]">
            <button className="flex-1 flex items-center justify-between gap-2 px-2.5 py-[7px] border border-border-mid bg-surface rounded cursor-pointer text-[12.5px] text-text-sb-3 transition-[background,border-color,color] duration-[var(--t)] ease-[var(--ease)] hover:border-text hover:text-text-sb-2 [&_kbd]:font-[var(--font-mono)] [&_kbd]:text-[10px] [&_kbd]:text-text-sb-3 [&_kbd]:bg-surface-3 [&_kbd]:border [&_kbd]:border-border [&_kbd]:rounded-[3px] [&_kbd]:px-[5px] [&_kbd]:py-px" onClick={openSearch} title="Open quick search">
              <span>Search…</span>
              <kbd>⌘K</kbd>
            </button>
            <input
              type="text"
              className="px-2.5 py-[7px] border border-border-mid rounded text-[12.5px] bg-surface outline-none text-text-sb transition-[border-color,box-shadow] duration-[var(--t)] ease-[var(--ease)] focus:border-accent focus:shadow-[0_0_0_2px_var(--accent-dim)]"
              placeholder="Filter visible pages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 pt-0.5 pb-3.5 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-sb-3 [&::-webkit-scrollbar-thumb]:rounded-[2px] [&::-webkit-scrollbar-thumb:hover]:bg-sb-4">
            {favorites.length > 0 && (
              <>
                <div className="[font-family:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.12em] text-text-sb-3 px-2 pt-2.5 pb-[3px] flex items-center gap-1">Favorites</div>
                <div className="flex flex-col">
                  {favorites.map((page) => (
                    <div
                      key={"fav-" + page.id}
                      className={`page-node ${currentPage?.id === page.id ? "selected" : ""}`}
                      onClick={() => { selectPageWithCascade(page); onNavigate?.(); }}
                    >
                      <span className="page-node-spacer" />
                      <span className="icon">{page.icon || "📄"}</span>
                      <span className="page-title-text">{page.title || "Untitled"}</span>
                    </div>
                  ))}
                </div>
                <div className="[font-family:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.12em] text-text-sb-3 px-2 pt-2.5 pb-[3px] flex items-center gap-1 mt-1.5">Pages</div>
              </>
            )}

            {loading ? (
              <div className="px-2 py-3 text-text-sb-3 text-[12px]">Loading…</div>
            ) : filtered.filter((p) => !p.parentId).length === 0 ? (
              <div className="px-2.5 py-3.5 text-text-sb-3 text-[12.5px] flex flex-col gap-2 items-start leading-relaxed">
                <div>No pages yet</div>
                <button className="px-3 py-[5px] bg-accent text-white border-none rounded-lg cursor-pointer text-[12px] font-medium transition-opacity duration-[var(--t)] ease-[var(--ease)] hover:opacity-[0.88]" onClick={handleCreateClick}>+ New page</button>
              </div>
            ) : (
              <TreeView.Root
                collection={collection}
                selectionMode="single"
                selectedValue={currentPage ? [currentPage.id] : []}
                expandedValue={expandedValue}
                onExpandedChange={({ expandedValue: next }: { expandedValue: string[] }) => setExpandedValue(next)}
                onSelectionChange={({ selectedValue: val }: { selectedValue: string[] }) => {
                  const id = val[0];
                  if (id) {
                    const page = pageMap.get(id);
                    if (page) { selectPageWithCascade(page); onNavigate?.(); }
                  }
                }}
              >
                <TreeView.Tree>
                  {collection.rootNode.children?.map((node: TreeNodeData, index: number) => (
                    <PageTreeNode
                      key={node.id}
                      node={node}
                      indexPath={[index]}
                      pageMap={pageMap}
                      dragOverTarget={dragOverTarget}
                      activePageId={activePageId}
                      onDelete={deletePage}
                      onToggleFavorite={(pid) => toggleFavorite(pid)}
                      onIconClick={(pageId, coords) => setIconPickerFor({ pageId, ...coords })}
                      depth={0}
                      lockedPageIds={lockedPageIds}
                    />
                  ))}
                </TreeView.Tree>
              </TreeView.Root>
            )}
          </nav>

          <div className="sticky bottom-0 bg-sb px-2 pt-[5px] pb-2.5 flex flex-col gap-px border-t border-border-sb">
            <button className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-2.5 py-1.5 text-[12.5px] text-text-sb-3 rounded-lg text-left transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.05)] hover:text-text-sb" onClick={handleCreateClick}>
              <span className="text-text-sb-3 text-[14px] w-4 text-center transition-[color] duration-[var(--t)] ease-[var(--ease)]">+</span> New page
            </button>
            <button className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-2.5 py-1.5 text-[12.5px] text-text-sb-3 rounded-lg text-left transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.05)] hover:text-text-sb" onClick={() => setShowImport(true)} title="Import Notion export">
              <span className="text-text-sb-3 text-[14px] w-4 text-center transition-[color] duration-[var(--t)] ease-[var(--ease)]">⤓</span> Import
            </button>
            <button className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-2.5 py-1.5 text-[12.5px] text-text-sb-3 rounded-lg text-left transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.05)] hover:text-text-sb" onClick={() => setShowTrash(true)} title="Trash">
              <span className="text-text-sb-3 text-[14px] w-4 text-center transition-[color] duration-[var(--t)] ease-[var(--ease)]">🗑</span> Trash
            </button>
          </div>

          <div
            className="absolute top-0 right-[-3px] w-1.5 h-full cursor-col-resize z-[5] hover:[background:linear-gradient(to_right,transparent_2px,var(--accent)_2px,var(--accent)_4px,transparent_4px)] hover:opacity-35"
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
          <div className="bg-surface border border-border-mid rounded shadow-[var(--shadow-xl)] px-3.5 py-2 min-w-[150px] max-w-[250px]">
            {(() => {
              const page = pages.find((p) => p.id === activePageId);
              if (!page) return null;
              return (
                <div className="flex items-center gap-1.5 text-[13px] text-text-2 px-1.5 py-1 bg-surface-3 rounded-[5px] border border-border">
                  <span className="icon">{page.icon || "📄"}</span>
                  {page.title || "Untitled"}
                </div>
              );
            })()}
          </div>
        ) : null}
      </DragOverlay>

      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      {showApiKeys && <ApiKeysModal onClose={() => setShowApiKeys(false)} />}
      {showTrash && <TrashModal onClose={() => setShowTrash(false)} onChanged={loadPages} />}
      {showTemplatePicker && (
        <TemplatePicker
          onClose={() => setShowTemplatePicker(false)}
          onSelect={handleTemplateSelect}
        />
      )}
    </DndContext>
  );
}

// ─── PageTreeNode ─────────────────────────────────────────────────────────────

interface PageTreeNodeProps {
  node: TreeNodeData;
  indexPath: number[];
  pageMap: Map<string, any>;
  dragOverTarget: { id: string; position: "above" | "below" | "nest" } | null;
  activePageId: string | null;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onIconClick: (pageId: string, coords: { top: number; left: number }) => void;
  depth: number;
  lockedPageIds: Set<string>;
}

const INDENT_STEP = 12;
const MAX_VISUAL_DEPTH = 6;

function PageTreeNode({
  node, indexPath, pageMap, dragOverTarget, activePageId,
  onDelete, onToggleFavorite, onIconClick, depth, lockedPageIds,
}: PageTreeNodeProps) {
  const page = pageMap.get(node.id);
  if (!page) return null;

  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: node.id,
  });

  const iconRef = useRef<HTMLSpanElement>(null);

  const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH);
  const overflowDepth = Math.max(0, depth - MAX_VISUAL_DEPTH);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    paddingLeft: visualDepth * INDENT_STEP + overflowDepth * 2,
    position: "relative",
    opacity: isDragging ? 0.3 : 1,
  };

  const showAbove = dragOverTarget?.id === node.id && dragOverTarget?.position === "above";
  const showBelow = dragOverTarget?.id === node.id && dragOverTarget?.position === "below";
  const isNestTarget = dragOverTarget?.id === node.id && dragOverTarget?.position === "nest";
  const isActive = activePageId === node.id;
  const hasChildren = (node.children?.length ?? 0) > 0;

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      onIconClick(node.id, { top: rect.bottom + 4, left: rect.left });
    }
  };

  return (
    <TreeView.NodeProvider node={node} indexPath={indexPath}>
      <div ref={setNodeRef} style={style} className={depth > 0 ? "page-node-indent" : undefined}>
        {showAbove && !isActive && <div className="h-0.5 bg-accent rounded-[1px] mx-0.5 my-px shadow-[0_0_6px_var(--accent-glow)]" />}

        <TreeView.Branch>
          <TreeView.BranchControl
            className={`page-node${isNestTarget ? " nest-target" : ""}`}
            onClick={(e: React.MouseEvent) => e.preventDefault()}
          >
            <div
              className="page-drag-handle"
              onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
              {...listeners}
              {...attributes}
              title="Drag to move"
            >
              ⋮⋮
            </div>

            <TreeView.BranchIndicator className="page-node-chevron" asChild>
              <span>▶</span>
            </TreeView.BranchIndicator>

            <span
              ref={iconRef}
              className="icon"
              onClick={handleIconClick}
              title="Change icon"
            >
              {page.icon || "📄"}
            </span>

            <TreeView.BranchText className="page-title-text">
              {page.title || "Untitled"}
            </TreeView.BranchText>

            {lockedPageIds.has(page.id) && (
              <span className="page-lock-mini" title="Restricted page" aria-label="Restricted">🔒</span>
            )}

            {page.isFavorite && (
              <span className="page-fav-mini" data-active="true" aria-label="Favorited">★</span>
            )}

            <PageActionMenu
              page={page}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onIconClick={onIconClick}
              iconRef={iconRef}
            />
          </TreeView.BranchControl>

          {hasChildren && (
            <TreeView.BranchContent>
              {node.children!.map((child, i) => (
                <PageTreeNode
                  key={child.id}
                  node={child}
                  indexPath={[...indexPath, i]}
                  pageMap={pageMap}
                  dragOverTarget={dragOverTarget}
                  activePageId={activePageId}
                  onDelete={onDelete}
                  onToggleFavorite={onToggleFavorite}
                  onIconClick={onIconClick}
                  depth={depth + 1}
                  lockedPageIds={lockedPageIds}
                />
              ))}
            </TreeView.BranchContent>
          )}
        </TreeView.Branch>

        {showBelow && !isActive && <div className="h-0.5 bg-accent rounded-[1px] mx-0.5 my-px shadow-[0_0_6px_var(--accent-glow)]" />}
      </div>
    </TreeView.NodeProvider>
  );
}

// ─── PageActionMenu ────────────────────────────────────────────────────────────

interface PageActionMenuProps {
  page: any;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onIconClick: (pageId: string, coords: { top: number; left: number }) => void;
  iconRef: React.RefObject<HTMLSpanElement | null>;
}

function PageActionMenu({ page, onDelete, onToggleFavorite, onIconClick, iconRef }: PageActionMenuProps) {
  return (
    <Menu.Root lazyMount unmountOnExit>
      <Menu.Trigger asChild>
        <button
          className="page-node-action"
          onClick={(e) => e.stopPropagation()}
          title="More actions"
        >
          ⋯
        </button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            className="page-node-menu"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <Menu.Item
              value="favorite"
              className="page-node-menu-item"
              onSelect={() => onToggleFavorite(page.id)}
            >
              {page.isFavorite ? "Remove from favorites" : "Add to favorites"}
            </Menu.Item>
            <Menu.Item
              value="icon"
              className="page-node-menu-item"
              onSelect={() => {
                if (iconRef.current) {
                  const rect = iconRef.current.getBoundingClientRect();
                  onIconClick(page.id, { top: rect.bottom + 4, left: rect.left });
                }
              }}
            >
              Change icon
            </Menu.Item>
            <Menu.Item
              value="delete"
              className="page-node-menu-item page-node-menu-danger"
              onSelect={() => onDelete(page.id)}
            >
              Delete
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
