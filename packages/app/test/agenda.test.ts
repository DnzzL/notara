/**
 * The agenda grouping behind the mobile calendar.
 *
 * A month grid at 390px gives 50px cells — enough for a number and nothing
 * else, which is a calendar you cannot read and cannot act on. The narrow
 * layout is an agenda instead: records grouped by day, in order, dated ones
 * first. This is the part worth testing, because ordering and the undated
 * bucket are where an agenda quietly goes wrong.
 */
import { describe, expect, test } from "bun:test";
import { buildAgenda } from "../src/lib/agenda.js";

const rec = (id: string, date: string | null) => ({
	record: { id, title: id },
	values: date === null ? {} : { Due: date },
});

describe("buildAgenda", () => {
	test("groups records by day, earliest first", () => {
		const groups = buildAgenda(
			[rec("c", "2026-03-12"), rec("a", "2026-03-10"), rec("b", "2026-03-11")],
			"Due",
		);
		expect(groups.map((g) => g.day)).toEqual([
			"2026-03-10",
			"2026-03-11",
			"2026-03-12",
		]);
	});

	test("puts several records on the same day in one group", () => {
		const groups = buildAgenda(
			[rec("a", "2026-03-10"), rec("b", "2026-03-10")],
			"Due",
		);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.rows.map((r) => r.record.id)).toEqual(["a", "b"]);
	});

	test("accepts a full ISO timestamp, not just a date", () => {
		const groups = buildAgenda([rec("a", "2026-03-10T14:30:00Z")], "Due");
		expect(groups[0]?.day).toBe("2026-03-10");
	});

	test("collects undated records into a trailing group", () => {
		const groups = buildAgenda(
			[rec("a", null), rec("b", "2026-03-10"), rec("c", "")],
			"Due",
		);
		expect(groups.map((g) => g.day)).toEqual(["2026-03-10", null]);
		expect(groups.at(-1)?.rows.map((r) => r.record.id)).toEqual(["a", "c"]);
	});

	test("omits the undated group when every record has a date", () => {
		const groups = buildAgenda([rec("a", "2026-03-10")], "Due");
		expect(groups.map((g) => g.day)).toEqual(["2026-03-10"]);
	});

	test("without a date field every record is undated", () => {
		const groups = buildAgenda([rec("a", "2026-03-10")], null);
		expect(groups).toEqual([
			{ day: null, rows: [rec("a", "2026-03-10")] },
		] as never);
	});

	test("no records is no groups, not a group of nothing", () => {
		expect(buildAgenda([], "Due")).toEqual([]);
	});
});
