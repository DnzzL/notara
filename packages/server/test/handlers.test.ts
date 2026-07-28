import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqlClient } from "@effect/sql";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import * as Blocks from "../src/handlers/blocks.js";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";

function makeTestDb() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-test-"));
	const filename = path.join(tmpDir, "test.db");
	return { filename, tmpDir };
}

function cleanup(tmpDir: string) {
	fs.rmSync(tmpDir, { recursive: true, force: true });
}

const TestDbLayer = (filename: string) => SqliteClient.layer({ filename });

const migrationsDir = path.join(
	import.meta.dirname || __dirname,
	"../migrations",
);

function runMigrations(filename: string) {
	const files = fs
		.readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort();
	const db = new Database(filename);
	try {
		for (const file of files) {
			const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
			db.exec(sql);
		}
	} finally {
		db.close();
	}
}

// ---------- Pages CRUD ----------

describe("Pages CRUD", () => {
	test("should create a page and verify it exists", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "My Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(page).toBeDefined();
			expect(page.id).toBeDefined();
			expect(page.title).toBe("My Page");
			expect(page.parentId).toBeNull();
			expect(page.icon).toBeNull();
			expect(page.coverUrl).toBeNull();
			expect(page.isDeleted).toBe(false);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should list pages", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			await Pages.createPage({ title: "Page A", parentId: null }).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			await Pages.createPage({ title: "Page B", parentId: null }).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			const pages = await Pages.listPages.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(pages.length).toBe(2);
			const titles = pages.map((p) => p.title);
			expect(titles).toContain("Page A");
			expect(titles).toContain("Page B");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should get a page by id", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const created = await Pages.createPage({
				title: "Get Me",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const page = await Pages.getPage(created.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(page.id).toBe(created.id);
			expect(page.title).toBe("Get Me");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should fail to get a non-existent page", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const result = await Pages.getPage("non-existent-id").pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromiseExit,
			);
			expect(result._tag).toBe("Failure");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should update page title", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const created = await Pages.createPage({
				title: "Old Title",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const updated = await Pages.updatePage({
				id: created.id,
				title: "New Title",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(updated.title).toBe("New Title");
			expect(updated.id).toBe(created.id);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should soft-delete a page", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const created = await Pages.createPage({
				title: "Delete Me",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Pages.deletePage(created.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			const pages = await Pages.listPages.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(pages.length).toBe(0);

			const result = await Pages.getPage(created.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromiseExit,
			);
			expect(result._tag).toBe("Failure");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should search pages using FTS", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			await Pages.createPage({
				title: "Engineering Notes",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Pages.createPage({ title: "Design Ideas", parentId: null }).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			const results = await Pages.searchPages("Engineering").pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].title).toBe("Engineering Notes");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should create a child page with parentId", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const parent = await Pages.createPage({
				title: "Parent",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const child = await Pages.createPage({
				title: "Child",
				parentId: parent.id,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(child.parentId).toBe(parent.id);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should create pages with increasing sort_order for siblings", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const p1 = await Pages.createPage({
				title: "First",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const p2 = await Pages.createPage({
				title: "Second",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const p3 = await Pages.createPage({
				title: "Third",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(p1.sortOrder).toBe(1);
			expect(p2.sortOrder).toBe(2);
			expect(p3.sortOrder).toBe(3);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should list pages ordered by sort_order", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const _p1 = await Pages.createPage({
				title: "First",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const _p2 = await Pages.createPage({
				title: "Second",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const _p3 = await Pages.createPage({
				title: "Third",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			const pages = await Pages.listPages.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(pages.length).toBe(3);
			expect(pages[0].title).toBe("First");
			expect(pages[1].title).toBe("Second");
			expect(pages[2].title).toBe("Third");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should reorder sibling pages via reorderPages", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const p1 = await Pages.createPage({
				title: "First",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const p2 = await Pages.createPage({
				title: "Second",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const p3 = await Pages.createPage({
				title: "Third",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Reverse the order: Third, First, Second
			const result = await Pages.reorderPages({
				parentId: null,
				pageIds: [p3.id, p1.id, p2.id],
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(result.reordered).toBe(true);

			// Verify the order changed
			const pages = await Pages.listPages.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(pages.length).toBe(3);
			expect(pages[0].title).toBe("Third");
			expect(pages[1].title).toBe("First");
			expect(pages[2].title).toBe("Second");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should have sortOrder field in Page schema", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Test",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(page.sortOrder).toBeDefined();
			expect(typeof page.sortOrder).toBe("number");
		} finally {
			cleanup(tmpDir);
		}
	});
});

// ---------- Blocks CRUD ----------

describe("Blocks CRUD", () => {
	test("should create blocks on a page", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Blocks Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const block = await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "Hello world",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			expect(block).toBeDefined();
			expect(block.pageId).toBe(page.id);
			expect(block.type).toBe("paragraph");
			expect(block.content).toBe("Hello world");
			expect(block.index).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should list blocks in order", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Ordered Blocks",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Blocks.createBlock({
				pageId: page.id,
				type: "heading1",
				content: "Title",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "Body",
				index: 1,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "Footer",
				index: 2,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const blocks = await Blocks.listBlocks(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(blocks.length).toBe(3);
			expect(blocks[0].content).toBe("Title");
			expect(blocks[1].content).toBe("Body");
			expect(blocks[2].content).toBe("Footer");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should update block content", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Update Block",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const block = await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "Old",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			const updated = await Blocks.updateBlock({
				id: block.id,
				content: "Updated!",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(updated.content).toBe("Updated!");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should delete a block", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Delete Block",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const block = await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "Delete me",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			await Blocks.deleteBlock(block.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			const blocks = await Blocks.listBlocks(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(blocks.length).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should reorder blocks", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Reorder",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const b1 = await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "First",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const b2 = await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "Second",
				index: 1,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const b3 = await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "Third",
				index: 2,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Reverse the order
			const reordered = await Blocks.reorderBlocks(page.id, [
				b3.id,
				b1.id,
				b2.id,
			]).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(reordered[0].content).toBe("Third");
			expect(reordered[1].content).toBe("First");
			expect(reordered[2].content).toBe("Second");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should create nested blocks with parentId", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Nested",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const parent = await Blocks.createBlock({
				pageId: page.id,
				type: "bulletList",
				content: "Parent item",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const child = await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "Child item",
				index: 1,
				parentId: parent.id,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(child.parentId).toBe(parent.id);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should update block type when type is provided", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Type test",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const block = await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "<p>Hello</p>",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(block.type).toBe("paragraph");

			// Update with a new type
			const updated = await Blocks.updateBlock({
				id: block.id,
				content: "<h1>Hello</h1>",
				type: "heading1",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(updated.type).toBe("heading1");
			expect(updated.content).toBe("<h1>Hello</h1>");

			// Verify it persists by round-tripping
			const blocks = await Blocks.listBlocks(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(blocks[0].type).toBe("heading1");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should keep type unchanged when type is omitted", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Type unchanged",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const block = await Blocks.createBlock({
				pageId: page.id,
				type: "heading1",
				content: "<h1>Title</h1>",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(block.type).toBe("heading1");

			// Update content without type — type should stay unchanged
			const updated = await Blocks.updateBlock({
				id: block.id,
				content: "<h1>Updated Title</h1>",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(updated.type).toBe("heading1");
			expect(updated.content).toBe("<h1>Updated Title</h1>");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should update content and type together", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Both",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const block = await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "<p>Old</p>",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			const updated = await Blocks.updateBlock({
				id: block.id,
				content: "<blockquote>New</blockquote>",
				type: "blockquote",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(updated.type).toBe("blockquote");
			expect(updated.content).toBe("<blockquote>New</blockquote>");
		} finally {
			cleanup(tmpDir);
		}
	});

	// ---------- Test helpers for reusability ----------
});

// ---------- Database CRUD ----------

describe("Database CRUD", () => {
	test("should create a database on a page", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Tasks",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(db).toBeDefined();
			expect(db.name).toBe("Tasks");
			expect(db.pageId).toBe(page.id);
			expect(db.isDeleted).toBe(false);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should list databases on a page", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Databases.createDatabase({ pageId: page.id, name: "Tasks" }).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			await Databases.createDatabase({
				pageId: page.id,
				name: "Contacts",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const dbs = await Databases.listDatabases(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(dbs.length).toBe(2);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should get a database by id", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Tasks",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const found = await Databases.getDatabase(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(found.id).toBe(db.id);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should create fields of different types", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Tasks",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const textField = await Databases.createField({
				databaseId: db.id,
				name: "Description",
				type: "text",
				options: null,
				relationTargetDbId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(textField.name).toBe("Description");
			expect(textField.type).toBe("text");
			expect(textField.options).toBeNull();

			const selectField = await Databases.createField({
				databaseId: db.id,
				name: "Status",
				type: "select",
				options: ["todo", "in-progress", "done"],
				relationTargetDbId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(selectField.name).toBe("Status");
			expect(selectField.type).toBe("select");
			expect(selectField.options).toEqual(["todo", "in-progress", "done"]);

			const fields = await Databases.listFields(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			// 1 default text field (Notes) + 2 explicit fields (Description, Status)
			expect(fields.length).toBe(3);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should create records and set field values", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Tasks",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const statusField = await Databases.createField({
				databaseId: db.id,
				name: "Status",
				type: "select",
				options: ["todo", "done"],
				relationTargetDbId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			const record = await Databases.createRecord({
				databaseId: db.id,
				title: "Task 1",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(record.title).toBe("Task 1");

			await Databases.updateFieldValue({
				recordId: record.id,
				fieldId: statusField.id,
				value: "todo",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			const { record: rec, values } = await Databases.getRecordWithValues(
				record.id,
			).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(rec.title).toBe("Task 1");
			expect(values.Status).toBe("todo");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should handle typed field values correctly", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Tasks",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const numField = await Databases.createField({
				databaseId: db.id,
				name: "Priority",
				type: "number",
				options: null,
				relationTargetDbId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const checkField = await Databases.createField({
				databaseId: db.id,
				name: "Done",
				type: "checkbox",
				options: null,
				relationTargetDbId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const multiField = await Databases.createField({
				databaseId: db.id,
				name: "Tags",
				type: "multiSelect",
				options: ["urgent", "important"],
				relationTargetDbId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			const record = await Databases.createRecord({
				databaseId: db.id,
				title: "Task 2",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			await Databases.updateFieldValue({
				recordId: record.id,
				fieldId: numField.id,
				value: "5",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Databases.updateFieldValue({
				recordId: record.id,
				fieldId: checkField.id,
				value: "true",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Databases.updateFieldValue({
				recordId: record.id,
				fieldId: multiField.id,
				value: JSON.stringify(["urgent", "important"]),
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			const { values } = await Databases.getRecordWithValues(record.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(values.Priority).toBe(5);
			expect(values.Done).toBe(true);
			expect(values.Tags).toEqual(["urgent", "important"]);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should soft-delete a record", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Tasks",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const record = await Databases.createRecord({
				databaseId: db.id,
				title: "To Delete",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			await Databases.deleteRecord(record.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			const records = await Databases.listRecords(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(records.length).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should create views (table and board)", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Tasks",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const statusField = await Databases.createField({
				databaseId: db.id,
				name: "Status",
				type: "select",
				options: ["todo", "done"],
				relationTargetDbId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			const tableView = await Databases.createView({
				databaseId: db.id,
				name: "All Tasks",
				type: "table",
				groupByFieldId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(tableView.name).toBe("All Tasks");
			expect(tableView.type).toBe("table");
			expect(tableView.sortOrder).toBe("asc");

			const boardView = await Databases.createView({
				databaseId: db.id,
				name: "By Status",
				type: "board",
				groupByFieldId: statusField.id,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(boardView.type).toBe("board");
			expect(boardView.groupByFieldId).toBe(statusField.id);

			const views = await Databases.listViews(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			// 1 default view (Grid) + 2 explicit views (All Tasks, By Status)
			expect(views.length).toBe(3);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should list records ordered by sort_order, not created_at", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Page",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Tasks",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Create records - they'll have created_at in this order
			const r1 = await Databases.createRecord({
				databaseId: db.id,
				title: "First Created",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const r2 = await Databases.createRecord({
				databaseId: db.id,
				title: "Second Created",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const r3 = await Databases.createRecord({
				databaseId: db.id,
				title: "Third Created",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Verify initial order matches creation order (sort_order defaults to 0, so ORDER BY sort_order ASC, created_at would match)
			const initialRecords = await Databases.listRecords(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(initialRecords.length).toBe(3);
			expect(initialRecords[0].title).toBe("First Created");
			expect(initialRecords[1].title).toBe("Second Created");
			expect(initialRecords[2].title).toBe("Third Created");

			// Reorder: put r3 first, r1 second, r2 third
			await Databases.reorderRecords({
				databaseId: db.id,
				recordIds: [r3.id, r1.id, r2.id],
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Verify listRecords returns records in sort_order, NOT created_at
			const reorderedRecords = await Databases.listRecords(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(reorderedRecords.length).toBe(3);
			expect(reorderedRecords[0].title).toBe("Third Created"); // r3 should be first now
			expect(reorderedRecords[1].title).toBe("First Created"); // r1 should be second
			expect(reorderedRecords[2].title).toBe("Second Created"); // r2 should be third
		} finally {
			cleanup(tmpDir);
		}
	});
});

// ---------- Page References (Backlinks) ----------

describe("Page References (Backlinks)", () => {
	test("should find blocks that reference a page (backlinks)", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			// Create two pages
			const pageA = await Pages.createPage({
				title: "Page A",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const pageB = await Pages.createPage({
				title: "Page B",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Create a block on Page A that references Page B
			// The format will be: <span data-page-ref="pageId">Page Name</span>
			const referenceContent = `<p>This links to <span data-page-ref="${pageB.id}">Page B</span>.</p>`;
			await Blocks.createBlock({
				pageId: pageA.id,
				type: "paragraph",
				content: referenceContent,
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Query for backlinks to Page B
			const backlinks = await Blocks.getBacklinks(pageB.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			expect(backlinks.length).toBe(1);
			expect(backlinks[0].pageId).toBe(pageA.id);
			expect(backlinks[0].pageTitle).toBe("Page A");
			expect(backlinks[0].content).toContain(pageB.id);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should return empty array when no backlinks exist", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const pageA = await Pages.createPage({
				title: "Page A",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const pageB = await Pages.createPage({
				title: "Page B",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// No blocks reference Page B
			await Blocks.createBlock({
				pageId: pageA.id,
				type: "paragraph",
				content: "<p>No references here.</p>",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			const backlinks = await Blocks.getBacklinks(pageB.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			expect(backlinks.length).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should find multiple backlinks from different pages", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const pageA = await Pages.createPage({
				title: "Page A",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const pageB = await Pages.createPage({
				title: "Page B",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const pageC = await Pages.createPage({
				title: "Page C",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Page A references Page B
			await Blocks.createBlock({
				pageId: pageA.id,
				type: "paragraph",
				content: `<p>See <span data-page-ref="${pageB.id}">Page B</span> for details.</p>`,
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Page C also references Page B
			await Blocks.createBlock({
				pageId: pageC.id,
				type: "paragraph",
				content: `<p>Related: <span data-page-ref="${pageB.id}">Page B</span></p>`,
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			const backlinks = await Blocks.getBacklinks(pageB.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			expect(backlinks.length).toBe(2);
			const pageIds = backlinks.map((b) => b.pageId);
			expect(pageIds).toContain(pageA.id);
			expect(pageIds).toContain(pageC.id);
		} finally {
			cleanup(tmpDir);
		}
	});
});

// ---------- Trash / Restore / Purge Lifecycle ----------

describe("Trash lifecycle", () => {
	test("should soft-delete page and show in trash", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Trash Me",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Soft-delete
			await Pages.deletePage(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			// Should disappear from regular listing
			const pages = await Pages.listPages.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(pages.length).toBe(0);

			// Should appear in trash
			const trash = await Databases.listTrash.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(trash.pages.length).toBe(1);
			expect(trash.pages[0].id).toBe(page.id);
			expect(trash.pages[0].title).toBe("Trash Me");
			expect(trash.pages[0].deletedAt).not.toBeNull();
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should restore trashed page", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Restore Me",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Pages.deletePage(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			// Restore
			const result = await Pages.restorePage(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(result.restored).toBe(true);

			// Should be back in regular listing
			const pages = await Pages.listPages.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(pages.length).toBe(1);
			expect(pages[0].id).toBe(page.id);
			expect(pages[0].isDeleted).toBe(false);

			// Should be gone from trash
			const trash = await Databases.listTrash.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(trash.pages.length).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should restore trashed record with backing page", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Host",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Tasks",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const record = await Databases.createRecord({
				databaseId: db.id,
				title: "Record to Trash",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			// Create backing page
			const _opened = await Databases.openRecordAsPage(record.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			// Soft-delete the record (also trashes its backing page)
			await Databases.deleteRecord(record.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			// Record should be in trash
			const trashBefore = await Databases.listTrash.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(trashBefore.records.length).toBe(1);

			// Restore the record (should also restore its backing page)
			const restoreResult = await Databases.restoreRecord(record.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(restoreResult.restored).toBe(true);

			// Record should be back in listing
			const records = await Databases.listRecords(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(records.length).toBe(1);
			expect(records[0].id).toBe(record.id);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should purge page and all children", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Purge Me",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			// Add a block
			await Blocks.createBlock({
				pageId: page.id,
				type: "paragraph",
				content: "<p>Child block</p>",
				index: 0,
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			// Add a database with a record
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Sub DB",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Databases.createField({
				databaseId: db.id,
				name: "Name",
				type: "text",
				options: null,
				relationTargetDbId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const _record = await Databases.createRecord({
				databaseId: db.id,
				title: "Sub Record",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Purge
			await Databases.purgePage(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			// Page should be gone
			const pages = await Pages.listPages.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(pages.length).toBe(0);

			// Database should be gone
			const dbs = await Databases.listDatabases(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(dbs.length).toBe(0);

			// Verify via raw SQL that related data is gone
			const counts = await Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const blocks =
					yield* sql`SELECT COUNT(*) as cnt FROM blocks WHERE page_id = ${page.id}`;
				const recs =
					yield* sql`SELECT COUNT(*) as cnt FROM database_records WHERE database_id = ${db.id}`;
				return { blocks: Number(blocks[0].cnt), recs: Number(recs[0].cnt) };
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			expect(counts.blocks).toBe(0);
			expect(counts.recs).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should purge database and all children", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "DB Host",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "To Purge",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			await Databases.createField({
				databaseId: db.id,
				name: "Label",
				type: "text",
				options: null,
				relationTargetDbId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const _record = await Databases.createRecord({
				databaseId: db.id,
				title: "Record A",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			await Databases.purgeDatabase(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			// Database should be gone
			const dbs = await Databases.listDatabases(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(dbs.length).toBe(0);

			// Record should be gone
			const records = await Databases.listRecords(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(records.length).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should purge expired items", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Expired",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Manually set deleted_at far in the past (bypassing the normal soft-delete)
			const rawDb = new Database(filename);
			rawDb.exec(
				`UPDATE pages SET is_deleted = 1, deleted_at = '2020-01-01T00:00:00.000Z' WHERE id = '${page.id}'`,
			);
			rawDb.close();

			// Purge expired (retentionDays=0 means everything past-deleted is eligible)
			const result = await Databases.purgeExpired(0).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(result.pages).toBe(1);

			// Page should be permanently gone
			const pages = await Pages.listPages.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(pages.length).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should purge record with backing page", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Host",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "Data",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const record = await Databases.createRecord({
				databaseId: db.id,
				title: "With Backing",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			// Create a backing page for the record
			const opened = await Databases.openRecordAsPage(record.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(opened.pageId).toBeDefined();

			// Purge the record
			await Databases.purgeRecord(record.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			// Record should be gone
			const records = await Databases.listRecords(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(records.length).toBe(0);

			// Backing page should also be purged
			const pages = await Pages.listPages.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(pages.length).toBe(1); // Only the host page remains
			expect(pages[0].id).toBe(page.id);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should soft-delete database and restore it", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const page = await Pages.createPage({
				title: "Host",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
			const db = await Databases.createDatabase({
				pageId: page.id,
				name: "To Trash",
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Soft-delete
			await Databases.deleteDatabase(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);

			// Should show in trash
			const trash = await Databases.listTrash.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(trash.databases.length).toBe(1);
			expect(trash.databases[0].id).toBe(db.id);

			// Restore
			const result = await Databases.restoreDatabase(db.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(result.restored).toBe(true);

			// Should be back in listing
			const dbs = await Databases.listDatabases(page.id).pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(dbs.length).toBe(1);
			expect(dbs[0].id).toBe(db.id);
		} finally {
			cleanup(tmpDir);
		}
	});

	test("should not list non-trashed items in trash", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const _page = await Pages.createPage({
				title: "Active",
				parentId: null,
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			// Active page should not show in trash
			const trash = await Databases.listTrash.pipe(
				Effect.provide(TestDbLayer(filename)),
				Effect.runPromise,
			);
			expect(trash.pages.length).toBe(0);
			expect(trash.databases.length).toBe(0);
			expect(trash.records.length).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});
});
