import { describe, expect, test } from "bun:test";

/**
 * NOT-61: Saved views dirty-state detection.
 *
 * The dirty-state utility compares the current query config (filters, sorts,
 * groupBy, boardHidden, viewType) against a saved snapshot.  If no saved view
 * is active (the "All" state) the view is never dirty.
 */
export type ViewType = "table" | "board" | "calendar";

export interface ViewConfig {
	filters: { fieldId: string; operator: string; value: string }[];
	sorts: { fieldId: string; order: "asc" | "desc" }[];
	groupBy: string | null;
	boardHidden: string[];
}

export function detectViewDirty(
	current: ViewConfig & { viewType: ViewType },
	saved: (ViewConfig & { viewType: ViewType }) | null,
): boolean {
	// No saved view → never dirty
	if (!saved) return false;

	return (
		current.viewType !== saved.viewType ||
		JSON.stringify(current.filters) !== JSON.stringify(saved.filters) ||
		JSON.stringify(current.sorts) !== JSON.stringify(saved.sorts) ||
		current.groupBy !== saved.groupBy ||
		JSON.stringify(current.boardHidden) !== JSON.stringify(saved.boardHidden)
	);
}

describe("detectViewDirty", () => {
	const baseCurrent: ViewConfig & { viewType: ViewType } = {
		viewType: "table",
		filters: [],
		sorts: [],
		groupBy: null,
		boardHidden: [],
	};

	const baseSaved: ViewConfig & { viewType: ViewType } = {
		viewType: "table",
		filters: [],
		sorts: [],
		groupBy: null,
		boardHidden: [],
	};

	test("no saved view returns not dirty", () => {
		expect(detectViewDirty(baseCurrent, null)).toBe(false);
	});

	test("unchanged view returns not dirty", () => {
		expect(detectViewDirty(baseCurrent, baseSaved)).toBe(false);
	});

	test("changed filter returns dirty", () => {
		const dirty = {
			...baseCurrent,
			filters: [{ fieldId: "f1", operator: "equals", value: "hello" }],
		};
		expect(detectViewDirty(dirty, baseSaved)).toBe(true);
	});

	test("changed sort returns dirty", () => {
		const dirty = {
			...baseCurrent,
			sorts: [{ fieldId: "f1", order: "asc" as const }],
		};
		expect(detectViewDirty(dirty, baseSaved)).toBe(true);
	});

	test("changed groupBy returns dirty", () => {
		const dirty = { ...baseCurrent, groupBy: "f1" };
		expect(detectViewDirty(dirty, baseSaved)).toBe(true);
	});

	test("changed boardHidden returns dirty", () => {
		const dirty = { ...baseCurrent, boardHidden: ["f1"] };
		expect(detectViewDirty(dirty, baseSaved)).toBe(true);
	});

	test("changed view type returns dirty", () => {
		const dirty = { ...baseCurrent, viewType: "board" as ViewType };
		expect(detectViewDirty(dirty, baseSaved)).toBe(true);
	});

	test("multiple changes detected", () => {
		const dirty = {
			viewType: "calendar" as ViewType,
			filters: [{ fieldId: "f1", operator: "is", value: "yes" }],
			sorts: [{ fieldId: "f2", order: "desc" as const }],
			groupBy: "f3",
			boardHidden: ["f4"],
		};
		const saved: ViewConfig & { viewType: ViewType } = {
			viewType: "table",
			filters: [],
			sorts: [],
			groupBy: null,
			boardHidden: [],
		};
		expect(detectViewDirty(dirty, saved)).toBe(true);
	});

	test("after save, no longer dirty", () => {
		// Simulates saving: current becomes the new saved state
		const afterSave = { ...baseCurrent };
		expect(detectViewDirty(afterSave, afterSave)).toBe(false);
	});
});
