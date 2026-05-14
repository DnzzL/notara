import { describe, it, expect } from "vitest";
import { Either } from "effect";
import { Schema } from "effect";
import {
  Page,
  Block,
  Database,
  DatabaseField,
  DatabaseRecord,
  RecordFieldValue,
  DatabaseView,
} from "../src/schema.js";

describe("Page Schema", () => {
  it("should encode and decode a valid Page", () => {
    const input = {
      id: "page-1",
      title: "My Page",
      parentId: null,
      icon: "📄",
      coverUrl: "https://example.com/cover.jpg",
      sortOrder: 0,
      isDeleted: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    };

    const decoded = Schema.decodeSync(Page)(input);
    expect(decoded.id).toBe("page-1");
    expect(decoded.title).toBe("My Page");
    expect(decoded.parentId).toBeNull();
    expect(decoded.icon).toBe("📄");
    expect(decoded.coverUrl).toBe("https://example.com/cover.jpg");
    expect(decoded.isDeleted).toBe(false);

    const encoded = Schema.encodeSync(Page)(decoded);
    expect(encoded.id).toBe("page-1");
  });

  it("should fail decoding when id is missing", () => {
    const input = {
      title: "Bad Page",
      parentId: null,
      icon: null,
      coverUrl: null,
      sortOrder: 0,
      isDeleted: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    };

    const result = Schema.decodeUnknownEither(Page)(input);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("should fail decoding when isDeleted is wrong type", () => {
    const input = {
      id: "page-1",
      title: "Bad Page",
      parentId: null,
      icon: null,
      coverUrl: null,
      sortOrder: 0,
      isDeleted: "not a boolean",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    };

    const result = Schema.decodeUnknownEither(Page)(input);
    expect(Either.isLeft(result)).toBe(true);
  });
});

describe("Block Schema", () => {
  it("should encode and decode a valid paragraph Block", () => {
    const input = {
      id: "block-1",
      pageId: "page-1",
      type: "paragraph" as const,
      content: "Hello world",
      parentId: null,
      index: 0,
    };

    const decoded = Schema.decodeSync(Block)(input);
    expect(decoded.id).toBe("block-1");
    expect(decoded.type).toBe("paragraph");
    expect(decoded.content).toBe("Hello world");
    expect(decoded.index).toBe(0);

    const encoded = Schema.encodeSync(Block)(decoded);
    expect(encoded.type).toBe("paragraph");
  });

  it("should fail decoding with an invalid block type", () => {
    const input = {
      id: "block-2",
      pageId: "page-1",
      type: "custom",
      content: "Bad type",
      parentId: null,
      index: 0,
    };

    const result = Schema.decodeUnknownEither(Block)(input);
    expect(Either.isLeft(result)).toBe(true);
  });
});

describe("DatabaseField Schema", () => {
  it("should preserve select options", () => {
    const input = {
      id: "field-1",
      databaseId: "db-1",
      name: "Status",
      type: "select" as const,
      options: ["todo", "done"],
      relationTargetDbId: null,
    };

    const decoded = Schema.decodeSync(DatabaseField)(input);
    expect(decoded.options).toEqual(["todo", "done"]);
    expect(decoded.type).toBe("select");

    const encoded = Schema.encodeSync(DatabaseField)(decoded);
    expect(encoded.options).toEqual(["todo", "done"]);
  });

  it("should allow relation type without relationTargetDbId", () => {
    const input = {
      id: "field-2",
      databaseId: "db-1",
      name: "Link",
      type: "relation" as const,
      options: null,
      relationTargetDbId: null,
    };

    const decoded = Schema.decodeSync(DatabaseField)(input);
    expect(decoded.type).toBe("relation");
    expect(decoded.relationTargetDbId).toBeNull();
  });
});

describe("DatabaseView Schema", () => {
  it("should encode and decode a board view with groupByFieldId", () => {
    const input = {
      id: "view-1",
      databaseId: "db-1",
      name: "Board View",
      type: "board" as const,
      groupByFieldId: "field-1",
      sortFieldId: null,
      sortOrder: "asc" as const,
    };

    const decoded = Schema.decodeSync(DatabaseView)(input);
    expect(decoded.type).toBe("board");
    expect(decoded.groupByFieldId).toBe("field-1");

    const encoded = Schema.encodeSync(DatabaseView)(decoded);
    expect(encoded.type).toBe("board");
  });

  it("should have null groupByFieldId for table views", () => {
    const input = {
      id: "view-2",
      databaseId: "db-1",
      name: "Table View",
      type: "table" as const,
      groupByFieldId: null,
      sortFieldId: "field-1",
      sortOrder: "desc" as const,
    };

    const decoded = Schema.decodeSync(DatabaseView)(input);
    expect(decoded.type).toBe("table");
    expect(decoded.groupByFieldId).toBeNull();
  });
});

describe("RecordFieldValue Schema", () => {
  it("should encode and decode a simple RecordFieldValue", () => {
    const input = {
      id: "rfv-1",
      recordId: "record-1",
      fieldId: "field-1",
      value: "some data",
    };

    const decoded = Schema.decodeSync(RecordFieldValue)(input);
    expect(decoded.value).toBe("some data");
    expect(decoded.recordId).toBe("record-1");

    const encoded = Schema.encodeSync(RecordFieldValue)(decoded);
    expect(encoded.value).toBe("some data");
  });
});
