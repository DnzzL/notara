// ── Inline OpenAPI 3.0.3 spec ─────────────────────────────────────────────────
// This is a plain TypeScript object — no code generation, full type clarity.
import { FIELD_TYPE_SPECS } from "@notara/shared";
import { operationsOpenApiPaths, restOperations } from "./operations.js";

const BLOCK_TYPES = [
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
	"database",
	"pageLink",
	"toggle",
	"callout",
] as const;

// Derived, not restated. This list was a third independent declaration of the
// field-type union and had already fallen behind — it was missing "people".
const FIELD_TYPES = FIELD_TYPE_SPECS.map((s) => s.type);

const schemas = {
	Error: {
		type: "object",
		required: ["error"],
		properties: { error: { type: "string", example: "Not found" } },
	},

	Page: {
		type: "object",
		required: [
			"id",
			"title",
			"sortOrder",
			"isDeleted",
			"isFavorite",
			"createdAt",
			"updatedAt",
		],
		properties: {
			id: { type: "string", example: "01JV2RXHK00000000000000000" },
			title: { type: "string", example: "Meeting notes" },
			parentId: { type: "string", nullable: true, example: null },
			icon: { type: "string", nullable: true, example: "📝" },
			coverUrl: { type: "string", nullable: true, example: null },
			sortOrder: { type: "number", example: 1 },
			isDeleted: { type: "boolean", example: false },
			isFavorite: { type: "boolean", example: false },
			createdAt: { type: "string", format: "date-time" },
			updatedAt: { type: "string", format: "date-time" },
			deletedAt: {
				type: "string",
				format: "date-time",
				nullable: true,
				description: "When the page was trashed, or null if not deleted.",
			},
		},
	},

	PageCreate: {
		type: "object",
		required: ["title"],
		properties: {
			title: { type: "string", example: "New page" },
			parentId: { type: "string", nullable: true, example: null },
		},
	},

	PageUpdate: {
		type: "object",
		properties: {
			title: { type: "string", example: "Updated title" },
			icon: { type: "string", nullable: true, example: "🚀" },
			coverUrl: { type: "string", nullable: true, example: null },
			isFavorite: { type: "boolean", example: true },
		},
	},

	Block: {
		type: "object",
		required: ["id", "pageId", "type", "content", "index"],
		properties: {
			id: { type: "string" },
			pageId: { type: "string" },
			type: { type: "string", enum: [...BLOCK_TYPES], example: "paragraph" },
			content: {
				type: "string",
				description:
					"Block payload, always a string. Text blocks hold HTML; image, pdf, file, pageLink, database and viewReference blocks hold a JSON string. See the Block content format section.",
				example: "<p>Hello world</p>",
			},
			parentId: { type: "string", nullable: true },
			index: { type: "integer", example: 0 },
		},
	},

	BlockCreate: {
		type: "object",
		required: ["pageId", "type", "content", "index"],
		properties: {
			pageId: { type: "string" },
			type: { type: "string", enum: [...BLOCK_TYPES], example: "paragraph" },
			content: {
				type: "string",
				description:
					"Block payload as a string — HTML for text blocks, a JSON string for structured ones. An object is rejected with 400.",
				example: "<p></p>",
			},
			index: { type: "integer", example: 0 },
			parentId: { type: "string", nullable: true, example: null },
		},
	},

	BlockUpdate: {
		type: "object",
		required: ["content"],
		properties: {
			content: {
				type: "string",
				description:
					"Replacement payload as a string, in the same format the block type stores.",
				example: "<p>Updated text</p>",
			},
		},
	},

	Database: {
		type: "object",
		required: ["id", "pageId", "name"],
		properties: {
			id: { type: "string" },
			pageId: { type: "string" },
			name: { type: "string", example: "Tasks" },
			isDeleted: { type: "boolean" },
			sortOrder: { type: "number" },
			titleLabel: { type: "string", example: "Name" },
			titleHidden: { type: "boolean" },
			deletedAt: { type: "string", format: "date-time", nullable: true },
		},
	},

	DatabaseCreate: {
		type: "object",
		required: ["pageId", "name"],
		properties: {
			pageId: {
				type: "string",
				description: "Page the database is hosted on",
				example: "01JV2RXHK00000000000000000",
			},
			name: { type: "string", example: "Tasks" },
		},
	},

	DatabaseUpdate: {
		type: "object",
		properties: {
			name: { type: "string", example: "Renamed DB" },
			titleLabel: {
				type: "string",
				example: "Name",
				description: "Label of the built-in title column",
			},
			titleHidden: { type: "boolean", description: "Hide the title column" },
		},
	},

	DatabaseField: {
		type: "object",
		required: ["id", "databaseId", "name", "type"],
		properties: {
			id: { type: "string" },
			databaseId: { type: "string" },
			name: { type: "string", example: "Status" },
			type: { type: "string", enum: [...FIELD_TYPES], example: "select" },
			options: {
				type: "array",
				items: { type: "string" },
				nullable: true,
				example: ["Todo", "Doing", "Done"],
			},
			relationTargetDbId: {
				type: "string",
				nullable: true,
				description: "Target database id for a relation field",
			},
			formula: {
				type: "string",
				nullable: true,
				description: "Expression for a formula field",
			},
			sortOrder: { type: "number" },
		},
	},

	FieldCreate: {
		type: "object",
		required: ["name", "type"],
		properties: {
			name: { type: "string", example: "Priority" },
			type: { type: "string", enum: [...FIELD_TYPES], example: "select" },
			options: {
				type: "array",
				items: { type: "string" },
				nullable: true,
				example: ["Low", "High"],
			},
			relationTargetDbId: { type: "string", nullable: true },
			formula: { type: "string", nullable: true },
		},
	},

	FieldUpdate: {
		type: "object",
		properties: {
			name: { type: "string" },
			type: { type: "string", enum: [...FIELD_TYPES] },
			options: { type: "array", items: { type: "string" }, nullable: true },
			relationTargetDbId: { type: "string", nullable: true },
			formula: { type: "string", nullable: true },
		},
	},

	DatabaseRecord: {
		type: "object",
		required: ["id", "databaseId", "title"],
		properties: {
			id: { type: "string" },
			databaseId: { type: "string" },
			title: { type: "string", example: "Fix the login bug" },
			description: { type: "string", nullable: true },
			pageId: {
				type: "string",
				nullable: true,
				description:
					"Backing page id once the record has been opened as a page; null otherwise.",
			},
			isDeleted: { type: "boolean" },
			createdAt: { type: "string", format: "date-time" },
			deletedAt: { type: "string", format: "date-time", nullable: true },
			fields: {
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
			title: { type: "string", example: "Updated title" },
			description: { type: "string", example: "More detail" },
		},
	},

	CellUpdate: {
		type: "object",
		required: ["value"],
		properties: {
			value: {
				type: "string",
				description:
					'Cell value as a string. Number: "42". Checkbox: "true"/"false". multiSelect: a JSON array string like \'["a","b"]\'.',
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
			id: { type: "string" },
			title: {
				type: "string",
				nullable: true,
				description: "Present for pages and records.",
			},
			name: {
				type: "string",
				nullable: true,
				description: "Present for databases.",
			},
			databaseId: {
				type: "string",
				nullable: true,
				description: "Present for records.",
			},
			deletedAt: { type: "string", format: "date-time", nullable: true },
		},
	},

	TrashContents: {
		type: "object",
		required: ["pages", "databases", "records"],
		properties: {
			pages: {
				type: "array",
				items: { $ref: "#/components/schemas/TrashItem" },
			},
			databases: {
				type: "array",
				items: { $ref: "#/components/schemas/TrashItem" },
			},
			records: {
				type: "array",
				items: { $ref: "#/components/schemas/TrashItem" },
			},
		},
	},

	SearchResult: {
		type: "object",
		required: ["type", "id", "title"],
		properties: {
			type: { type: "string", enum: ["page", "block"], example: "page" },
			id: { type: "string" },
			title: { type: "string" },
			content: { type: "string" },
			pageId: { type: "string" },
		},
	},

	Workspace: {
		type: "object",
		required: ["id", "name", "slug", "role"],
		properties: {
			id: { type: "string" },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const ref = (name: keyof typeof schemas) => ({
	$ref: `#/components/schemas/${name}`,
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
   Generate keys in your workspace settings → API keys. A key carries a scope:
   a **read** key may only issue GET requests and gets \`403\` on anything that
   changes state; a **write** key can do anything you can. The scope is fixed
   when the key is created.

2. **Session cookie**: if you're calling from a browser that is already signed in, the session cookie is sent automatically.

## Base URL

All paths below are relative to \`/api/v1\`. For example, \`GET /workspaces\` → \`GET /api/v1/workspaces\`.

## Block content format

A block's \`content\` is always a **string**, sent and returned exactly as stored.
How to read it depends on the block type.

Text-bearing blocks hold **HTML**, because the editor produces and consumes HTML:

| Type | Example |
|------|---------|
| paragraph | \`"<p>Hello</p>"\` |
| heading1/2/3 | \`"<h1>Title</h1>"\` |
| bulletList / numberedList | \`"<ul><li>Item</li></ul>"\` |
| todo | \`"<ul data-type=\\"taskList\\"><li data-checked=\\"false\\">Task</li></ul>"\` |
| blockquote | \`"<blockquote>Quoted</blockquote>"\` |
| code | \`"<pre><code>const x = 1</code></pre>"\` |
| toggle / callout | HTML, with block-specific attributes |
| divider | \`""\` |

Structured blocks hold a **JSON string**:

| Type | Example |
|------|---------|
| image / pdf / file | \`"{\\"src\\":\\"/attachments/01H….png\\",\\"fileName\\":\\"diagram.png\\"}"\` |
| pageLink | \`"{\\"pageId\\":\\"01H…\\"}"\` |
| database | \`"{\\"databaseId\\":\\"01H…\\"}"\` |
| viewReference | \`"{\\"databaseId\\":\\"01H…\\",\\"viewId\\":\\"01H…\\"}"\` |

Sending a JSON **object** rather than a string is rejected with 400. Earlier
versions of this document described \`{ "text": "…" }\` objects for text blocks;
that was never what the server stored, and content written that way rendered
blank. If you have blocks created that way, rewrite them as HTML.
`.trim(),
		contact: { name: "Notara", url: "https://github.com/notara" },
		license: { name: "MIT" },
	},
	servers: [{ url: "/api/v1", description: "Current instance" }],
	security: [{ BearerAuth: [] }],
	tags: [
		{
			name: "Workspaces",
			description: "List workspaces the authenticated user belongs to",
		},
		{ name: "Pages", description: "Create, read, update and delete pages" },
		{
			name: "Blocks",
			description: "Read and write the content blocks inside a page",
		},
		{
			name: "Databases",
			description:
				"Create and edit inline databases, their fields, and records",
		},
		{ name: "Search", description: "Full-text search across pages and blocks" },
		{ name: "Trash", description: "Soft-deleted items; restore or purge them" },
	],
	components: {
		securitySchemes: {
			BearerAuth: {
				type: "http",
				scheme: "bearer",
				description:
					"API key with `ntr_` prefix. Generate one in workspace settings. A read-scoped key is refused with `403` on any request that changes state.",
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
					200: jsonResponse("List of workspaces", {
						type: "array",
						items: ref("Workspace"),
					}),
					...errors,
				},
			},
		},

		// ── Pages, Blocks, Databases, Search, Trash ──────────────────────────────
		// Derived from the operation table in api-v1/operations.ts — the REST
		// router is registered from the same list, so route and document cannot
		// drift apart for these operations. See NOT-122 / TASK-23.
		...operationsOpenApiPaths(restOperations, wsParam),
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
  <script id="api-reference" data-url="/api/v1/openapi.json" data-configuration='${JSON.stringify(
		{
			theme: "none",
			layout: "modern",
			defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
			authentication: { preferredSecurityScheme: "BearerAuth" },
			favicon:
				"data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22 fill=%22none%22%3E%3Crect x=%224%22 y=%224%22 width=%2211%22 height=%2211%22 rx=%223%22 fill=%22%231A1A1A%22/%3E%3Crect x=%2217%22 y=%224%22 width=%2211%22 height=%2211%22 rx=%223%22 fill=%22%232B4DFF%22/%3E%3Crect x=%224%22 y=%2217%22 width=%2211%22 height=%2211%22 rx=%223%22 fill=%22%231A1A1A%22/%3E%3Crect x=%2217%22 y=%2217%22 width=%2211%22 height=%2211%22 rx=%223%22 fill=%22%231A1A1A%22/%3E%3C/svg%3E",
		},
	)}'>
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
