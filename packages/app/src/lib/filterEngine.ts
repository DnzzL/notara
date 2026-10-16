/**
 * The app's view over the shared query engine.
 *
 * Filtering used to be implemented here, beside a server-side equality path and
 * a reference block's third engine, and they drifted. The operator semantics now
 * live once in `@notara/shared` — this module keeps the app's public surface
 * (its types, its labels, `applyFilters`/`applySorts`) and delegates to it, so a
 * saved view means the same thing here and over the API.
 */
import {
	type DatabaseField,
	type DatabaseRecord,
	type Filter,
	fieldTypeSpec,
	matchesFilters,
} from "@notara/shared";

export type { Filter, FilterOperator } from "@notara/shared";
export { OPERATOR_LABELS, operatorsForFieldType } from "@notara/shared";

export interface Sort {
	fieldId: string;
	direction: "asc" | "desc";
}

export type RecordWithValues = {
	record: DatabaseRecord;
	values: Record<string, unknown>;
};

export function applyFilters(
	records: RecordWithValues[],
	fields: DatabaseField[],
	filters: Filter[],
): RecordWithValues[] {
	if (filters.length === 0) return records;
	return matchesFilters(records, fields, filters);
}

export function applySorts(
	records: RecordWithValues[],
	fields: DatabaseField[],
	sorts: Sort[],
): RecordWithValues[] {
	if (sorts.length === 0) return records;
	const result = [...records];
	// Apply sorts from last to first so the first sort has highest precedence.
	for (let i = sorts.length - 1; i >= 0; i--) {
		const sort = sorts[i];
		const field = fields.find((f) => f.id === sort.fieldId);
		if (!field) continue;
		// Comparison is the field type's business: only `number` used to be
		// special-cased here, so dates sorted as text and checkboxes by alphabet.
		const compare = fieldTypeSpec(field.type).compare;
		result.sort((a, b) => {
			const cmp = compare(
				String(a.values[field.name] ?? ""),
				String(b.values[field.name] ?? ""),
			);
			return sort.direction === "desc" ? -cmp : cmp;
		});
	}
	return result;
}

export function applyFiltersAndSorts(
	records: RecordWithValues[],
	fields: DatabaseField[],
	filters: Filter[],
	sorts: Sort[],
): RecordWithValues[] {
	return applySorts(applyFilters(records, fields, filters), fields, sorts);
}
