/**
 * Keyboard navigation in the command palette.
 *
 * The list the arrow keys walked and the list the screen highlighted were not
 * the same list. `getFlatResults()` returned `[]` while the query was empty —
 * which is the palette's *default* state, showing recent pages — so ArrowDown
 * clamped `selectedIndex` to `-1`, the highlight vanished, and Enter did
 * nothing. Two of the three rendered sections indexed from their own zero on
 * top of that, so only the very first row was ever correct.
 *
 * One list now. This is that list.
 */
import { describe, expect, test } from "bun:test";
import { flattenSearchItems } from "../src/lib/search-navigation.js";

const page = (id: string) => ({ id, title: id, icon: null });
const result = (id: string, type: "page" | "block") => ({
	type,
	id,
	pageId: `p-${id}`,
	title: id,
});

describe("flattenSearchItems", () => {
	test("with no query, the recent pages are the list", () => {
		const flat = flattenSearchItems({
			query: "",
			recentPages: [page("a"), page("b")],
			pageResults: [],
			blockResults: [],
		});
		expect(flat.map((i) => i.id)).toEqual(["a", "b"]);
	});

	test("with a query, pages come before blocks", () => {
		const flat = flattenSearchItems({
			query: "x",
			recentPages: [page("recent")],
			pageResults: [result("p1", "page")],
			blockResults: [result("b1", "block")],
		});
		expect(flat.map((i) => i.id)).toEqual(["p1", "b1"]);
	});

	test("a query hides the recents even when it matches nothing", () => {
		const flat = flattenSearchItems({
			query: "zzz",
			recentPages: [page("a")],
			pageResults: [],
			blockResults: [],
		});
		expect(flat).toEqual([]);
	});

	test("whitespace is not a query", () => {
		const flat = flattenSearchItems({
			query: "   ",
			recentPages: [page("a")],
			pageResults: [],
			blockResults: [],
		});
		expect(flat.map((i) => i.id)).toEqual(["a"]);
	});

	test("every item carries the pageId navigation needs", () => {
		const flat = flattenSearchItems({
			query: "",
			recentPages: [page("a")],
			pageResults: [],
			blockResults: [],
		});
		expect(flat[0]?.pageId).toBe("a");
	});
});
