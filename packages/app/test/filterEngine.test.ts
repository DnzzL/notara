/**
 * The query engine had no tests at all, despite being pure and trivially
 * testable — a pure omission rather than a hard problem.
 *
 * The cases that matter most here are the ones that make a saved view behave
 * the same in a table and in a reference block, because it did not: the block
 * carried its own engine that understood five operators the filter UI never
 * emits, ignored the ones it does, and read `order` where the table writes
 * `direction`, so every sort silently did nothing.
 */
import { describe, expect, test } from "bun:test";
import {
	applyFilters,
	applyFiltersAndSorts,
	applySorts,
	operatorsForFieldType,
} from "../src/lib/filterEngine.js";
import { parseViewConfig, serializeViewConfig } from "../src/lib/viewConfig.js";

const field = (id: string, name: string, type: string) =>
	({ id, name, type }) as never;

const fields = [
	field("f1", "Name", "text"),
	field("f2", "Score", "number"),
	field("f3", "Due", "date"),
	field("f4", "Done", "checkbox"),
];

const row = (values: Record<string, unknown>, id = String(Math.random())) =>
	({ record: { id, title: String(values.Name ?? "") }, values }) as never;

const names = (rows: readonly unknown[]) =>
	rows.map((r) => (r as { values: Record<string, unknown> }).values.Name);

describe("applyFilters", () => {
	const rows = [
		row({ Name: "Alpha", Score: "10" }),
		row({ Name: "Beta", Score: "" }),
		row({ Name: "Gamma", Score: "30" }),
	];

	test("contains and is are case-insensitive", () => {
		expect(
			names(
				applyFilters(rows, fields, [
					{ fieldId: "f1", operator: "contains", value: "ALPH" },
				]),
			),
		).toEqual(["Alpha"]);
	});

	test("is_empty and is_not_empty split on the blank cell", () => {
		// These are emitted by the filter UI and were among the operators the
		// reference block's engine ignored entirely.
		expect(
			names(
				applyFilters(rows, fields, [
					{ fieldId: "f2", operator: "is_empty", value: "" },
				]),
			),
		).toEqual(["Beta"]);
		expect(
			names(
				applyFilters(rows, fields, [
					{ fieldId: "f2", operator: "is_not_empty", value: "" },
				]),
			),
		).toEqual(["Alpha", "Gamma"]);
	});

	test("numeric comparisons compare numbers", () => {
		expect(
			names(
				applyFilters(rows, fields, [
					{ fieldId: "f2", operator: "gt", value: "20" },
				]),
			),
		).toEqual(["Gamma"]);
	});

	test("several filters all have to pass", () => {
		expect(
			names(
				applyFilters(rows, fields, [
					{ fieldId: "f2", operator: "is_not_empty", value: "" },
					{ fieldId: "f1", operator: "contains", value: "a" },
				]),
			),
		).toEqual(["Alpha", "Gamma"]);
	});

	test("a filter on a deleted field is ignored rather than emptying the view", () => {
		expect(
			names(
				applyFilters(rows, fields, [
					{ fieldId: "gone", operator: "is", value: "x" },
				]),
			),
		).toEqual(["Alpha", "Beta", "Gamma"]);
	});
});

describe("applySorts", () => {
	test("sorts dates chronologically, not as text", () => {
		// Only `number` used to be special-cased, so this was wrong for every
		// non-ISO date format.
		const rows = [
			row({ Name: "later", Due: "March 3, 2026" }),
			row({ Name: "earlier", Due: "January 5, 2026" }),
		];
		expect(
			names(applySorts(rows, fields, [{ fieldId: "f3", direction: "asc" }])),
		).toEqual(["earlier", "later"]);
	});

	test("sorts numbers numerically", () => {
		const rows = [
			row({ Name: "big", Score: "100" }),
			row({ Name: "small", Score: "9" }),
		];
		expect(
			names(applySorts(rows, fields, [{ fieldId: "f2", direction: "asc" }])),
		).toEqual(["small", "big"]);
	});

	test("descending reverses it", () => {
		const rows = [
			row({ Name: "small", Score: "9" }),
			row({ Name: "big", Score: "100" }),
		];
		expect(
			names(applySorts(rows, fields, [{ fieldId: "f2", direction: "desc" }])),
		).toEqual(["big", "small"]);
	});

	test("the first sort wins, the second breaks ties", () => {
		const rows = [
			row({ Name: "b", Done: "true" }),
			row({ Name: "a", Done: "true" }),
			row({ Name: "c", Done: "false" }),
		];
		expect(
			names(
				applySorts(rows, fields, [
					{ fieldId: "f4", direction: "asc" },
					{ fieldId: "f1", direction: "asc" },
				]),
			),
		).toEqual(["c", "a", "b"]);
	});
});

describe("operatorsForFieldType", () => {
	test("offers comparisons on numbers and not on checkboxes", () => {
		expect(operatorsForFieldType("number")).toContain("gt");
		expect(operatorsForFieldType("checkbox")).toEqual(["is"]);
	});

	test("offers date comparisons on dates", () => {
		expect(operatorsForFieldType("date")).toContain("before");
	});
});

describe("a saved view means the same thing everywhere", () => {
	// The user-visible defect: these configurations exist in databases, written
	// by the reference block's own spelling, and used to filter and sort nothing.
	const legacy = JSON.stringify({
		filters: [{ fieldId: "f2", operator: "notEmpty", value: "" }],
		sorts: [{ fieldId: "f1", order: "desc" }],
		boardHidden: [],
	});

	test("legacy operator spellings are normalised on read", () => {
		expect(parseViewConfig(legacy).filters[0].operator).toBe("is_not_empty");
	});

	test("a sort written as `order` is read as `direction`", () => {
		expect(parseViewConfig(legacy).sorts[0]).toEqual({
			fieldId: "f1",
			direction: "desc",
		});
	});

	test("the normalised config actually filters and sorts", () => {
		const rows = [
			row({ Name: "Alpha", Score: "10" }),
			row({ Name: "Beta", Score: "" }),
			row({ Name: "Gamma", Score: "30" }),
		];
		const config = parseViewConfig(legacy);
		expect(
			names(applyFiltersAndSorts(rows, fields, config.filters, config.sorts)),
		).toEqual(["Gamma", "Alpha"]);
	});

	test("a malformed config reads as empty rather than throwing", () => {
		expect(parseViewConfig("{not json")).toEqual({
			filters: [],
			sorts: [],
			boardHidden: [],
		});
		expect(parseViewConfig(null)).toEqual({
			filters: [],
			sorts: [],
			boardHidden: [],
		});
	});

	test("serialising a parsed legacy config emits the current spelling", () => {
		const round = serializeViewConfig(parseViewConfig(legacy));
		expect(round).toContain('"direction":"desc"');
		expect(round).toContain('"is_not_empty"');
		expect(round).not.toContain('"order"');
	});
});
