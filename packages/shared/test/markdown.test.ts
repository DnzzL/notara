/**
 * NOT-183 moved `markdownToBlocks` out of the Notion importer into
 * `@notara/shared` so the importer and the app read markdown the same way.
 * A move must not change a single block, so every test here pins the exact
 * blocks one construct produces — that pinned output is the contract the
 * importer's own tests (packages/server/test/import.test.ts) relied on before
 * the move.
 */
import { describe, expect, it } from "vitest";
import { markdownToBlocks } from "../src/markdown.js";

describe("markdownToBlocks", () => {
	it("reads a plain line as a paragraph", () => {
		expect(markdownToBlocks("Hello world")).toEqual([
			{ type: "paragraph", content: "Hello world" },
		]);
	});

	it("reads headings 2 and 3 with their level kept", () => {
		expect(markdownToBlocks("## Section\n### Subsection")).toEqual([
			{ type: "heading2", content: "Section" },
			{ type: "heading3", content: "Subsection" },
		]);
	});

	it("drops the first h1 as the page title by default", () => {
		expect(markdownToBlocks("# Page Title\nContent here")).toEqual([
			{ type: "paragraph", content: "Content here" },
		]);
	});

	it("keeps the first h1 when skipFirstH1 is false", () => {
		expect(markdownToBlocks("# Page Title", { skipFirstH1: false })).toEqual([
			{ type: "heading1", content: "Page Title" },
		]);
	});

	it("skips only the first h1, not a later one", () => {
		expect(markdownToBlocks("# Title\n# Second")).toEqual([
			{ type: "heading1", content: "Second" },
		]);
	});

	it("reads unchecked and checked todos, any case of x", () => {
		expect(markdownToBlocks("- [ ] Todo\n- [x] Done\n- [X] Also done")).toEqual(
			[
				{ type: "todo", content: "Todo", checked: false },
				{ type: "todo", content: "Done", checked: true },
				{ type: "todo", content: "Also done", checked: true },
			],
		);
	});

	it("reads a bullet list item", () => {
		expect(markdownToBlocks("- Item one\n- Item two")).toEqual([
			{ type: "bulletList", content: "Item one" },
			{ type: "bulletList", content: "Item two" },
		]);
	});

	it("reads an ordered list item", () => {
		expect(markdownToBlocks("1. First\n10. Tenth")).toEqual([
			{ type: "numberedList", content: "First" },
			{ type: "numberedList", content: "Tenth" },
		]);
	});

	it("reads a blockquote", () => {
		expect(markdownToBlocks("> A quote")).toEqual([
			{ type: "blockquote", content: "A quote" },
		]);
	});

	it("reads a divider", () => {
		expect(markdownToBlocks("---")).toEqual([{ type: "divider", content: "" }]);
	});

	it("reads a fenced block with no language as `code`", () => {
		expect(markdownToBlocks("```\nconst x = 1;\nconsole.log(x);\n```")).toEqual(
			[{ type: "code", content: "const x = 1;\nconsole.log(x);" }],
		);
	});

	it("names a fenced block after its language tag", () => {
		expect(markdownToBlocks("```ts\nconst x = 1;\n```")).toEqual([
			{ type: "code-ts", content: "const x = 1;" },
		]);
	});

	it("flushes an unterminated fenced block that has content", () => {
		expect(markdownToBlocks("```\nconst x = 1;")).toEqual([
			{ type: "code", content: "const x = 1;" },
		]);
	});

	it("ignores blank lines", () => {
		expect(markdownToBlocks("Before\n\nAfter")).toEqual([
			{ type: "paragraph", content: "Before" },
			{ type: "paragraph", content: "After" },
		]);
	});

	it("reads a standalone image line as a relative src plus its file name", () => {
		expect(markdownToBlocks("![a cat](images/cat.png)")).toEqual([
			{
				type: "image",
				content: JSON.stringify({
					src: "images/cat.png",
					fileName: "cat.png",
				}),
			},
		]);
	});

	it("reads a standalone link to a .md file as a page reference", () => {
		const guid = "0123456789abcdef0123456789abcdef";
		expect(markdownToBlocks(`[Sub page](Sub%20page%20${guid}.md)`)).toEqual([
			{
				type: "pageLink",
				content: JSON.stringify({ __pageRef: guid }),
			},
		]);
	});
});
