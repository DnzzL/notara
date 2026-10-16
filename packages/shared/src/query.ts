/**
 * The operator semantics for a filter, once, in shared.
 *
 * The app's query bar and the REST records endpoint both evaluate through this,
 * so a saved view means the same thing to a human and to an agent. The field
 * type's registry supplies the operators it offers; this decides what each one
 * does to a decoded cell.
 *
 * The behaviour is lifted from the app's `filterEngine.applyFilters`, which was
 * the working implementation — the same twelve operators, and the same
 * type-aware reading: a multi-value cell matches on membership, a number
 * compares numerically, an unticked checkbox is empty, a date uses
 * before/after, and an empty value matches an empty cell including an empty
 * list.
 */
import {
	type FieldTypeSpec,
	type FilterOperator,
	fieldTypeSpec,
} from "./field-types.js";
import type { DatabaseField } from "./schema.js";

export type { FilterOperator } from "./field-types.js";

/** A single condition: which field, which operator, what to compare against. */
export interface Filter {
	fieldId: string;
	operator: FilterOperator;
	value: string;
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
	contains: "Contains",
	does_not_contain: "Does not contain",
	is: "Is",
	is_not: "Is not",
	is_empty: "Is empty",
	is_not_empty: "Is not empty",
	gt: ">",
	lt: "<",
	gte: "≥",
	lte: "≤",
	before: "Before",
	after: "After",
};

/**
 * Operators offered for a field type — drives the smart filter UI.
 *
 * The list lives in the field-type registry, beside the decode and compare that
 * have to agree with it. This used to be its own switch, which is how the
 * reference block's private engine came to understand a different set entirely.
 */
export function operatorsForFieldType(type: string): FilterOperator[] {
	return [...fieldTypeSpec(type).operators];
}

/** Blank: absent, empty string, or an empty list. An unticked checkbox is. */
const isEmptyCell = (cell: unknown): boolean => {
	if (Array.isArray(cell)) return cell.length === 0;
	return !cell || cell === "" || cell === "[]" || cell === "null";
};

/**
 * Equality on the decoded cell. A checkbox is compared as its ticked state so a
 * never-written one reads as `false`; a multi-value cell matches by membership;
 * a number matches however it is written (`"1.0"` is `1`).
 */
const equalsCell = (type: string, cell: unknown, needle: string): boolean => {
	if (type === "checkbox") {
		const ticked = cell === true || cell === "true";
		return String(ticked) === needle;
	}
	if (Array.isArray(cell)) {
		if (needle === "") return cell.length === 0;
		return cell.some((v) => String(v).toLowerCase() === needle);
	}
	if (type === "number" && cell != null && cell !== "")
		return needle !== "" && Number(needle) === Number(cell);
	return String(cell ?? "").toLowerCase() === needle;
};

/**
 * Whether one decoded cell passes one operator against one value.
 *
 * `spec` is the field's type spec, or its type name. An operator the type does
 * not offer is the caller's to refuse — this evaluates whatever it is given.
 */
export function matchesFilter(
	spec: FieldTypeSpec | string,
	operator: FilterOperator,
	cell: unknown,
	value: string,
): boolean {
	const type = typeof spec === "string" ? fieldTypeSpec(spec) : spec;
	const needle = value.toLowerCase();
	switch (operator) {
		case "contains":
			// A multi-value cell stringifies to "a,b", so "contains" reads as
			// membership for the field types whose registry offers only this.
			return String(cell ?? "")
				.toLowerCase()
				.includes(needle);
		case "does_not_contain":
			return !String(cell ?? "")
				.toLowerCase()
				.includes(needle);
		case "is":
			return equalsCell(type.type, cell, needle);
		case "is_not":
			return !equalsCell(type.type, cell, needle);
		case "is_empty":
			return isEmptyCell(cell);
		case "is_not_empty":
			return !isEmptyCell(cell);
		case "gt":
			return Number(cell) > Number(value);
		case "lt":
			return Number(cell) < Number(value);
		case "gte":
			return Number(cell) >= Number(value);
		case "lte":
			return Number(cell) <= Number(value);
		case "before":
			return (
				cell != null && cell !== "" && new Date(String(cell)) < new Date(value)
			);
		case "after":
			return (
				cell != null && cell !== "" && new Date(String(cell)) > new Date(value)
			);
		default:
			return true;
	}
}

/**
 * Operator spellings that exist in stored view configurations but are not what the filter
 * UI emits today. The reference block understood `equals`, `startsWith`, `notEmpty` and
 * `isEmpty`; the app normalises them on read, and the server now reads the same stored
 * configurations to answer `?view=`, so the table belongs here rather than in whichever
 * reader happened to come first.
 */
const OPERATOR_ALIASES: Record<string, FilterOperator> = {
	equals: "is",
	notEquals: "is_not",
	startsWith: "contains",
	isEmpty: "is_empty",
	notEmpty: "is_not_empty",
};

/**
 * A stored operator in today's spelling.
 *
 * A spelling this build does not know passes through unchanged, so a caller can refuse it
 * by name rather than have it quietly mean nothing.
 */
export function normaliseFilterOperator(raw: unknown): FilterOperator {
	const value = String(raw ?? "");
	return OPERATOR_ALIASES[value] ?? (value as FilterOperator);
}

/** A stored sort direction in today's spelling; `order` is the reference block's word. */
export function normaliseSortDirection(raw: unknown): "asc" | "desc" {
	return raw === "desc" ? "desc" : "asc";
}

/**
 * The rows whose values pass every filter, ANDed. The cell is read from the
 * row's `values` map by the field's name; a field that no longer exists is
 * ignored rather than emptying the view.
 */
export function matchesFilters<T extends { values: Record<string, unknown> }>(
	records: readonly T[],
	fields: readonly DatabaseField[],
	filters: readonly Filter[],
): T[] {
	return records.filter((row) =>
		filters.every((filter) => {
			const field = fields.find((f) => f.id === filter.fieldId);
			if (!field) return true;
			return matchesFilter(
				fieldTypeSpec(field.type),
				filter.operator,
				row.values[field.name],
				filter.value,
			);
		}),
	);
}
