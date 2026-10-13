/**
 * Markdown written by a person or an agent, as the blocks the editor stores:
 * escaped text inside the editor's HTML. Used by the Backlog.md import and by
 * REST writes of a card's body.
 */
import { markdownToBlocks } from "./notion.js";

const escapeHtml = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Inline markdown as editor marks: `code`, **bold**, _italic_ or *italic*,
 * and [links](https://…). Everything else is escaped text; a link to anything
 * but http(s) stays text.
 */
const inline = (text: string) =>
	escapeHtml(text)
		.split(/(`[^`]+`)/)
		.map((part) =>
			part.startsWith("`") && part.endsWith("`") && part.length > 1
				? `<code>${part.slice(1, -1)}</code>`
				: part
						.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
						.replace(/(^|\W)[_*](\S(?:.*?\S)?)[_*](?=\W|$)/g, "$1<em>$2</em>")
						.replace(
							/\[([^\]]+)\]\((https?:\/\/[^\s)"]+)\)/g,
							'<a href="$2">$1</a>',
						),
		)
		.join("");

/** A parsed markdown block as the editor stores it: escaped text in its HTML. */
export const editorBlock = (parsed: string, text: string) => {
	// The parser names a fenced block's language (`code-ts`); the editor has one code block.
	const type = parsed.startsWith("code") ? "code" : parsed;
	const t = type === "code" ? escapeHtml(text) : inline(text);
	switch (type) {
		case "heading1":
		case "heading2":
		case "heading3":
			return { type, content: `<h${type.at(-1)}>${t}</h${type.at(-1)}>` };
		case "bulletList":
			return { type, content: `<ul><li><p>${t}</p></li></ul>` };
		case "numberedList":
			return { type, content: `<ol><li><p>${t}</p></li></ol>` };
		case "code":
			return { type, content: `<pre><code>${t}</code></pre>` };
		case "blockquote":
			return { type, content: `<blockquote><p>${t}</p></blockquote>` };
		case "divider":
			return { type, content: "" };
		default:
			return { type: "paragraph", content: `<p>${t}</p>` };
	}
};

export const todo = (text: string, checked: boolean) => ({
	type: "todo",
	content: `<ul data-type="taskList"><li data-type="taskItem" data-checked="${checked}"><p>${inline(text)}</p></li></ul>`,
});

/** Every block of `text`, its `[ ]` / `[x]` items as to-dos. */
export const markdownAsEditorBlocks = (text: string) =>
	markdownToBlocks(text, { skipFirstH1: false }).map((b) =>
		b.type === "todo"
			? todo(b.content, b.checked ?? false)
			: editorBlock(b.type, b.content),
	);
