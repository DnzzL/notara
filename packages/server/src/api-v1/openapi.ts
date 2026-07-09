// ── Inline OpenAPI 3.0.3 spec ─────────────────────────────────────────────────
// This is a plain TypeScript object — no code generation, full type clarity.

const BLOCK_TYPES = [
  "paragraph", "heading1", "heading2", "heading3",
  "bulletList", "numberedList", "todo",
  "code", "blockquote", "divider",
  "image", "pdf", "database", "pageLink", "toggle", "callout",
] as const;

const FIELD_TYPES = [
  "text", "number", "select", "multiSelect", "date", "checkbox", "relation", "page", "formula",
] as const;

const schemas = {
  Error: {
    type: "object",
    required: ["error"],
    properties: { error: { type: "string", example: "Not found" } },
  },

  Page: {
    type: "object",
    required: ["id", "title", "sortOrder", "isDeleted", "isFavorite", "createdAt", "updatedAt"],
    properties: {
      id:          { type: "string", example: "01JV2RXHK00000000000000000" },
      title:       { type: "string", example: "Meeting notes" },
      parentId:    { type: "string", nullable: true, example: null },
      icon:        { type: "string", nullable: true, example: "📝" },
      coverUrl:    { type: "string", nullable: true, example: null },
      sortOrder:   { type: "number", example: 1 },
      isDeleted:   { type: "boolean", example: false },
      isFavorite:  { type: "boolean", example: false },
      createdAt:   { type: "string", format: "date-time" },
      updatedAt:   { type: "string", format: "date-time" },
      deletedAt:   { type: "string", format: "date-time", nullable: true, description: "When the page was trashed, or null if not deleted." },
    },
  },

  PageCreate: {
    type: "object",
    required: ["title"],
    properties: {
      title:    { type: "string", example: "New page" },
      parentId: { type: "string", nullable: true, example: null },
    },
  },

  PageUpdate: {
    type: "object",
    properties: {
      title:      { type: "string", example: "Updated title" },
      icon:       { type: "string", nullable: true, example: "🚀" },
      coverUrl:   { type: "string", nullable: true, example: null },
      isFavorite: { type: "boolean", example: true },
    },
  },

  Block: {
    type: "object",
    required: ["id", "pageId", "type", "content", "index"],
    properties: {
      id:       { type: "string" },
      pageId:   { type: "string" },
      type:     { type: "string", enum: [...BLOCK_TYPES], example: "paragraph" },
      content:  {
        description: "Block payload — varies by type. Paragraph: `{text:string}`. Heading: `{text:string,level:1|2|3}`. Todo: `{text:string,checked:boolean}`. Code: `{code:string,language:string}`. Stored and returned as a JSON object.",
        example: { text: "Hello world" },
      },
      parentId: { type: "string", nullable: true },
      index:    { type: "integer", example: 0 },
    },
  },

  BlockCreate: {
    type: "object",
    required: ["pageId", "type", "content", "index"],
    properties: {
      pageId:   { type: "string" },
      type:     { type: "string", enum: [...BLOCK_TYPES], example: "paragraph" },
      content:  { description: "JSON object matching the block type schema", example: { text: "" } },
      index:    { type: "integer", example: 0 },
      parentId: { type: "string", nullable: true, example: null },
    },
  },

  BlockUpdate: {
    type: "object",
    required: ["content"],
    properties: {
      content: { description: "New content payload", example: { text: "Updated text" } },
    },
  },

  Database: {
    type: "object",
    required: ["id", "pageId", "name"],
    properties: {
      id:         { type: "string" },
      pageId:     { type: "string" },
      name:       { type: "string", example: "Tasks" },
      isDeleted:  { type: "boolean" },
      sortOrder:  { type: "number" },
      titleLabel: { type: "string", example: "Name" },
      titleHidden:{ type: "boolean" },
      deletedAt:  { type: "string", format: "date-time", nullable: true },
    },
  },

  DatabaseCreate: {
    type: "object",
    required: ["pageId", "name"],
    properties: {
      pageId: { type: "string", description: "Page the database is hosted on", example: "01JV2RXHK00000000000000000" },
      name:   { type: "string", example: "Tasks" },
    },
  },

  DatabaseUpdate: {
    type: "object",
    properties: {
      name:        { type: "string", example: "Renamed DB" },
      titleLabel:  { type: "string", example: "Name", description: "Label of the built-in title column" },
      titleHidden: { type: "boolean", description: "Hide the title column" },
    },
  },

  DatabaseField: {
    type: "object",
    required: ["id", "databaseId", "name", "type"],
    properties: {
      id:                 { type: "string" },
      databaseId:         { type: "string" },
      name:               { type: "string", example: "Status" },
      type:               { type: "string", enum: [...FIELD_TYPES], example: "select" },
      options:            { type: "array", items: { type: "string" }, nullable: true, example: ["Todo", "Doing", "Done"] },
      relationTargetDbId: { type: "string", nullable: true, description: "Target database id for a relation field" },
      formula:            { type: "string", nullable: true, description: "Expression for a formula field" },
      sortOrder:          { type: "number" },
    },
  },

  FieldCreate: {
    type: "object",
    required: ["name", "type"],
    properties: {
      name:               { type: "string", example: "Priority" },
      type:               { type: "string", enum: [...FIELD_TYPES], example: "select" },
      options:            { type: "array", items: { type: "string" }, nullable: true, example: ["Low", "High"] },
      relationTargetDbId: { type: "string", nullable: true },
      formula:            { type: "string", nullable: true },
    },
  },

  FieldUpdate: {
    type: "object",
    properties: {
      name:               { type: "string" },
      type:               { type: "string", enum: [...FIELD_TYPES] },
      options:            { type: "array", items: { type: "string" }, nullable: true },
      relationTargetDbId: { type: "string", nullable: true },
      formula:            { type: "string", nullable: true },
    },
  },

  DatabaseRecord: {
    type: "object",
    required: ["id", "databaseId", "title"],
    properties: {
      id:          { type: "string" },
      databaseId:  { type: "string" },
      title:       { type: "string", example: "Fix the login bug" },
      description: { type: "string", nullable: true },
      pageId:      { type: "string", nullable: true, description: "Backing page id once the record has been opened as a page; null otherwise." },
      isDeleted:   { type: "boolean" },
      createdAt:   { type: "string", format: "date-time" },
      deletedAt:   { type: "string", format: "date-time", nullable: true },
      fields:      {
        type: "object",
        description: "Map of field names to their values for this record",
        additionalProperties: { type: "string" },
        example: { Status: "In progress", Priority: "High" },
      },
    },
  },

  RecordCreate: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string", example: "Fix the login bug" },
    },
  },

  RecordUpdate: {
    type: "object",
    properties: {
      title:       { type: "string", example: "Updated title" },
      description: { type: "string", example: "More detail" },
    },
  },

  CellUpdate: {
    type: "object",
    required: ["value"],
    properties: {
      value: {
        type: "string",
        description: "Cell value as a string. Number: \"42\". Checkbox: \"true\"/\"false\". multiSelect: a JSON array string like '[\"a\",\"b\"]'.",
        example: "In progress",
      },
    },
  },

  RestoreResult: {
    type: "object",
    properties: { restored: { type: "boolean", example: true } },
  },

  TrashItem: {
    type: "object",
    required: ["id", "deletedAt"],
    properties: {
      id:         { type: "string" },
      title:      { type: "string", nullable: true, description: "Present for pages and records." },
      name:       { type: "string", nullable: true, description: "Present for databases." },
      databaseId: { type: "string", nullable: true, description: "Present for records." },
      deletedAt:  { type: "string", format: "date-time", nullable: true },
    },
  },

  TrashContents: {
    type: "object",
    required: ["pages", "databases", "records"],
    properties: {
      pages:     { type: "array", items: { $ref: "#/components/schemas/TrashItem" } },
      databases: { type: "array", items: { $ref: "#/components/schemas/TrashItem" } },
      records:   { type: "array", items: { $ref: "#/components/schemas/TrashItem" } },
    },
  },

  SearchResult: {
    type: "object",
    required: ["type", "id", "title"],
    properties: {
      type:    { type: "string", enum: ["page", "block"], example: "page" },
      id:      { type: "string" },
      title:   { type: "string" },
      content: { type: "string" },
      pageId:  { type: "string" },
    },
  },

  Workspace: {
    type: "object",
    required: ["id", "name", "slug", "role"],
    properties: {
      id:   { type: "string" },
      name: { type: "string", example: "Acme" },
      slug: { type: "string", example: "acme" },
      role: { type: "string", enum: ["owner", "member"] },
    },
  },
} as const;

// ── Path parameters ───────────────────────────────────────────────────────────

const wsParam = {
  name: "workspaceId",
  in: "path" as const,
  required: true,
  schema: { type: "string" },
  description: "Workspace ID",
};

const pageParam = {
  name: "pageId",
  in: "path" as const,
  required: true,
  schema: { type: "string" },
  description: "Page ID",
};

const blockParam = {
  name: "blockId",
  in: "path" as const,
  required: true,
  schema: { type: "string" },
  description: "Block ID",
};

const dbParam = {
  name: "dbId",
  in: "path" as const,
  required: true,
  schema: { type: "string" },
  description: "Database ID",
};

const fieldParam = {
  name: "fieldId",
  in: "path" as const,
  required: true,
  schema: { type: "string" },
  description: "Field ID",
};

const recordParam = {
  name: "recordId",
  in: "path" as const,
  required: true,
  schema: { type: "string" },
  description: "Record ID",
};

const permanentQuery = {
  name: "permanent",
  in: "query" as const,
  required: false,
  schema: { type: "boolean" },
  description: "When `true`, permanently purge instead of moving to trash. Irreversible.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const ref = (name: keyof typeof schemas) => ({ $ref: `#/components/schemas/${name}` });

const jsonBody = (schema: object) => ({
  required: true,
  content: { "application/json": { schema } },
});

const jsonResponse = (description: string, schema: object) => ({
  description,
  content: { "application/json": { schema } },
});

const errors = {
  401: jsonResponse("Unauthorized", ref("Error")),
  403: jsonResponse("Forbidden", ref("Error")),
  404: jsonResponse("Not found", ref("Error")),
  422: jsonResponse("Validation error", ref("Error")),
  500: jsonResponse("Server error", ref("Error")),
};

// ── Spec ──────────────────────────────────────────────────────────────────────

export const spec = {
  openapi: "3.0.3",
  info: {
    title: "Notara REST API",
    version: "1.0.0",
    description: `
Automate Notara — create and manage pages, write blocks, query databases and search content programmatically.

## Authentication

Every request must be authenticated with one of:

1. **API key** (recommended for scripts): set the \`Authorization\` header:
   \`\`\`
   Authorization: Bearer ntr_<your-key>
   \`\`\`
   Generate keys in your workspace settings → API keys.

2. **Session cookie**: if you're calling from a browser that is already signed in, the session cookie is sent automatically.

## Base URL

All paths below are relative to \`/api/v1\`. For example, \`GET /workspaces\` → \`GET /api/v1/workspaces\`.

## Block content format

Each block stores a \`content\` JSON object whose shape depends on the block type:

| Type | Shape |
|------|-------|
| paragraph | \`{ "text": "…" }\` |
| heading1/2/3 | \`{ "text": "…" }\` |
| todo | \`{ "text": "…", "checked": false }\` |
| code | \`{ "code": "…", "language": "typescript" }\` |
| bulletList / numberedList | \`{ "text": "…" }\` |
| toggle | \`{ "text": "…", "open": false }\` |
| callout | \`{ "text": "…", "emoji": "💡" }\` |
| divider | \`{}\` |
| image / pdf | \`{ "url": "…", "caption": "…" }\` |
| pageLink | \`{ "pageId": "…" }\` |
| database | \`{ "databaseId": "…" }\` |
`.trim(),
    contact: { name: "Notara", url: "https://github.com/notara" },
    license: { name: "MIT" },
  },
  servers: [{ url: "/api/v1", description: "Current instance" }],
  security: [{ BearerAuth: [] }],
  tags: [
    { name: "Workspaces", description: "List workspaces the authenticated user belongs to" },
    { name: "Pages",      description: "Create, read, update and delete pages" },
    { name: "Blocks",     description: "Read and write the content blocks inside a page" },
    { name: "Databases",  description: "Create and edit inline databases, their fields, and records" },
    { name: "Search",     description: "Full-text search across pages and blocks" },
    { name: "Trash",      description: "Soft-deleted items; restore or purge them" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key with `ntr_` prefix. Generate one in workspace settings.",
      },
    },
    schemas,
  },
  paths: {
    // ── Workspaces ──────────────────────────────────────────────────────────
    "/workspaces": {
      get: {
        tags: ["Workspaces"],
        summary: "List workspaces",
        operationId: "listWorkspaces",
        responses: {
          200: jsonResponse("List of workspaces", { type: "array", items: ref("Workspace") }),
          ...errors,
        },
      },
    },

    // ── Pages ───────────────────────────────────────────────────────────────
    "/workspaces/{workspaceId}/pages": {
      parameters: [wsParam],
      get: {
        tags: ["Pages"],
        summary: "List all pages",
        operationId: "listPages",
        responses: {
          200: jsonResponse("All non-deleted pages", { type: "array", items: ref("Page") }),
          ...errors,
        },
      },
      post: {
        tags: ["Pages"],
        summary: "Create a page",
        operationId: "createPage",
        requestBody: jsonBody(ref("PageCreate")),
        responses: {
          201: jsonResponse("Created page", ref("Page")),
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/pages/{pageId}": {
      parameters: [wsParam, pageParam],
      get: {
        tags: ["Pages"],
        summary: "Get a page",
        operationId: "getPage",
        responses: {
          200: jsonResponse("Page", ref("Page")),
          ...errors,
        },
      },
      patch: {
        tags: ["Pages"],
        summary: "Update a page",
        operationId: "updatePage",
        requestBody: jsonBody(ref("PageUpdate")),
        responses: {
          200: jsonResponse("Updated page", ref("Page")),
          ...errors,
        },
      },
      delete: {
        tags: ["Pages"],
        summary: "Delete a page",
        description: "Moves the page to trash by default. Pass `?permanent=true` to purge it permanently along with its blocks, databases and records.",
        operationId: "deletePage",
        parameters: [permanentQuery],
        responses: {
          204: { description: "Page deleted" },
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/pages/{pageId}/restore": {
      parameters: [wsParam, pageParam],
      post: {
        tags: ["Pages"],
        summary: "Restore a trashed page",
        operationId: "restorePage",
        responses: {
          200: jsonResponse("Restore result", ref("RestoreResult")),
          ...errors,
        },
      },
    },

    // ── Blocks ──────────────────────────────────────────────────────────────
    "/workspaces/{workspaceId}/pages/{pageId}/blocks": {
      parameters: [wsParam, pageParam],
      get: {
        tags: ["Blocks"],
        summary: "List blocks in a page",
        operationId: "listBlocks",
        responses: {
          200: jsonResponse("Blocks ordered by index", { type: "array", items: ref("Block") }),
          ...errors,
        },
      },
      post: {
        tags: ["Blocks"],
        summary: "Create a block",
        operationId: "createBlock",
        requestBody: jsonBody(ref("BlockCreate")),
        responses: {
          201: jsonResponse("Created block", ref("Block")),
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/blocks/{blockId}": {
      parameters: [wsParam, blockParam],
      patch: {
        tags: ["Blocks"],
        summary: "Update a block's content",
        operationId: "updateBlock",
        requestBody: jsonBody(ref("BlockUpdate")),
        responses: {
          200: jsonResponse("Updated block", ref("Block")),
          ...errors,
        },
      },
      delete: {
        tags: ["Blocks"],
        summary: "Delete a block",
        operationId: "deleteBlock",
        responses: {
          204: { description: "Block deleted" },
          ...errors,
        },
      },
    },

    // ── Databases ───────────────────────────────────────────────────────────
    "/workspaces/{workspaceId}/databases": {
      parameters: [wsParam],
      get: {
        tags: ["Databases"],
        summary: "List all databases in the workspace",
        operationId: "listDatabases",
        responses: {
          200: jsonResponse("Databases", { type: "array", items: ref("Database") }),
          ...errors,
        },
      },
      post: {
        tags: ["Databases"],
        summary: "Create a database",
        operationId: "createDatabase",
        requestBody: jsonBody(ref("DatabaseCreate")),
        responses: {
          201: jsonResponse("Created database", ref("Database")),
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/databases/{dbId}": {
      parameters: [wsParam, dbParam],
      patch: {
        tags: ["Databases"],
        summary: "Update a database",
        operationId: "updateDatabase",
        requestBody: jsonBody(ref("DatabaseUpdate")),
        responses: {
          200: jsonResponse("Updated database", ref("Database")),
          ...errors,
        },
      },
      delete: {
        tags: ["Databases"],
        summary: "Delete a database",
        description: "Moves the database to trash by default. Pass `?permanent=true` to purge it with all its records, fields and views.",
        operationId: "deleteDatabase",
        parameters: [permanentQuery],
        responses: {
          204: { description: "Database deleted" },
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/databases/{dbId}/restore": {
      parameters: [wsParam, dbParam],
      post: {
        tags: ["Databases"],
        summary: "Restore a trashed database",
        operationId: "restoreDatabase",
        responses: {
          200: jsonResponse("Restore result", ref("RestoreResult")),
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/databases/{dbId}/fields": {
      parameters: [wsParam, dbParam],
      get: {
        tags: ["Databases"],
        summary: "List a database's fields (columns)",
        operationId: "listFields",
        responses: {
          200: jsonResponse("Fields", { type: "array", items: ref("DatabaseField") }),
          ...errors,
        },
      },
      post: {
        tags: ["Databases"],
        summary: "Create a field (column)",
        operationId: "createField",
        requestBody: jsonBody(ref("FieldCreate")),
        responses: {
          201: jsonResponse("Created field", ref("DatabaseField")),
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/databases/{dbId}/fields/{fieldId}": {
      parameters: [wsParam, dbParam, fieldParam],
      patch: {
        tags: ["Databases"],
        summary: "Update a field",
        operationId: "updateField",
        requestBody: jsonBody(ref("FieldUpdate")),
        responses: {
          200: jsonResponse("Updated field", ref("DatabaseField")),
          ...errors,
        },
      },
      delete: {
        tags: ["Databases"],
        summary: "Delete a field",
        operationId: "deleteField",
        responses: {
          204: { description: "Field deleted" },
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/databases/{dbId}/records": {
      parameters: [wsParam, dbParam],
      get: {
        tags: ["Databases"],
        summary: "List records in a database",
        operationId: "listDatabaseRecords",
        responses: {
          200: jsonResponse("Records with field values", { type: "array", items: ref("DatabaseRecord") }),
          ...errors,
        },
      },
      post: {
        tags: ["Databases"],
        summary: "Create a record (row)",
        operationId: "createRecord",
        requestBody: jsonBody(ref("RecordCreate")),
        responses: {
          201: jsonResponse("Created record", ref("DatabaseRecord")),
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/databases/{dbId}/records/{recordId}": {
      parameters: [wsParam, dbParam, recordParam],
      patch: {
        tags: ["Databases"],
        summary: "Update a record's title or description",
        operationId: "updateRecord",
        requestBody: jsonBody(ref("RecordUpdate")),
        responses: {
          200: jsonResponse("Updated record", ref("DatabaseRecord")),
          ...errors,
        },
      },
      delete: {
        tags: ["Databases"],
        summary: "Delete a record",
        description: "Moves the record to trash by default. Pass `?permanent=true` to purge it.",
        operationId: "deleteRecord",
        parameters: [permanentQuery],
        responses: {
          204: { description: "Record deleted" },
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/databases/{dbId}/records/{recordId}/restore": {
      parameters: [wsParam, dbParam, recordParam],
      post: {
        tags: ["Databases"],
        summary: "Restore a trashed record",
        operationId: "restoreRecord",
        responses: {
          200: jsonResponse("Restore result", ref("RestoreResult")),
          ...errors,
        },
      },
    },

    "/workspaces/{workspaceId}/databases/{dbId}/records/{recordId}/fields/{fieldId}": {
      parameters: [wsParam, dbParam, recordParam, fieldParam],
      put: {
        tags: ["Databases"],
        summary: "Set a single cell value",
        operationId: "setCell",
        requestBody: jsonBody(ref("CellUpdate")),
        responses: {
          200: jsonResponse("Updated value", { type: "object" }),
          ...errors,
        },
      },
    },

    // ── Search ──────────────────────────────────────────────────────────────
    "/workspaces/{workspaceId}/search": {
      parameters: [
        wsParam,
        {
          name: "q",
          in: "query" as const,
          required: true,
          schema: { type: "string" },
          description: "Search query",
          example: "meeting notes",
        },
      ],
      get: {
        tags: ["Search"],
        summary: "Full-text search",
        operationId: "search",
        responses: {
          200: jsonResponse("Search results", { type: "array", items: ref("SearchResult") }),
          ...errors,
        },
      },
    },

    // ── Trash ─────────────────────────────────────────────────────────────────
    "/workspaces/{workspaceId}/trash": {
      parameters: [wsParam],
      get: {
        tags: ["Trash"],
        summary: "List trashed items",
        description: "Returns explicitly-trashed pages, databases and records, newest first. Restore via the corresponding `…/restore` endpoint, or purge with `DELETE …?permanent=true`.",
        operationId: "listTrash",
        responses: {
          200: jsonResponse("Trash contents", ref("TrashContents")),
          ...errors,
        },
      },
    },
  },
};

// ── Scalar API Reference HTML ─────────────────────────────────────────────────

export const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Notara API Reference</title>
  <style>
    body { margin: 0; }
    :root {
      --scalar-color-1: #0f1220;
      --scalar-color-2: #3d4063;
      --scalar-color-3: #6b6f8f;
      --scalar-color-accent: #5B5EF4;
      --scalar-background-1: #ffffff;
      --scalar-background-2: #f5f6fa;
      --scalar-background-3: #eeeffe;
      --scalar-border-color: #e2e4ef;
      --scalar-sidebar-background-1: #f9f9fc;
    }
  </style>
</head>
<body>
  <script id="api-reference" data-url="/api/v1/openapi.json" data-configuration='${JSON.stringify({
    theme: "none",
    layout: "modern",
    defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
    authentication: { preferredSecurityScheme: "BearerAuth" },
    favicon: "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22 fill=%22none%22%3E%3Crect x=%224%22 y=%224%22 width=%2211%22 height=%2211%22 rx=%223%22 fill=%22%231A1A1A%22/%3E%3Crect x=%2217%22 y=%224%22 width=%2211%22 height=%2211%22 rx=%223%22 fill=%22%232B4DFF%22/%3E%3Crect x=%224%22 y=%2217%22 width=%2211%22 height=%2211%22 rx=%223%22 fill=%22%231A1A1A%22/%3E%3Crect x=%2217%22 y=%2217%22 width=%2211%22 height=%2211%22 rx=%223%22 fill=%22%231A1A1A%22/%3E%3C/svg%3E",
  })}'>
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
