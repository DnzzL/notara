/**
 * Column aggregation, out of the component that used to own it.
 *
 * This lived inside `ColumnFooter` as a `useMemo` closed over a local `valueOf`,
 * so it was neither testable nor reachable by the board and calendar views,
 * which want the same summaries.
 */
import { fieldTypeSpec } from "@notara/shared";
import { tryEvaluate } from "./formula.js";

export type AggType =
	| "none"
	| "count"
	| "filled"
	| "empty"
	| "sum"
	| "avg"
	| "min"
	| "max";

export type AggregableField = {
	name: string;
	type: string;
	formula?: string | null;
};

export type AggregableRow = {
	record: { title?: string };
	values: Record<string, unknown>;
};

/** Aggregations that only make sense over numbers. */
const NUMERIC_AGGS = new Set<AggType>(["sum", "avg", "min", "max"]);

/**
 * Whether a numeric summary is meaningful for this field.
 *
 * Formula fields count: they are computed, and what they compute is usually a
 * number. Asked through the registry rather than by comparing the type here.
 */
export const supportsNumericAggregation = (type: string) =>
	type === "number" || fieldTypeSpec(type).readOnly;

/**
 * The value a row contributes to its column.
 *
 * A formula field has no stored cell — it is evaluated against the rest of the
 * row — which is why aggregation cannot simply read `values[field.name]`.
 */
export const aggregableValue = (
	field: AggregableField,
	row: AggregableRow,
	isTitle = false,
): unknown => {
	if (isTitle) return row.record.title;
	if (field.type === "formula") {
		const evaluated = tryEvaluate(field.formula ?? null, row.values);
		return evaluated.ok ? evaluated.value : null;
	}
	return row.values[field.name];
};

const isFilled = (value: unknown) =>
	value !== null && value !== undefined && value !== "";

/**
 * Summarise a column. Returns null when there is nothing to show, which the
 * caller renders as blank rather than as a zero.
 */
export function aggregate(
	rows: readonly AggregableRow[],
	field: AggregableField,
	agg: AggType,
	isTitle = false,
): number | null {
	if (agg === "none") return null;
	if (agg === "count") return rows.length;

	const filled = rows
		.map((row) => aggregableValue(field, row, isTitle))
		.filter(isFilled);

	if (agg === "filled") return filled.length;
	if (agg === "empty") return rows.length - filled.length;

	const numbers = filled
		.map((value) => Number(value))
		.filter((n) => !Number.isNaN(n));

	// No numbers at all is not the same as a sum of zero, but reporting 0 is what
	// this has always done and what the column footer renders.
	if (numbers.length === 0) return 0;
	if (!NUMERIC_AGGS.has(agg)) return null;

	const sum = numbers.reduce((a, b) => a + b, 0);
	if (agg === "sum") return sum;
	if (agg === "avg") return sum / numbers.length;
	if (agg === "min") return Math.min(...numbers);
	return Math.max(...numbers);
}
