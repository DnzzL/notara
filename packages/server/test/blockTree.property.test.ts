import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { blockToMarkdown } from "../src/export/page.js";
import { markdownToBlocks } from "../src/import/notion.js";

// ── Property: a block tree round-trips through the real export → import
// pipeline (blockToMarkdown / markdownToBlocks — the same functions
// exportPageAsMarkdown and importNotionExport call) ─────────────────────
//
// Restricted to the block types that pipeline actually preserves. Two
// known gaps found while writing this test, tracked as follow-up rather
// than fixed here:
//   - numberedList: blockToMarkdown emits "1. content", but
//     markdownToBlocks has no case for a leading "N. " — it falls through
//     to plain paragraph. The type is lost on import.
//   - code: markdownToBlocks accumulates each line with a trailing "\n",
//     so single-line code content round-trips with an extra newline.
// Content is restricted to a safe alphabet so it can't itself look like
// another block's markdown marker (e.g. a paragraph starting with "# ").

const safeContentArb = fc
	.stringMatching(/^[A-Za-z0-9 ]+$/)
	.filter((s) => s.trim().length > 0);

const roundTrippableBlockArb = fc.oneof(
	fc.record({ type: fc.constant("paragraph"), content: safeContentArb }),
	fc.record({ type: fc.constant("heading1"), content: safeContentArb }),
	fc.record({ type: fc.constant("heading2"), content: safeContentArb }),
	fc.record({ type: fc.constant("heading3"), content: safeContentArb }),
	fc.record({ type: fc.constant("bulletList"), content: safeContentArb }),
	fc.record({ type: fc.constant("blockquote"), content: safeContentArb }),
	// Only the unchecked shape round-trips losslessly: blockToMarkdown
	// leaves an existing "[x]"/"[ ]" prefix untouched, which safeContentArb
	// never produces, so every generated todo takes the "- [ ] " path.
	fc.record({ type: fc.constant("todo"), content: safeContentArb }),
	fc.record({ type: fc.constant("divider"), content: fc.constant("") }),
);

describe("Block tree round-trips through the export/import pipeline", () => {
	test("blockToMarkdown → markdownToBlocks preserves type and content", () => {
		fc.assert(
			fc.property(
				fc.array(roundTrippableBlockArb, { minLength: 1, maxLength: 20 }),
				(blocks) => {
					// Mirrors exportPageAsMarkdown: a page title line, then each
					// block's markdown, blank-line separated.
					let markdown = "# Some Page Title\n\n";
					for (const block of blocks) {
						markdown += `${blockToMarkdown(block.type, block.content)}\n\n`;
					}

					const parsed = markdownToBlocks(markdown);

					expect(parsed).toEqual(blocks);
				},
			),
		);
	});
});
