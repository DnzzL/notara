import {
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BlockLockedError } from "@notara/shared";
import {
	BubbleMenu,
	type Editor,
	EditorContent,
	useEditor,
} from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ulid } from "ulidx";
import { useSession } from "../auth-client.js";
import { shouldOpenBlockMenu } from "../lib/blockContextMenu.js";
import {
	insertBlockAfter as computeInsertBlockAfter,
	splitBlock as computeSplitBlock,
	mergeBlocks,
} from "../lib/blockDocument.js";
import {
	setFocusedBlock,
	startPresence,
	stopPresence,
} from "../lib/presenceConnection.js";
import { api, getCurrentWorkspaceId } from "../rpc-client.js";
import { useBlockStore, useDatabaseStore, usePageStore } from "../store.js";
import { usePresenceStore } from "../stores/presenceStore.js";
import { toaster } from "../toaster.js";
import { uploadFile as apiUploadFile, isUploadable } from "../uploader.js";
import { BacklinksPanel } from "./BacklinksPanel.js";
import { BlockContextMenu, type BlockMenuItem } from "./BlockContextMenu.js";
import {
	type BlockNavigationCallbacks,
	BlockNavigationExtension,
	detectBlockTypeFromEditor,
} from "./BlockNavigationExtension.js";
import {
	applyFocus,
	consumeFocus,
	requestFocus,
	subscribeFocus,
} from "./blockEditing.js";
import { PageLinkBlock } from "./blocks/page-link-block.js";
import {
	getBlockRenderer,
	hasBlockRenderer,
} from "./blocks/renderer-registry.js";
import { SLASH_COMMANDS } from "./blockTypes.js";
import { DatabaseView } from "./DatabaseView.js";
import { DragHandle } from "./DragHandle.js";
import { EmojiPicker } from "./EmojiPicker.js";
import {
	blockContent,
	defaultContentForType,
	sharedExtensions,
} from "./editorSchema.js";
import { PageMenu } from "./PageMenu.js";
import { PageReferenceExtension } from "./PageReferenceExtension.js";
import { createPageReferenceRender } from "./PageReferenceMenu.js";
import { PresenceAvatars } from "./PresenceAvatars.js";
import { SlashMenu } from "./SlashMenu.js";
import { Button, IconButton } from "./ui/index.js";

// The TipTap schema lives in editorSchema.ts so the public read-only renderer
// can mount it without this file's store, RPC and presence imports. Re-exported
// here because this is where callers have always looked for it.
export {
	blockContent,
	defaultContentForType,
	sharedExtensions,
} from "./editorSchema.js";

/** Extract text from HTML by stripping tags. */
function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

/**
 * Compute the numbered-run index for each block in a sorted list.
 * NumberedList blocks in a consecutive run get 1, 2, 3, ...
 * A non-numbered block mid-run resets the count so the next
 * NumberedList starts at 1 again.
 */
function computeNumberedRunIndices(
	blocks: { id: string; type: string }[],
): Map<string, number> {
	const result = new Map<string, number>();
	let currentRun = 1;

	for (const block of blocks) {
		if (block.type === "numberedList") {
			result.set(block.id, currentRun);
			currentRun++;
		} else {
			currentRun = 1;
		}
	}

	return result;
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
	const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	/**
	 * What the server is known to hold — NOT what the store holds.
	 *
	 * These parted company when the store started following the editor on every
	 * keystroke: comparing against the store then said "no change" for text the
	 * server had never seen, and the save was skipped. Everything looked right
	 * locally and nothing was persisted.
	 */
	const savedContentRef = useRef(block.content);
	// The editor's option callbacks below are bound at mount and never rebound,
	// so anything they read about the block has to come through a ref.
	const blockRef = useRef(block);
	blockRef.current = block;

	const lockedByUserId = usePresenceStore((s) => s.locks.get(block.id) ?? null);
	const lockedByName = usePresenceStore(
		(s) => s.others.find((u) => u.userId === lockedByUserId)?.name ?? null,
	);

	const editor = useEditor({
		extensions: [
			...sharedExtensions(block.type),
			// Configured once and never again: TipTap's `setOptions` fast path (the
			// one `useEditor` takes with empty deps) does not rebuild the extension
			// manager. Only the block's own id is safe to freeze here — everything
			// positional is resolved live, inside the callbacks.
			BlockNavigationExtension.configure({
				blockId: block.id,
				callbacks,
			}),
			PageReferenceExtension.configure({
				items: async (query: string) => {
					// Search pages matching the query
					const results =
						query.length > 0
							? await api.globalSearch({ query })
							: (await api.listPages()).map((p: any) => ({
									type: "page" as const,
									id: p.id,
									title: p.title,
									content: "",
									pageId: p.id,
								}));
					const pageItems = results
						.filter((r: any) => r.type === "page")
						.slice(0, 8)
						.map((page: any) => ({
							pageId: page.id,
							pageTitle: page.title,
							type: "page" as const,
						}));

					// Placeholder person items (display-only until person pages exist)
					const personItems: {
						pageId: string;
						pageTitle: string;
						type: "person";
					}[] = [];
					if (query.length >= 2) {
						personItems.push({
							pageId: `person-placeholder-${query}`,
							pageTitle: query,
							type: "person",
						});
					}

					return { pages: pageItems, people: personItems };
				},
				render: createPageReferenceRender,
			}),
		],
		content: blockContent(block),
		autofocus: false,
		editorProps: {
			// Esc blurs the block (clears the caret and releases the presence lock).
			handleKeyDown: (view, event) => {
				if (event.key === "Escape") {
					(view.dom as HTMLElement).blur();
					return true;
				}
				return false;
			},
		},
		onFocus: () => {
			setFocusedBlock(block.id);
		},
		onBlur: () => {
			setFocusedBlock(null);
		},
		onUpdate: ({ editor: ed }) => {
			detectSlashCommand(ed);
			// Keep the store level with the editor on every keystroke. Everything
			// structural — merge, split, the content-sync effect — reads the store,
			// and letting it trail the debounce below is what made a Backspace
			// right after typing merge a stale line.
			useBlockStore
				.getState()
				.setLocalContent(
					blockRef.current.id,
					ed.getHTML(),
					detectBlockTypeFromEditor(ed),
				);
			clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(async () => {
				const html = ed.getHTML();
				const liveType = detectBlockTypeFromEditor(ed);
				const typeChanged = liveType !== blockRef.current.type;

				// Single update call: persist content, and maybe the block type
				// too (for markdown transforms like `- ` → bulletList so the
				// Enter/Backspace label and behavior update promptly).
				if (html !== savedContentRef.current || typeChanged) {
					savedContentRef.current = html;
					await callbacks.updateBlock?.(
						blockRef.current.id,
						html,
						typeChanged ? liveType : undefined,
					);
				}
			}, 200);
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
			const before = ed.state.doc.textBetween(
				Math.max(0, from - 60),
				from,
				"\n",
				"\0",
			);
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
		} catch {
			/* coordsAtPos may throw mid-transaction */
		}
	}

	// Slash-command editor edits. `block-strip-slash` removes the trailing
	// `/query`; `block-set-content` applies an in-place command's content (the
	// editor is focused, so the content-sync effect below won't do it for us).
	useEffect(() => {
		const handlerStripSlash = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail.blockId !== block.id || !editor) return;
			const { from } = editor.state.selection;
			const before = editor.state.doc.textBetween(
				Math.max(0, from - 60),
				from,
				"\n",
				"\0",
			);
			const match = before.match(/\/[\w-]*$/);
			if (match) {
				editor
					.chain()
					.focus()
					.deleteRange({ from: from - match[0].length, to: from })
					.run();
			}
		};
		const handlerSetContent = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail.blockId !== block.id || !editor) return;
			editor.commands.setContent(detail.content, false);
			// The caller persists the same HTML, so record it as saved rather than
			// let the next keystroke re-send it.
			savedContentRef.current = detail.content;
			// Where the caret lands is the caller's to say: a merge wants it at the
			// seam, a slash command at the end. This is also the only way to update
			// a block that currently HAS the caret — the content-sync effect skips
			// focused editors on purpose, which left a forward-delete showing the
			// pre-merge line while the store held the merged one.
			applyFocus(editor, detail.focus ?? { kind: "end" });
		};
		const handlerRemoteUpdate = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail.blockId !== block.id || !editor) return;
			// Don't overwrite what the user is actively editing.
			if (editor.isFocused) return;
			// emitUpdate=false so the debounced save callback doesn't fire
			// (onUpdate would persist the remote content back to the server).
			editor.commands.setContent(detail.content, false);
			savedContentRef.current = detail.content;
			useBlockStore.getState().setLocalContent(detail.blockId, detail.content);
		};
		window.addEventListener("block-strip-slash", handlerStripSlash);
		window.addEventListener("block-set-content", handlerSetContent);
		window.addEventListener("block-remote-update", handlerRemoteUpdate);
		return () => {
			window.removeEventListener("block-strip-slash", handlerStripSlash);
			window.removeEventListener("block-set-content", handlerSetContent);
			window.removeEventListener("block-remote-update", handlerRemoteUpdate);
		};
	}, [block.id, editor]);

	// Sync content when the block changes externally (merge/split, undo, or a
	// remote edit). Skip only when this block is focused locally: the editor is
	// then the one writing, and the store is level with it either way.
	//
	// There used to be a second guard here, skipping the sync while this block's
	// debounced save was in flight — back when the store trailed the editor by
	// the debounce and could hand back an older line. It also swallowed the
	// merged text a Backspace had just written into this block, leaving the
	// editor showing the pre-merge line and saving it back over the merge.
	useEffect(() => {
		if (!editor) return;
		if (editor.isFocused) return;
		const expected = blockContent(block);
		const current = editor.getHTML();
		if (current !== expected) {
			editor.commands.setContent(expected, false);
		}
	}, [block.id, block.content, editor, block]);

	// Consume pending focus requests. Declared after the content-sync effect so
	// that, on a re-render that updates content (merge/split), the editor already
	// holds the fresh HTML before we place the caret. The store guard prevents
	// acting on stale content when a sync is still pending.
	useEffect(() => {
		if (!editor) return;
		const tryConsume = () => {
			const stored = useBlockStore
				.getState()
				.blocks.find((b) => b.id === block.id);
			if (!stored || editor.getHTML() !== blockContent(stored)) return;
			const target = consumeFocus(block.id);
			if (target) applyFocus(editor, target);
		};
		tryConsume();
		return subscribeFocus(tryConsume);
		// `block.content` is a dependency because a focus request can arrive
		// before the content it belongs to: a merge writes the joined text and
		// asks for the caret at the seam in the same tick, and the guard above
		// refuses to place a caret in an editor that is still showing the
		// pre-merge line. Re-running once the content lands is what lets it in.
	}, [block.id, block.content, editor]);

	// Reflect remote lock: non-editable while another user holds the block.
	useEffect(() => {
		if (!editor) return;
		editor.setEditable(lockedByUserId === null);
	}, [editor, lockedByUserId]);

	// Non-editable block types — delegate to registered renderers.
	if (hasBlockRenderer(block.type)) {
		const Renderer = getBlockRenderer(block.type)!;
		return (
			<Renderer
				block={block as any}
				blockIndex={blockIndex}
				totalBlocks={totalBlocks}
				onUpdateBlock={callbacks.updateBlock as any}
				onDeleteBlock={useBlockStore.getState().deleteBlock}
			/>
		);
	}

	return (
		<div
			className={`block-node ${lockedByUserId ? "block-node--locked" : ""}`}
			data-block-index={blockIndex}
			data-block-type={block.type}
		>
			{/*
        Always mounted (toggled via CSS) so the `.block-node` child list stays
        stable around the ProseMirror-managed `<EditorContent>`. Mounting/
        unmounting this span made React `insertBefore` against the BubbleMenu's
        node, which tippy relocates — crashing remote viewers when a peer
        focuses the block.
      */}
			<span
				className="block-lock-badge"
				title={lockedByName ? `${lockedByName} is editing` : undefined}
				style={lockedByUserId && lockedByName ? undefined : { display: "none" }}
			>
				{lockedByName ? lockedByName.slice(0, 1).toUpperCase() : ""}
			</span>
			{editor && (
				<BubbleMenu
					editor={editor}
					tippyOptions={{ duration: 100, placement: "top" }}
				>
					<div className="bubble-menu">
						<span className="bubble-menu-separator" />
						{/* The format toggles stay raw <button>s on purpose: they are styled as
						    a set by `.bubble-menu button` in styles.css and carry an `.active`
						    pressed state. That is a toolbar, not any of ui/Button's variants —
						    wrapping them would mean inventing a sixth variant for one toolbar. */}
						<button
							onClick={() => (editor.chain().focus() as any).toggleBold().run()}
							className={editor.isActive("bold") ? "active" : ""}
							title="Bold (Cmd+B)"
						>
							<b>B</b>
						</button>
						<button
							onClick={() =>
								(editor.chain().focus() as any).toggleItalic().run()
							}
							className={editor.isActive("italic") ? "active" : ""}
							title="Italic (Cmd+I)"
						>
							<i>I</i>
						</button>
						<button
							onClick={() =>
								(editor.chain().focus() as any).toggleStrike().run()
							}
							className={editor.isActive("strike") ? "active" : ""}
							title="Strikethrough"
						>
							<s>S</s>
						</button>
						<button
							onClick={() => (editor.chain().focus() as any).toggleCode().run()}
							className={editor.isActive("code") ? "active" : ""}
							title="Inline code"
						>
							<code>{"<>"}</code>
						</button>
						<span className="bubble-menu-separator" />
						<button
							onClick={() =>
								editor.chain().focus().toggleHeading({ level: 1 }).run()
							}
							className={
								editor.isActive("heading", { level: 1 }) ? "active" : ""
							}
							title="Heading 1"
						>
							H1
						</button>
						<button
							onClick={() =>
								editor.chain().focus().toggleHeading({ level: 2 }).run()
							}
							className={
								editor.isActive("heading", { level: 2 }) ? "active" : ""
							}
							title="Heading 2"
						>
							H2
						</button>
						<button
							onClick={() =>
								editor.chain().focus().toggleHeading({ level: 3 }).run()
							}
							className={
								editor.isActive("heading", { level: 3 }) ? "active" : ""
							}
							title="Heading 3"
						>
							H3
						</button>
						<button
							onClick={() =>
								(editor.chain().focus() as any).toggleBulletList().run()
							}
							className={editor.isActive("bulletList") ? "active" : ""}
							title="Bullet list"
						>
							•
						</button>
						<button
							onClick={() =>
								(editor.chain().focus() as any).toggleOrderedList().run()
							}
							className={editor.isActive("orderedList") ? "active" : ""}
							title="Numbered list"
						>
							1.
						</button>
						<button
							onClick={() =>
								(editor.chain().focus() as any).toggleBlockquote().run()
							}
							className={editor.isActive("blockquote") ? "active" : ""}
							title="Quote"
						>
							"
						</button>
						<button
							onClick={() =>
								(editor.chain().focus() as any).toggleTaskList().run()
							}
							className={editor.isActive("taskList") ? "active" : ""}
							title="To-do"
						>
							☐
						</button>
						<span className="bubble-menu-separator" />
						<button
							onClick={() => {
								const prevUrl = editor.getAttributes("link").href;
								const url = window.prompt("Enter URL", prevUrl || "https://");
								if (url) {
									(editor.chain().focus() as any)
										.extendMarkRange("link")
										.setLink({ href: url })
										.run();
								}
							}}
							className={editor.isActive("link") ? "active" : ""}
							title="Link"
						>
							🔗
						</button>
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
	return (
		<div className="h-0.5 bg-accent rounded-sm my-0.5 shadow-[0_0_6px_var(--accent-glow)]" />
	);
}

/**
 *   - targetPageId set → render a clickable card; click navigates.
 *   - targetPageId empty (just-inserted from /page slash command) → open
 *     a small inline picker so the user immediately chooses a page; the
 *     selection is persisted as the block's content.
 */
/** Sortable wrapper for a single block with drag handle. */
function SortableBlock({
	id,
	children,
	showDropIndicator,
	isDragging,
	onDragStart,
	onDragAbort,
	onInsertBelow,
	onOpenMenu,
	blockType,
	numberedRun,
	onGutterClick,
}: {
	id: string;
	children: React.ReactNode;
	showDropIndicator: boolean;
	isDragging: boolean;
	onDragStart: () => void;
	onDragAbort?: () => void;
	onInsertBelow?: () => void;
	onOpenMenu?: (x: number, y: number) => void;
	blockType: string;
	numberedRun?: number;
	onGutterClick?: (clientY: number) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging: isSortableDragging,
	} = useSortable({
		id,
		disabled: false,
	});
	const handleDownPos = useRef<{ x: number; y: number } | null>(null);

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isSortableDragging ? 0.3 : 1,
		...(numberedRun != null ? { "--numbered-run": String(numberedRun) } : {}),
	} as React.CSSProperties & { "--numbered-run"?: string };

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="relative flex flex-col data-[block-type=database]:my-2"
			data-block-type={blockType}
			data-block-id={id}
			onContextMenu={(e) => {
				if (!onOpenMenu) return;
				// A database's menu opens from its name only — see shouldOpenBlockMenu.
				// The gutter handle still opens the same menu on desktop.
				if (!shouldOpenBlockMenu(blockType, e.target as HTMLElement)) return;
				e.preventDefault();
				onOpenMenu(e.clientX, e.clientY);
			}}
		>
			<DropIndicator active={showDropIndicator} />
			<div
				className={`group relative flex items-start gap-1 py-px rounded transition-[background] duration-[var(--t)] ease-[var(--ease)] ${isDragging || isSortableDragging ? "shadow-[var(--shadow-lg)] bg-surface rounded scale-[1.012]" : ""}`}
			>
				{/* Gutter click target (AC#2): click left gutter to focus block at nearest caret position */}
				{onGutterClick && (
					<div
						className="absolute inset-y-0 left-0 w-[52px] z-10 cursor-text max-[880px]:hidden"
						onMouseDown={(e) => {
							e.stopPropagation();
							e.preventDefault();
							onGutterClick(e.clientY);
						}}
					/>
				)}
				<div className="flex items-center gap-0 w-12 shrink-0 mt-0.5 opacity-0 transition-opacity duration-[var(--t)] ease-[var(--ease)] group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto relative z-20 max-[880px]:hidden">
					<IconButton
						type="button"
						variant="ghost"
						className="w-[22px] h-[22px] text-[18px]"
						title="Add block below"
						onClick={(e) => {
							e.stopPropagation();
							onInsertBelow?.();
						}}
					>
						+
					</IconButton>
					<div
						className="flex items-center justify-center w-6 h-6 cursor-grab shrink-0 mt-0.5 rounded transition-[background] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 active:cursor-grabbing"
						onMouseDown={(e) => {
							e.stopPropagation();
							handleDownPos.current = { x: e.clientX, y: e.clientY };
							// Set visual drag state immediately so the block shadow/scale
							// appears before dnd-kit activates the drag (8px threshold).
							onDragStart();
						}}
						onMouseUp={(e) => {
							const start = handleDownPos.current;
							handleDownPos.current = null;
							if (!start) return;
							const moved = Math.hypot(
								e.clientX - start.x,
								e.clientY - start.y,
							);
							// dnd-kit's activation constraint is 8px. If the user
							// released before that threshold, ensure the immediate
							// drag-state visual (shadow/scale) from onMouseDown is
							// cleared — handleDragEnd/handleDragCancel won't fire.
							if (moved < 8) {
								onDragAbort?.();
							}
							// Open context menu when the pointer barely moved.
							if (moved < 4 && onOpenMenu) {
								e.stopPropagation();
								const rect = (
									e.currentTarget as HTMLElement
								).getBoundingClientRect();
								onOpenMenu(rect.right + 4, rect.top);
							}
						}}
						title="Click for options, drag to reorder"
						{...listeners}
						{...attributes}
					>
						<DragHandle
							onDragStart={onDragStart}
							testId={`drag-handle-${id}`}
						/>
					</div>
				</div>
				<div className="flex-1 min-w-0">{children}</div>
			</div>
		</div>
	);
}

export function BlockEditor() {
	const currentPage = usePageStore((s) => s.currentPage);
	const updatePage = usePageStore((s) => s.updatePage);
	const setPageIcon = usePageStore((s) => s.setPageIcon);
	const toggleFavorite = usePageStore((s) => s.toggleFavorite);
	const accessDeniedFor = usePageStore((s) => s.accessDeniedFor);
	const blocks = useBlockStore((s) => s.blocks);
	const updateBlock = useBlockStore((s) => s.updateBlock);
	const createBlock = useBlockStore((s) => s.createBlock);
	const deleteBlock = useBlockStore((s) => s.deleteBlock);
	const duplicateBlock = useBlockStore((s) => s.duplicateBlock);
	const reorderBlocks = useBlockStore((s) => s.reorderBlocks);
	const loadBlocks = useBlockStore((s) => s.loadBlocks);
	const databases = useDatabaseStore((s) => s.databases);
	const createDatabase = useDatabaseStore((s) => s.createDatabase);
	const deleteDatabase = useDatabaseStore((s) => s.deleteDatabase);
	const loadDatabases = useDatabaseStore((s) => s.loadDatabases);
	const reorderDatabases = useDatabaseStore((s) => s.reorderDatabases);
	const [uploading, setUploading] = useState(false);
	const { data: session } = useSession();

	// Start a presence session whenever the open page changes.
	useEffect(() => {
		const workspaceId = getCurrentWorkspaceId();
		if (!currentPage || !workspaceId || !session?.user) {
			stopPresence();
			return;
		}
		startPresence({
			workspaceId,
			pageId: currentPage.id,
			selfUserId: session.user.id,
			onBlockUpdated: (blockId, content) => {
				window.dispatchEvent(
					new CustomEvent("block-remote-update", {
						detail: { blockId, content },
					}),
				);
			},
		});
		return () => {
			stopPresence();
		};
	}, [currentPage?.id, session?.user?.id, session?.user, currentPage]);

	const handleFiles = useCallback(
		async (files: FileList | File[]) => {
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
				alert(
					`Upload failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			} finally {
				setUploading(false);
			}
		},
		[currentPage, loadBlocks],
	);
	const [iconPickerAnchor, setIconPickerAnchor] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleValue, setTitleValue] = useState("");
	const [slashMenu, setSlashMenu] = useState<{
		show: boolean;
		query: string;
		top: number;
		left: number;
		/** Which block opened the menu. An id, because the reporting callback is
		    frozen at editor mount and a position would be a render behind. */
		blockId: string;
	}>({
		show: false,
		query: "",
		top: 0,
		left: 0,
		blockId: "",
	});
	const [newDbId, setNewDbId] = useState<string | null>(null);

	// Context menu state
	const [blockMenu, setBlockMenu] = useState<{
		blockId: string;
		x: number;
		y: number;
	} | null>(null);
	// Database blocks aren't real blocks, so they need their own menu. `blockId`
	// is set only for inline database blocks (so we can also drop the placeholder).
	const [dbMenu, setDbMenu] = useState<{
		dbId: string;
		blockId: string | null;
		x: number;
		y: number;
	} | null>(null);

	// Drag-drop state
	const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
	const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(
		null,
	);
	const _dragCancelRequested = useRef(false);

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
		blocks.filter((b) => b.type === "database").map((b) => b.content),
	);

	// ── Inter-block operations ────────────────────────────────────────
	//
	// Every one of these addresses its block by ID and resolves the neighbours
	// from the live store, not from the `sortedBlocks` of the render that
	// created it. Both properties are load-bearing: `useEditor` freezes the
	// callbacks it was configured with at mount (see BlockNavigationExtension),
	// so a closure over an index — or over a snapshot of the block list — keeps
	// pointing at whatever sat there when the block was first rendered. That is
	// how Enter came to rewrite a neighbour and Backspace to delete one.
	//
	// Reading `useBlockStore.getState()` also survives the `await` inside these
	// functions, where a captured array would already be a render behind.

	/** The block list as rendered, straight from the store. */
	const liveBlocks = useCallback(
		() =>
			[...useBlockStore.getState().blocks].sort((a, b) => a.index - b.index),
		[],
	);

	/** A block and its neighbours, by id. */
	const neighbours = useCallback(
		(blockId: string) => {
			const list = liveBlocks();
			const i = list.findIndex((b) => b.id === blockId);
			if (i === -1) return null;
			return { current: list[i], prev: list[i - 1], next: list[i + 1] };
		},
		[liveBlocks],
	);

	/** Move focus to the adjacent block, optionally preserving the caret column. */
	const navigateFrom = useCallback(
		(blockId: string, dir: "prev" | "next", x?: number) => {
			const around = neighbours(blockId);
			const target = dir === "prev" ? around?.prev : around?.next;
			if (!target) return false;
			const edge = dir === "prev" ? "bottom" : "top";
			if (x != null) requestFocus(target.id, { kind: "column", x, edge });
			else requestFocus(target.id, { kind: edge === "top" ? "start" : "end" });
			return true;
		},
		[neighbours],
	);

	/** Merge a block with the one before it, preserving inline formatting. */
	const mergeWithPrevious = useCallback(
		(blockId: string) => {
			const around = neighbours(blockId);
			const current = around?.current;
			const prev = around?.prev;
			if (!current || !prev) return;

			const op = mergeBlocks(prev, current);

			void updateBlock(op.updateBlock.id, op.updateBlock.content);
			void deleteBlock(op.deleteBlockId);
			// Pushed straight into the surviving editor rather than left to the
			// content-sync effect: on a forward-delete that editor is the focused
			// one, and the sync skips focused blocks.
			window.dispatchEvent(
				new CustomEvent("block-set-content", {
					detail: {
						blockId: op.focus.blockId,
						content: op.updateBlock.content,
						focus: { kind: "offset", offset: op.focus.offset },
					},
				}),
			);
		},
		[neighbours, updateBlock, deleteBlock],
	);

	/** Pull the block after `blockId` into it, caret held at the seam. */
	const mergeWithNext = useCallback(
		(blockId: string) => {
			const next = neighbours(blockId)?.next;
			if (!next) return false;
			mergeWithPrevious(next.id);
			return true;
		},
		[neighbours, mergeWithPrevious],
	);

	/** Split a block. beforeContent stays, afterContent becomes a new block below. */
	const splitBlock = useCallback(
		(
			blockId: string,
			beforeContent: string,
			afterContent: string,
			newBlockType?: string,
			currentType?: string,
		) => {
			const current = neighbours(blockId)?.current;
			const page = usePageStore.getState().currentPage;
			if (!current || !page) return;

			// The new block's id is chosen here so the caret can be sent after it
			// on this keystroke. Neither write is awaited: both stores update
			// synchronously and reconcile with the server on their own. Awaiting
			// them is what used to leave the caret in the old block long enough
			// for the next characters to land there.
			const newId = ulid();
			const op = computeSplitBlock(
				current,
				beforeContent,
				afterContent,
				newId,
				newBlockType,
				currentType,
			);

			requestFocus(op.focus.blockId, { kind: "start" });
			void updateBlock(
				op.updateBlock.id,
				op.updateBlock.content,
				op.updateBlock.type,
			);
			void createBlock({ ...op.insertBlock, pageId: page.id });
		},
		[neighbours, updateBlock, createBlock],
	);

	/** Insert a new empty paragraph after a block. */
	const insertBlockAfter = useCallback(
		(blockId: string) => {
			const current = neighbours(blockId)?.current;
			const page = usePageStore.getState().currentPage;
			if (!current || !page) return;

			const newId = ulid();
			const op = computeInsertBlockAfter(current, newId);
			requestFocus(op.focus.blockId, { kind: "start" });
			void createBlock({ ...op.insertBlock, pageId: page.id });
		},
		[neighbours, createBlock],
	);

	/** Update a block's content (for debounced saves). */
	const handleUpdateBlock = useCallback(
		async (id: string, content: string, type?: string) => {
			try {
				await updateBlock(id, content, type);
			} catch (err) {
				if (err instanceof BlockLockedError) {
					const holderName =
						usePresenceStore
							.getState()
							.others.find((u) => u.userId === err.holderUserId)?.name ??
						"Someone";
					toaster.create({
						title: `${holderName} is editing this block`,
						description: "Wait a moment and try again.",
						type: "info",
					});
					return;
				}
				throw err;
			}
		},
		[updateBlock],
	);

	// ── Slash command handling ────────────────────────────────────────
	const handleSlashCommand = useCallback(
		async (command: string, blockId: string) => {
			if (!currentPage) return;
			setSlashMenu((m) => ({ ...m, show: false }));

			const currentBlock = neighbours(blockId)?.current;
			if (!currentBlock) return;

			// Remove the trailing `/query` from the block before applying the command.
			window.dispatchEvent(
				new CustomEvent("block-strip-slash", {
					detail: { blockId: currentBlock.id },
				}),
			);

			const def = SLASH_COMMANDS.find((c) => c.id === command);

			if (def?.defaultContent !== null && def?.defaultContent !== undefined) {
				// Standard commands: update current block content in place. The block
				// stays focused, so push the content into the editor directly — the
				// focus-guarded content-sync effect won't reflect a store-only update.
				await updateBlock(currentBlock.id, def.defaultContent);
				window.dispatchEvent(
					new CustomEvent("block-set-content", {
						detail: { blockId: currentBlock.id, content: def.defaultContent },
					}),
				);
			} else if (command === "database") {
				const db = await createDatabase(currentPage.id, "Untitled");
				await loadDatabases(currentPage.id);
				setNewDbId(db.id);
			} else if (command === "image") {
				fileInputRef.current?.click();
			} else if (command === "file") {
				fileInputRef.current?.click();
			} else if (command === "divider") {
				await createBlock({
					pageId: currentPage.id,
					type: "divider",
					content: "",
					index: currentBlock.index + 1,
					parentId: null,
				});
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
			} else if (command === "people") {
				// Insert an empty people block; PeopleBlock auto-opens a picker.
				await createBlock({
					pageId: currentPage.id,
					type: "people",
					content: defaultContentForType("people"),
					index: currentBlock.index + 1,
					parentId: null,
				});
			} else if (command === "viewReference") {
				// Insert an empty view-reference block; ViewReferenceBlock auto-opens a
				// picker for selecting the database + saved view.
				await createBlock({
					pageId: currentPage.id,
					type: "viewReference",
					content: "",
					index: currentBlock.index + 1,
					parentId: null,
				});
			}
		},
		[
			currentPage,
			sortedBlocks,
			updateBlock,
			createBlock,
			createDatabase,
			loadDatabases,
		],
	);

	// ── Title editing ─────────────────────────────────────────────────
	const handleTitleSave = async () => {
		if (currentPage && titleValue !== currentPage.title) {
			await updatePage(currentPage.id, { title: titleValue });
		}
		setIsEditingTitle(false);
	};

	const handleTitleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleTitleSave();
		} else if (e.key === "Escape") {
			setIsEditingTitle(false);
		}
	};

	// ── Drag-Drop handlers ──────────────────────────────────────────────

	/** Determine converted type when a block is dragged to a new position. */
	function _getConvertedType(
		draggedType: string,
		targetIndex: number,
		allBlocks: typeof sortedBlocks,
	): string {
		if (targetIndex < 0 || targetIndex >= allBlocks.length) return draggedType;

		const prevBlock = allBlocks[targetIndex - 1];
		const nextBlock = allBlocks[targetIndex + 1];

		// Check if dropping into a list context
		const prevIsList =
			prevBlock &&
			(prevBlock.type === "bulletList" || prevBlock.type === "numberedList");
		const nextIsList =
			nextBlock &&
			(nextBlock.type === "bulletList" || nextBlock.type === "numberedList");

		if (prevIsList || nextIsList) {
			const listType = prevIsList ? prevBlock?.type : nextBlock?.type;
			if (
				draggedType === "paragraph" ||
				draggedType === "heading1" ||
				draggedType === "heading2" ||
				draggedType === "heading3"
			) {
				return listType;
			}
		}

		// Check if dropping out of a list context
		const isListType =
			draggedType === "bulletList" || draggedType === "numberedList";
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

	/** AC#2: Click gutter/beside a block to focus it at nearest caret position. */
	const handleGutterClick = useCallback((blockId: string, clientY: number) => {
		// Blur any currently focused ProseMirror before requesting new focus,
		// so clicking the gutter of a different block properly unfocuses the
		// previously selected block (removes its focus indicator).
		const ae = document.activeElement as HTMLElement | null;
		if (ae?.classList.contains("ProseMirror")) ae.blur();

		const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
		if (blockEl) {
			const rect = blockEl.getBoundingClientRect();
			const midY = rect.top + rect.height / 2;
			requestFocus(blockId, {
				kind: clientY < midY ? "start" : "end",
			});
		} else {
			requestFocus(blockId, { kind: "start" });
		}
	}, []);

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

		// Split by id prefix, not by type. Two different things carry
		// `type: "database"` here: a real block that hosts an inline database,
		// whose id is a block id, and an orphan database, whose id is prefixed
		// `db-`. Filtering on the type dropped inline database blocks from the
		// block order — so the reorder never assigned them an index and they
		// drifted — while handing their block ids to reorderDatabases.
		const newBlockOrder = newItems
			.filter((item) => !item.id.startsWith("db-"))
			.map((item) => item.id);
		const newDbOrder = newItems
			.filter((item) => item.id.startsWith("db-"))
			.map((item) => item.id.slice("db-".length));

		// Persist both orders
		await reorderBlocks(currentPage.id, newBlockOrder);
		if (newDbOrder.length > 0) {
			await reorderDatabases(currentPage.id, newDbOrder);
		}
	};

	// ── Block context menu ────────────────────────────────────────────
	/** Move a block up or down in the sorted order. */
	const moveBlock = useCallback(
		async (blockId: string, direction: "up" | "down") => {
			if (!currentPage) return;
			const ordered = [...blocks].sort((a, b) => a.index - b.index);
			const idx = ordered.findIndex((b) => b.id === blockId);
			if (idx === -1) return;
			const swapWith = direction === "up" ? idx - 1 : idx + 1;
			if (swapWith < 0 || swapWith >= ordered.length) return;
			const reordered = [...ordered];
			[reordered[idx], reordered[swapWith]] = [
				reordered[swapWith],
				reordered[idx],
			];
			await reorderBlocks(
				currentPage.id,
				reordered.map((b) => b.id),
			);
		},
		[currentPage, blocks, reorderBlocks],
	);

	/** Build the context-menu items for a given block. */
	const buildBlockMenuItems = useCallback(
		(blockId: string): BlockMenuItem[] => {
			const ordered = [...blocks].sort((a, b) => a.index - b.index);
			const idx = ordered.findIndex((b) => b.id === blockId);
			return [
				{
					id: "duplicate",
					label: "Duplicate",
					icon: "⎘",
					onClick: () => {
						duplicateBlock(blockId);
					},
				},
				{
					id: "move-up",
					label: "Move up",
					icon: "↑",
					disabled: idx <= 0,
					onClick: () => {
						moveBlock(blockId, "up");
					},
				},
				{
					id: "move-down",
					label: "Move down",
					icon: "↓",
					disabled: idx === -1 || idx >= ordered.length - 1,
					onClick: () => {
						moveBlock(blockId, "down");
					},
				},
				{
					id: "delete",
					label: "Delete",
					icon: "🗑",
					danger: true,
					onClick: () => {
						deleteBlock(blockId);
					},
				},
			];
		},
		[blocks, duplicateBlock, deleteBlock, moveBlock],
	);

	/** Context-menu items for a database block. Deleting removes the database and,
	 *  for inline databases, the placeholder block that hosts it. */
	const buildDatabaseMenuItems = useCallback(
		(dbId: string, blockId: string | null): BlockMenuItem[] => {
			const db = databases.find((d) => d.id === dbId);
			return [
				{
					id: "delete",
					label: "Delete database",
					icon: "🗑",
					danger: true,
					onClick: () => {
						if (
							!window.confirm(
								`Delete database "${db?.name || "Untitled"}"? It can be restored from Trash.`,
							)
						)
							return;
						deleteDatabase(dbId);
						if (blockId) deleteBlock(blockId);
					},
				},
			];
		},
		[databases, deleteDatabase, deleteBlock],
	);

	// Build combined items list. Databases already pointed at by an inline
	// `database` block are skipped here so we don't double-render them
	// (once inline, once at the bottom). Anything left over is appended.
	const orphanDatabases = databases.filter((db) => !inlineDbIds.has(db.id));
	// Filter out inline database blocks whose target database is missing/deleted,
	// so SortableContext items match exactly what SortableBlock nodes are mounted
	// (a dangling id with no DOM node causes dnd-kit to crash on drag).
	const visibleBlocks = sortedBlocks.filter((block) => {
		if (block.type === "database") {
			return databases.some((d) => d.id === block.content);
		}
		return true;
	});
	const allItems = [
		...visibleBlocks,
		...orphanDatabases.map((db) => ({
			id: `db-${db.id}`,
			type: "database" as const,
			index: orphanDatabases.indexOf(db) + visibleBlocks.length,
		})),
	];

	if (!currentPage && accessDeniedFor) {
		return (
			<div className="flex items-center justify-center h-screen flex-1 bg-editor">
				<div className="flex flex-col items-center gap-0 text-center max-w-[320px] [animation:empty-state-in_0.4s_var(--ease-spring)]">
					<div
						className="mb-5 opacity-85 [filter:drop-shadow(0_4px_12px_rgba(43,77,255,0.08))]"
						aria-hidden="true"
					>
						<div className="text-2xl">🔒</div>
					</div>
					<h2 className="[font-family:var(--font-title)] text-[22px] font-bold text-text tracking-[-0.02em] mb-2">
						You don't have access to this page
					</h2>
					<p className="text-[14px] text-text-3 leading-relaxed mb-6">
						Ask the page owner to share it with you, or pick another page from
						the sidebar.
					</p>
				</div>
			</div>
		);
	}

	if (!currentPage) {
		return (
			<div className="flex items-center justify-center h-screen flex-1 bg-editor">
				<div className="flex flex-col items-center gap-0 text-center max-w-[320px] [animation:empty-state-in_0.4s_var(--ease-spring)]">
					<div
						className="mb-5 opacity-85 [filter:drop-shadow(0_4px_12px_rgba(43,77,255,0.08))]"
						aria-hidden="true"
					>
						<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
							<rect
								x="8"
								y="6"
								width="38"
								height="50"
								rx="4"
								fill="#E8EAF0"
								stroke="#D0D3DE"
								strokeWidth="1.5"
							/>
							<rect
								x="14"
								y="6"
								width="38"
								height="50"
								rx="4"
								fill="#EEF0F5"
								stroke="#D8DBE6"
								strokeWidth="1.5"
							/>
							<rect
								x="20"
								y="6"
								width="38"
								height="50"
								rx="4"
								fill="white"
								stroke="#CDD0DC"
								strokeWidth="1.5"
							/>
							<rect
								x="28"
								y="18"
								width="22"
								height="2.5"
								rx="1.25"
								fill="#C8CAD8"
							/>
							<rect x="28" y="24" width="18" height="2" rx="1" fill="#DCDFE8" />
							<rect x="28" y="29" width="20" height="2" rx="1" fill="#DCDFE8" />
							<rect x="28" y="34" width="15" height="2" rx="1" fill="#DCDFE8" />
						</svg>
					</div>
					<h2 className="[font-family:var(--font-title)] text-[22px] font-bold text-text tracking-[-0.02em] mb-2">
						Start somewhere
					</h2>
					<p className="text-[14px] text-text-3 leading-relaxed mb-6">
						Open a page from the sidebar, or create a new one to begin writing.
					</p>
					<div className="flex items-center gap-2 text-[12px] text-text-3">
						<span className="flex items-center gap-1 [&_kbd]:[font-family:var(--font-mono)] [&_kbd]:text-[10.5px] [&_kbd]:bg-surface-3 [&_kbd]:border [&_kbd]:border-border-mid [&_kbd]:rounded [&_kbd]:px-[5px] [&_kbd]:py-0.5 [&_kbd]:text-text-2 [&_kbd]:leading-[1.4] [&_kbd]:shadow-[0_1px_0_var(--border-mid)]">
							<kbd>⌘</kbd>
							<kbd>K</kbd> to search
						</span>
					</div>
				</div>
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
			<SortableContext
				items={allItems.map((item) => item.id)}
				strategy={verticalListSortingStrategy}
			>
				<div
					className="main"
					onMouseDown={(e) => {
						// Click on empty editor canvas (not a block, control, or menu)
						const t = e.target as HTMLElement;
						if (
							t.closest(
								'.ProseMirror, button, input, textarea, a, [role="menu"]',
							)
						)
							return;

						// AC#1: Click below the last block → focus/create trailing paragraph
						const editorEl = (e.currentTarget as HTMLElement).querySelector(
							".editor",
						);
						if (editorEl && sortedBlocks.length > 0) {
							const blockEls =
								editorEl.querySelectorAll<HTMLElement>("[data-block-type]");
							const lastBlockEl = blockEls[blockEls.length - 1];
							if (
								lastBlockEl &&
								e.clientY > lastBlockEl.getBoundingClientRect().bottom
							) {
								const lastBlock = sortedBlocks[sortedBlocks.length - 1];
								if (lastBlock) {
									// Blur the previously focused editor before requesting new focus
									const ae = document.activeElement as HTMLElement | null;
									if (ae?.classList.contains("ProseMirror")) ae.blur();

									// If last block is empty, focus it; otherwise create trailing paragraph
									const content = stripHtml(lastBlock.content);
									if (!content && currentPage) {
										requestFocus(lastBlock.id, { kind: "end" });
									} else if (currentPage) {
										createBlock({
											pageId: currentPage.id,
											type: "paragraph",
											content: defaultContentForType("paragraph"),
											index: lastBlock.index + 1,
											parentId: null,
										}).then((newBlock) => {
											if (newBlock?.id)
												requestFocus(newBlock.id, { kind: "start" });
										});
									}
									return;
								}
							}
						}

						// Otherwise blur the active editor
						const ae = document.activeElement as HTMLElement | null;
						if (ae?.classList.contains("ProseMirror")) ae.blur();
					}}
					onClick={(e) => {
						// Navigate when clicking inline [[page]] references
						const target = (e.target as HTMLElement).closest(
							"span[data-page-ref]",
						);
						if (target) {
							const pageId = target.getAttribute("data-page-ref");
							if (pageId) {
								e.preventDefault();
								e.stopPropagation();
								const url = new URL(window.location.href);
								url.searchParams.set("page", pageId);
								window.history.pushState({ pageId }, "", url);
								window.dispatchEvent(new PopStateEvent("popstate"));
							}
						}
					}}
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
						name="file-upload"
						accept="*/*"
						multiple
						style={{ display: "none" }}
						onChange={(e) => {
							if (e.target.files) handleFiles(e.target.files);
							e.target.value = "";
						}}
					/>
					{uploading && <div className="upload-toast">Uploading…</div>}

					<div className="flex items-center gap-2.5 mb-7">
						<IconButton
							variant="ghost"
							size="lg"
							className="text-[2.4em]"
							title="Change icon"
							onClick={(e) => {
								const rect = (
									e.currentTarget as HTMLElement
								).getBoundingClientRect();
								setIconPickerAnchor({ top: rect.bottom + 4, left: rect.left });
							}}
						>
							{currentPage.icon || "📄"}
						</IconButton>
						{isEditingTitle ? (
							<input
								type="text"
								name="page-title"
								className="[font-family:var(--font-title)] text-[2.4em] font-bold mb-7 border-2 border-accent rounded-lg outline-none w-full px-2 py-1 text-text bg-surface-2 tracking-[-0.025em] leading-[1.22]"
								value={titleValue}
								onChange={(e) => setTitleValue(e.target.value)}
								onBlur={handleTitleSave}
								onKeyDown={handleTitleKeyDown}
								placeholder="Page title..."
							/>
						) : (
							<h1
								className="[font-family:var(--font-title)] text-[2.4em] font-bold mb-7 border-none outline-none w-full text-text bg-transparent tracking-[-0.025em] leading-[1.22] placeholder:text-text-3 hover:bg-[rgba(0,0,0,0.015)] hover:rounded"
								onClick={() => {
									setIsEditingTitle(true);
									setTitleValue(currentPage.title || "");
								}}
								style={{ cursor: "pointer" }}
							>
								{currentPage.title || "Untitled"}
							</h1>
						)}
						<IconButton
							variant="ghost"
							className="text-[20px] hover:text-star"
							title={currentPage.isFavorite ? "Unfavorite" : "Add to favorites"}
							onClick={() => toggleFavorite(currentPage.id)}
						>
							{currentPage.isFavorite ? "★" : "☆"}
						</IconButton>
						<PresenceAvatars />
						<PageMenu
							pageId={currentPage.id}
							workspaceId={getCurrentWorkspaceId()}
						/>
					</div>
					<EmojiPicker
						open={iconPickerAnchor !== null}
						anchor={iconPickerAnchor}
						onClose={() => setIconPickerAnchor(null)}
						onSelect={(icon) => setPageIcon(currentPage.id, icon)}
					/>

					<div className="editor">
						{/* ── Blocks ── */}
						{(() => {
							const numberedRunIndices =
								computeNumberedRunIndices(sortedBlocks);
							return sortedBlocks.map((block, _blockIndex) => {
								const blockIndex = _blockIndex;
								// Inline database block: block.content holds the dbId.
								if (block.type === "database") {
									const db = databases.find((d) => d.id === block.content);
									if (!db) return null;
									return (
										<SortableBlock
											key={block.id}
											id={block.id}
											showDropIndicator={dropIndicatorIndex === blockIndex}
											isDragging={activeBlockId === block.id}
											onDragStart={() => setActiveBlockId(block.id)}
											onDragAbort={() => setActiveBlockId(null)}
											onOpenMenu={(x, y) =>
												setDbMenu({ dbId: db.id, blockId: block.id, x, y })
											}
											blockType="database"
											numberedRun={numberedRunIndices.get(block.id)}
											onGutterClick={(clientY) =>
												handleGutterClick(block.id, clientY)
											}
										>
											<DatabaseView database={db} isNew={db.id === newDbId} />
										</SortableBlock>
									);
								}

								// Page-link block.
								if (block.type === "pageLink") {
									return (
										<SortableBlock
											key={block.id}
											id={block.id}
											showDropIndicator={dropIndicatorIndex === blockIndex}
											isDragging={activeBlockId === block.id}
											onDragStart={() => setActiveBlockId(block.id)}
											onDragAbort={() => setActiveBlockId(null)}
											onInsertBelow={() => insertBlockAfter(block.id)}
											onOpenMenu={(x, y) =>
												setBlockMenu({ blockId: block.id, x, y })
											}
											blockType="pageLink"
											numberedRun={numberedRunIndices.get(block.id)}
											onGutterClick={(clientY) =>
												handleGutterClick(block.id, clientY)
											}
										>
											<PageLinkBlock
												block={block as any}
												blockIndex={sortedBlocks.indexOf(block)}
												totalBlocks={sortedBlocks.length}
												onUpdateBlock={async (id, content) => {
													await updateBlock(id, content);
												}}
												onDeleteBlock={deleteBlock}
											/>
										</SortableBlock>
									);
								}

								// Custom-rendered blocks (image, pdf, file, divider, people, etc.)
								if (hasBlockRenderer(block.type)) {
									const Renderer = getBlockRenderer(block.type)!;
									return (
										<SortableBlock
											key={block.id}
											id={block.id}
											showDropIndicator={dropIndicatorIndex === blockIndex}
											isDragging={activeBlockId === block.id}
											onDragStart={() => setActiveBlockId(block.id)}
											onDragAbort={() => setActiveBlockId(null)}
											onInsertBelow={() => insertBlockAfter(block.id)}
											onOpenMenu={(x, y) =>
												setBlockMenu({ blockId: block.id, x, y })
											}
											blockType={block.type}
											numberedRun={numberedRunIndices.get(block.id)}
											onGutterClick={(clientY) =>
												handleGutterClick(block.id, clientY)
											}
										>
											<Renderer
												block={block as any}
												blockIndex={sortedBlocks.indexOf(block)}
												totalBlocks={sortedBlocks.length}
												onUpdateBlock={async (id, content) => {
													await updateBlock(id, content);
												}}
												onDeleteBlock={deleteBlock}
											/>
										</SortableBlock>
									);
								}

								// Standard TipTap-editable blocks.
								// Bound by id, never by position: the editor freezes these at
								// mount (see BlockNavigationExtension), so an index here goes
								// stale the moment anything is inserted above.
								const callbacks: BlockNavigationCallbacks = {
									navigate: (dir, x) => navigateFrom(block.id, dir, x),
									mergeWithPrevious: () => mergeWithPrevious(block.id),
									mergeWithNext: () => mergeWithNext(block.id),
									splitBlock: (before, after, newType, currentType) =>
										splitBlock(block.id, before, after, newType, currentType),
									insertBlockAfter: () => insertBlockAfter(block.id),
									updateBlock: handleUpdateBlock,
								};

								return (
									<SortableBlock
										key={block.id}
										id={block.id}
										showDropIndicator={dropIndicatorIndex === blockIndex}
										isDragging={activeBlockId === block.id}
										onDragStart={() => setActiveBlockId(block.id)}
										onDragAbort={() => setActiveBlockId(null)}
										onInsertBelow={() => insertBlockAfter(block.id)}
										onOpenMenu={(x, y) =>
											setBlockMenu({ blockId: block.id, x, y })
										}
										blockType={block.type}
										onGutterClick={(clientY) =>
											handleGutterClick(block.id, clientY)
										}
									>
										<SingleBlockEditor
											block={block}
											blockIndex={blockIndex}
											totalBlocks={sortedBlocks.length}
											callbacks={callbacks}
											onSlashMenuOpen={(data) => {
												if (data.query === "__close__") {
													setSlashMenu((m) =>
														m.show ? { ...m, show: false } : m,
													);
												} else {
													setSlashMenu({
														show: true,
														query: data.query,
														top: data.top,
														left: data.left,
														blockId: block.id,
													});
												}
											}}
										/>
									</SortableBlock>
								);
							});
						})()}

						{/* ── Add-block bar (between blocks and orphan databases) ── */}
						{sortedBlocks.length > 0 && (
							<button
								className="group flex items-center gap-2 py-1.5 pl-[52px] pr-0 mt-1 opacity-35 cursor-pointer transition-opacity duration-[var(--t)] ease-[var(--ease)] border-none bg-transparent w-full text-left text-[14px] text-text-3 hover:opacity-70 active:opacity-100 max-[880px]:pl-3 max-[880px]:opacity-60"
								type="button"
								onClick={async (e) => {
									e.stopPropagation();
									try {
										const lastBlock = sortedBlocks[sortedBlocks.length - 1];
										const block = await createBlock({
											pageId: currentPage.id,
											type: "paragraph",
											content: defaultContentForType("paragraph"),
											index: lastBlock ? lastBlock.index + 1 : 0,
											parentId: null,
										});
										if (block?.id) requestFocus(block.id, { kind: "start" });
									} catch (err) {
										toaster.create({
											title: "Failed to create block",
											description: String(err),
											type: "error",
										});
									}
								}}
							>
								<span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-[1.5px] border-border-mid text-[16px] leading-none shrink-0 transition-[border-color] duration-[var(--t)] ease-[var(--ease)] group-hover:border-accent">
									+
								</span>
								<span>New block</span>
							</button>
						)}

						{/* ── Orphan databases (not pointed at by an inline database block) ── */}
						{orphanDatabases.map((db) => (
							<SortableBlock
								key={`db-${db.id}`}
								id={`db-${db.id}`}
								showDropIndicator={
									dropIndicatorIndex ===
									visibleBlocks.length + orphanDatabases.indexOf(db)
								}
								isDragging={activeBlockId === `db-${db.id}`}
								onDragStart={() => setActiveBlockId(`db-${db.id}`)}
								onOpenMenu={(x, y) =>
									setDbMenu({ dbId: db.id, blockId: null, x, y })
								}
								blockType="database"
							>
								<DatabaseView database={db} isNew={db.id === newDbId} />
							</SortableBlock>
						))}

						{/* ── Empty state ── */}
						{sortedBlocks.length === 0 && databases.length === 0 && (
							<div
								className="relative flex items-center justify-center min-h-[100px] text-center rounded border-2 border-dashed border-border-mid transition-[border-color,background] duration-[var(--t)] ease-[var(--ease)] cursor-pointer hover:border-accent hover:bg-accent-dim max-[880px]:min-h-[80px]"
								onClick={async () => {
									try {
										const block = await createBlock({
											pageId: currentPage.id,
											type: "paragraph",
											content: defaultContentForType("paragraph"),
											index: 0,
											parentId: null,
										});
										if (block?.id) requestFocus(block.id, { kind: "start" });
									} catch (err) {
										toaster.create({
											title: "Failed to create block",
											description: String(err),
											type: "error",
										});
									}
								}}
							>
								<div className="flex flex-col items-center gap-2 [&>span]:text-[14px] [&>span]:text-text-3">
									<span>This page is empty</span>
									{/* Visual affordance only — the wrapping div handles the click. */}
									<Button variant="secondary" size="sm" tabIndex={-1}>
										+ New block
									</Button>
								</div>
							</div>
						)}

						{/* Slash Command Menu */}
						{slashMenu.show && (
							<SlashMenu
								commands={slashCommands}
								query={slashMenu.query}
								position={{ top: slashMenu.top, left: slashMenu.left }}
								onSelect={(cmd) => handleSlashCommand(cmd, slashMenu.blockId)}
								onClose={() => setSlashMenu((m) => ({ ...m, show: false }))}
							/>
						)}

						{/* Block Context Menu (right-click or drag-handle click) */}
						{blockMenu && (
							<BlockContextMenu
								x={blockMenu.x}
								y={blockMenu.y}
								items={buildBlockMenuItems(blockMenu.blockId)}
								onClose={() => setBlockMenu(null)}
							/>
						)}

						{/* Database context menu */}
						{dbMenu && (
							<BlockContextMenu
								x={dbMenu.x}
								y={dbMenu.y}
								items={buildDatabaseMenuItems(dbMenu.dbId, dbMenu.blockId)}
								onClose={() => setDbMenu(null)}
							/>
						)}
					</div>

					{/* Mobile floating action button — always within reach while scrolling */}
					{sortedBlocks.length > 0 && (
						<button
							className="fab-add-block"
							type="button"
							aria-label="Add block"
							onClick={async (e) => {
								e.stopPropagation();
								try {
									const lastBlock = sortedBlocks[sortedBlocks.length - 1];
									const block = await createBlock({
										pageId: currentPage.id,
										type: "paragraph",
										content: defaultContentForType("paragraph"),
										index: lastBlock ? lastBlock.index + 1 : 0,
										parentId: null,
									});
									if (block?.id) requestFocus(block.id, { kind: "start" });
								} catch (err) {
									toaster.create({
										title: "Failed to create block",
										description: String(err),
										type: "error",
									});
								}
							}}
						>
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
								<path
									d="M10 4v12M4 10h12"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
								/>
							</svg>
						</button>
					)}

					{/* Backlinks Panel */}
					<BacklinksPanel />

					<DragOverlay>
						{activeBlockId ? (
							<div className="bg-surface border border-border-mid rounded shadow-[var(--shadow-xl)] px-5 py-3 min-w-[200px] max-w-[400px]">
								{(() => {
									const block = sortedBlocks.find(
										(b) => b.id === activeBlockId,
									);
									if (block)
										return (
											<div className="text-[13.5px] text-text-2 px-3 py-2 bg-surface-3 rounded border border-border">
												{block.type}
											</div>
										);
									const db = databases.find(
										(d) => `db-${d.id}` === activeBlockId,
									);
									if (db)
										return (
											<div className="text-[13.5px] text-text-2 px-3 py-2 bg-surface-3 rounded border border-border">
												Database: {db.name}
											</div>
										);
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

const slashCommands = SLASH_COMMANDS.map((c) => ({
	id: c.id,
	name: c.name,
	icon: c.icon,
	shortcut: c.shortcut,
}));
