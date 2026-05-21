// ── Inline OpenAPI 3.0.3 spec ─────────────────────────────────────────────────
// This is a plain TypeScript object — no code generation, full type clarity.

const BLOCK_TYPES = [
  "paragraph", "heading1", "heading2", "heading3",
  "bulletList", "numberedList", "todo",
  "code", "blockquote", "divider",
  "image", "pdf", "database", "pageLink", "toggle", "callout",
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
      isDeleted:   { type: "boolean" },
      createdAt:   { type: "string", format: "date-time" },
      fields:      {
        type: "object",
        description: "Map of field names to their values for this record",
        additionalProperties: { type: "string" },
        example: { Status: "In progress", Priority: "High" },
      },
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
    { name: "Databases",  description: "Inspect inline databases and their records" },
    { name: "Search",     description: "Full-text search across pages and blocks" },
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
        summary: "Delete a page (soft delete)",
        operationId: "deletePage",
        responses: {
          204: { description: "Page deleted" },
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
    favicon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%235B5EF4%22/><rect x=%228%22 y=%2210%22 width=%2216%22 height=%222.5%22 rx=%221.25%22 fill=%22white%22/><rect x=%228%22 y=%2215%22 width=%2212%22 height=%222%22 rx=%221%22 fill=%22white%22 opacity=%220.7%22/><rect x=%228%22 y=%2219.5%22 width=%2214%22 height=%222%22 rx=%221%22 fill=%22white%22 opacity=%220.5%22/></svg>",
  })}'>
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
