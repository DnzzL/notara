export type SplitBehavior = "normal" | "list" | "todo" | "split-paragraph";

/** All block types that have a corresponding BLOCK_TYPE_CONFIG entry. */
export type BlockType =
	| "paragraph"
	| "heading1"
	| "heading2"
	| "heading3"
	| "blockquote"
	| "code"
	| "bulletList"
	| "numberedList"
	| "todo"
	| "divider"
	| "image"
	| "pdf"
	| "file"
	| "database"
	| "pageLink"
	| "toggle"
	| "callout"
	| "people"
	| "viewReference";

/**
 * Derive the block type from the top-level HTML fragment.
 * Single source of truth for HTML → BlockType mapping, used by
 * derive-live detection, merge, and any other path that needs
 * to infer block type from rendered content.
 */
export function blockTypeFromHtml(html: string): BlockType {
	const t = html.trim();

	if (t.startsWith("<h1>") || t.startsWith("<h1 ")) return "heading1";
	if (t.startsWith("<h2>") || t.startsWith("<h2 ")) return "heading2";
	if (t.startsWith("<h3>") || t.startsWith("<h3 ")) return "heading3";
	if (t.startsWith("<blockquote>")) return "blockquote";
	if (t.startsWith("<pre>")) return "code";
	if (t.startsWith('<ul data-type="taskList"')) return "todo";
	if (t.startsWith("<ul") || t.startsWith("<ul ")) return "bulletList";
	if (t.startsWith("<ol") || t.startsWith("<ol ")) return "numberedList";

	return "paragraph";
}

/** Extract the numeric heading level (1-3) from a heading block type. */
export function headingLevelFromType(type: BlockType): number {
	if (type === "heading1") return 1;
	if (type === "heading2") return 2;
	if (type === "heading3") return 3;
	return 1;
}

export interface BlockTypeConfig {
	/** Placeholder shown in empty TipTap editor for this block type. */
	placeholder: string;
	/** Initial HTML content for a new block of this type (empty state). */
	defaultContent: string;
	/** Which Enter-key split strategy applies in BlockNavigationExtension. */
	splitBehavior: SplitBehavior;
	/** True for blocks that render outside TipTap (divider, image, pdf, database, pageLink). */
	rendersCustom: boolean;
}

export interface SlashCommandDef {
	/** Command ID passed to handleSlashCommand. */
	id: string;
	icon: string;
	name: string;
	shortcut: string;
	/**
	 * HTML content to set on the current block, or null for commands that need
	 * special handling (database, image, divider, pageLink).
	 */
	defaultContent: string | null;
}

/**
 * Map a block type to its HTML wrapping tag.
 * Used when splitting a block at cursor: the "before" part keeps
 * the original wrapping tag, while the "after" part becomes a new
 * paragraph block.
 */
export function blockTagForType(type: BlockType): string {
	switch (type) {
		case "heading1":
			return "h1";
		case "heading2":
			return "h2";
		case "heading3":
			return "h3";
		case "blockquote":
			return "blockquote";
		default:
			return "p";
	}
}

/** Per-block-type config for rendering and keyboard behavior. */
export const BLOCK_TYPE_CONFIG: Record<BlockType, BlockTypeConfig> = {
	paragraph: {
		placeholder: "Type '/' for commands",
		defaultContent: "<p></p>",
		// Enter splits into a new paragraph block; Shift+Enter is the line break.
		splitBehavior: "split-paragraph",
		rendersCustom: false,
	},
	heading1: {
		placeholder: "Heading 1",
		defaultContent: "<h1></h1>",
		splitBehavior: "split-paragraph",
		rendersCustom: false,
	},
	heading2: {
		placeholder: "Heading 2",
		defaultContent: "<h2></h2>",
		splitBehavior: "split-paragraph",
		rendersCustom: false,
	},
	heading3: {
		placeholder: "Heading 3",
		defaultContent: "<h3></h3>",
		splitBehavior: "split-paragraph",
		rendersCustom: false,
	},
	blockquote: {
		placeholder: "Quote",
		defaultContent: "<blockquote></blockquote>",
		splitBehavior: "split-paragraph",
		rendersCustom: false,
	},
	code: {
		placeholder: "Code",
		defaultContent: "<pre><code></code></pre>",
		splitBehavior: "normal",
		rendersCustom: false,
	},
	bulletList: {
		placeholder: "List",
		defaultContent: "<ul><li></li></ul>",
		splitBehavior: "list",
		rendersCustom: false,
	},
	numberedList: {
		placeholder: "List",
		defaultContent: "<ol><li></li></ol>",
		splitBehavior: "list",
		rendersCustom: false,
	},
	todo: {
		placeholder: "To-do",
		defaultContent:
			'<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
		splitBehavior: "todo",
		rendersCustom: false,
	},
	divider: {
		placeholder: "",
		defaultContent: "",
		splitBehavior: "normal",
		rendersCustom: true,
	},
	image: {
		placeholder: "",
		defaultContent: "",
		splitBehavior: "normal",
		rendersCustom: true,
	},
	pdf: {
		placeholder: "",
		defaultContent: "",
		splitBehavior: "normal",
		rendersCustom: true,
	},
	file: {
		placeholder: "",
		defaultContent: "",
		splitBehavior: "normal",
		rendersCustom: true,
	},
	database: {
		placeholder: "",
		defaultContent: "",
		splitBehavior: "normal",
		rendersCustom: true,
	},
	pageLink: {
		placeholder: "",
		defaultContent: "",
		splitBehavior: "normal",
		rendersCustom: true,
	},
	viewReference: {
		placeholder: "",
		defaultContent: "",
		splitBehavior: "normal",
		rendersCustom: true,
	},
	toggle: {
		placeholder: "",
		defaultContent: "",
		splitBehavior: "normal",
		rendersCustom: false,
	},
	callout: {
		placeholder: "",
		defaultContent: '<div data-callout><div class="callout-text"></div></div>',
		splitBehavior: "normal",
		rendersCustom: false,
	},
	people: {
		placeholder: "",
		defaultContent: "",
		splitBehavior: "normal",
		rendersCustom: true,
	},
};

const DETAILS_CONTENT =
	'<details open=""><summary>Toggle</summary><div data-details-content=""><p></p></div></details>';

const CALLOUT_CONTENT =
	'<div data-callout><div class="callout-text"></div></div>';

/** All slash menu commands in display order — only blocks that markdown + the bubble bar cannot express. */
export const SLASH_COMMANDS: SlashCommandDef[] = [
	{
		id: "image",
		icon: "🖼️",
		name: "Image",
		shortcut: "/image",
		defaultContent: null,
	},
	{
		id: "file",
		icon: "📎",
		name: "File",
		shortcut: "/file",
		defaultContent: null,
	},
	{
		id: "divider",
		icon: "—",
		name: "Divider",
		shortcut: "---",
		defaultContent: null,
	},
	{
		id: "callout",
		icon: "💡",
		name: "Callout",
		shortcut: "/callout",
		defaultContent: CALLOUT_CONTENT,
	},
	{
		id: "toggle",
		icon: "▶",
		name: "Toggle",
		shortcut: "/toggle",
		defaultContent: DETAILS_CONTENT,
	},
	{
		id: "database",
		icon: "🗃️",
		name: "Database",
		shortcut: "/database",
		defaultContent: null,
	},
	{
		id: "pageLink",
		icon: "🔗",
		name: "Link to page",
		shortcut: "/page",
		defaultContent: null,
	},
	{
		id: "people",
		icon: "👤",
		name: "People",
		shortcut: "/people",
		defaultContent: null,
	},
	{
		id: "viewReference",
		icon: "👁️",
		name: "View reference",
		shortcut: "/view",
		defaultContent: null,
	},
];
