import { Schema } from "effect";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Block, DatabaseField, DatabaseView, Page } from "../src/schema.js";

// ── Arbitraries ──────────────────────────────────────────────────────────

const ulidArb = fc.string({ minLength: 10, maxLength: 30 });
// noInvalidDate: fc.date() otherwise yields Invalid Date, and toISOString() throws on it.
const isoDateArb = fc.date({ noInvalidDate: true }).map((d) => d.toISOString());

const blockTypeArb = fc.constantFrom(
	"paragraph",
	"heading1",
	"heading2",
	"heading3",
	"bulletList",
	"numberedList",
	"todo",
	"code",
	"blockquote",
	"divider",
	"image",
	"pdf",
	"file",
	"database",
	"pageLink",
	"toggle",
	"callout",
	"people",
	"viewReference",
);

const viewTypeArb = fc.constantFrom("table", "board", "calendar");

const fieldTypeArb = fc.constantFrom(
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
);

const sortOrderArb = fc.constantFrom("asc", "desc");

// Page arbitrary
const pageArb = fc.record({
	id: ulidArb,
	title: fc.string(),
	parentId: fc.oneof(fc.constant(null), ulidArb),
	icon: fc.oneof(fc.constant(null), fc.string()),
	coverUrl: fc.oneof(fc.constant(null), fc.string()),
	sortOrder: fc.integer(),
	isDeleted: fc.boolean(),
	isFavorite: fc.boolean(),
	createdAt: isoDateArb,
	updatedAt: isoDateArb,
	deletedAt: fc.oneof(fc.constant(null), isoDateArb),
});

// Block arbitrary
const blockArb = fc.record({
	id: ulidArb,
	pageId: ulidArb,
	type: blockTypeArb,
	content: fc.string(),
	parentId: fc.oneof(fc.constant(null), ulidArb),
	index: fc.integer({ min: 0 }),
});

// DatabaseView arbitrary
const dbViewArb = fc.record({
	id: ulidArb,
	databaseId: ulidArb,
	name: fc.string({ maxLength: 100 }),
	type: viewTypeArb,
	groupByFieldId: fc.oneof(fc.constant(null), ulidArb),
	sortFieldId: fc.oneof(fc.constant(null), ulidArb),
	sortOrder: sortOrderArb,
	config: fc.string(),
	isDefault: fc.boolean(),
});

// DatabaseField arbitrary
const dbFieldArb = fc.record({
	id: ulidArb,
	databaseId: ulidArb,
	name: fc.string({ maxLength: 50 }),
	type: fieldTypeArb,
	options: fc.oneof(
		fc.constant(null),
		fc.array(fc.string({ maxLength: 30 }), { maxLength: 20 }),
	),
	relationTargetDbId: fc.oneof(fc.constant(null), ulidArb),
	formula: fc.oneof(fc.constant(null), fc.string({ maxLength: 200 })),
	sortOrder: fc.integer(),
	syncLinkedRow: fc.boolean(),
});

// ── Property: serialize → deserialize is identity ──────────────────────

describe("Page: serialize→deserialize identity", () => {
	it("should round-trip any valid Page", () => {
		fc.assert(
			fc.property(pageArb, (input) => {
				const decoded = Schema.decodeSync(Page)(input);
				const encoded = Schema.encodeSync(Page)(decoded);
				expect(encoded.id).toBe(input.id);
				expect(encoded.title).toBe(input.title);
				expect(encoded.isDeleted).toBe(input.isDeleted);
				expect(encoded.isFavorite).toBe(input.isFavorite);
				expect(encoded.parentId).toBe(input.parentId);
			}),
		);
	});
});

describe("Block: serialize→deserialize identity", () => {
	it("should round-trip any valid Block", () => {
		fc.assert(
			fc.property(blockArb, (input) => {
				const decoded = Schema.decodeSync(Block)(input);
				const encoded = Schema.encodeSync(Block)(decoded);
				expect(encoded.id).toBe(input.id);
				expect(encoded.pageId).toBe(input.pageId);
				expect(encoded.type).toBe(input.type);
				expect(encoded.content).toBe(input.content);
				expect(encoded.index).toBe(input.index);
			}),
		);
	});
});

describe("DatabaseView: serialize→deserialize identity", () => {
	it("should round-trip any valid DatabaseView", () => {
		fc.assert(
			fc.property(dbViewArb, (input) => {
				const decoded = Schema.decodeSync(DatabaseView)(input);
				const encoded = Schema.encodeSync(DatabaseView)(decoded);
				expect(encoded.id).toBe(input.id);
				expect(encoded.databaseId).toBe(input.databaseId);
				expect(encoded.type).toBe(input.type);
				expect(encoded.isDefault).toBe(input.isDefault);
			}),
		);
	});
});

describe("DatabaseField: serialize→deserialize identity", () => {
	it("should round-trip any valid DatabaseField", () => {
		fc.assert(
			fc.property(dbFieldArb, (input) => {
				const decoded = Schema.decodeSync(DatabaseField)(input);
				const encoded = Schema.encodeSync(DatabaseField)(decoded);
				expect(encoded.id).toBe(input.id);
				expect(encoded.name).toBe(input.name);
				expect(encoded.type).toBe(input.type);
				expect(encoded.databaseId).toBe(input.databaseId);
			}),
		);
	});
});

// ── Property: decoder rejects invalid inputs ────────────────────────────

describe("Schema rejects invalid block types", () => {
	it("should reject Block with invalid type", () => {
		fc.assert(
			fc.property(blockArb, fc.string(), (input, badType) => {
				// Only test with strings that are not valid block types
				fc.pre(
					![
						"paragraph",
						"heading1",
						"heading2",
						"heading3",
						"bulletList",
						"numberedList",
						"todo",
						"code",
						"blockquote",
						"divider",
						"image",
						"pdf",
						"file",
						"database",
						"callout",
						"toggle",
						"tableOfContents",
						"viewReference",
						"people",
						"equation",
					].includes(badType),
				);
				const bad = { ...input, type: badType };
				const result = Schema.decodeUnknownExit(Block)(bad);
				expect(result._tag).toBe("Failure");
			}),
		);
	});
});

describe("Schema rejects invalid view types", () => {
	it("should reject DatabaseView with invalid type", () => {
		fc.assert(
			fc.property(dbViewArb, fc.string(), (input, badType) => {
				fc.pre(!["table", "board", "calendar"].includes(badType));
				const bad = { ...input, type: badType };
				const result = Schema.decodeUnknownExit(DatabaseView)(bad);
				expect(result._tag).toBe("Failure");
			}),
		);
	});
});

describe("Schema rejects invalid field types", () => {
	it("should reject DatabaseField with invalid type", () => {
		fc.assert(
			fc.property(dbFieldArb, fc.string(), (input, badType) => {
				fc.pre(
					![
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
					].includes(badType),
				);
				const bad = { ...input, type: badType };
				const result = Schema.decodeUnknownExit(DatabaseField)(bad);
				expect(result._tag).toBe("Failure");
			}),
		);
	});
});
