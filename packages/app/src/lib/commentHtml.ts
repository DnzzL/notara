import { escapeHtml, inlineMarkdown } from "@notara/shared";

/**
 * A comment's markdown as HTML: fenced blocks as code, inline marks elsewhere,
 * everything else escaped. Links open in a new tab, off the page being read.
 */
export const commentHtml = (body: string) =>
	body
		.split(/(```[^\n]*\n[\s\S]*?```\n?)/)
		.map((part) =>
			part.startsWith("```")
				? `<pre><code>${escapeHtml(part.replace(/^```[^\n]*\n/, "").replace(/```\n?$/, ""))}</code></pre>`
				: inlineMarkdown(part).replaceAll(
						"<a href=",
						'<a target="_blank" rel="noopener noreferrer" href=',
					),
		)
		.join("");
