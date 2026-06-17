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

const SIDEBAR_WIDTH_KEY = "notara:sidebarWidth";
const SIDEBAR_COLLAPSED_KEY = "notara:sidebarCollapsed";
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 260;

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  onStartTour?: () => void;
}

export function Sidebar({ className, onNavigate, onStartTour }: SidebarProps = {}) {
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
  const [dragOverTarget, setDragOverTarget] = useState<{ id: string; isNest: boolean } | null>(null);
  const isAltHeldRef = useRef(false);

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

  // Track Alt/Option key during drag for nesting
  useEffect(() => {
    if (!activePageId) {
      isAltHeldRef.current = false;
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        isAltHeldRef.current = true;
        setDragOverTarget((prev) => (prev ? { ...prev, isNest: true } : null));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        isAltHeldRef.current = false;
        setDragOverTarget((prev) => (prev ? { ...prev, isNest: false } : null));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [activePageId]);

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

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActivePageId(active.id as string);
  };

  const handleDragCancel = () => {
    setActivePageId(null);
    setDragOverTarget(null);
  };

  const handleDragOver = useCallback(({ over }: DragOverEvent) => {
    if (!over) {
      setDragOverTarget(null);
      return;
    }
    setDragOverTarget({ id: String(over.id), isNest: isAltHeldRef.current });
  }, []);

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActivePageId(null);
      setDragOverTarget(null);

      if (!over || active.id === over.id) return;

      const draggedId = String(active.id);
      const overId = String(over.id);

      const draggedPage = filtered.find((p) => p.id === draggedId);
      const targetPage = filtered.find((p) => p.id === overId);
      if (!draggedPage || !targetPage) return;

      // Prevent dropping on own descendants
      const descendants = getDescendants(draggedId, pages);
      if (descendants.has(overId)) return;

      if (isAltHeldRef.current) {
        // Nest: move dragged page under target page
        await movePage(draggedId, overId);
        return;
      }

      // Default: reorder as sibling of target (placed before over item)
      const targetParentId = targetPage.parentId ?? null;
      const draggedParentId = draggedPage.parentId ?? null;

      // If dragging across parents, first move to target's parent
      if (draggedParentId !== targetParentId) {
        await movePage(draggedId, targetParentId);
      }

      // Get all siblings of the target parent (from pre-move closure state)
      const siblings = filtered
        .filter((p) => (p.parentId ?? null) === targetParentId)
        .map((p) => p.id);

      // Remove dragged from its current position (no-op if cross-parent move)
      const withoutDragged = siblings.filter((id) => id !== draggedId);

      // Find where to insert: before the over item
      const overIdx = withoutDragged.indexOf(overId);
      if (overIdx === -1) return;

      // Insert dragged before the over item
      const newOrder = [
        ...withoutDragged.slice(0, overIdx),
        draggedId,
        ...withoutDragged.slice(overIdx),
      ];

      await reorderPages(targetParentId, newOrder);
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
      <aside className="w-6 shrink-0 bg-sb border-r border-border-sb flex flex-col items-center pt-3 gap-1" aria-label="Sidebar (collapsed)">
        <button
          className="bg-transparent border-none cursor-pointer text-text-sb-3 text-[13px] px-[5px] py-[3px] rounded-lg transition-[color,background] duration-[var(--t)] ease-[var(--ease)] hover:bg-sb-2 hover:text-text-sb"
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
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={treeOrder} strategy={verticalListSortingStrategy}>
        <aside data-sidebar className={`bg-sb border-r border-border-sb flex flex-col shrink-0 relative min-w-[200px] max-w-[480px]${className ? ` ${className}` : ""}`} style={{ width }}>
          <WorkspaceSwitcher
            onCollapse={() => setCollapsed(true)}
            onOpenBackups={() => setShowSettings(true)}
            onOpenApiKeys={() => setShowApiKeys(true)}
          />
          <div className="sticky top-0 z-[2] bg-sb px-2.5 pt-2.5 pb-[7px] flex flex-col gap-1.5 border-b border-transparent transition-[border-color] duration-[var(--t)] ease-[var(--ease)]">
            <button data-search-trigger className="flex-1 flex items-center justify-between gap-2 px-2.5 py-[7px] border border-border-mid bg-surface rounded cursor-pointer text-[12.5px] text-text-sb-3 transition-[background,border-color,color] duration-[var(--t)] ease-[var(--ease)] hover:border-text hover:text-text-sb-2 [&_kbd]:font-[var(--font-mono)] [&_kbd]:text-[10px] [&_kbd]:text-text-sb-3 [&_kbd]:bg-surface-3 [&_kbd]:border [&_kbd]:border-border [&_kbd]:rounded-[3px] [&_kbd]:px-[5px] [&_kbd]:py-px" onClick={openSearch} title="Open quick search">
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
                      className={`relative px-1 cursor-pointer rounded-lg text-[13px] text-text-sb-2 flex items-center gap-0.5 min-h-[28px] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.045)] hover:text-text-sb ${currentPage?.id === page.id ? "bg-accent-dim! text-accent-2! font-semibold!" : ""}`}
                      onClick={() => { selectPageWithCascade(page); onNavigate?.(); }}
                    >
                      <span className="w-2" />
                      <span className="text-[13px] leading-none shrink-0 cursor-pointer w-[18px] text-center">{page.icon || "📄"}</span>
                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap tracking-[-0.005em]">{page.title || "Untitled"}</span>
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
            <button data-new-page className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-2.5 py-1.5 text-[12.5px] text-text-sb-3 rounded-lg text-left transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.05)] hover:text-text-sb" onClick={handleCreateClick}>
              <span className="text-text-sb-3 text-[14px] w-4 text-center transition-[color] duration-[var(--t)] ease-[var(--ease)]">+</span> New page
            </button>
            <button className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-2.5 py-1.5 text-[12.5px] text-text-sb-3 rounded-lg text-left transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.05)] hover:text-text-sb" onClick={() => setShowImport(true)} title="Import Notion export">
              <span className="text-text-sb-3 text-[14px] w-4 text-center transition-[color] duration-[var(--t)] ease-[var(--ease)]">⤓</span> Import
            </button>
            <button className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-2.5 py-1.5 text-[12.5px] text-text-sb-3 rounded-lg text-left transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.05)] hover:text-text-sb" onClick={() => setShowTrash(true)} title="Trash">
              <span className="text-text-sb-3 text-[14px] w-4 text-center transition-[color] duration-[var(--t)] ease-[var(--ease)]">🗑</span> Trash
            </button>
            <button className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-2.5 py-1.5 text-[12.5px] text-text-sb-3 rounded-lg text-left transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.05)] hover:text-text-sb" onClick={() => onStartTour?.()} title="Help / Onboarding tour">
              <span className="text-text-sb-3 text-[14px] w-4 text-center transition-[color] duration-[var(--t)] ease-[var(--ease)]">?</span> Help
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
              const isNesting = dragOverTarget?.isNest ?? false;
              return (
                <div className="flex items-center gap-1.5 text-[13px] text-text-2 px-1.5 py-1 bg-surface-3 rounded-[5px] border border-border">
                  <span className="icon">{page.icon || "📄"}</span>
                  {page.title || "Untitled"}
                  {isNesting && <span className="text-[10px] font-medium text-accent ml-1 px-1.5 py-0.5 bg-accent-dim/30 rounded-[3px]">Nest</span>}
                </div>
              );
            })()}
          </div>
        ) : null}
      </DragOverlay>

      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} onStartTour={onStartTour} />
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
  dragOverTarget: { id: string; isNest: boolean } | null;
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

  const isHovered = dragOverTarget?.id === node.id;
  const isNestTarget = isHovered && dragOverTarget?.isNest === true;
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
      <div ref={setNodeRef} style={style} className={depth > 0 ? "relative before:content-[''] before:absolute before:left-[7px] before:top-0 before:bottom-0 before:w-px before:bg-border-sb" : undefined}>

        <TreeView.Branch>
          <TreeView.BranchControl
            className={`group relative flex items-center gap-0.5 min-h-[28px] px-1 rounded-lg text-[13px] text-text-sb-2 cursor-pointer transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.045)] hover:text-text-sb${isHovered ? (isNestTarget ? " bg-accent-dim rounded-lg shadow-[0_0_0_2px_var(--accent-mid)]" : " bg-sb-2 rounded-lg") : ""}`}
            onClick={(e: React.MouseEvent) => e.preventDefault()}
          >
            <div
              className="flex items-center justify-center w-4 h-4 cursor-grab opacity-0 transition-opacity duration-[var(--t)] ease-[var(--ease)] shrink-0 rounded-[3px] text-text-sb-3 text-[10px] leading-none select-none group-hover:opacity-100 hover:bg-sb-3 hover:text-text-sb-2 active:cursor-grabbing"
              onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
              {...listeners}
              {...attributes}
              title="Drag to move"
            >
              ⋮⋮
            </div>

            <TreeView.BranchIndicator className="inline-flex items-center justify-center w-3.5 h-3.5 text-[8px] text-text-sb-3 cursor-pointer transition-[transform,color] duration-[var(--t)] ease-[var(--ease)] shrink-0 rounded-[3px] data-[state=open]:rotate-90 data-[state=closed]:rotate-0 hover:text-text-sb-2 hover:bg-sb-2" asChild>
              <span>▶</span>
            </TreeView.BranchIndicator>

            <span
              ref={iconRef}
              className="text-[13px] leading-none shrink-0 cursor-pointer w-[18px] text-center"
              onClick={handleIconClick}
              title="Change icon"
            >
              {page.icon || "📄"}
            </span>

            <TreeView.BranchText className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap tracking-[-0.005em]">
              {page.title || "Untitled"}
            </TreeView.BranchText>

            {lockedPageIds.has(page.id) && (
              <span className="page-lock-mini" title="Restricted page" aria-label="Restricted">🔒</span>
            )}

            {page.isFavorite && (
              <span className="bg-transparent border-none cursor-pointer text-text-sb-3 text-[13px] px-[3px] ml-auto transition-[color] duration-[var(--t)] ease-[var(--ease)] group-hover:visible hover:text-amber-400 data-[active=true]:visible data-[active=true]:text-amber-400 invisible" data-active="true" aria-label="Favorited">★</span>
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
          className="bg-transparent border-none cursor-pointer text-text-sb-3 px-1 py-px text-[14px] leading-none rounded ml-auto opacity-0 transition-opacity duration-[var(--t)] ease-[var(--ease)] shrink-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 hover:bg-sb-3 hover:text-text-sb"
          onClick={(e) => e.stopPropagation()}
          title="More actions"
        >
          ⋯
        </button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            className="bg-surface border border-border-mid rounded-lg shadow-[var(--shadow-lg)] min-w-[210px] p-1.5 z-[200] outline-none! flex flex-col gap-0.5 [animation:modal-pop_0.12s_var(--ease-spring)]"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <Menu.Item
              value="favorite"
              className="flex items-center gap-2.5 w-full bg-transparent border-none text-left px-2.5 py-2 text-[13px] rounded-md cursor-pointer text-text-2 [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text data-[highlighted]:bg-surface-3 data-[highlighted]:text-text data-[highlighted]:outline-none"
              onSelect={() => onToggleFavorite(page.id)}
            >
              <span className="w-4 text-center text-[13px] leading-none shrink-0">{page.isFavorite ? "★" : "☆"}</span>
              {page.isFavorite ? "Remove from favorites" : "Add to favorites"}
            </Menu.Item>
            <Menu.Item
              value="icon"
              className="flex items-center gap-2.5 w-full bg-transparent border-none text-left px-2.5 py-2 text-[13px] rounded-md cursor-pointer text-text-2 [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text data-[highlighted]:bg-surface-3 data-[highlighted]:text-text data-[highlighted]:outline-none"
              onSelect={() => {
                if (iconRef.current) {
                  const rect = iconRef.current.getBoundingClientRect();
                  onIconClick(page.id, { top: rect.bottom + 4, left: rect.left });
                }
              }}
            >
              <span className="w-4 text-center text-[13px] leading-none shrink-0">😀</span>
              Change icon
            </Menu.Item>
            <div role="separator" className="h-px bg-border my-1 -mx-1.5" />
            <Menu.Item
              value="delete"
              className="flex items-center gap-2.5 w-full bg-transparent border-none text-left px-2.5 py-2 text-[13px] rounded-md cursor-pointer text-danger [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-danger-dim hover:text-danger data-[highlighted]:bg-danger-dim data-[highlighted]:text-danger data-[highlighted]:outline-none"
              onSelect={() => onDelete(page.id)}
            >
              <span className="w-4 text-center text-[13px] leading-none shrink-0">🗑</span>
              Delete
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
