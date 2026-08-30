/**
 * What leaves the server when a stranger opens a public link.
 *
 * `resolvePublicPage` needs a workspace layer and the ACL, so it is exercised
 * end to end in e2e/public-share.spec.ts. What is asserted here is the pair of
 * projections that decide what a public reader is allowed to see — the part
 * that would leak silently if it drifted, since a leak here looks like a page
 * that renders correctly.
 */
import { describe, expect, test } from "bun:test";
import {
	buildPublicDatabase,
	publicView,
	redactBlocks,
} from "../src/handlers/public-page.js";

describe("redactBlocks", () => {
	const block = (type: string, content: string) => ({
		id: `b-${type}`,
		type,
		content,
		parentId: null,
		index: 0,
	});

	test("blanks blocks that point outside the shared page", () => {
		// Each of these names something this token does not cover: another page,
		// a database, a saved view, or the workspace's members.
		for (const type of ["pageLink", "database", "viewReference", "people"]) {
			const [out] = redactBlocks([block(type, '{"pageId":"secret"}')]);
			expect(out?.content, type).toBe("");
		}
	});

	test("keeps the block itself, not just its content", () => {
		// Dropping it would leave a paragraph saying "see the table below" above
		// nothing at all, which reads worse than an empty placeholder.
		const out = redactBlocks([block("database", '{"databaseId":"d1"}')]);
		expect(out).toHaveLength(1);
		expect(out[0]?.type).toBe("database");
		expect(out[0]?.id).toBe("b-database");
	});

	test("leaves text and media blocks untouched", () => {
		const kept = ["paragraph", "heading1", "code", "image", "pdf", "todo"];
		for (const type of kept) {
			const [out] = redactBlocks([block(type, "<p>kept</p>")]);
			expect(out?.content, type).toBe("<p>kept</p>");
		}
	});

	test("does not mutate the blocks it was given", () => {
		const input = [block("pageLink", '{"pageId":"secret"}')];
		redactBlocks(input);
		expect(input[0]?.content).toBe('{"pageId":"secret"}');
	});

	test("keeps a database block's content when its id is accessible", () => {
		const [out] = redactBlocks([block("database", "d1")], new Set(["d1"]));
		expect(out?.content).toBe("d1");
	});

	test("blanks a database block whose id is not in the accessible set", () => {
		const [out] = redactBlocks(
			[block("database", "d1")],
			new Set(["some-other-db"]),
		);
		expect(out?.content).toBe("");
	});
});

describe("buildPublicDatabase", () => {
	const field = (name: string, type: string) => ({
		id: `f-${name}`,
		name,
		type,
		options: null,
	});

	test("blanks cells whose field type names something outside the database", () => {
		const fields = [
			field("Title", "text"),
			field("Owner", "people"),
			field("Related", "relation"),
			field("Page", "page"),
		];
		const recordsWithValues = [
			{
				record: { id: "r1", title: "Row 1" },
				values: {
					Title: "Row 1",
					Owner: ["user-1"],
					Related: ["rec-2"],
					Page: ["page-9"],
				},
			},
		];

		const out = buildPublicDatabase(fields, recordsWithValues);

		expect(out.records[0]?.values).toEqual({
			Title: "Row 1",
			Owner: null,
			Related: null,
			Page: null,
		});
		expect(JSON.stringify(out)).not.toContain("user-1");
		expect(JSON.stringify(out)).not.toContain("rec-2");
		expect(JSON.stringify(out)).not.toContain("page-9");
	});
});

describe("publicView", () => {
	test("publishes only what a reader needs", () => {
		// The projection is written out by hand rather than spread, so adding a
		// column to `pages` cannot quietly widen what goes on the open web. This
		// asserts that: the row below carries fields a spread would have leaked.
		const row = {
			id: "p1",
			title: "Public",
			icon: "📄",
			coverUrl: null,
			updatedAt: "2026-01-01T00:00:00.000Z",
			parentId: "parent-nobody-may-see",
			isFavorite: true,
			isDeleted: false,
			deletedAt: null,
			sortOrder: 3,
		};

		expect(publicView(row)).toEqual({
			id: "p1",
			title: "Public",
			icon: "📄",
			coverUrl: null,
			updatedAt: "2026-01-01T00:00:00.000Z",
		});
	});
});
