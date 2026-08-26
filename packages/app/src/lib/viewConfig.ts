/**
 * Reading and writing a saved view's configuration.
 *
 * Parsing this used to happen in three places — the database store, and twice
 * inline in the view-reference block — each producing a slightly different
 * shape. That is how a saved view came to filter and sort differently depending
 * on whether it was opened as a table or embedded as a reference block.
 *
 * The two divergences are normalised HERE, on read, rather than anywhere else:
 *
 *   - **Sort direction.** The table writes `direction: "asc" | "desc"`. The
 *     reference block read `order`. Configurations written by either are still
 *     in databases, so both are accepted and one is emitted.
 *   - **Operator names.** The reference block understood `equals`, `startsWith`,
 *     `notEmpty` and `isEmpty` — none of which the filter UI ever emitted — while
 *     the operators it *did* emit (`is_empty`, `is_not_empty`, and everything
 *     beyond `is`/`contains`) fell through its default branch and filtered
 *     nothing at all.
 *
 * Normalising on read rather than migrating the stored rows is deliberate: a
 * migration would have to run against every workspace database, and a view
 * config is small, read often, and written rarely.
 */
import type { Filter, FilterOperator, Sort } from "./filterEngine.js";

export interface ViewConfig {
	filters: Filter[];
	sorts: Sort[];
	boardHidden: string[];
}

export const emptyViewConfig = (): ViewConfig => ({
	filters: [],
	sorts: [],
	boardHidden: [],
});

/**
 * Operator spellings that exist in stored configurations but are not what the
 * filter UI emits today.
 */
const OPERATOR_ALIASES: Record<string, FilterOperator> = {
	equals: "is",
	notEquals: "is_not",
	startsWith: "contains",
	isEmpty: "is_empty",
	notEmpty: "is_not_empty",
};

const normaliseOperator = (raw: unknown): FilterOperator => {
	const value = String(raw ?? "");
	return OPERATOR_ALIASES[value] ?? (value as FilterOperator);
};

const normaliseFilter = (raw: unknown): Filter | null => {
	if (!raw || typeof raw !== "object") return null;
	const f = raw as Record<string, unknown>;
	if (typeof f.fieldId !== "string") return null;
	return {
		fieldId: f.fieldId,
		operator: normaliseOperator(f.operator),
		value: typeof f.value === "string" ? f.value : String(f.value ?? ""),
	};
};

const normaliseSort = (raw: unknown): Sort | null => {
	if (!raw || typeof raw !== "object") return null;
	const s = raw as Record<string, unknown>;
	if (typeof s.fieldId !== "string") return null;
	// `order` is the reference block's spelling of `direction`.
	const direction = s.direction ?? s.order;
	return {
		fieldId: s.fieldId,
		direction: direction === "desc" ? "desc" : "asc",
	};
};

const compact = <T>(items: unknown, map: (raw: unknown) => T | null): T[] =>
	Array.isArray(items) ? items.map(map).filter((v): v is T => v !== null) : [];

/** Parse a stored configuration. Malformed input reads as empty, never throws. */
export function parseViewConfig(config: string | null | undefined): ViewConfig {
	if (!config) return emptyViewConfig();
	try {
		const parsed = JSON.parse(config);
		return {
			filters: compact(parsed.filters, normaliseFilter),
			sorts: compact(parsed.sorts, normaliseSort),
			boardHidden: Array.isArray(parsed.boardHidden)
				? parsed.boardHidden.filter((v: unknown) => typeof v === "string")
				: [],
		};
	} catch {
		return emptyViewConfig();
	}
}

/** Serialise a configuration for storage, always in the current spelling. */
export function serializeViewConfig(config: ViewConfig): string {
	return JSON.stringify({
		filters: config.filters,
		sorts: config.sorts,
		boardHidden: config.boardHidden,
	});
}

/**
 * Has the working configuration diverged from the saved one?
 *
 * Compared after normalising both, so a view saved in the old spelling does not
 * read as dirty the moment it is opened.
 */
export function isDirty(saved: string | null | undefined, working: ViewConfig) {
	return (
		serializeViewConfig(parseViewConfig(saved)) !== serializeViewConfig(working)
	);
}
