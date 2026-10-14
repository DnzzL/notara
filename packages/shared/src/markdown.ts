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
