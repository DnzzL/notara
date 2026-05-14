import { useEffect, useRef, useCallback, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import { DetailsNode, DetailsSummary, DetailsContent } from "./DetailsExtension.js";
import { BlockNavigationExtension, type BlockNavigationCallbacks } from "./BlockNavigationExtension.js";
import { useStore } from "../store.js";
import { DatabaseView } from "./DatabaseView.js";
import { SlashMenu } from "./SlashMenu.js";
import { DndContext, type DragEndEvent, type DragStartEvent, type DragOverEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragHandle } from "./DragHandle.js";

/** Shared TipTap extensions — same set for every block editor. */
const SHARED_EXTENSIONS = [
  StarterKit as any,
  TaskList.configure({ HTMLAttributes: { class: "task-list" } }) as any,
  TaskItem.configure({ nested: true, HTMLAttributes: { class: "task-item" } }) as any,
  HorizontalRule as any,
  Image.configure({ inline: false }) as any,
  DetailsNode,
  DetailsContent,
  DetailsSummary,
];

/** Map a block type to its default HTML content when empty. */
function defaultContentForType(type: string): string {
  switch (type) {
    case "heading1": return "<h1></h1>";
    case "heading2": return "<h2></h2>";
    case "heading3": return "<h3></h3>";
    case "bulletList": return "<ul><li></li></ul>";
    case "numberedList": return "<ol><li></li></ol>";
    case "todo": return '<ul class="task-list"><li data-checked="false"></li></ul>';
    case "code": return "<pre><code></code></pre>";
    case "blockquote": return "<blockquote></blockquote>";
    default: return "<p></p>";
  }
}

/** Content to render for the block. */
function blockContent(block: { type: string; content: string }): string {
  return block.content || defaultContentForType(block.type);
}

/** Extract text from HTML by stripping tags. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/** Extract heading level from HTML string. */
function getHeadingLevel(html: string): string {
  const m = html.match(/<h(\d)/);
  return m ? m[1] : "1";
}

/** A single block with its own TipTap editor instance. */
function SingleBlockEditor({
  block,
  blockIndex,
  totalBlocks,
  callbacks,
  onSlashMenuOpen,
}: {
  block: { id: string; type: string; content: string; index: number };
  blockIndex: number;
  totalBlocks: number;
  callbacks: BlockNavigationCallbacks;
  onSlashMenuOpen: (data: { query: string; top: number; left: number }) => void;
}) {
  const savingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contentRef = useRef(block.content);
  contentRef.current = block.content;

  const editor = useEditor({
    extensions: [
      ...SHARED_EXTENSIONS,
      BlockNavigationExtension.configure({
        blockIndex,
        totalBlocks,
        callbacks,
        blockType: block.type,
      }),
    ],
    content: blockContent(block),
    autofocus: false,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (event.key === "/") {
          setTimeout(() => {
            try {
              const pos = editor?.state?.selection?.from ?? 0;
              const coords = editor?.view.coordsAtPos(pos);
              if (coords) {
                onSlashMenuOpen({
                  query: "",
                  top: coords.bottom + window.scrollY,
                  left: coords.left + window.scrollX,
                });
              }
            } catch { /* coordsAtPos may throw */ }
          }, 0);
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (savingRef.current) return;
      savingRef.current = true;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const html = ed.getHTML();
        if (html !== contentRef.current) {
          callbacks.updateBlock?.(block.id, html);
        }
        savingRef.current = false;
      }, 500);
    },
  });

  // Focus this editor when a block-focus event targets this block
  // Also handle block-focus-new for newly created blocks (focused by index)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.blockId === block.id && editor) {
        if (detail.cursorPosition === "end") {
          const end = Math.max(1, editor.state.doc.content.size - 1);
          editor.commands.setTextSelection(end);
        } else {
          editor.commands.setTextSelection(1);
        }
        editor.commands.focus();
      }
    };
    const handlerNew = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Focus by index for newly created blocks
      if (detail.index === blockIndex && editor) {
        if (detail.cursorPosition === "end") {
          const end = Math.max(1, editor.state.doc.content.size - 1);
          editor.commands.setTextSelection(end);
        } else {
          editor.commands.setTextSelection(1);
        }
        editor.commands.focus();
      }
    };
    window.addEventListener("block-focus", handler);
    window.addEventListener("block-focus-new", handlerNew);
    return () => {
      window.removeEventListener("block-focus", handler);
      window.removeEventListener("block-focus-new", handlerNew);
    };
  }, [block.id, blockIndex, editor]);

  // Sync content when block changes externally (merge/split)
  useEffect(() => {
    if (!editor) return;
    const expected = blockContent(block);
    const current = editor.getHTML();
    if (current !== expected) {
      editor.commands.setContent(expected);
    }
  }, [block.id, block.content, editor]);

  // Non-editable block types
  if (block.type === "divider") {
    return <hr className="block-divider" />;
  }

  if (block.type === "image") {
    const srcMatch = block.content?.match(/src="([^"]+)"/);
    if (srcMatch) {
      return <img src={srcMatch[1]} alt="Block image" className="block-image" />;
    }
    return <div className="block-image-placeholder">Click to add image</div>;
  }

  if (block.type === "database") {
    return null;
  }

  return (
    <div className="block-node" data-block-index={blockIndex} data-block-type={block.type}>
      <EditorContent editor={editor} />
    </div>
  );
}

/** Drop indicator between blocks during drag. */
function DropIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return <div className="drop-indicator" />;
}

/** Sortable wrapper for a single block with drag handle. */
function SortableBlock({
  id,
  children,
  showDropIndicator,
  isDragging,
  onDragStart,
  blockType,
}: {
  id: string;
  children: React.ReactNode;
  showDropIndicator: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  blockType: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id,
    disabled: false,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-block-wrapper" data-block-type={blockType}>
      <DropIndicator active={showDropIndicator} />
      <div className={`block-container ${isDragging || isSortableDragging ? "block-dragging" : ""}`}>
        <div
          className="drag-handle-wrapper"
          onMouseDown={(e) => {
            e.stopPropagation();
            onDragStart();
          }}
          {...listeners}
          {...attributes}
        >
          <DragHandle onDragStart={onDragStart} testId={`drag-handle-${id}`} />
        </div>
        <div className="block-content">{children}</div>
      </div>
    </div>
  );
}

export function BlockEditor() {
  const { currentPage, blocks, updateBlock, createBlock, deleteBlock, createDatabase, updatePage, databases, loadDatabases, reorderBlocks } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [slashMenu, setSlashMenu] = useState<{ show: boolean; query: string; top: number; left: number; blockIndex: number }>({
    show: false, query: "", top: 0, left: 0, blockIndex: 0,
  });
  const [newDbId, setNewDbId] = useState<string | null>(null);

  // Drag-drop state
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  const dragCancelRequested = useRef(false);

  // Pointer sensor for drag-drop - prevent text selection during drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // Sorted blocks (filter out database blocks - they render separately)
  const sortedBlocks = [...blocks]
    .filter((b) => b.type !== "database")
    .sort((a, b) => a.index - b.index);

  // ── Inter-block operations ────────────────────────────────────────

  /** Move focus to target block. */
  const navigateToBlock = useCallback((targetIndex: number, cursorPosition: "start" | "end") => {
    const targetBlock = sortedBlocks[targetIndex];
    if (targetBlock) {
      window.dispatchEvent(new CustomEvent("block-focus", {
        detail: { blockId: targetBlock.id, cursorPosition },
      }));
    }
  }, [sortedBlocks]);

  /** Merge current block with previous. */
  const mergeWithPrevious = useCallback(async (blockIndex: number) => {
    if (blockIndex <= 0) return;
    const current = sortedBlocks[blockIndex];
    const prev = sortedBlocks[blockIndex - 1];
    if (!current || !prev) return;

    // Extract text content from both blocks and merge
    const prevText = stripHtml(prev.content || defaultContentForType(prev.type));
    const currentText = stripHtml(current.content || defaultContentForType(current.type));
    const mergedText = prevText + currentText;

    // Preserve the previous block's type
    let mergedHtml: string;
    if (prev.type.startsWith("heading")) {
      const level = getHeadingLevel(prev.content || defaultContentForType(prev.type));
      mergedHtml = `<h${level}>${mergedText}</h${level}>`;
    } else if (prev.type === "blockquote") {
      mergedHtml = `<blockquote>${mergedText}</blockquote>`;
    } else if (prev.type === "code") {
      mergedHtml = `<pre><code>${mergedText}</code></pre>`;
    } else {
      mergedHtml = `<p>${mergedText}</p>`;
    }

    await updateBlock(prev.id, mergedHtml);
    await deleteBlock(current.id);

    // Focus the previous block at the merge point
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("block-focus", {
        detail: { blockId: prev.id, cursorPosition: "end" },
      }));
    }, 50);
  }, [sortedBlocks, updateBlock, deleteBlock]);

  /** Split the current block. beforeContent stays, afterContent becomes new block. */
  const splitBlock = useCallback(async (blockIndex: number, beforeContent: string, afterContent: string, newBlockType?: string) => {
    const current = sortedBlocks[blockIndex];
    if (!current || !currentPage) return;

    // Update current block with before content
    const finalBefore = beforeContent || defaultContentForType(current.type);
    await updateBlock(current.id, finalBefore);

    // Create new block with after content
    const newType = newBlockType || "paragraph";
    const finalAfter = afterContent || defaultContentForType(newType);
    await createBlock({
      pageId: currentPage.id,
      type: newType,
      content: finalAfter,
      index: current.index + 1,
      parentId: null,
    });

    // Focus the new block after it's created
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("block-focus-new", {
        detail: { index: blockIndex + 1, cursorPosition: "start" },
      }));
    }, 100);
  }, [sortedBlocks, currentPage, updateBlock, createBlock]);

  /** Insert a new empty paragraph after this block. */
  const insertBlockAfter = useCallback(async (blockIndex: number) => {
    const current = sortedBlocks[blockIndex];
    if (!current || !currentPage) return;

    await createBlock({
      pageId: currentPage.id,
      type: "paragraph",
      content: "<p></p>",
      index: current.index + 1,
      parentId: null,
    });

    // Focus the new block
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("block-focus-new", {
        detail: { index: blockIndex + 1, cursorPosition: "start" },
      }));
    }, 100);
  }, [sortedBlocks, currentPage, createBlock]);

  /** Update a block's content (for debounced saves). */
  const handleUpdateBlock = useCallback(async (id: string, content: string) => {
    await updateBlock(id, content);
  }, [updateBlock]);

  // ── Slash command handling ────────────────────────────────────────
  const handleSlashCommand = useCallback(async (command: string, blockIndex: number) => {
    if (!currentPage) return;
    setSlashMenu((m) => ({ ...m, show: false }));

    const currentBlock = sortedBlocks[blockIndex];
    if (!currentBlock) return;

    if (command === "database") {
      const db = await createDatabase(currentPage.id, "Untitled");
      await loadDatabases(currentPage.id);
      setNewDbId(db.id);
    } else if (command === "heading1") {
      await updateBlock(currentBlock.id, "<h1></h1>");
    } else if (command === "heading2") {
      await updateBlock(currentBlock.id, "<h2></h2>");
    } else if (command === "heading3") {
      await updateBlock(currentBlock.id, "<h3></h3>");
    } else if (command === "quote") {
      await updateBlock(currentBlock.id, "<blockquote></blockquote>");
    } else if (command === "callout") {
      await updateBlock(currentBlock.id, '<details open=""><summary>Toggle</summary><div data-details-content=""><p></p></div></details>');
    } else if (command === "divider") {
      await createBlock({
        pageId: currentPage.id, type: "divider", content: "", index: currentBlock.index + 1, parentId: null,
      });
    } else if (command === "todo") {
      await updateBlock(currentBlock.id, '<ul class="task-list"><li data-checked="false"></li></ul>');
    } else if (command === "toggle") {
      await updateBlock(currentBlock.id, '<details open=""><summary>Toggle</summary><div data-details-content=""><p></p></div></details>');
    } else if (command === "bullet") {
      await updateBlock(currentBlock.id, "<ul><li></li></ul>");
    } else if (command === "numbered") {
      await updateBlock(currentBlock.id, "<ol><li></li></ol>");
    } else if (command === "code") {
      await updateBlock(currentBlock.id, "<pre><code></code></pre>");
    } else if (command === "image") {
      fileInputRef.current?.click();
    }
  }, [currentPage, sortedBlocks, updateBlock, createBlock, createDatabase, loadDatabases]);

  // ── Title editing ─────────────────────────────────────────────────
  const handleTitleSave = async () => {
    if (currentPage && titleValue !== currentPage.title) {
      await updatePage(currentPage.id, titleValue);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleTitleSave(); }
    else if (e.key === "Escape") { setIsEditingTitle(false); }
  };

  // ── Drag-Drop handlers ──────────────────────────────────────────────

  /** Determine converted type when a block is dragged to a new position. */
  function getConvertedType(draggedType: string, targetIndex: number, allBlocks: typeof sortedBlocks): string {
    if (targetIndex < 0 || targetIndex >= allBlocks.length) return draggedType;

    const prevBlock = allBlocks[targetIndex - 1];
    const nextBlock = allBlocks[targetIndex + 1];

    // Check if dropping into a list context
    const prevIsList = prevBlock && (prevBlock.type === "bulletList" || prevBlock.type === "numberedList");
    const nextIsList = nextBlock && (nextBlock.type === "bulletList" || nextBlock.type === "numberedList");

    if (prevIsList || nextIsList) {
      const listType = prevIsList ? prevBlock!.type : nextBlock!.type;
      if (draggedType === "paragraph" || draggedType === "heading1" || draggedType === "heading2" || draggedType === "heading3") {
        return listType;
      }
    }

    // Check if dropping out of a list context
    const isListType = draggedType === "bulletList" || draggedType === "numberedList";
    if (isListType && !prevIsList && !nextIsList) {
      return "paragraph";
    }

    return draggedType;
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveBlockId(active.id as string);
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    if (!over || !currentPage) return;

    const overId = String(over.id);
    const overIndex = allItems.findIndex((item) => item.id === overId);
    if (overIndex >= 0) {
      setDropIndicatorIndex(overIndex);
    }
  };

  const handleDragCancel = () => {
    setActiveBlockId(null);
    setDropIndicatorIndex(null);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveBlockId(null);
    setDropIndicatorIndex(null);

    if (!over || !currentPage) return;
    if (active.id === over.id) return;

    const oldIndex = allItems.findIndex((item) => item.id === active.id);
    const newIndex = allItems.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Get the block being dragged
    const draggedBlock = sortedBlocks.find((b) => b.id === active.id);
    if (!draggedBlock) return;

    // Calculate new order
    const newItems = [...allItems];
    const [movedItem] = newItems.splice(oldIndex, 1);
    newItems.splice(newIndex, 0, movedItem);

    // Extract block IDs for reorder API
    const newBlockOrder = newItems.filter((item) => item.type === "block").map((item) => item.id);

    // Call reorder API
    await reorderBlocks(currentPage.id, newBlockOrder);

    // Handle list conversion: if block type needs to change based on new context
    const reorderedBlockTypes = newItems.filter((item) => item.type === "block");
    const convertedType = getConvertedType(draggedBlock.type, newIndex, reorderedBlockTypes);
    if (convertedType !== draggedBlock.type) {
      // Convert the block type
      const defaultHtml = defaultContentForType(convertedType);
      const currentText = stripHtml(draggedBlock.content || defaultContentForType(draggedBlock.type));
      let newHtml: string;
      if (convertedType.startsWith("heading")) {
        const level = getHeadingLevel(draggedBlock.content || defaultContentForType(draggedBlock.type));
        newHtml = `<h${level}>${currentText}</h${level}>`;
      } else {
        newHtml = defaultHtml.replace(/>$/, `>${currentText}</`).replace(defaultHtml.match(/<\/\w+>/)?.[0] || "", "");
        // Simpler approach: just use default content with text inserted
        const tag = convertedType === "bulletList" ? "ul" : convertedType === "numberedList" ? "ol" : "p";
        newHtml = `<${tag}><li>${currentText}</li></${tag}>`;
      }
      await updateBlock(draggedBlock.id, newHtml);
    }
  };

  // Build combined items list (blocks + databases) for drag-drop
  const allItems = [...sortedBlocks, ...databases.map((db) => ({
    id: `db-${db.id}`,
    type: "database" as const,
    index: databases.indexOf(db) + sortedBlocks.length,
  }))];

  if (!currentPage) {
    return (
      <div className="empty-state">
        <div><h2>Welcome</h2><p>Select a page from the sidebar or create a new one</p></div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="main">
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} />

          {isEditingTitle ? (
            <input
              type="text" className="page-title-input" value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)} onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown} autoFocus placeholder="Page title..."
            />
          ) : (
            <h1 className="page-title" onClick={() => { setIsEditingTitle(true); setTitleValue(currentPage.title || ""); }} style={{ cursor: "pointer" }}>
              {currentPage.title || "Untitled"}
            </h1>
          )}

          <div className="editor">
            {allItems.map((item, index) => {
              if (item.type === "database") {
                const db = databases.find((d) => `db-${d.id}` === item.id);
                if (!db) return null;
                return (
                  <SortableBlock
                    key={item.id}
                    id={item.id}
                    showDropIndicator={dropIndicatorIndex === index}
                    isDragging={activeBlockId === item.id}
                    onDragStart={() => setActiveBlockId(item.id)}
                    blockType="database"
                  >
                    <DatabaseView database={db} isNew={db.id === newDbId} />
                  </SortableBlock>
                );
              }

              const block = sortedBlocks.find((b) => b.id === item.id);
              if (!block) return null;
              const blockIndex = sortedBlocks.indexOf(block);
              const callbacks: BlockNavigationCallbacks = {
                navigateToBlock: (targetIdx, cursorPos) => navigateToBlock(targetIdx, cursorPos),
                mergeWithPrevious: () => mergeWithPrevious(blockIndex),
                splitBlock: (before, after, newType) => splitBlock(blockIndex, before, after, newType),
                insertBlockAfter: () => insertBlockAfter(blockIndex),
                updateBlock: handleUpdateBlock,
              };

              return (
                <SortableBlock
                  key={block.id}
                  id={block.id}
                  showDropIndicator={dropIndicatorIndex === index}
                  isDragging={activeBlockId === block.id}
                  onDragStart={() => setActiveBlockId(block.id)}
                  blockType={block.type}
                >
                  <SingleBlockEditor
                    block={block}
                    blockIndex={blockIndex}
                    totalBlocks={sortedBlocks.length}
                    callbacks={callbacks}
                    onSlashMenuOpen={(data) => {
                      setSlashMenu({ show: true, query: data.query, top: data.top, left: data.left, blockIndex: blockIndex });
                    }}
                  />
                </SortableBlock>
              );
            })}

            {/* Empty state: no blocks yet */}
            {sortedBlocks.length === 0 && databases.length === 0 && (
              <div
                className="block-node empty-block"
                onClick={async () => {
                  await createBlock({
                    pageId: currentPage.id, type: "paragraph", content: "<p></p>", index: 0, parentId: null,
                  });
                }}
                style={{ cursor: "text" }}
              >
                Click here or press '/' to start editing...
              </div>
            )}

            {/* Slash Command Menu */}
            {slashMenu.show && (
              <SlashMenu
                commands={slashCommands}
                query={slashMenu.query}
                position={{ top: slashMenu.top, left: slashMenu.left }}
                onSelect={(cmd) => handleSlashCommand(cmd, slashMenu.blockIndex)}
                onClose={() => setSlashMenu((m) => ({ ...m, show: false }))}
              />
            )}
          </div>

          <DragOverlay>
            {activeBlockId ? (
              <div className="drag-overlay">
                {(() => {
                  const block = sortedBlocks.find((b) => b.id === activeBlockId);
                  if (block) return <div className="drag-preview">{block.type}</div>;
                  const db = databases.find((d) => `db-${d.id}` === activeBlockId);
                  if (db) return <div className="drag-preview">Database: {db.name}</div>;
                  return null;
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </div>
      </SortableContext>
    </DndContext>
  );
}

const slashCommands = [
  { id: "image", name: "Image", icon: "🖼️", shortcut: "/image" },
  { id: "heading1", name: "Heading 1", icon: "H1", shortcut: "#" },
  { id: "heading2", name: "Heading 2", icon: "H2", shortcut: "##" },
  { id: "heading3", name: "Heading 3", icon: "H3", shortcut: "###" },
  { id: "quote", name: "Quote", icon: "\" ", shortcut: "\"" },
  { id: "callout", name: "Callout", icon: "💡", shortcut: "/callout" },
  { id: "divider", name: "Divider", icon: "—", shortcut: "---" },
  { id: "todo", name: "Todo List", icon: "☐", shortcut: "[]" },
  { id: "toggle", name: "Toggle", icon: "▶", shortcut: "/toggle" },
  { id: "bullet", name: "Bullet List", icon: "•", shortcut: "-" },
  { id: "numbered", name: "Numbered List", icon: "1.", shortcut: "1." },
  { id: "code", name: "Code Block", icon: "</>", shortcut: "```" },
  { id: "database", name: "Database", icon: "🗃️", shortcut: "/database" },
];
