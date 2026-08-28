/**
 * Multi-select is the one case the design system reserves a chip for: several
 * values side by side, each needing a boundary. Past two they collapse into a
 * count, so a tag-heavy record stays one `--row` tall instead of wrapping the
 * table out of its rhythm.
 *
 * The split is the part worth pinning — it is what stops a cell with eight tags
 * from silently breaking the row rhythm the whole Établi register rests on.
 */
import { describe, expect, test } from "bun:test";
import { splitMultiSelect } from "../src/lib/multiSelect.js";

describe("splitMultiSelect", () => {
	test("shows everything when it fits", () => {
		expect(splitMultiSelect(["a", "b"])).toEqual({
			shown: ["a", "b"],
			hidden: [],
		});
	});

	test("collapses the tail past the limit", () => {
		expect(splitMultiSelect(["a", "b", "c", "d"])).toEqual({
			shown: ["a", "b"],
			hidden: ["c", "d"],
		});
	});

	test("one value is still a chip, not a bare dot", () => {
		expect(splitMultiSelect(["only"])).toEqual({ shown: ["only"], hidden: [] });
	});

	test("no values is nothing, not an empty chip", () => {
		expect(splitMultiSelect([])).toEqual({ shown: [], hidden: [] });
	});

	test("exactly at the limit does not produce a +0", () => {
		const { hidden } = splitMultiSelect(["a", "b"]);
		expect(hidden).toHaveLength(0);
	});
});
