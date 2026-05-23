import { describe, test, expect, afterEach } from "bun:test";
import { Effect, Layer } from "effect";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as Pages from "../src/handlers/pages.js";
import * as Blocks from "../src/handlers/blocks.js";
import * as Databases from "../src/handlers/databases.js";

function makeTestDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notion-alt-test-"));
  const filename = path.join(tmpDir, "test.db");
  return { filename, tmpDir };
}

function cleanup(tmpDir: string) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

const TestDbLayer = (filename: string) => SqliteClient.layer({ filename });

const migrationsDir = path.join(import.meta.dirname || __dirname, "../migrations");

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
      const page = await Pages.createPage({ title: "My Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const created = await Pages.createPage({ title: "Get Me", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const created = await Pages.createPage({ title: "Old Title", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const updated = await Pages.updatePage({ id: created.id, title: "New Title" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const created = await Pages.createPage({ title: "Delete Me", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      await Pages.createPage({ title: "Engineering Notes", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const parent = await Pages.createPage({ title: "Parent", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const child = await Pages.createPage({ title: "Child", parentId: parent.id }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      expect(child.parentId).toBe(parent.id);
    } finally {
      cleanup(tmpDir);
    }
  });

  test("should create pages with increasing sort_order for siblings", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      runMigrations(filename);
      const p1 = await Pages.createPage({ title: "First", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const p2 = await Pages.createPage({ title: "Second", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const p3 = await Pages.createPage({ title: "Third", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const p1 = await Pages.createPage({ title: "First", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const p2 = await Pages.createPage({ title: "Second", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const p3 = await Pages.createPage({ title: "Third", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

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
      const p1 = await Pages.createPage({ title: "First", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const p2 = await Pages.createPage({ title: "Second", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const p3 = await Pages.createPage({ title: "Third", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

      // Reverse the order: Third, First, Second
      const result = await Pages.reorderPages({ parentId: null, pageIds: [p3.id, p1.id, p2.id] }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const page = await Pages.createPage({ title: "Test", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const page = await Pages.createPage({ title: "Blocks Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const page = await Pages.createPage({ title: "Ordered Blocks", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      await Blocks.createBlock({ pageId: page.id, type: "heading1", content: "Title", index: 0, parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      await Blocks.createBlock({ pageId: page.id, type: "paragraph", content: "Body", index: 1, parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      await Blocks.createBlock({ pageId: page.id, type: "paragraph", content: "Footer", index: 2, parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const page = await Pages.createPage({ title: "Update Block", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const block = await Blocks.createBlock({
        pageId: page.id, type: "paragraph", content: "Old", index: 0, parentId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      const updated = await Blocks.updateBlock({ id: block.id, content: "Updated!" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      expect(updated.content).toBe("Updated!");
    } finally {
      cleanup(tmpDir);
    }
  });

  test("should delete a block", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      runMigrations(filename);
      const page = await Pages.createPage({ title: "Delete Block", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const block = await Blocks.createBlock({
        pageId: page.id, type: "paragraph", content: "Delete me", index: 0, parentId: null,
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
      const page = await Pages.createPage({ title: "Reorder", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const b1 = await Blocks.createBlock({ pageId: page.id, type: "paragraph", content: "First", index: 0, parentId: null }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      const b2 = await Blocks.createBlock({ pageId: page.id, type: "paragraph", content: "Second", index: 1, parentId: null }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      const b3 = await Blocks.createBlock({ pageId: page.id, type: "paragraph", content: "Third", index: 2, parentId: null }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      // Reverse the order
      const reordered = await Blocks.reorderBlocks(page.id, [b3.id, b1.id, b2.id]).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const page = await Pages.createPage({ title: "Nested", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const parent = await Blocks.createBlock({ pageId: page.id, type: "bulletList", content: "Parent item", index: 0, parentId: null }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      const child = await Blocks.createBlock({ pageId: page.id, type: "paragraph", content: "Child item", index: 1, parentId: parent.id }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      expect(child.parentId).toBe(parent.id);
    } finally {
      cleanup(tmpDir);
    }
  });
});

// ---------- Database CRUD ----------

describe("Database CRUD", () => {
  test("should create a database on a page", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      runMigrations(filename);
      const page = await Pages.createPage({ title: "DB Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const db = await Databases.createDatabase({ pageId: page.id, name: "Tasks" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const page = await Pages.createPage({ title: "DB Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      await Databases.createDatabase({ pageId: page.id, name: "Tasks" }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      await Databases.createDatabase({ pageId: page.id, name: "Contacts" }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
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
      const page = await Pages.createPage({ title: "DB Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const db = await Databases.createDatabase({ pageId: page.id, name: "Tasks" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
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
      const page = await Pages.createPage({ title: "DB Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const db = await Databases.createDatabase({ pageId: page.id, name: "Tasks" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const textField = await Databases.createField({
        databaseId: db.id, name: "Description", type: "text", options: null, relationTargetDbId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      expect(textField.name).toBe("Description");
      expect(textField.type).toBe("text");
      expect(textField.options).toBeNull();

      const selectField = await Databases.createField({
        databaseId: db.id, name: "Status", type: "select",
        options: ["todo", "in-progress", "done"], relationTargetDbId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      expect(selectField.name).toBe("Status");
      expect(selectField.type).toBe("select");
      expect(selectField.options).toEqual(["todo", "in-progress", "done"]);

      const fields = await Databases.listFields(db.id).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      expect(fields.length).toBe(2);
    } finally {
      cleanup(tmpDir);
    }
  });

  test("should create records and set field values", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      runMigrations(filename);
      const page = await Pages.createPage({ title: "DB Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const db = await Databases.createDatabase({ pageId: page.id, name: "Tasks" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const statusField = await Databases.createField({
        databaseId: db.id, name: "Status", type: "select",
        options: ["todo", "done"], relationTargetDbId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      const record = await Databases.createRecord({ databaseId: db.id, title: "Task 1" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      expect(record.title).toBe("Task 1");

      await Databases.updateFieldValue({ recordId: record.id, fieldId: statusField.id, value: "todo" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

      const { record: rec, values } = await Databases.getRecordWithValues(record.id).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      expect(rec.title).toBe("Task 1");
      expect(values["Status"]).toBe("todo");
    } finally {
      cleanup(tmpDir);
    }
  });

  test("should handle typed field values correctly", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      runMigrations(filename);
      const page = await Pages.createPage({ title: "DB Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const db = await Databases.createDatabase({ pageId: page.id, name: "Tasks" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const numField = await Databases.createField({
        databaseId: db.id, name: "Priority", type: "number", options: null, relationTargetDbId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      const checkField = await Databases.createField({
        databaseId: db.id, name: "Done", type: "checkbox", options: null, relationTargetDbId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      const multiField = await Databases.createField({
        databaseId: db.id, name: "Tags", type: "multiSelect",
        options: ["urgent", "important"], relationTargetDbId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      const record = await Databases.createRecord({ databaseId: db.id, title: "Task 2" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

      await Databases.updateFieldValue({ recordId: record.id, fieldId: numField.id, value: "5" }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      await Databases.updateFieldValue({ recordId: record.id, fieldId: checkField.id, value: "true" }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      await Databases.updateFieldValue({ recordId: record.id, fieldId: multiField.id, value: JSON.stringify(["urgent", "important"]) }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      const { values } = await Databases.getRecordWithValues(record.id).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      expect(values["Priority"]).toBe(5);
      expect(values["Done"]).toBe(true);
      expect(values["Tags"]).toEqual(["urgent", "important"]);
    } finally {
      cleanup(tmpDir);
    }
  });

  test("should soft-delete a record", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      runMigrations(filename);
      const page = await Pages.createPage({ title: "DB Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const db = await Databases.createDatabase({ pageId: page.id, name: "Tasks" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const record = await Databases.createRecord({ databaseId: db.id, title: "To Delete" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

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
      const page = await Pages.createPage({ title: "DB Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const db = await Databases.createDatabase({ pageId: page.id, name: "Tasks" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const statusField = await Databases.createField({
        databaseId: db.id, name: "Status", type: "select",
        options: ["todo", "done"], relationTargetDbId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      const tableView = await Databases.createView({
        databaseId: db.id, name: "All Tasks", type: "table", groupByFieldId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      expect(tableView.name).toBe("All Tasks");
      expect(tableView.type).toBe("table");
      expect(tableView.sortOrder).toBe("asc");

      const boardView = await Databases.createView({
        databaseId: db.id, name: "By Status", type: "board", groupByFieldId: statusField.id,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      expect(boardView.type).toBe("board");
      expect(boardView.groupByFieldId).toBe(statusField.id);

      const views = await Databases.listViews(db.id).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      expect(views.length).toBe(2);
    } finally {
      cleanup(tmpDir);
    }
  });

  test("should list records ordered by sort_order, not created_at", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      runMigrations(filename);
      const page = await Pages.createPage({ title: "DB Page", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const db = await Databases.createDatabase({ pageId: page.id, name: "Tasks" }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

      // Create records - they'll have created_at in this order
      const r1 = await Databases.createRecord({ databaseId: db.id, title: "First Created" }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      const r2 = await Databases.createRecord({ databaseId: db.id, title: "Second Created" }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      const r3 = await Databases.createRecord({ databaseId: db.id, title: "Third Created" }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      // Verify initial order matches creation order (sort_order defaults to 0, so ORDER BY sort_order ASC, created_at would match)
      const initialRecords = await Databases.listRecords(db.id).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
      expect(initialRecords.length).toBe(3);
      expect(initialRecords[0].title).toBe("First Created");
      expect(initialRecords[1].title).toBe("Second Created");
      expect(initialRecords[2].title).toBe("Third Created");

      // Reorder: put r3 first, r1 second, r2 third
      await Databases.reorderRecords({ databaseId: db.id, recordIds: [r3.id, r1.id, r2.id] }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

      // Verify listRecords returns records in sort_order, NOT created_at
      const reorderedRecords = await Databases.listRecords(db.id).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
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
      const pageA = await Pages.createPage({ title: "Page A", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const pageB = await Pages.createPage({ title: "Page B", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

      // Create a block on Page A that references Page B
      // The format will be: <span data-page-ref="pageId">Page Name</span>
      const referenceContent = `<p>This links to <span data-page-ref="${pageB.id}">Page B</span>.</p>`;
      await Blocks.createBlock({
        pageId: pageA.id, type: "paragraph", content: referenceContent, index: 0, parentId: null,
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
      const pageA = await Pages.createPage({ title: "Page A", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const pageB = await Pages.createPage({ title: "Page B", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

      // No blocks reference Page B
      await Blocks.createBlock({
        pageId: pageA.id, type: "paragraph", content: "<p>No references here.</p>", index: 0, parentId: null,
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
      const pageA = await Pages.createPage({ title: "Page A", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const pageB = await Pages.createPage({ title: "Page B", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );
      const pageC = await Pages.createPage({ title: "Page C", parentId: null }).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

      // Page A references Page B
      await Blocks.createBlock({
        pageId: pageA.id, type: "paragraph", 
        content: `<p>See <span data-page-ref="${pageB.id}">Page B</span> for details.</p>`,
        index: 0, parentId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      // Page C also references Page B
      await Blocks.createBlock({
        pageId: pageC.id, type: "paragraph",
        content: `<p>Related: <span data-page-ref="${pageB.id}">Page B</span></p>`,
        index: 0, parentId: null,
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      const backlinks = await Blocks.getBacklinks(pageB.id).pipe(
        Effect.provide(TestDbLayer(filename)),
        Effect.runPromise,
      );

      expect(backlinks.length).toBe(2);
      const pageIds = backlinks.map(b => b.pageId);
      expect(pageIds).toContain(pageA.id);
      expect(pageIds).toContain(pageC.id);
    } finally {
      cleanup(tmpDir);
    }
  });
});
