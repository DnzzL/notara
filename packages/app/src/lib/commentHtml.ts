import {
	escapeHtml,
	inlineMarkdown,
	markdownToBlocks,
	type ParsedBlock,
} from "@notara/shared";

/** The block constructs a comment renders as elements — the whole subset. */
const SUBSET = new Set([
	"heading1",
	"heading2",
	"heading3",
	"bulletList",
	"todo",
	"blockquote",
]);

/** Text, the renderer's own kind: a line the subset names nothing for. */
const TEXT = "text";

/**
 * One line, named by the shared parser. A line outside the subset — blank, a
 * table row, an image — keeps its own text: the parser stores those as JSON,
 * and what a comment says is never rewritten.
 */
const lineOf = (line: string): ParsedBlock => {
	const parsed: ParsedBlock | undefined = markdownToBlocks(line, {
		skipFirstH1: false,
	})[0];
	return parsed && SUBSET.has(parsed.type)
		? parsed
		: { type: TEXT, content: line };
};

/** Consecutive lines of one kind: one list, one quote, one run of prose. */
const runsOf = (lines: string[]): ParsedBlock[][] => {
	const runs: ParsedBlock[][] = [];
	for (const line of lines) {
		const current = lineOf(line);
		const open = runs[runs.length - 1];
		if (open && open[0].type === current.type) open.push(current);
		else runs.push([current]);
	}
	return runs;
};

/** A run's text, its own newlines between the lines. */
const textOf = (run: ParsedBlock[]) =>
	run.map((line) => inlineMarkdown(line.content)).join("\n");

/** One run as its element; text runs stay text, blanks and all. */
const elementOf = (run: ParsedBlock[]): string => {
	switch (run[0].type) {
		case "heading1":
		case "heading2":
		case "heading3": {
			const h = run[0].type.slice(-1);
			return run
				.map((line) => `<h${h}>${inlineMarkdown(line.content)}</h${h}>`)
				.join("");
		}
		case "bulletList":
			return `<ul>${run
				.map((line) => `<li>${inlineMarkdown(line.content)}</li>`)
				.join("")}</ul>`;
		case "todo":
			return `<ul class="comment-todos">${run
				.map(
					(line) =>
						`<li><input type="checkbox" disabled${line.checked ? " checked" : ""}> ${inlineMarkdown(line.content)}</li>`,
				)
				.join("")}</ul>`;
		case "blockquote":
			return `<blockquote>${textOf(run)}</blockquote>`;
		default:
			return textOf(run);
	}
};

/** An element takes its own line box; text keeps its newlines. */
const isElement = (run: ParsedBlock[]) => run[0].type !== TEXT;

/**
 * A part of a comment that is not fenced code, as HTML. Blank lines are kept:
 * the parser drops them, and a comment's own spacing is not ours to lose. No
 * newline is put beside an element — its line box is already the break, and
 * under `pre-wrap` a newline there would show as an extra blank line.
 */
const partHtml = (part: string): string => {
	const runs = runsOf(part.split("\n"));
	return runs
		.map(
			(run, i) =>
				(i > 0 && !isElement(run) && !isElement(runs[i - 1]) ? "\n" : "") +
				elementOf(run),
		)
		.join("");
};

/**
 * A comment's markdown as HTML: a heading, a list, a to-do, a quote and a
 * fenced block as those elements, inline marks everywhere, everything else
 * escaped text. Links open in a new tab, off the page being read.
 */
export const commentHtml = (body: string) =>
	body
		.split(/(```[^\n]*\n[\s\S]*?```\n?)/)
		.map((part) =>
			part.startsWith("```")
				? `<pre><code>${escapeHtml(part.replace(/^```[^\n]*\n/, "").replace(/```\n?$/, ""))}</code></pre>`
				: partHtml(part).replaceAll(
						"<a href=",
						'<a target="_blank" rel="noopener noreferrer" href=',
					),
		)
		.join("");
