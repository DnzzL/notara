/** `s` as HTML text. */
export const escapeHtml = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Inline markdown as HTML marks: `code`, **bold**, _italic_ or *italic*,
 * and [links](https://…). Everything else is escaped text; a link to anything
 * but http(s) stays text. The one rule for a card's body and a comment.
 */
export const inlineMarkdown = (text: string) =>
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

/** A parsed markdown block: its type, its text, and a to-do's tick. */
export interface ParsedBlock {
	type: string;
	content: string;
	/** A to-do's tick; absent on other blocks. */
	checked?: boolean;
}

/**
 * Exported Markdown as block objects. The one parser for the Notion importer
 * and for anything the app reads as markdown, so the two can't drift apart.
 */
export function markdownToBlocks(
	md: string,
	// A Notion export repeats the page title as its first `# ` heading.
	{ skipFirstH1 = true } = {},
): ParsedBlock[] {
	const lines = md.split("\n");
	const blocks: ParsedBlock[] = [];
	let inCode = false;
	let codeLines: string[] = [];
	let codeType = "code";

	for (const line of lines) {
		if (inCode) {
			if (line.startsWith("```")) {
				blocks.push({ type: codeType, content: codeLines.join("\n") });
				inCode = false;
				codeLines = [];
			} else {
				codeLines.push(line);
			}
			continue;
		}

		if (line.startsWith("# ")) {
			if (skipFirstH1) {
				skipFirstH1 = false;
				continue;
			}
			blocks.push({ type: "heading1", content: line.slice(2) });
		} else if (line.startsWith("## ")) {
			blocks.push({ type: "heading2", content: line.slice(3) });
		} else if (line.startsWith("### ")) {
			blocks.push({ type: "heading3", content: line.slice(4) });
		} else if (
			line.startsWith("- [ ] ") ||
			line.startsWith("- [x] ") ||
			line.startsWith("- [X] ")
		) {
			blocks.push({
				type: "todo",
				content: line.slice(6),
				checked: line[3] !== " ",
			});
		} else if (line.startsWith("- ")) {
			blocks.push({ type: "bulletList", content: line.slice(2) });
		} else if (/^\d+\.\s/.test(line)) {
			blocks.push({
				type: "numberedList",
				content: line.slice(line.indexOf(" ") + 1),
			});
		} else if (line.startsWith("```")) {
			inCode = true;
			codeLines = [];
			const lang = line.slice(3).trim();
			codeType = lang ? `code-${lang}` : "code";
		} else if (line.startsWith("> ")) {
			blocks.push({ type: "blockquote", content: line.slice(2) });
		} else if (line.trim() === "---" || line.trim() === "***") {
			blocks.push({ type: "divider", content: "" });
		} else if (line.trim() === "") {
		} else {
			// Image: standalone line like `![alt](path/to/img.png)`. Notion
			// exports images this way. The path is left relative; the importer
			// will resolve + copy + rewrite afterwards.
			const trimmed = line.trim();
			const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
			const linkMatch = trimmed.match(/^\[([^\]]*)\]\(([^)]+\.md)\)$/);
			if (imgMatch) {
				const src = imgMatch[2];
				const fileName = decodeURIComponent(src.split("/").pop() ?? "image");
				blocks.push({
					type: "image",
					content: JSON.stringify({ src, fileName }),
				});
			} else if (linkMatch) {
				// Standalone link to another .md file = Notion sub-page reference.
				// Emit a pageLink placeholder; the post-import pass resolves the
				// GUID to an actual pageId.
				const href = decodeURIComponent(linkMatch[2]);
				const guids = [...href.matchAll(/[a-f0-9]{32}/gi)].map((mm) => mm[0]);
				const targetGuid = guids[guids.length - 1] ?? null;
				if (targetGuid) {
					blocks.push({
						type: "pageLink",
						content: JSON.stringify({ __pageRef: targetGuid }),
					});
				} else {
					blocks.push({ type: "paragraph", content: line });
				}
			} else {
				blocks.push({ type: "paragraph", content: line });
			}
		}
	}

	if (inCode && codeLines.length > 0) {
		blocks.push({ type: codeType, content: codeLines.join("\n") });
	}

	return blocks;
}
