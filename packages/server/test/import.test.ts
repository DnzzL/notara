import { describe, expect, test } from "bun:test";
import {
	determineParent,
	markdownToBlocks,
	parsePageTitle,
} from "../src/import/notion.js";

describe("markdownToBlocks", () => {
	test("converts paragraphs to paragraph blocks", () => {
		const md = "Hello world\nThis is a second paragraph";
		const blocks = markdownToBlocks(md);
		expect(blocks).toHaveLength(2);
		expect(blocks[0].type).toBe("paragraph");
		expect(blocks[0].content).toBe("Hello world");
		expect(blocks[1].type).toBe("paragraph");
		expect(blocks[1].content).toBe("This is a second paragraph");
	});

	test("converts headings to heading blocks", () => {
		const md = "# Main Title\n## Section\n### Subsection\nNormal text";
		const blocks = markdownToBlocks(md);
		// First # becomes page title, so ## Section is first block
		expect(blocks[0].type).toBe("heading2");
		expect(blocks[0].content).toBe("Section");
		expect(blocks[1].type).toBe("heading3");
		expect(blocks[1].content).toBe("Subsection");
		expect(blocks[2].type).toBe("paragraph");
		expect(blocks[2].content).toBe("Normal text");
	});

	test("converts bullet lists", () => {
		const md = "- Item one\n- Item two\n- Item three";
		const blocks = markdownToBlocks(md);
		expect(blocks).toHaveLength(3);
		expect(blocks[0].type).toBe("bulletList");
		expect(blocks[0].content).toBe("Item one");
	});

	test("converts checkboxes (todos)", () => {
		const md = "- [ ] Todo one\n- [x] Done thing";
		const blocks = markdownToBlocks(md);
		expect(blocks[0].type).toBe("todo");
		expect(blocks[0].content).toBe("Todo one");
		expect(blocks[1].type).toBe("todo");
		expect(blocks[1].content).toBe("Done thing");
	});

	test("converts code blocks", () => {
		const md = "Some text\n```\nconst x = 1;\nconsole.log(x);\n```\nMore text";
		const blocks = markdownToBlocks(md);
		expect(blocks).toHaveLength(3);
		expect(blocks[1].type).toBe("code");
		expect(blocks[1].content).toBe("const x = 1;\nconsole.log(x);\n");
	});

	test("converts blockquotes", () => {
		const md = "> This is a quote\nNormal text";
		const blocks = markdownToBlocks(md);
		expect(blocks[0].type).toBe("blockquote");
		expect(blocks[0].content).toBe("This is a quote");
	});

	test("converts horizontal rules", () => {
		const md = "Before\n---\nAfter";
		const blocks = markdownToBlocks(md);
		expect(blocks).toHaveLength(3);
		expect(blocks[1].type).toBe("divider");
	});

	test("skips title heading (becomes page title)", () => {
		const md = "# Page Title\nContent here";
		const blocks = markdownToBlocks(md);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].type).toBe("paragraph");
	});
});

describe("parsePageTitle", () => {
	test("extracts title from first heading", () => {
		const md = "# My Page Title\nSome content";
		expect(parsePageTitle(md)).toBe("My Page Title");
	});

	test("falls back to filename when no heading", () => {
		const md = "Just some content without heading";
		expect(parsePageTitle(md, "MyFile.md")).toBe("MyFile");
	});

	test("strips GUID from filename fallback", () => {
		const md = "Content";
		expect(
			parsePageTitle(md, "My Page (a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4).md"),
		).toBe("My Page");
	});
});

describe("determineParent", () => {
	test("extracts parent GUID from Notion folder structure", () => {
		const filePath =
			"Private & Shared/Parent Page (a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4)/Child.md";
		const guidMap = new Map([
			["a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4", "page-uuid-1"],
		]);
		expect(determineParent(filePath, guidMap)).toBe("page-uuid-1");
	});

	test("returns null for root-level files", () => {
		const filePath =
			"Private & Shared/Page (a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4).md";
		const guidMap = new Map();
		expect(determineParent(filePath, guidMap)).toBe(null);
	});

	test("returns null when parent GUID not in map", () => {
		const filePath =
			"Private & Shared/Parent (a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4)/Child.md";
		const guidMap = new Map();
		expect(determineParent(filePath, guidMap)).toBe(null);
	});
});
