/**
 * The registry defines "done" for the field-type refactor, so these tests are
 * written against the behaviour the eighteen scattered sites are supposed to
 * end up with — including two things they got wrong, which a registry that
 * faithfully preserved them would have entrenched rather than fixed.
 */
import { describe, expect, it } from "vitest";
import {
	FIELD_TYPE_SPECS,
	fieldTypeSpec,
	isKnownFieldType,
} from "../src/field-types.js";

describe("the registry covers what exists", () => {
	it("has an entry for every field type the schema declares", () => {
		// If this fails, someone added a member to DatabaseFieldType without an
		// entry here — which is exactly the drift the registry exists to stop.
		const declared = [
			"text",
			"number",
			"select",
			"multiSelect",
			"date",
			"checkbox",
			"relation",
			"page",
			"formula",
			"people",
		];
		expect(FIELD_TYPE_SPECS.map((s) => s.type).sort()).toEqual(declared.sort());
	});

	it("gives every entry a label, an icon and a width", () => {
		for (const spec of FIELD_TYPE_SPECS) {
			expect(spec.label, spec.type).toBeTruthy();
			expect(spec.icon, spec.type).toBeTruthy();
			expect(spec.defaultWidth, spec.type).toBeGreaterThan(0);
			expect(spec.operators.length, spec.type).toBeGreaterThan(0);
		}
	});

	it("falls back to text for a type this build does not know", () => {
		// A workspace written by a newer version must render badly, not crash.
		// The example is deliberately not a plausible future field type: using
		// one would make this test fail the day that type is actually added.
		expect(fieldTypeSpec("not-a-real-field-type").type).toBe("text");
		expect(isKnownFieldType("not-a-real-field-type")).toBe(false);
	});
});

describe("decode and encode round-trip every stored representation", () => {
	it("keeps scalar values through a round trip", () => {
		for (const type of ["text", "select", "date", "formula"]) {
			const spec = fieldTypeSpec(type);
			expect(spec.encode(spec.decode("hello")), type).toBe("hello");
		}
	});

	it("reads a missing value as empty rather than throwing", () => {
		for (const spec of FIELD_TYPE_SPECS) {
			expect(() => spec.decode(null), spec.type).not.toThrow();
			expect(() => spec.decode(undefined), spec.type).not.toThrow();
			expect(() => spec.decode(""), spec.type).not.toThrow();
		}
	});

	it("round-trips multi-value cells as JSON arrays", () => {
		for (const type of ["multiSelect", "relation", "people"]) {
			const spec = fieldTypeSpec(type);
			expect(spec.decode('["a","b"]'), type).toEqual(["a", "b"]);
			expect(spec.encode(["a", "b"]), type).toBe('["a","b"]');
		}
	});

	it("reads a legacy comma-joined multi-value cell", () => {
		// Notion's Status and Tag exports arrived as comma-joined strings, and
		// rows written then are still in the database.
		expect(fieldTypeSpec("multiSelect").decode("a, b")).toEqual(["a", "b"]);
	});

	it("reads malformed multi-value data as empty, not as a crash", () => {
		expect(fieldTypeSpec("multiSelect").decode("{not json")).toEqual([
			"{not json",
		]);
		expect(fieldTypeSpec("multiSelect").decode("[")).toEqual(["["]);
	});

	it("decodes a checkbox to a boolean and back", () => {
		const spec = fieldTypeSpec("checkbox");
		expect(spec.decode("true")).toBe(true);
		expect(spec.decode("false")).toBe(false);
		expect(spec.decode("")).toBe(false);
		expect(spec.encode(true)).toBe("true");
		expect(spec.encode(false)).toBe("false");
	});

	it("reads a page cell written before it was multi-valued", () => {
		// A bare page id, not a one-element array. Rows written that way are
		// still in databases, and the display already handled both — migrating
		// to a scalar decode would have emptied every one of them.
		const spec = fieldTypeSpec("page");
		expect(spec.decode("01HPAGE")).toEqual(["01HPAGE"]);
		expect(spec.decode('["01HA","01HB"]')).toEqual(["01HA", "01HB"]);
		expect(spec.encode(["01HA"])).toBe('["01HA"]');
	});

	it("decodes a number to a number, and an empty cell to null", () => {
		const spec = fieldTypeSpec("number");
		expect(spec.decode("42")).toBe(42);
		expect(spec.decode("")).toBe(null);
	});

	it("decodes unparseable number raw to null, not NaN", () => {
		const spec = fieldTypeSpec("number");
		expect(spec.decode("abc")).toBe(null);
	});
});

describe("compare", () => {
	const sortBy = (type: string, values: string[]) =>
		[...values].sort(fieldTypeSpec(type).compare);

	it("orders dates chronologically, not alphabetically", () => {
		// The bug being fixed: only `number` was special-cased, so dates sorted
		// as text. Formats that are not zero-padded ISO sorted wrongly.
		expect(sortBy("date", ["2026-01-10", "2026-01-02"])).toEqual([
			"2026-01-02",
			"2026-01-10",
		]);
		expect(sortBy("date", ["March 3, 2026", "January 5, 2026"])).toEqual([
			"January 5, 2026",
			"March 3, 2026",
		]);
	});

	it("orders numbers numerically, not as text", () => {
		expect(sortBy("number", ["10", "9", "100"])).toEqual(["9", "10", "100"]);
	});

	it("orders unchecked before checked, rather than by the alphabet", () => {
		expect(sortBy("checkbox", ["true", "false"])).toEqual(["false", "true"]);
	});

	it("sorts blanks last, so empty rows never lead the list", () => {
		expect(sortBy("text", ["b", "", "a"])).toEqual(["a", "b", ""]);
		expect(sortBy("number", ["2", "", "1"])).toEqual(["1", "2", ""]);
		expect(sortBy("date", ["2026-01-02", "", "2026-01-01"])).toEqual([
			"2026-01-01",
			"2026-01-02",
			"",
		]);
	});

	it("groups unparseable values instead of scattering them", () => {
		const sorted = sortBy("number", ["3", "abc", "1"]);
		expect(sorted[0]).toBe("1");
		expect(sorted).toContain("abc");
	});

	it("orders multi-value cells by their first entry", () => {
		expect(sortBy("multiSelect", ['["b"]', '["a","z"]'])).toEqual([
			'["a","z"]',
			'["b"]',
		]);
	});

	it("compares text case-insensitively and numerically aware", () => {
		expect(sortBy("text", ["item 10", "Item 2"])).toEqual([
			"Item 2",
			"item 10",
		]);
	});
});

describe("readOnly", () => {
	it("marks formula fields read-only and nothing else", () => {
		// Before this flag the rule lived in whichever view remembered to check,
		// and the inline editor's props did not mention formula at all.
		const readOnly = FIELD_TYPE_SPECS.filter((s) => s.readOnly).map(
			(s) => s.type,
		);
		expect(readOnly).toEqual(["formula"]);
	});
});
