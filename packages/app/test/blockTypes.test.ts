/**
 * Block-type knowledge that used to live in several places at once.
 *
 * The config carried a `rendersCustom` flag alongside the renderer registry —
 * two lists, differing by two entries, kept in sync by hand. It turned out
 * nothing read the flag at all, so it was deleted rather than reconciled: a
 * second source of truth that everyone had to maintain and no one consulted.
 *
 * What remains worth pinning is that every registered type has a config, that
 * default content is defined once, and that wrapping inline HTML gives the same
 * answer whichever path asks.
 */
import { describe, expect, test } from "bun:test";
import {
	BLOCK_TYPE_CONFIG,
	blockTagForType,
	blockTypeFromHtml,
	wrapInlineHTML,
} from "../src/components/blockTypes.js";

const types = Object.keys(BLOCK_TYPE_CONFIG) as Array<
	keyof typeof BLOCK_TYPE_CONFIG
>;

describe("the config covers every block type", () => {
	test("every entry has a placeholder, default content and split behaviour", () => {
		for (const type of types) {
			const config = BLOCK_TYPE_CONFIG[type];
			expect(config.defaultContent, type).toBeDefined();
			expect(config.splitBehavior, type).toBeTruthy();
		}
	});

	test("default content is valid for the type that will parse it back", () => {
		// A block created with its default content must read back as its own type,
		// or the first keystroke silently changes what the block is.
		for (const type of ["paragraph", "heading1", "heading2", "heading3"]) {
			const config = BLOCK_TYPE_CONFIG[type as keyof typeof BLOCK_TYPE_CONFIG];
			expect(blockTypeFromHtml(config.defaultContent), type).toBe(type);
		}
	});
});

describe("wrapInlineHTML", () => {
	test("wraps headings at the right level", () => {
		expect(wrapInlineHTML("heading1", "Title")).toBe("<h1>Title</h1>");
		expect(wrapInlineHTML("heading3", "Title")).toBe("<h3>Title</h3>");
	});

	test("nests code inside pre, which the tag lookup alone does not know", () => {
		// The divergence this replaced: the merge path knew about <pre><code> and
		// blockTagForType returned "p" for code, so splitting and merging a code
		// block disagreed about what it should look like.
		expect(wrapInlineHTML("code", "const x = 1")).toBe(
			"<pre><code>const x = 1</code></pre>",
		);
		expect(blockTagForType("code")).toBe("p");
	});

	test("wraps a quote as a quote and anything else as a paragraph", () => {
		expect(wrapInlineHTML("blockquote", "Said")).toBe(
			"<blockquote>Said</blockquote>",
		);
		expect(wrapInlineHTML("paragraph", "Text")).toBe("<p>Text</p>");
		expect(wrapInlineHTML("todo", "Task")).toBe("<p>Task</p>");
	});

	test("round-trips through the type derived from the HTML", () => {
		for (const type of ["heading1", "heading2", "blockquote", "paragraph"]) {
			const html = wrapInlineHTML(
				type as keyof typeof BLOCK_TYPE_CONFIG,
				"x",
			);
			expect(blockTypeFromHtml(html), type).toBe(type);
		}
	});
});
