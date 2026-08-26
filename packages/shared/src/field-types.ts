/**
 * One entry per database field type.
 *
 * Adding a field type currently means editing roughly eighteen places across
 * three packages, and the compiler helps with none of them: every site compares
 * `field.type` as a plain string rather than as the union. The union itself is
 * declared three times independently — here in the schema, again in the
 * hand-written OpenAPI document, and again in the field components.
 *
 * This module is the single place those eighteen collapse into. It deliberately
 * holds only what is framework-free — decoding, encoding, comparison, operators,
 * metadata — so the server, the Notion importer and the front end can all read
 * the same table. The React pieces (cell display, inline editor, configuration
 * panel) are keyed by the same types on the app side, where React belongs.
 *
 * Two behaviours are corrected rather than carried over, because a registry that
 * preserves a bug in one place instead of ten is not much of an improvement:
 *
 *   - Sorting only special-cased `number`, so dates sorted as text and
 *     checkboxes sorted "false" before "true" by accident of the alphabet.
 *   - `isReadOnly` did not exist. Formula fields are computed, and the rule
 *     lived in whichever view remembered to check.
 */
import type { DatabaseFieldType } from "./schema.js";

export type FieldType = typeof DatabaseFieldType.Type;

/** Operators a filter may use. Kept in sync with the query engine's vocabulary. */
export type FilterOperator =
	| "contains"
	| "does_not_contain"
	| "is"
	| "is_not"
	| "is_empty"
	| "is_not_empty"
	| "gt"
	| "lt"
	| "gte"
	| "lte"
	| "before"
	| "after";

export interface FieldTypeSpec {
	readonly type: FieldType;
	/** Shown in the field-type picker. */
	readonly label: string;
	readonly icon: string;
	/** Offered in the "basic" section of the picker; the rest are advanced. */
	readonly basic: boolean;
	readonly defaultWidth: number;
	/**
	 * Computed from other fields, so the grid must not offer an editor for it.
	 * Before this flag the rule lived in the callers.
	 */
	readonly readOnly: boolean;
	/** Stored string to a usable value. Never throws; bad data reads as empty. */
	readonly decode: (raw: string | null | undefined) => unknown;
	/** Usable value back to the stored string. */
	readonly encode: (value: unknown) => string;
	/** Order two stored values. Negative, zero or positive, like Array.sort. */
	readonly compare: (a: string, b: string) => number;
	readonly operators: readonly FilterOperator[];
}

const TEXT_OPERATORS: readonly FilterOperator[] = [
	"contains",
	"does_not_contain",
	"is",
	"is_not",
	"is_empty",
	"is_not_empty",
];

const collator = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
});

const compareText = (a: string, b: string) => collator.compare(a, b);

/** Blank sorts last in both directions, so empties never lead the list. */
const compareWithBlanksLast = (
	a: string,
	b: string,
	compare: (a: string, b: string) => number,
) => {
	const aEmpty = a === "" || a == null;
	const bEmpty = b === "" || b == null;
	if (aEmpty && bEmpty) return 0;
	if (aEmpty) return 1;
	if (bEmpty) return -1;
	return compare(a, b);
};

const compareNumbers = (a: string, b: string) =>
	compareWithBlanksLast(a, b, (x, y) => {
		const nx = Number(x);
		const ny = Number(y);
		// Unparseable values fall back to text so they group instead of scattering.
		if (Number.isNaN(nx) || Number.isNaN(ny)) return compareText(x, y);
		return nx - ny;
	});

const compareDates = (a: string, b: string) =>
	compareWithBlanksLast(a, b, (x, y) => {
		const tx = Date.parse(x);
		const ty = Date.parse(y);
		if (Number.isNaN(tx) || Number.isNaN(ty)) return compareText(x, y);
		return tx - ty;
	});

/** Unchecked before checked, rather than "false" before "true" by alphabet. */
const compareCheckboxes = (a: string, b: string) =>
	Number(a === "true") - Number(b === "true");

/** Multi-value cells are stored as JSON arrays. */
const decodeList = (raw: string | null | undefined): string[] => {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		// Older rows stored a bare comma-joined string.
		return raw
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}
};

const encodeList = (value: unknown): string =>
	JSON.stringify(Array.isArray(value) ? value.map(String) : []);

const asString = (raw: string | null | undefined) => raw ?? "";
const encodeString = (value: unknown) =>
	value === null || value === undefined ? "" : String(value);

const SPECS: Record<FieldType, FieldTypeSpec> = {
	text: {
		type: "text",
		label: "Text",
		icon: "Aa",
		basic: true,
		defaultWidth: 120,
		readOnly: false,
		decode: asString,
		encode: encodeString,
		compare: (a, b) => compareWithBlanksLast(a, b, compareText),
		operators: TEXT_OPERATORS,
	},
	number: {
		type: "number",
		label: "Number",
		icon: "#",
		basic: true,
		defaultWidth: 90,
		readOnly: false,
		decode: (raw) => (raw ? Number(raw) : null),
		encode: encodeString,
		compare: compareNumbers,
		operators: [
			"is",
			"is_not",
			"gt",
			"lt",
			"gte",
			"lte",
			"is_empty",
			"is_not_empty",
		],
	},
	select: {
		type: "select",
		label: "Select",
		icon: "◆",
		basic: true,
		defaultWidth: 120,
		readOnly: false,
		decode: asString,
		encode: encodeString,
		compare: (a, b) => compareWithBlanksLast(a, b, compareText),
		operators: ["is", "is_not", "is_empty", "is_not_empty"],
	},
	multiSelect: {
		type: "multiSelect",
		label: "Multi-select",
		icon: "◆◆",
		basic: false,
		defaultWidth: 140,
		readOnly: false,
		decode: decodeList,
		encode: encodeList,
		// By first entry, so grouping by a multi-select is at least stable.
		compare: (a, b) =>
			compareWithBlanksLast(
				decodeList(a)[0] ?? "",
				decodeList(b)[0] ?? "",
				compareText,
			),
		operators: ["contains", "does_not_contain", "is_empty", "is_not_empty"],
	},
	date: {
		type: "date",
		label: "Date",
		icon: "📅",
		basic: true,
		defaultWidth: 130,
		readOnly: false,
		decode: asString,
		encode: encodeString,
		compare: compareDates,
		operators: ["is", "before", "after", "is_empty", "is_not_empty"],
	},
	checkbox: {
		type: "checkbox",
		label: "Checkbox",
		icon: "☑",
		basic: true,
		defaultWidth: 80,
		readOnly: false,
		decode: (raw) => raw === "true",
		encode: (value) => (value ? "true" : "false"),
		compare: compareCheckboxes,
		operators: ["is"],
	},
	page: {
		type: "page",
		// "Page link", not "the page this record lives on" — see CONTEXT.md.
		label: "Page link",
		icon: "📄",
		basic: false,
		defaultWidth: 120,
		readOnly: false,
		decode: asString,
		encode: encodeString,
		compare: (a, b) => compareWithBlanksLast(a, b, compareText),
		operators: ["is", "is_not", "is_empty", "is_not_empty"],
	},
	relation: {
		type: "relation",
		label: "Relation",
		icon: "🔗",
		basic: false,
		defaultWidth: 140,
		readOnly: false,
		decode: decodeList,
		encode: encodeList,
		compare: (a, b) =>
			compareWithBlanksLast(
				decodeList(a)[0] ?? "",
				decodeList(b)[0] ?? "",
				compareText,
			),
		operators: ["contains", "does_not_contain", "is_empty", "is_not_empty"],
	},
	formula: {
		type: "formula",
		label: "Formula",
		icon: "ƒ",
		basic: false,
		defaultWidth: 120,
		// The reason this flag exists: the read-only rule used to live in the
		// views, and the inline editor's props did not even mention formula.
		readOnly: true,
		decode: asString,
		encode: encodeString,
		compare: (a, b) => compareWithBlanksLast(a, b, compareText),
		operators: TEXT_OPERATORS,
	},
	people: {
		type: "people",
		label: "People",
		icon: "👤",
		basic: false,
		defaultWidth: 140,
		readOnly: false,
		decode: decodeList,
		encode: encodeList,
		compare: (a, b) =>
			compareWithBlanksLast(
				decodeList(a)[0] ?? "",
				decodeList(b)[0] ?? "",
				compareText,
			),
		operators: ["contains", "does_not_contain", "is_empty", "is_not_empty"],
	},
};

/** Every field type, in the order the picker should show them. */
export const FIELD_TYPE_SPECS: readonly FieldTypeSpec[] = [
	SPECS.text,
	SPECS.number,
	SPECS.select,
	SPECS.multiSelect,
	SPECS.date,
	SPECS.checkbox,
	SPECS.page,
	SPECS.relation,
	SPECS.formula,
	SPECS.people,
];

/**
 * The spec for a field type.
 *
 * Falls back to `text` for a type this build does not know: a workspace written
 * by a newer version must still render, badly, rather than crash.
 */
export const fieldTypeSpec = (type: string): FieldTypeSpec =>
	SPECS[type as FieldType] ?? SPECS.text;

export const isKnownFieldType = (type: string): type is FieldType =>
	type in SPECS;
