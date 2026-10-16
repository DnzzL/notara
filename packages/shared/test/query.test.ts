/**
 * The shared evaluator (NOT-175) is the one implementation of filter semantics
 * the app and the records endpoint both run. These tests pin every operator
 * against every field type the registry offers it for, so the app's
 * `filterEngine` regression net (packages/app/test/filterEngine.test.ts) and the
 * server's route tests can lean on the same behaviour.
 */
import { describe, expect, it } from "vitest";
import { fieldTypeSpec } from "../src/field-types.js";
import {
	matchesFilter,
	matchesFilters,
	operatorsForFieldType,
} from "../src/query.js";

const matches = (type: string, operator: never, cell: unknown, value: string) =>
	matchesFilter(type, operator, cell, value);

describe("text", () => {
	it("contains and is are case-insensitive", () => {
		expect(matches("text", "contains" as never, "Alpha", "ALPH")).toBe(true);
		expect(matches("text", "contains" as never, "Alpha", "beta")).toBe(false);
		expect(matches("text", "is" as never, "Alpha", "alpha")).toBe(true);
		expect(matches("text", "is_not" as never, "Alpha", "alpha")).toBe(false);
	});

	it("does_not_contain is the negation of contains", () => {
		expect(matches("text", "does_not_contain" as never, "Alpha", "beta")).toBe(
			true,
		);
	});

	it("is_empty and is_not_empty split on the blank cell", () => {
		expect(matches("text", "is_empty" as never, "", "")).toBe(true);
		expect(matches("text", "is_empty" as never, null, "")).toBe(true);
		expect(matches("text", "is_not_empty" as never, "x", "")).toBe(true);
		expect(matches("text", "is_not_empty" as never, "", "")).toBe(false);
	});
});

describe("number", () => {
	it("compares numerically, however the value is written", () => {
		expect(matches("number", "is" as never, 1, "1.0")).toBe(true);
		expect(matches("number", "is" as never, 1, "2")).toBe(false);
		expect(matches("number", "gt" as never, 10, "4")).toBe(true);
		expect(matches("number", "gte" as never, 4, "4")).toBe(true);
		expect(matches("number", "lt" as never, 4, "10")).toBe(true);
		expect(matches("number", "lte" as never, 4, "4")).toBe(true);
		expect(matches("number", "gt" as never, 1, "4")).toBe(false);
	});

	it("an absent number is empty", () => {
		expect(matches("number", "is_empty" as never, null, "")).toBe(true);
		expect(matches("number", "is_not_empty" as never, 0.5, "")).toBe(true);
	});
});

describe("select", () => {
	it("is and is_not are exact, if case-insensitive", () => {
		expect(matches("select", "is" as never, "done", "Done")).toBe(true);
		expect(matches("select", "is_not" as never, "done", "Done")).toBe(false);
		expect(matches("select", "is_empty" as never, "", "")).toBe(true);
	});
});

describe("multiSelect", () => {
	it("matches on membership", () => {
		expect(matches("multiSelect", "contains" as never, ["bug"], "bug")).toBe(
			true,
		);
		expect(
			matches("multiSelect", "contains" as never, ["bug", "ux"], "ux"),
		).toBe(true);
		expect(
			matches("multiSelect", "contains" as never, ["bug"], "enhancement"),
		).toBe(false);
		expect(
			matches("multiSelect", "does_not_contain" as never, ["bug"], "ux"),
		).toBe(true);
	});

	it("an empty list is empty, not a value", () => {
		expect(matches("multiSelect", "is_empty" as never, [], "")).toBe(true);
		expect(matches("multiSelect", "is_empty" as never, ["bug"], "")).toBe(
			false,
		);
		expect(matches("multiSelect", "is_not_empty" as never, ["bug"], "")).toBe(
			true,
		);
		expect(matches("multiSelect", "is_not_empty" as never, [], "")).toBe(false);
		expect(matches("multiSelect", "is" as never, ["bug"], "bug")).toBe(true);
	});
});

describe("date", () => {
	it("understands before and after, parsed as dates", () => {
		expect(matches("date", "before" as never, "2026-01-05", "2026-02-01")).toBe(
			true,
		);
		expect(matches("date", "after" as never, "2026-03-03", "2026-02-01")).toBe(
			true,
		);
		expect(matches("date", "after" as never, "2026-01-05", "2026-02-01")).toBe(
			false,
		);
		expect(matches("date", "is" as never, "2026-03-03", "2026-03-03")).toBe(
			true,
		);
		expect(matches("date", "is_empty" as never, "", "")).toBe(true);
	});
});

describe("checkbox", () => {
	it("tick and untick, a never-written cell reading as false", () => {
		expect(matches("checkbox", "is" as never, true, "true")).toBe(true);
		expect(matches("checkbox", "is" as never, false, "false")).toBe(true);
		expect(matches("checkbox", "is" as never, undefined, "false")).toBe(true);
		expect(matches("checkbox", "is" as never, undefined, "true")).toBe(false);
		expect(matches("checkbox", "is_empty" as never, false, "")).toBe(true);
	});
});

describe("multi-value link fields", () => {
	it.each(["page", "relation", "people"])(
		"%s matches on membership",
		(type) => {
			expect(matches(type, "contains" as never, ["p1", "p2"], "p2")).toBe(true);
			expect(matches(type, "contains" as never, [], "p1")).toBe(false);
			expect(matches(type, "is_empty" as never, [], "")).toBe(true);
			expect(matches(type, "is_not_empty" as never, ["p1"], "")).toBe(true);
		},
	);
});

describe("a field's operator list", () => {
	it("comes from the registry, not a second switch", () => {
		expect(operatorsForFieldType("number")).toEqual(
			fieldTypeSpec("number").operators,
		);
		expect(operatorsForFieldType("checkbox")).toEqual(["is"]);
		expect(operatorsForFieldType("date")).toContain("before");
		// A type this build does not know falls back to text, badly but not fatally.
		expect(operatorsForFieldType("mystery")).toEqual(
			fieldTypeSpec("text").operators,
		);
	});
});

describe("a whole filter list, ANDed", () => {
	const fields = [
		{ id: "f1", name: "Name", type: "text" },
		{ id: "f2", name: "Score", type: "number" },
	] as never;

	const rows = [
		{ values: { Name: "Alpha", Score: "10" } },
		{ values: { Name: "Beta", Score: "" } },
		{ values: { Name: "Gamma", Score: "30" } },
	];

	it("keeps the rows every filter passes", () => {
		expect(
			matchesFilters(rows, fields, [
				{ fieldId: "f2", operator: "is_not_empty", value: "" },
				{ fieldId: "f1", operator: "contains", value: "a" },
			]).map((r) => r.values.Name),
		).toEqual(["Alpha", "Gamma"]);
	});

	it("ignores a filter on a field that no longer exists", () => {
		expect(
			matchesFilters(rows, fields, [
				{ fieldId: "gone", operator: "is", value: "x" },
			]).length,
		).toBe(3);
	});
});
