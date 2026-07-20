export type SplitBehavior = "normal" | "list" | "todo";

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

/** Per-block-type config for rendering and keyboard behavior. Keyed by block.type. */
export const BLOCK_TYPE_CONFIG: Record<string, BlockTypeConfig> = {
	paragraph: {
		placeholder: "Type '/' for commands",
		defaultContent: "<p></p>",
		splitBehavior: "normal",
		rendersCustom: false,
	},
	heading1: {
		placeholder: "Heading 1",
		defaultContent: "<h1></h1>",
		splitBehavior: "normal",
		rendersCustom: false,
	},
	heading2: {
		placeholder: "Heading 2",
		defaultContent: "<h2></h2>",
		splitBehavior: "normal",
		rendersCustom: false,
	},
	heading3: {
		placeholder: "Heading 3",
		defaultContent: "<h3></h3>",
		splitBehavior: "normal",
		rendersCustom: false,
	},
	blockquote: {
		placeholder: "Quote",
		defaultContent: "<blockquote></blockquote>",
		splitBehavior: "normal",
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
];
