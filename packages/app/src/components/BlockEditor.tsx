import { useEffect, useRef, useCallback, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { BubbleMenu } from "@tiptap/react";
import { DetailsNode, DetailsSummary, DetailsContent } from "./DetailsExtension.js";
import { BlockNavigationExtension, type BlockNavigationCallbacks } from "./BlockNavigationExtension.js";
import { PageReferenceNode, PageReferenceExtension, createPageReferenceRender } from "./PageReferenceExtension.js";
import { api } from "../rpc-client.js";
import { useStore, usePageStore } from "../store.js";
import { DatabaseView } from "./DatabaseView.js";
import { SlashMenu } from "./SlashMenu.js";
import { DndContext, type DragEndEvent, type DragStartEvent, type DragOverEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragHandle } from "./DragHandle.js";
import { BacklinksPanel } from "./BacklinksPanel.js";
import { EmojiPicker } from "./EmojiPicker.js";
import { PageMenu } from "./PageMenu.js";
import { uploadFile as apiUploadFile, isUploadable } from "../uploader.js";
import { useBlockStore } from "../stores/blockStore.js";

/** Placeholder text shown on empty blocks, keyed by block type. */
function placeholderForType(blockType: string): string {
  switch (blockType) {
    case "heading1": return "Heading 1";
    case "heading2": return "Heading 2";
    case "heading3": return "Heading 3";
    case "blockquote": return "Quote";
    case "code": return "Code";
    case "todo": return "To-do";
    case "bulletList":
    case "numberedList": return "List";
    default: return "Type '/' for commands";
  }
}

/** Shared TipTap extensions — same set for every block editor. */
function sharedExtensions(blockType: string) {
  return [
    StarterKit as any,
    TaskList.configure({ HTMLAttributes: { class: "task-list" } }) as any,
    TaskItem.configure({ nested: true, HTMLAttributes: { class: "task-item" } }) as any,
    HorizontalRule as any,
    Image.configure({ inline: false }) as any,
    Placeholder.configure({
      placeholder: placeholderForType(blockType),
      emptyEditorClass: "is-editor-empty",
    }) as any,
    DetailsNode,
    DetailsContent,
    DetailsSummary,
    PageReferenceNode,
  ];
}

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
      ...sharedExtensions(block.type),
      BlockNavigationExtension.configure({
        blockIndex,
        totalBlocks,
        callbacks,
        blockType: block.type,
      }),
      PageReferenceExtension.configure({
        items: async (query: string) => {
          // Search pages matching the query
          const results = query.length > 0
            ? await api.globalSearch(query)
            : (await api.listPages()).map((p: any) => ({ type: "page" as const, id: p.id, title: p.title, content: "", pageId: p.id }));
          const pages = results.filter((r: any) => r.type === "page").slice(0, 10);
          return pages.map((page: any) => ({
            pageId: page.id,
            pageTitle: page.title,
          }));
        },
        render: createPageReferenceRender,
      }),
    ],
    content: blockContent(block),
    autofocus: false,
    editorProps: {},
    onUpdate: ({ editor: ed }) => {
      detectSlashCommand(ed);
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
    onSelectionUpdate: ({ editor: ed }) => {
      detectSlashCommand(ed);
    },
  });

  /**
   * Scan text immediately before the cursor for a `/word` slash trigger.
   * Reports the query (text after `/`) and screen coords to the parent;
   * parent renders the SlashMenu. Closes when no trigger is present.
   */
  function detectSlashCommand(ed: Editor) {
    try {
      const { from } = ed.state.selection;
      const before = ed.state.doc.textBetween(Math.max(0, from - 60), from, "\n", "\0");
      const match = before.match(/(?:^|\s)\/([\w-]*)$/);
      if (!match) {
        onSlashMenuOpen({ query: "__close__", top: 0, left: 0 });
        return;
      }
      const coords = ed.view.coordsAtPos(from);
      onSlashMenuOpen({
        query: match[1],
        top: coords.bottom + window.scrollY,
        left: coords.left + window.scrollX,
      });
    } catch { /* coordsAtPos may throw mid-transaction */ }
  }

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
    const handlerStripSlash = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.blockId !== block.id || !editor) return;
      const { from } = editor.state.selection;
      const before = editor.state.doc.textBetween(Math.max(0, from - 60), from, "\n", "\0");
      const match = before.match(/\/[\w-]*$/);
      if (match) {
        editor.chain().focus().deleteRange({ from: from - match[0].length, to: from }).run();
      }
    };
    window.addEventListener("block-focus", handler);
    window.addEventListener("block-focus-new", handlerNew);
    window.addEventListener("block-strip-slash", handlerStripSlash);
    return () => {
      window.removeEventListener("block-focus", handler);
      window.removeEventListener("block-focus-new", handlerNew);
      window.removeEventListener("block-strip-slash", handlerStripSlash);
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
    // New format: JSON { src, mimeType, fileName }
    let src: string | null = null;
    let alt = "Block image";
    if (block.content?.startsWith("{")) {
      try {
        const data = JSON.parse(block.content);
        src = data.src;
        alt = data.fileName || alt;
      } catch { /* fall through */ }
    }
    if (!src) {
      // Legacy HTML format
      const srcMatch = block.content?.match(/src=["']([^"']+)["']/);
      if (srcMatch) src = srcMatch[1];
    }
    if (src) {
      return <img src={src} alt={alt} className="block-image" style={{ maxWidth: "100%", borderRadius: 4, display: "block", margin: "4px 0" }} />;
    }
    return <div className="block-image-placeholder">Click to add image</div>;
  }

  if (block.type === "pdf") {
    let src: string | null = null;
    let fileName = "document.pdf";
    if (block.content?.startsWith("{")) {
      try {
        const data = JSON.parse(block.content);
        src = data.src;
        fileName = data.fileName || fileName;
      } catch { /* fall through */ }
    }
    if (!src) {
      return <div className="block-image-placeholder">PDF not found</div>;
    }
    return (
      <div className="block-pdf">
        <div className="block-pdf-header">
          <span>📄 {fileName}</span>
          <a href={src} target="_blank" rel="noopener noreferrer">Open</a>
        </div>
        <iframe src={src} title={fileName} className="block-pdf-frame" />
      </div>
    );
  }

  if (block.type === "database") {
    return null;
  }

  return (
    <div className="block-node" data-block-index={blockIndex} data-block-type={block.type}>
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100, placement: "top" }}>
          <div className="bubble-menu">
            <button onClick={() => (editor.chain().focus() as any).toggleBold().run()} className={editor.isActive("bold") ? "active" : ""} title="Bold (Cmd+B)"><b>B</b></button>
            <button onClick={() => (editor.chain().focus() as any).toggleItalic().run()} className={editor.isActive("italic") ? "active" : ""} title="Italic (Cmd+I)"><i>I</i></button>
            <button onClick={() => (editor.chain().focus() as any).toggleStrike().run()} className={editor.isActive("strike") ? "active" : ""} title="Strikethrough"><s>S</s></button>
            <button onClick={() => (editor.chain().focus() as any).toggleCode().run()} className={editor.isActive("code") ? "active" : ""} title="Inline code"><code>{"<>"}</code></button>
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

/** Drop indicator between blocks during drag. */
function DropIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return <div className="drop-indicator" />;
}

/**
 * Block-level link to another page. Two states:
 *   - targetPageId set → render a clickable card; click navigates.
 *   - targetPageId empty (just-inserted from /page slash command) → open
 *     a small inline picker so the user immediately chooses a page; the
 *     selection is persisted as the block's content.
 */
function PageLinkBlock({
  blockId, targetPageId, onPick,
}: {
  blockId: string;
  targetPageId: string;
  onPick: (pageId: string) => void | Promise<void>;
}) {
  const pages = usePageStore((s) => s.pages);
  const page = pages.find((p) => p.id === targetPageId);
  const [pickerOpen, setPickerOpen] = useState(targetPageId === "");
  const [query, setQuery] = useState("");

  const navigate = (e: React.MouseEvent) => {
    if (!targetPageId) return;
    e.stopPropagation();
    const url = new URL(window.location.href);
    url.searchParams.set("page", targetPageId);
    window.history.pushState({ pageId: targetPageId }, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (!targetPageId || pickerOpen) {
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
          placeholder="Link to page…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); setPickerOpen(false); }
            else if (e.key === "Enter" && visible[0]) {
              e.preventDefault();
              setPickerOpen(false);
              onPick(visible[0].id);
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
              onClick={() => { setPickerOpen(false); onPick(p.id); }}
            >
              <span>{p.icon || "📄"}</span>
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
      <div className="page-link-block page-link-block--missing" data-block-id={blockId}>
        Page no longer exists
      </div>
    );
  }
  return (
    <a className="page-link-block" href={`?page=${targetPageId}`} onClick={navigate}>
      <span className="page-link-block-icon">{page.icon || "📄"}</span>
      <span className="page-link-block-title">{page.title || "Untitled"}</span>
      <span className="page-link-block-arrow">↗</span>
    </a>
  );
}

/** Sortable wrapper for a single block with drag handle. */
function SortableBlock({
  id,
  children,
  showDropIndicator,
  isDragging,
  onDragStart,
  onInsertBelow,
  blockType,
}: {
  id: string;
  children: React.ReactNode;
  showDropIndicator: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onInsertBelow?: () => void;
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
        <div className="block-gutter">
          <button
            type="button"
            className="block-insert-btn"
            title="Add block below"
            onClick={(e) => { e.stopPropagation(); onInsertBelow?.(); }}
          >
            +
          </button>
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
        </div>
        <div className="block-content">{children}</div>
      </div>
    </div>
  );
}

export function BlockEditor() {
  const { currentPage, blocks, updateBlock, createBlock, deleteBlock, createDatabase, updatePage, setPageIcon, toggleFavorite, databases, loadDatabases, reorderBlocks, reorderDatabases, loadBlocks } = useStore();
  const [uploading, setUploading] = useState(false);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!currentPage) return;
    const list = Array.from(files).filter(isUploadable);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        await apiUploadFile(currentPage.id, file);
      }
      await loadBlocks(currentPage.id);
    } catch (err) {
      console.error("Upload failed:", err);
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }, [currentPage, loadBlocks]);
  const [iconPickerAnchor, setIconPickerAnchor] = useState<{ top: number; left: number } | null>(null);
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

  // Sorted blocks. Keep `database`-typed blocks so they render at their
  // inline position; the block's `content` is the dbId of the database to
  // show there. Databases attached to the page that aren't pointed at by
  // any inline block fall through to the orphan list further down so the
  // user can still see them.
  const sortedBlocks = [...blocks].sort((a, b) => a.index - b.index);
  const inlineDbIds = new Set(
    blocks.filter((b) => b.type === "database").map((b) => b.content)
  );

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

  /** Focus a block by ID once its editor has mounted. */
  const focusBlockWhenReady = (blockId: string, cursorPosition: "start" | "end" = "start") => {
    let tries = 0;
    const tick = () => {
      window.dispatchEvent(new CustomEvent("block-focus", {
        detail: { blockId, cursorPosition },
      }));
      tries += 1;
      // Editor may not have mounted yet on first dispatch; retry a few times.
      if (tries < 6) setTimeout(tick, 30);
    };
    tick();
  };

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
    const newBlock = await createBlock({
      pageId: currentPage.id,
      type: newType,
      content: finalAfter,
      index: current.index + 1,
      parentId: null,
    });

    if (newBlock?.id) focusBlockWhenReady(newBlock.id, "start");
  }, [sortedBlocks, currentPage, updateBlock, createBlock]);

  /** Insert a new empty paragraph after this block. */
  const insertBlockAfter = useCallback(async (blockIndex: number) => {
    const current = sortedBlocks[blockIndex];
    if (!current || !currentPage) return;

    const newBlock = await createBlock({
      pageId: currentPage.id,
      type: "paragraph",
      content: "<p></p>",
      index: current.index + 1,
      parentId: null,
    });

    if (newBlock?.id) focusBlockWhenReady(newBlock.id, "start");
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

    // Remove the trailing `/query` from the block before applying the command.
    window.dispatchEvent(new CustomEvent("block-strip-slash", {
      detail: { blockId: currentBlock.id },
    }));

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
    } else if (command === "pageLink") {
      // Insert an empty pageLink block; PageLinkBlock auto-opens a picker
      // for blocks with no target yet, and persists the selected pageId.
      await createBlock({
        pageId: currentPage.id,
        type: "pageLink",
        content: "",
        index: currentBlock.index + 1,
        parentId: null,
      });
    }
  }, [currentPage, sortedBlocks, updateBlock, createBlock, createDatabase, loadDatabases]);

  // ── Title editing ─────────────────────────────────────────────────
  const handleTitleSave = async () => {
    if (currentPage && titleValue !== currentPage.title) {
      await updatePage(currentPage.id, { title: titleValue });
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

    // Calculate new interleaved order
    const newItems = [...allItems];
    const [movedItem] = newItems.splice(oldIndex, 1);
    newItems.splice(newIndex, 0, movedItem);

    // Extract new order for blocks and databases separately
    const newBlockOrder = newItems.filter((item) => item.type !== "database").map((item) => item.id);
    const newDbOrder = newItems.filter((item) => item.type === "database").map((item) => item.id.replace("db-", ""));

    // Persist both orders
    await reorderBlocks(currentPage.id, newBlockOrder);
    if (newDbOrder.length > 0) {
      await reorderDatabases(currentPage.id, newDbOrder);
    }
  };

  // Build combined items list. Databases already pointed at by an inline
  // `database` block are skipped here so we don't double-render them
  // (once inline, once at the bottom). Anything left over is appended.
  const orphanDatabases = databases.filter((db) => !inlineDbIds.has(db.id));
  const allItems = [...sortedBlocks, ...orphanDatabases.map((db) => ({
    id: `db-${db.id}`,
    type: "database" as const,
    index: orphanDatabases.indexOf(db) + sortedBlocks.length,
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
        <div
          className="main"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            if (e.dataTransfer.files.length > 0) {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }
          }}
          onPaste={(e) => {
            const files: File[] = [];
            for (const item of Array.from(e.clipboardData.items)) {
              const f = item.getAsFile();
              if (f && isUploadable(f)) files.push(f);
            }
            if (files.length > 0) {
              e.preventDefault();
              handleFiles(files);
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {uploading && <div className="upload-toast">Uploading…</div>}

          <div className="page-header">
            <button
              className="page-icon-btn"
              title="Change icon"
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setIconPickerAnchor({ top: rect.bottom + 4, left: rect.left });
              }}
            >
              {currentPage.icon || "📄"}
            </button>
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
            <button
              className="page-fav-btn"
              title={currentPage.isFavorite ? "Unfavorite" : "Add to favorites"}
              onClick={() => toggleFavorite(currentPage.id)}
            >
              {currentPage.isFavorite ? "★" : "☆"}
            </button>
            <PageMenu pageId={currentPage.id} />
          </div>
          <EmojiPicker
            open={iconPickerAnchor !== null}
            anchor={iconPickerAnchor}
            onClose={() => setIconPickerAnchor(null)}
            onSelect={(icon) => setPageIcon(currentPage.id, icon)}
          />


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

              // Inline database block: block.content holds the dbId, look up
              // the database and render it at this position in the body.
              if (block.type === "database") {
                const db = databases.find((d) => d.id === block.content);
                if (!db) return null;
                return (
                  <SortableBlock
                    key={block.id}
                    id={block.id}
                    showDropIndicator={dropIndicatorIndex === index}
                    isDragging={activeBlockId === block.id}
                    onDragStart={() => setActiveBlockId(block.id)}
                    blockType="database"
                  >
                    <DatabaseView database={db} isNew={db.id === newDbId} />
                  </SortableBlock>
                );
              }

              // Page-link block: block.content is the target pageId. Renders
              // as a clickable row (icon + title) that navigates on click.
              if (block.type === "pageLink") {
                return (
                  <SortableBlock
                    key={block.id}
                    id={block.id}
                    showDropIndicator={dropIndicatorIndex === index}
                    isDragging={activeBlockId === block.id}
                    onDragStart={() => setActiveBlockId(block.id)}
                    onInsertBelow={() => insertBlockAfter(sortedBlocks.indexOf(block))}
                    blockType="pageLink"
                  >
                    <PageLinkBlock
                      blockId={block.id}
                      targetPageId={block.content}
                      onPick={(pid) => updateBlock(block.id, pid)}
                    />
                  </SortableBlock>
                );
              }

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
                  onInsertBelow={() => insertBlockAfter(blockIndex)}
                  blockType={block.type}
                >
                  <SingleBlockEditor
                    block={block}
                    blockIndex={blockIndex}
                    totalBlocks={sortedBlocks.length}
                    callbacks={callbacks}
                    onSlashMenuOpen={(data) => {
                      if (data.query === "__close__") {
                        setSlashMenu((m) => m.show ? { ...m, show: false } : m);
                      } else {
                        setSlashMenu({ show: true, query: data.query, top: data.top, left: data.left, blockIndex: blockIndex });
                      }
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

          {/* Backlinks Panel */}
          <BacklinksPanel />

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
  { id: "pageLink", name: "Link to page", icon: "🔗", shortcut: "/page" },
];
