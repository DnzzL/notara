import type { DatabaseField, DatabaseRecord } from "@notara/shared";

export type FilterOperator =
  | "contains"
  | "does_not_contain"
  | "is"
  | "is_not"
  | "is_empty"
  | "is_not_empty";

export interface Filter {
  fieldId: string;
  operator: FilterOperator;
  value: string;
}

export interface Sort {
  fieldId: string;
  direction: "asc" | "desc";
}

export type RecordWithValues = { record: DatabaseRecord; values: Record<string, unknown> };

export function applyFilters(
  records: RecordWithValues[],
  fields: DatabaseField[],
  filters: Filter[],
): RecordWithValues[] {
  if (filters.length === 0) return records;
  return records.filter((row) => filters.every((filter) => {
    const field = fields.find(f => f.id === filter.fieldId);
    if (!field) return true;
    const val = row.values[field.name];
    const fv = filter.value.toLowerCase();
    switch (filter.operator) {
      case "contains":         return String(val ?? "").toLowerCase().includes(fv);
      case "does_not_contain": return !String(val ?? "").toLowerCase().includes(fv);
      case "is":               return String(val ?? "").toLowerCase() === fv;
      case "is_not":           return String(val ?? "").toLowerCase() !== fv;
      case "is_empty":         return !val || val === "" || val === "[]" || val === "null";
      case "is_not_empty":     return Boolean(val) && val !== "" && val !== "[]" && val !== "null";
      default:                 return true;
    }
  }));
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
    const field = fields.find(f => f.id === sort.fieldId);
    if (!field) continue;
    result.sort((a, b) => {
      const aV = a.values[field.name] ?? "";
      const bV = b.values[field.name] ?? "";
      const cmp = field.type === "number"
        ? Number(aV) - Number(bV)
        : String(aV).localeCompare(String(bV));
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
