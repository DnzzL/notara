import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { blockToMarkdown } from "../src/export/page.js";
import { markdownToBlocks } from "../src/import/notion.js";

// ── Property: a block tree round-trips through the real export → import
// pipeline (blockToMarkdown / markdownToBlocks — the same functions
// exportPageAsMarkdown and importNotionExport call) ─────────────────────
//
// "Tree" here means what the pipeline itself means by it: blockToMarkdown
// has no notion of parentId/nesting — a page's blocks are exported as a
// flat, indentation-free sequence — so there is no parent/child structure
// for this test to round-trip beyond block order.
//
// Only 8 of the ~19 block types are covered (paragraph, heading1-3,
// bulletList, blockquote, todo, divider); the rest are excluded, not just
// numberedList/code. Two exclusions are confirmed bugs, tracked as
// TASK-25 in the fleet backlog rather than fixed here:
//   - numberedList: blockToMarkdown emits "1. content", but
//     markdownToBlocks has no case for a leading "N. " — it falls through
//     to plain paragraph. The type is lost on import.
//   - code: markdownToBlocks accumulates each line with a trailing "\n",
//     so single-line code content round-trips with an extra newline.
// The remaining types (image, file, pdf, database, toggle, callout,
// pageLink, people, viewReference) are JSON- or placeholder-content
// blocks with their own asymmetric encode/decode shapes (e.g. toggle's
// "<details><summary>" export has no matching import case either) —
// out of scope for this pass; not claimed to round-trip.
//
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
