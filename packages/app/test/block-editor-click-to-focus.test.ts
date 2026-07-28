import { describe, expect, test } from "bun:test";

// ── Helper: determine which block to focus based on click position ──
// These utilities model the "click below last block" (AC#1) and
// "click beside a block" (AC#2) behaviors.

type ClickTarget = {
	/** Index of the block to focus, or -1 to create a new trailing block. */
	blockIndex: number;
	/** Where to place the caret in the target block. */
	position: "start" | "end" | "nearest-to-click";
};

/**
 * Given the total number of blocks and the y-offset of a click relative to
 * the blocks container, decide which block to focus.
 *
 * @param blockCount — total number of rendered blocks.
 * @param blockRects — array of { top, bottom } for each block in order.
 * @param clickY — y-coordinate of the click relative to the container.
 */
function resolveClickTarget(
	blockCount: number,
	blockRects: Array<{ top: number; bottom: number }>,
	clickY: number,
): ClickTarget {
	if (blockCount === 0) {
		return { blockIndex: -1, position: "start" };
	}

	// Check if click is below the last block
	const lastRect = blockRects[blockRects.length - 1];
	if (clickY >= lastRect.bottom) {
		return { blockIndex: blockCount - 1, position: "end" };
	}

	// Check if click is above the first block
	const firstRect = blockRects[0];
	if (clickY < firstRect.top) {
		return { blockIndex: 0, position: "start" };
	}

	// Find which block the click falls within or beside
	for (let i = 0; i < blockCount; i++) {
		const rect = blockRects[i];
		if (clickY >= rect.top && clickY < rect.bottom) {
			// Click is within this block's vertical bounds
			const midY = (rect.top + rect.bottom) / 2;
			return {
				blockIndex: i,
				position: clickY < midY ? "start" : "end",
			};
		}
		// Check if click is in the gap between this block and the next
		if (i < blockCount - 1) {
			const nextRect = blockRects[i + 1];
			if (clickY >= rect.bottom && clickY < nextRect.top) {
				// Click is in the gap between blocks
				const gapMid = (rect.bottom + nextRect.top) / 2;
				return {
					blockIndex: clickY < gapMid ? i : i + 1,
					position: clickY < gapMid ? "end" : "start",
				};
			}
		}
	}

	// Fallback: focus the last block
	return { blockIndex: blockCount - 1, position: "end" };
}

describe("resolveClickTarget", () => {
	const singleBlock = [{ top: 100, bottom: 140 }];
	const threeBlocks = [
		{ top: 100, bottom: 140 },
		{ top: 160, bottom: 200 },
		{ top: 220, bottom: 260 },
	];

	test("click below last block focuses last at end", () => {
		expect(resolveClickTarget(1, singleBlock, 200)).toEqual({
			blockIndex: 0,
			position: "end",
		});
	});

	test("click above first block focuses first at start", () => {
		expect(resolveClickTarget(1, singleBlock, 50)).toEqual({
			blockIndex: 0,
			position: "start",
		});
	});

	test("click in top half of block focuses start", () => {
		expect(resolveClickTarget(1, singleBlock, 110)).toEqual({
			blockIndex: 0,
			position: "start",
		});
	});

	test("click in bottom half of block focuses end", () => {
		expect(resolveClickTarget(1, singleBlock, 135)).toEqual({
			blockIndex: 0,
			position: "end",
		});
	});

	test("click between blocks focuses nearest block edge", () => {
		// Gap between block 0 (bottom=140) and block 1 (top=160)
		// Gap mid = 150. Above 150 → block 0 end. Below 150 → block 1 start.
		expect(resolveClickTarget(3, threeBlocks, 145)).toEqual({
			blockIndex: 0,
			position: "end",
		});
		expect(resolveClickTarget(3, threeBlocks, 155)).toEqual({
			blockIndex: 1,
			position: "start",
		});
	});

	test("empty blocks returns -1 for create-new", () => {
		expect(resolveClickTarget(0, [], 100)).toEqual({
			blockIndex: -1,
			position: "start",
		});
	});

	test("last of three blocks — below all focuses last at end", () => {
		expect(resolveClickTarget(3, threeBlocks, 300)).toEqual({
			blockIndex: 2,
			position: "end",
		});
	});

	test("click in middle block targets correctly", () => {
		// Click at top of middle block (165 < mid=180) → start
		expect(resolveClickTarget(3, threeBlocks, 165)).toEqual({
			blockIndex: 1,
			position: "start",
		});
		// Click at bottom of middle block (190 > mid=180) → end
		expect(resolveClickTarget(3, threeBlocks, 190)).toEqual({
			blockIndex: 1,
			position: "end",
		});
	});
});
