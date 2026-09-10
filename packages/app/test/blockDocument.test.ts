/**
 * Split/merge/insert used to be inline closures in BlockEditor.tsx, only
 * reachable by mounting a TipTap editor. blockDocument.ts pulled the pure
 * computation out; these tests import it directly instead of re-deriving
 * the logic, so a regression here is a real regression and not a copy
 * drifting from the original.
 *
 * mergeBlocks calls extractInlineHTML, which parses with `DOMParser` — a
 * browser API this bun:test environment doesn't provide. The fixtures below
 * only ever nest one element deep (e.g. `<ul><li>...</li></ul>`), so a
 * handful of lines of tag matching stands in for it, scoped to this file.
 */
import { describe, expect, test } from "bun:test";
import {
	type BlockLike,
	insertBlockAfter,
	mergeBlocks,
	splitBlock,
} from "../src/lib/blockDocument.js";

class FakeElement {
	readonly children: FakeElement[];
	constructor(
		readonly tagName: string,
		readonly innerHTML: string,
	) {
		this.children = splitTopLevelElements(innerHTML);
	}
	get firstElementChild(): FakeElement | null {
		return this.children[0] ?? null;
	}
	get textContent(): string {
		return this.innerHTML.replace(/<[^>]*>/g, "");
	}
}

function splitTopLevelElements(html: string): FakeElement[] {
	const elements: FakeElement[] = [];
	const tagRe = /<(\/?)(\w+)[^>]*>/g;
	let depth = 0;
	let start = -1;
	for (const match of html.matchAll(tagRe)) {
		const [full, closing, tag] = match;
		if (!closing) {
			if (depth === 0) start = match.index;
			depth++;
		} else {
			depth--;
			if (depth === 0) {
				const outer = html.slice(start, match.index + full.length);
				const inner = outer.slice(
					outer.indexOf(">") + 1,
					outer.lastIndexOf("<"),
				);
				elements.push(new FakeElement(tag, inner));
			}
		}
	}
	return elements;
}

(globalThis as { DOMParser?: unknown }).DOMParser = class {
	parseFromString(html: string) {
		return { body: new FakeElement("body", html) };
	}
};

function block(overrides: Partial<BlockLike> = {}): BlockLike {
	return {
		id: "block-1",
		type: "paragraph",
		content: "<p></p>",
		index: 0,
		...overrides,
	};
}

describe("mergeBlocks", () => {
	test("concatenates inline content and wraps it in the previous block's type", () => {
		const prev = block({
			id: "prev",
			type: "heading1",
			content: "<h1>Hello</h1>",
		});
		const current = block({
			id: "cur",
			type: "paragraph",
			content: "<p> world</p>",
		});

		const op = mergeBlocks(prev, current);

		expect(op.updateBlock).toEqual({
			id: "prev",
			content: "<h1>Hello world</h1>",
		});
		expect(op.deleteBlockId).toBe("cur");
	});

	test("caret lands at the seam, the text length of the previous block", () => {
		const prev = block({ id: "prev", content: "<p>abc</p>" });
		const current = block({ id: "cur", content: "<p>def</p>" });

		const op = mergeBlocks(prev, current);

		expect(op.focus).toEqual({ blockId: "prev", offset: 3 });
	});

	test("derives the previous block's type from its content, not its stored type", () => {
		// A markdown transform ("# " -> heading) may have changed the content
		// without yet persisting the type field.
		const prev = block({
			id: "prev",
			type: "paragraph",
			content: "<h2>item</h2>",
		});
		const current = block({ id: "cur", content: "<p>more</p>" });

		const op = mergeBlocks(prev, current);

		expect(op.updateBlock.content).toBe("<h2>itemmore</h2>");
	});

	test("falls back to the type's default content for empty blocks", () => {
		const prev = block({ id: "prev", type: "heading2", content: "" });
		const current = block({ id: "cur", content: "" });

		const op = mergeBlocks(prev, current);

		expect(op.updateBlock.content).toBe("<h2></h2>");
		expect(op.focus.offset).toBe(0);
	});
});

describe("splitBlock", () => {
	test("keeps beforeContent in the current block and puts afterContent in a new one", () => {
		const current = block({
			id: "cur",
			index: 2,
			content: "<p>hello world</p>",
		});

		const op = splitBlock(current, "<p>hello</p>", "<p>world</p>", "new-id");

		expect(op.updateBlock).toEqual({
			id: "cur",
			content: "<p>hello</p>",
			type: undefined,
		});
		expect(op.insertBlock).toEqual({
			id: "new-id",
			type: "paragraph",
			content: "<p>world</p>",
			index: 3,
			parentId: null,
		});
		expect(op.focus).toEqual({ blockId: "new-id" });
	});

	test("defaults the new block's type to paragraph", () => {
		const current = block({ id: "cur", index: 0 });

		const op = splitBlock(current, "<p>a</p>", "<p>b</p>", "new-id");

		expect(op.insertBlock.type).toBe("paragraph");
	});

	test("honours an explicit new block type, e.g. splitting out of a list item", () => {
		const current = block({ id: "cur", type: "bulletList", index: 0 });

		const op = splitBlock(
			current,
			"<ul><li>a</li></ul>",
			"<p></p>",
			"new-id",
			"paragraph",
		);

		expect(op.insertBlock.type).toBe("paragraph");
	});

	test("carries a changed current type only when it differs from the stored one", () => {
		const current = block({ id: "cur", type: "paragraph", index: 0 });

		// currentType matches: no type update needed.
		const unchanged = splitBlock(
			current,
			"<p>a</p>",
			"<p>b</p>",
			"new-id",
			undefined,
			"paragraph",
		);
		expect(unchanged.updateBlock.type).toBeUndefined();

		// currentType differs (markdown transform turned it into a bullet list
		// before the split): the split must persist that alongside the content.
		const changed = splitBlock(
			current,
			"<ul><li>a</li></ul>",
			"<p>b</p>",
			"new-id",
			undefined,
			"bulletList",
		);
		expect(changed.updateBlock.type).toBe("bulletList");
	});

	test("falls back to default content for empty before/after halves", () => {
		const current = block({ id: "cur", type: "heading1", index: 0 });

		const op = splitBlock(current, "", "", "new-id");

		expect(op.updateBlock.content).toBe("<h1></h1>");
		expect(op.insertBlock.content).toBe("<p></p>");
	});
});

describe("insertBlockAfter", () => {
	test("inserts an empty paragraph right after the current block", () => {
		const current = block({ id: "cur", index: 4 });

		const op = insertBlockAfter(current, "new-id");

		expect(op.insertBlock).toEqual({
			id: "new-id",
			type: "paragraph",
			content: "<p></p>",
			index: 5,
			parentId: null,
		});
		expect(op.focus).toEqual({ blockId: "new-id" });
	});
});
