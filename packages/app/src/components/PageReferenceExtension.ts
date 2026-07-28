import { Node, mergeAttributes, Extension } from "@tiptap/core";
import { Suggestion } from "@tiptap/suggestion";
import type { Editor, Range } from "@tiptap/core";

/**
 * PageReference extension — inline @mention for pages and people.
 *
 * Typing `@` triggers a suggestion popup (rendered via React portal) that
 * searches pages and workspace members. Selecting a suggestion inserts a
 * non-editable inline node that survives reload and syncs across clients.
 */

export interface PageReferenceItem {
	pageId: string;
	pageTitle: string;
	type: "page" | "person";
}

export interface PageReferenceNodeOptions {
	HTMLAttributes: Record<string, any>;
	renderLabel: (props: PageReferenceItem) => string;
}

export const PageReferenceNode = Node.create<PageReferenceNodeOptions>({
	name: "pageReference",

	group: "inline",

	inline: true,

	selectable: false,

	atom: true,

	addOptions() {
		return {
			HTMLAttributes: {
				class: "page-reference",
			},
			renderLabel: ({ pageId, pageTitle }) => pageTitle,
		};
	},

	addAttributes() {
		return {
			pageId: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-page-ref"),
				renderHTML: (attributes) => {
					if (!attributes.pageId) return {};
					return {
						"data-page-ref": attributes.pageId,
					};
				},
			},
			pageTitle: {
				default: null,
				parseHTML: (element) => element.textContent,
			},
			type: {
				default: "page",
				parseHTML: (element) => element.getAttribute("data-ref-type"),
				renderHTML: (attributes) => {
					if (!(attributes as any).type) return {};
					return {
						"data-ref-type": (attributes as any).type,
					};
				},
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: `span[data-page-ref]`,
			},
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const attrs = node.attrs as unknown as PageReferenceItem;
		const label = this.options.renderLabel(attrs);
		return [
			"span",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
				"data-ref-type": attrs.type || "page",
			}),
			label,
		];
	},
});

/**
 * PageReference extension with @mention suggestion support.
 * Configured with items (search function) and render (portal-based popup).
 */
export interface PageReferenceExtensionOptions {
	items: (
		query: string,
	) =>
		| Promise<PageReferenceItem[]>
		| PageReferenceItem[]
		| Promise<{ pages: PageReferenceItem[]; people: PageReferenceItem[] }>
		| { pages: PageReferenceItem[]; people: PageReferenceItem[] };
	render: () => {
		onStart?: (props: PageReferenceRenderProps) => void;
		onUpdate?: (props: PageReferenceRenderProps) => void;
		onKeyDown?: (props: { event: KeyboardEvent; range: Range }) => boolean;
		onExit?: (props: PageReferenceRenderProps) => void;
	};
}

export interface PageReferenceRenderProps {
	editor: Editor;
	range: Range;
	query: string;
	text: string;
	items: PageReferenceItem[];
	command: (props: PageReferenceItem) => void;
}

export const PageReferenceExtension =
	Extension.create<PageReferenceExtensionOptions>({
		name: "pageReferenceExtension",

		addProseMirrorPlugins() {
			return [
				Suggestion({
					editor: this.editor,
					char: "@",
					allowSpaces: false,
					allowedPrefixes: [" "],
					startOfLine: true,
					command: ({
						editor,
						range,
						props,
					}: {
						editor: Editor;
						range: Range;
						props: PageReferenceItem;
					}) => {
						editor
							.chain()
							.focus()
							.deleteRange(range)
							.insertContent({
								type: "pageReference",
								attrs: props,
							})
							.run();
					},
					items: async ({ query }: { query: string }) => {
						const result = this.options.items(query);
						// Support both flat array and {pages, people} shape
						if (result instanceof Promise) {
							const resolved = await result;
							if (Array.isArray(resolved)) return resolved;
							return [...resolved.pages, ...resolved.people];
						}
						if (Array.isArray(result)) return result;
						return [...result.pages, ...result.people];
					},
					render: this.options.render,
				}),
			];
		},
	});

export default PageReferenceNode;
