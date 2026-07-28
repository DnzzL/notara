import { describe, expect, test } from "bun:test";

// ── Helper: compute numbered-run index for consecutive numberedList blocks ──
// This utility is extracted from the BlockEditor render loop. It assigns each
// block a `numberedRunIndex` starting at 1, resetting to 1 whenever a
// non-numberedList block appears between two numberedList blocks.

type BlockShape = { id: string; type: string; index: number };

function computeNumberedRunIndices(blocks: BlockShape[]): Map<string, number> {
	const result = new Map<string, number>();
	let currentRun = 1;

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		if (block.type === "numberedList") {
			result.set(block.id, currentRun);
			currentRun++;
		} else {
			currentRun = 1;
		}
	}

	return result;
}

describe("computeNumberedRunIndices", () => {
	test("single numberedList block gets index 1", () => {
		const blocks = [{ id: "a", type: "numberedList", index: 0 }];
		const indices = computeNumberedRunIndices(blocks);
		expect(indices.get("a")).toBe(1);
	});

	test("consecutive numberedList blocks get 1, 2, 3", () => {
		const blocks = [
			{ id: "a", type: "numberedList", index: 0 },
			{ id: "b", type: "numberedList", index: 1 },
			{ id: "c", type: "numberedList", index: 2 },
		];
		const indices = computeNumberedRunIndices(blocks);
		expect(indices.get("a")).toBe(1);
		expect(indices.get("b")).toBe(2);
		expect(indices.get("c")).toBe(3);
	});

	test("non-numbered block resets the run", () => {
		const blocks = [
			{ id: "a", type: "numberedList", index: 0 },
			{ id: "b", type: "numberedList", index: 1 },
			{ id: "c", type: "paragraph", index: 2 },
			{ id: "d", type: "numberedList", index: 3 },
		];
		const indices = computeNumberedRunIndices(blocks);
		expect(indices.get("a")).toBe(1);
		expect(indices.get("b")).toBe(2);
		expect(indices.get("c")).toBeUndefined(); // not numbered
		expect(indices.get("d")).toBe(1); // restarts
	});

	test("non-numbered block types (paragraph, heading, bulletList, todo) all reset", () => {
		const blocks = [
			{ id: "a", type: "numberedList", index: 0 },
			{ id: "b", type: "paragraph", index: 1 },
			{ id: "c", type: "numberedList", index: 2 },
			{ id: "d", type: "bulletList", index: 3 },
			{ id: "e", type: "numberedList", index: 4 },
			{ id: "f", type: "todo", index: 5 },
			{ id: "g", type: "numberedList", index: 6 },
		];
		const indices = computeNumberedRunIndices(blocks);
		expect(indices.get("a")).toBe(1);
		expect(indices.get("c")).toBe(1); // after paragraph
		expect(indices.get("e")).toBe(1); // after bulletList
		expect(indices.get("g")).toBe(1); // after todo
	});

	test("multiple runs all start at 1", () => {
		const blocks = [
			{ id: "a", type: "numberedList", index: 0 },
			{ id: "b", type: "numberedList", index: 1 },
			{ id: "c", type: "paragraph", index: 2 },
			{ id: "d", type: "numberedList", index: 3 },
			{ id: "e", type: "paragraph", index: 4 },
			{ id: "f", type: "numberedList", index: 5 },
			{ id: "g", type: "numberedList", index: 6 },
		];
		const indices = computeNumberedRunIndices(blocks);
		expect(indices.get("a")).toBe(1);
		expect(indices.get("b")).toBe(2);
		expect(indices.get("d")).toBe(1); // run 2 starts
		expect(indices.get("f")).toBe(1); // run 3 starts
		expect(indices.get("g")).toBe(2); // run 3 continues
	});

	test("empty blocks list returns empty map", () => {
		const indices = computeNumberedRunIndices([]);
		expect(indices.size).toBe(0);
	});

	test("non-numbered blocks are not in the map", () => {
		const blocks = [
			{ id: "a", type: "paragraph", index: 0 },
			{ id: "b", type: "bulletList", index: 1 },
			{ id: "c", type: "todo", index: 2 },
		];
		const indices = computeNumberedRunIndices(blocks);
		expect(indices.has("a")).toBe(false);
		expect(indices.has("b")).toBe(false);
		expect(indices.has("c")).toBe(false);
	});
});
