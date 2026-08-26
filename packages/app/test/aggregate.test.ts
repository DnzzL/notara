/**
 * Aggregation, testable for the first time.
 *
 * It lived inside `ColumnFooter` as a `useMemo` closed over a local accessor, so
 * exercising it meant rendering a table — which is why it never was.
 */
import { describe, expect, test } from "bun:test";
import {
	aggregableValue,
	aggregate,
	supportsNumericAggregation,
} from "../src/lib/aggregate.js";

const rows = (...values: Array<unknown>) =>
	values.map((v) => ({ record: { title: `r${v}` }, values: { Score: v } }));

const scoreField = { name: "Score", type: "number" as const };

describe("counting", () => {
	test("count includes empty rows, filled and empty split them", () => {
		const data = rows(1, "", 3, null);
		expect(aggregate(data, scoreField, "count")).toBe(4);
		expect(aggregate(data, scoreField, "filled")).toBe(2);
		expect(aggregate(data, scoreField, "empty")).toBe(2);
	});

	test("zero is a value, not an absence", () => {
		// The distinction that makes filled/empty worth having at all.
		const data = rows(0, "");
		expect(aggregate(data, scoreField, "filled")).toBe(1);
	});

	test("none returns null, so the footer stays blank", () => {
		expect(aggregate(rows(1, 2), scoreField, "none")).toBeNull();
	});
});

describe("numeric summaries", () => {
	test("sum, avg, min and max ignore empty cells", () => {
		const data = rows(10, "", 20, null, 30);
		expect(aggregate(data, scoreField, "sum")).toBe(60);
		expect(aggregate(data, scoreField, "avg")).toBe(20);
		expect(aggregate(data, scoreField, "min")).toBe(10);
		expect(aggregate(data, scoreField, "max")).toBe(30);
	});

	test("non-numeric values drop out rather than poisoning the total", () => {
		expect(aggregate(rows(10, "abc", 20), scoreField, "sum")).toBe(30);
	});

	test("a column with no numbers reports zero", () => {
		// Preserved from the component: zero is what the footer has always shown,
		// and changing it to null here would blank a column that used to read 0.
		expect(aggregate(rows("a", "b"), scoreField, "sum")).toBe(0);
	});
});

describe("formula columns", () => {
	const formulaField = {
		name: "Total",
		type: "formula",
		formula: 'prop("Score") * 2',
	};

	test("aggregate evaluates the formula instead of reading a stored cell", () => {
		// A formula field has no cell of its own; reading values[field.name]
		// would have summed a column of undefined.
		expect(aggregate(rows(1, 2, 3), formulaField, "sum")).toBe(12);
	});

	test("a formula that cannot be evaluated contributes nothing", () => {
		const broken = { name: "Broken", type: "formula", formula: "1 +" };
		expect(aggregate(rows(1, 2), broken, "filled")).toBe(0);
	});

	test("formula columns accept numeric summaries", () => {
		expect(supportsNumericAggregation("formula")).toBe(true);
		expect(supportsNumericAggregation("number")).toBe(true);
		expect(supportsNumericAggregation("text")).toBe(false);
	});
});

describe("the title column", () => {
	test("reads the record's title rather than a field value", () => {
		const data = [{ record: { title: "Ship it" }, values: {} }];
		expect(aggregableValue(scoreField, data[0], true)).toBe("Ship it");
		expect(aggregate(data, scoreField, "filled", true)).toBe(1);
	});
});
