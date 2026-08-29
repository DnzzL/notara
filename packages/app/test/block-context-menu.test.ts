/**
 * The database block's context-menu zone.
 *
 * The menu behind this predicate has exactly one item, and that item deletes a
 * database. It used to open from anywhere on the block wrapper, which for a
 * database is the entire table — so a right-click on a cell, or a long press
 * on a row on touch, put a delete confirmation in front of someone who had
 * asked for nothing. Worth pinning: the failure mode is data loss, and the
 * zone is invisible, so nothing else would notice it widening again.
 */
import { describe, expect, test } from "bun:test";
import { shouldOpenBlockMenu } from "../src/lib/blockContextMenu.js";

/** Stands in for an event target, with the two properties the check reads. */
const target = (tagName: string, insideName: boolean) => ({
	tagName,
	closest: (selector: string) =>
		selector === ".db-toolbar-name" && insideName ? {} : null,
});

describe("shouldOpenBlockMenu", () => {
	test("a non-database block opens from anywhere", () => {
		expect(shouldOpenBlockMenu("paragraph", target("TD", false))).toBe(true);
		expect(shouldOpenBlockMenu("heading", target("SPAN", false))).toBe(true);
	});

	test("a database opens from its name", () => {
		expect(shouldOpenBlockMenu("database", target("BUTTON", true))).toBe(true);
	});

	test("a database does not open from a cell", () => {
		expect(shouldOpenBlockMenu("database", target("TD", false))).toBe(false);
	});

	test("a database does not open from a toolbar control", () => {
		expect(shouldOpenBlockMenu("database", target("BUTTON", false))).toBe(
			false,
		);
	});

	test("the rename input keeps the browser's own menu", () => {
		expect(shouldOpenBlockMenu("database", target("INPUT", true))).toBe(false);
	});
});
