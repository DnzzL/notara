import { Effect } from "effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import type * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { WorkspaceDb } from "../db.js";
import * as Blocks from "../handlers/blocks.js";
import * as Databases from "../handlers/databases.js";
import * as Pages from "../handlers/pages.js";
import * as Permissions from "../handlers/permissions.js";
import * as Search from "../handlers/search.js";
import { ApiError, requireWorkspaceMember, resolveApiUser } from "./auth.js";
import {
	created,
	handle,
	noContent,
	ok,
	optionalField,
	parseBody,
	queryParam,
	requireField,
	requireParam,
} from "./response.js";

/**
 * One entry declares a REST operation's shape once: the route it answers and
 * how it runs. `registerOperations` derives the router registration from it;
 * `operationsOpenApiPaths` derives the OpenAPI document from the same list —
 * so route and document cannot drift for any operation declared here.
 *
 * Covers every REST resource (pages, blocks, databases, fields, records,
 * search, trash). `GET /api/v1/workspaces` stays hand-registered in
 * routes.ts: it has no workspace-scoped layer or permission check to merge,
 * so the table buys it nothing. RPC (rpc-handlers.ts) is a separate surface,
 * not covered here.
 */

/** Path parameters resolved by the router for the matched route. */
type RouteParams = Readonly<Record<string, string | undefined>>;

/** Everything an operation's `run` needs once auth and layer are settled. */
export interface OperationContext {
	readonly userId: string;
	readonly workspaceId: string;
	readonly role: "owner" | "member";
	readonly params: RouteParams;
}

export interface Operation {
	readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
	/** Router-spelled path, e.g. "/api/v1/workspaces/:workspaceId/pages/:pageId". */
	readonly path: `/${string}`;
	readonly operationId: string;
	readonly tag: string;
	/**
	 * Runs before `run`, under the same already-acquired workspace layer, and
	 * blocks the mutation on failure — the fix for AC4: the permission check
	 * and the mutation it guards share one workspace-layer acquisition instead
	 * of two. Omit for workspace-membership-only operations (list operations
	 * that filter by `ctx.role` instead of a single ACL check), or when the
	 * check's resource id comes from the body rather than a path param
	 * (createDatabase): there, `run` does its own check as its first step —
	 * still under the one layer, since the layer wraps `run` either way.
	 */
	readonly checkPermission?: (
		ctx: Pick<OperationContext, "userId" | "workspaceId" | "params">,
	) => Effect.Effect<void, unknown, any>;
	/**
	 * `R` is `any` because each handler needs a different slice of the
	 * per-workspace context; it's always satisfied by the time this runs.
	 */
	readonly run: (
		ctx: OperationContext,
	) => Effect.Effect<HttpServerResponse.HttpServerResponse, unknown, any>;
	/** Path params beyond `workspaceId`, for the OpenAPI `parameters` array. */
	readonly pathParams: readonly object[];
	readonly openapi: {
		readonly summary: string;
		readonly description?: string;
		readonly requestBody?: object;
		readonly parameters?: readonly object[];
		readonly responses: Readonly<Record<number, object>>;
	};
}

const errorRef = { $ref: "#/components/schemas/Error" };
const errorResponses = {
	401: {
		description: "Unauthorized",
		content: { "application/json": { schema: errorRef } },
	},
	403: {
		description: "Forbidden",
		content: { "application/json": { schema: errorRef } },
	},
	404: {
		description: "Not found",
		content: { "application/json": { schema: errorRef } },
	},
	422: {
		description: "Validation error",
		content: { "application/json": { schema: errorRef } },
	},
	500: {
		description: "Server error",
		content: { "application/json": { schema: errorRef } },
	},
};

const jsonSchema = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const jsonBody = (name: string) => ({
	required: true,
	content: { "application/json": { schema: jsonSchema(name) } },
});
const jsonResponse = (description: string, schema: object) => ({
	description,
	content: { "application/json": { schema } },
});

// ── Path params (canonical; also imported by openapi.ts) ─────────────────────

export const pageParam = {
	name: "pageId",
	in: "path" as const,
	required: true,
	schema: { type: "string" },
	description: "Page ID",
};

export const blockParam = {
	name: "blockId",
	in: "path" as const,
	required: true,
	schema: { type: "string" },
	description: "Block ID",
};

export const dbParam = {
	name: "dbId",
	in: "path" as const,
	required: true,
	schema: { type: "string" },
	description: "Database ID",
};

export const fieldParam = {
	name: "fieldId",
	in: "path" as const,
	required: true,
	schema: { type: "string" },
	description: "Field ID",
};

export const recordParam = {
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
	description:
		"When `true`, permanently purge instead of moving to trash. Irreversible.",
};

/** The 404 mapping the old hand-written routes gave getPage/updatePage. */
const notFound = (resource: string, id: string) =>
	new ApiError({ status: 404, message: `${resource} ${id} not found` });

// ── Pages ──────────────────────────────────────────────────────────────────────

export const pageOperations: readonly Operation[] = [
	{
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages",
		operationId: "listPages",
		tag: "Pages",
		pathParams: [],
		run: (ctx) =>
			Effect.gen(function* () {
				const all = yield* Pages.listPages;
				const pages = yield* Permissions.filterPagesByPermission(
					ctx.userId,
					ctx.workspaceId,
					ctx.role,
					all,
				);
				return ok(pages);
			}),
		openapi: {
			summary: "List all pages",
			responses: {
				200: jsonResponse("All non-deleted pages", {
					type: "array",
					items: jsonSchema("Page"),
				}),
				...errorResponses,
			},
		},
	},
	{
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/pages",
		operationId: "createPage",
		tag: "Pages",
		pathParams: [],
		run: () =>
			Effect.gen(function* () {
				const body = yield* parseBody;
				const title = yield* requireField(body, "title");
				const parentId = optionalField(body, "parentId");
				const page = yield* Pages.createPage({ title, parentId });
				return created(page);
			}),
		openapi: {
			summary: "Create a page",
			requestBody: jsonBody("PageCreate"),
			responses: {
				201: jsonResponse("Created page", jsonSchema("Page")),
				...errorResponses,
			},
		},
	},
	{
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId",
		operationId: "getPage",
		tag: "Pages",
		pathParams: [pageParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				yield* Permissions.checkPagePermission(
					ctx.userId,
					ctx.workspaceId,
					pageId,
					"viewer",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				const page = yield* Pages.getPage(pageId).pipe(
					Effect.mapError(() => notFound("Page", pageId)),
				);
				return ok(page);
			}),
		openapi: {
			summary: "Get a page",
			responses: {
				200: jsonResponse("Page", jsonSchema("Page")),
				...errorResponses,
			},
		},
	},
	{
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId",
		operationId: "updatePage",
		tag: "Pages",
		pathParams: [pageParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				yield* Permissions.checkPagePermission(
					ctx.userId,
					ctx.workspaceId,
					pageId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const page = yield* Pages.updatePage({
					id: pageId,
					title: typeof b.title === "string" ? b.title : undefined,
					icon: "icon" in b ? (b.icon as string | null) : undefined,
					coverUrl: "coverUrl" in b ? (b.coverUrl as string | null) : undefined,
					isFavorite: "isFavorite" in b ? Boolean(b.isFavorite) : undefined,
				}).pipe(Effect.mapError(() => notFound("Page", pageId)));
				return ok(page);
			}),
		openapi: {
			summary: "Update a page",
			requestBody: jsonBody("PageUpdate"),
			responses: {
				200: jsonResponse("Updated page", jsonSchema("Page")),
				...errorResponses,
			},
		},
	},
	{
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId",
		operationId: "deletePage",
		tag: "Pages",
		pathParams: [pageParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				yield* Permissions.checkPagePermission(
					ctx.userId,
					ctx.workspaceId,
					pageId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				const permanent = (yield* queryParam("permanent")) === "true";
				if (permanent) yield* Databases.purgePage(pageId);
				else yield* Pages.deletePage(pageId);
				return noContent();
			}),
		openapi: {
			summary: "Delete a page",
			description:
				"Moves the page to trash by default. Pass `?permanent=true` to purge it permanently along with its blocks, databases and records.",
			parameters: [permanentQuery],
			responses: { 204: { description: "Page deleted" }, ...errorResponses },
		},
	},
	{
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/restore",
		operationId: "restorePage",
		tag: "Pages",
		pathParams: [pageParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				yield* Permissions.checkPagePermission(
					ctx.userId,
					ctx.workspaceId,
					pageId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				const result = yield* Pages.restorePage(pageId);
				return ok(result);
			}),
		openapi: {
			summary: "Restore a trashed page",
			responses: {
				200: jsonResponse("Restore result", jsonSchema("RestoreResult")),
				...errorResponses,
			},
		},
	},
];

// ── Blocks ─────────────────────────────────────────────────────────────────────

/**
 * Block content crosses this boundary exactly as it is stored: a string whose
 * reading depends on the block type. The contract, and why this adapter no
 * longer parses or coerces it, lives in handlers/blocks.ts.
 */
const requireBlockContent = (raw: unknown) =>
	Blocks.isValidContent(raw)
		? Effect.succeed(raw)
		: Effect.fail(
				new ApiError({ status: 400, message: Blocks.CONTENT_CONTRACT }),
			);

export const blockOperations: readonly Operation[] = [
	{
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/blocks",
		operationId: "listBlocks",
		tag: "Blocks",
		pathParams: [pageParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				yield* Permissions.checkPagePermission(
					ctx.userId,
					ctx.workspaceId,
					pageId,
					"viewer",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				const blocks = yield* Blocks.listBlocks(pageId);
				return ok(blocks);
			}),
		openapi: {
			summary: "List blocks in a page",
			responses: {
				200: jsonResponse("Blocks ordered by index", {
					type: "array",
					items: jsonSchema("Block"),
				}),
				...errorResponses,
			},
		},
	},
	{
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/blocks",
		operationId: "createBlock",
		tag: "Blocks",
		pathParams: [pageParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				yield* Permissions.checkPagePermission(
					ctx.userId,
					ctx.workspaceId,
					pageId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const type = yield* requireField(body, "type");
				const content = yield* requireBlockContent(b.content);
				const index = typeof b.index === "number" ? b.index : 0;
				const parentId = optionalField(body, "parentId");
				const block = yield* Blocks.createBlock({
					pageId,
					type,
					content,
					index,
					parentId,
				});
				return created(block);
			}),
		openapi: {
			summary: "Create a block",
			requestBody: jsonBody("BlockCreate"),
			responses: {
				201: jsonResponse("Created block", jsonSchema("Block")),
				...errorResponses,
			},
		},
	},
	{
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/blocks/:blockId",
		operationId: "updateBlock",
		tag: "Blocks",
		pathParams: [blockParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const blockId = yield* requireParam(ctx.params, "blockId");
				yield* Permissions.checkBlockPermission(
					ctx.userId,
					ctx.workspaceId,
					blockId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const blockId = yield* requireParam(ctx.params, "blockId");
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				if (!("content" in b)) {
					return yield* Effect.fail(
						new ApiError({
							status: 422,
							message: 'Field "content" is required',
						}),
					);
				}
				const block = yield* Blocks.updateBlock({
					id: blockId,
					content: yield* requireBlockContent(b.content),
				}).pipe(Effect.mapError(() => notFound("Block", blockId)));
				return ok(block);
			}),
		openapi: {
			summary: "Update a block's content",
			requestBody: jsonBody("BlockUpdate"),
			responses: {
				200: jsonResponse("Updated block", jsonSchema("Block")),
				...errorResponses,
			},
		},
	},
	{
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/blocks/:blockId",
		operationId: "deleteBlock",
		tag: "Blocks",
		pathParams: [blockParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const blockId = yield* requireParam(ctx.params, "blockId");
				yield* Permissions.checkBlockPermission(
					ctx.userId,
					ctx.workspaceId,
					blockId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const blockId = yield* requireParam(ctx.params, "blockId");
				yield* Blocks.deleteBlock(blockId);
				return noContent();
			}),
		openapi: {
			summary: "Delete a block",
			responses: { 204: { description: "Block deleted" }, ...errorResponses },
		},
	},
];

// ── Databases ──────────────────────────────────────────────────────────────────

export const databaseOperations: readonly Operation[] = [
	{
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/databases",
		operationId: "listDatabases",
		tag: "Databases",
		pathParams: [],
		run: (ctx) =>
			Effect.gen(function* () {
				const all = yield* Databases.listAllDatabases;
				const allPages = yield* Pages.listPages;
				const visible = yield* Permissions.filterPagesByPermission(
					ctx.userId,
					ctx.workspaceId,
					ctx.role,
					allPages,
				);
				const visibleIds = new Set(visible.map((p) => p.id));
				const dbs = all.filter((db) => visibleIds.has(db.pageId));
				return ok(dbs);
			}),
		openapi: {
			summary: "List all databases in the workspace",
			responses: {
				200: jsonResponse("Databases", {
					type: "array",
					items: jsonSchema("Database"),
				}),
				...errorResponses,
			},
		},
	},
	{
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases",
		operationId: "createDatabase",
		tag: "Databases",
		pathParams: [],
		// No `pageId` path param to key a declarative checkPermission off — the
		// target page comes from the body instead, so the check runs as the
		// first step of `run`, still inside the one workspace-layer acquisition.
		run: (ctx) =>
			Effect.gen(function* () {
				const body = yield* parseBody;
				const pageId = yield* requireField(body, "pageId");
				const name = yield* requireField(body, "name");
				yield* Permissions.checkPagePermission(
					ctx.userId,
					ctx.workspaceId,
					pageId,
					"editor",
				);
				const db = yield* Databases.createDatabase({ pageId, name });
				return created(db);
			}),
		openapi: {
			summary: "Create a database",
			requestBody: jsonBody("DatabaseCreate"),
			responses: {
				201: jsonResponse("Created database", jsonSchema("Database")),
				...errorResponses,
			},
		},
	},
	{
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId",
		operationId: "updateDatabase",
		tag: "Databases",
		pathParams: [dbParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const db = yield* Effect.gen(function* () {
					if (typeof b.name === "string")
						yield* Databases.renameDatabase({ id: dbId, name: b.name });
					return yield* Databases.updateDatabase({
						id: dbId,
						titleLabel:
							typeof b.titleLabel === "string" ? b.titleLabel : undefined,
						titleHidden:
							"titleHidden" in b ? Boolean(b.titleHidden) : undefined,
					});
				}).pipe(Effect.mapError(() => notFound("Database", dbId)));
				return ok(db);
			}),
		openapi: {
			summary: "Update a database",
			requestBody: jsonBody("DatabaseUpdate"),
			responses: {
				200: jsonResponse("Updated database", jsonSchema("Database")),
				...errorResponses,
			},
		},
	},
	{
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId",
		operationId: "deleteDatabase",
		tag: "Databases",
		pathParams: [dbParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				const permanent = (yield* queryParam("permanent")) === "true";
				if (permanent) yield* Databases.purgeDatabase(dbId);
				else yield* Databases.deleteDatabase(dbId);
				return noContent();
			}),
		openapi: {
			summary: "Delete a database",
			description:
				"Moves the database to trash by default. Pass `?permanent=true` to purge it with all its records, fields and views.",
			parameters: [permanentQuery],
			responses: {
				204: { description: "Database deleted" },
				...errorResponses,
			},
		},
	},
	{
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/restore",
		operationId: "restoreDatabase",
		tag: "Databases",
		pathParams: [dbParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				const result = yield* Databases.restoreDatabase(dbId);
				return ok(result);
			}),
		openapi: {
			summary: "Restore a trashed database",
			responses: {
				200: jsonResponse("Restore result", jsonSchema("RestoreResult")),
				...errorResponses,
			},
		},
	},
];

// ── Fields ─────────────────────────────────────────────────────────────────────

export const fieldOperations: readonly Operation[] = [
	{
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/fields",
		operationId: "listFields",
		tag: "Databases",
		pathParams: [dbParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"viewer",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				const fields = yield* Databases.listFields(dbId);
				return ok(fields);
			}),
		openapi: {
			summary: "List a database's fields (columns)",
			responses: {
				200: jsonResponse("Fields", {
					type: "array",
					items: jsonSchema("DatabaseField"),
				}),
				...errorResponses,
			},
		},
	},
	{
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/fields",
		operationId: "createField",
		tag: "Databases",
		pathParams: [dbParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const name = yield* requireField(body, "name");
				const type = yield* requireField(body, "type");
				const field = yield* Databases.createField({
					databaseId: dbId,
					name,
					type,
					options: Array.isArray(b.options) ? (b.options as string[]) : null,
					relationTargetDbId: optionalField(body, "relationTargetDbId"),
					formula: optionalField(body, "formula"),
				});
				return created(field);
			}),
		openapi: {
			summary: "Create a field (column)",
			requestBody: jsonBody("FieldCreate"),
			responses: {
				201: jsonResponse("Created field", jsonSchema("DatabaseField")),
				...errorResponses,
			},
		},
	},
	{
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/fields/:fieldId",
		operationId: "updateField",
		tag: "Databases",
		pathParams: [dbParam, fieldParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const fieldId = yield* requireParam(ctx.params, "fieldId");
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const field = yield* Databases.updateField({
					id: fieldId,
					name: typeof b.name === "string" ? b.name : undefined,
					type: typeof b.type === "string" ? b.type : undefined,
					options:
						"options" in b
							? Array.isArray(b.options)
								? (b.options as string[])
								: null
							: undefined,
					relationTargetDbId:
						"relationTargetDbId" in b
							? (b.relationTargetDbId as string | null)
							: undefined,
					formula: "formula" in b ? (b.formula as string | null) : undefined,
				}).pipe(Effect.mapError(() => notFound("Field", fieldId)));
				return ok(field);
			}),
		openapi: {
			summary: "Update a field",
			requestBody: jsonBody("FieldUpdate"),
			responses: {
				200: jsonResponse("Updated field", jsonSchema("DatabaseField")),
				...errorResponses,
			},
		},
	},
	{
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/fields/:fieldId",
		operationId: "deleteField",
		tag: "Databases",
		pathParams: [dbParam, fieldParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const fieldId = yield* requireParam(ctx.params, "fieldId");
				yield* Databases.deleteField(fieldId);
				return noContent();
			}),
		openapi: {
			summary: "Delete a field",
			responses: { 204: { description: "Field deleted" }, ...errorResponses },
		},
	},
];

// ── Records ────────────────────────────────────────────────────────────────────

export const recordOperations: readonly Operation[] = [
	{
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records",
		operationId: "listDatabaseRecords",
		tag: "Databases",
		pathParams: [dbParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"viewer",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				// `listRecordsWithValues` yields `{ record, values }`, where `values`
				// is already a field-name → parsed-value map. Flatten it for REST
				// consumers.
				const raw = yield* Databases.listRecordsWithValues(dbId);
				const records = (
					raw as Array<{ record: any; values: Record<string, unknown> }>
				).map(({ record, values }) => ({
					id: record.id,
					databaseId: record.databaseId,
					title: record.title,
					description: record.description ?? null,
					isDeleted: record.isDeleted,
					createdAt: record.createdAt,
					fields: values ?? {},
				}));
				return ok(records);
			}),
		openapi: {
			summary: "List records in a database",
			responses: {
				200: jsonResponse("Records with field values", {
					type: "array",
					items: jsonSchema("DatabaseRecord"),
				}),
				...errorResponses,
			},
		},
	},
	{
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records",
		operationId: "createRecord",
		tag: "Databases",
		pathParams: [dbParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				const body = yield* parseBody;
				const title = yield* requireField(body, "title");
				const record = yield* Databases.createRecord({
					databaseId: dbId,
					title,
				});
				return created(record);
			}),
		openapi: {
			summary: "Create a record (row)",
			requestBody: jsonBody("RecordCreate"),
			responses: {
				201: jsonResponse("Created record", jsonSchema("DatabaseRecord")),
				...errorResponses,
			},
		},
	},
	{
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId",
		operationId: "updateRecord",
		tag: "Databases",
		pathParams: [dbParam, recordParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const recordId = yield* requireParam(ctx.params, "recordId");
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const result = yield* Databases.updateRecord({
					id: recordId,
					title: typeof b.title === "string" ? b.title : undefined,
					description:
						typeof b.description === "string" ? b.description : undefined,
				});
				return ok(result);
			}),
		openapi: {
			summary: "Update a record's title or description",
			requestBody: jsonBody("RecordUpdate"),
			responses: {
				200: jsonResponse("Updated record", jsonSchema("DatabaseRecord")),
				...errorResponses,
			},
		},
	},
	{
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId",
		operationId: "deleteRecord",
		tag: "Databases",
		pathParams: [dbParam, recordParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const recordId = yield* requireParam(ctx.params, "recordId");
				const permanent = (yield* queryParam("permanent")) === "true";
				yield* permanent
					? Databases.purgeRecord(recordId)
					: Databases.deleteRecord(recordId);
				return noContent();
			}),
		openapi: {
			summary: "Delete a record",
			description:
				"Moves the record to trash by default. Pass `?permanent=true` to purge it.",
			parameters: [permanentQuery],
			responses: { 204: { description: "Record deleted" }, ...errorResponses },
		},
	},
	{
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId/restore",
		operationId: "restoreRecord",
		tag: "Databases",
		pathParams: [dbParam, recordParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const recordId = yield* requireParam(ctx.params, "recordId");
				const result = yield* Databases.restoreRecord(recordId);
				return ok(result);
			}),
		openapi: {
			summary: "Restore a trashed record",
			responses: {
				200: jsonResponse("Restore result", jsonSchema("RestoreResult")),
				...errorResponses,
			},
		},
	},
	{
		method: "PUT",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId/fields/:fieldId",
		operationId: "setCell",
		tag: "Databases",
		pathParams: [dbParam, recordParam, fieldParam],
		checkPermission: (ctx) =>
			Effect.gen(function* () {
				const dbId = yield* requireParam(ctx.params, "dbId");
				yield* Permissions.checkDatabasePermission(
					ctx.userId,
					ctx.workspaceId,
					dbId,
					"editor",
				);
			}),
		run: (ctx) =>
			Effect.gen(function* () {
				const recordId = yield* requireParam(ctx.params, "recordId");
				const fieldId = yield* requireParam(ctx.params, "fieldId");
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				if (!("value" in b)) {
					return yield* Effect.fail(
						new ApiError({ status: 422, message: 'Field "value" is required' }),
					);
				}
				const value =
					typeof b.value === "string" ? b.value : JSON.stringify(b.value);
				const result = yield* Databases.updateFieldValue({
					recordId,
					fieldId,
					value,
				});
				return ok(result);
			}),
		openapi: {
			summary: "Set a single cell value",
			requestBody: jsonBody("CellUpdate"),
			responses: {
				200: jsonResponse("Updated value", { type: "object" }),
				...errorResponses,
			},
		},
	},
];

// ── Search + Trash ─────────────────────────────────────────────────────────────

export const searchOperations: readonly Operation[] = [
	{
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/search",
		operationId: "search",
		tag: "Search",
		pathParams: [],
		run: (ctx) =>
			Effect.gen(function* () {
				const q = yield* queryParam("q");
				if (!q?.trim()) {
					return yield* Effect.fail(
						new ApiError({
							status: 422,
							message: 'Query parameter "q" is required',
						}),
					);
				}
				const hits = yield* Search.globalSearch(q);
				const allPages = yield* Pages.listPages;
				const visible = yield* Permissions.filterPagesByPermission(
					ctx.userId,
					ctx.workspaceId,
					ctx.role,
					allPages,
				);
				const visibleIds = new Set(visible.map((p) => p.id));
				const results = hits.filter((r) =>
					visibleIds.has(r.type === "page" ? r.id : r.pageId),
				);
				return ok(results);
			}),
		openapi: {
			summary: "Full-text search",
			parameters: [
				{
					name: "q",
					in: "query" as const,
					required: true,
					schema: { type: "string" },
					description: "Search query",
					example: "meeting notes",
				},
			],
			responses: {
				200: jsonResponse("Search results", {
					type: "array",
					items: jsonSchema("SearchResult"),
				}),
				...errorResponses,
			},
		},
	},
];

export const trashOperations: readonly Operation[] = [
	{
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/trash",
		operationId: "listTrash",
		tag: "Trash",
		pathParams: [],
		run: () =>
			Effect.gen(function* () {
				const trash = yield* Databases.listTrash;
				return ok(trash);
			}),
		openapi: {
			summary: "List trashed items",
			description:
				"Returns explicitly-trashed pages, databases and records, newest first. Restore via the corresponding `…/restore` endpoint, or purge with `DELETE …?permanent=true`.",
			responses: {
				200: jsonResponse("Trash contents", jsonSchema("TrashContents")),
				...errorResponses,
			},
		},
	},
];

/** Every REST operation the table covers, in registration/OpenAPI order. */
export const restOperations: readonly Operation[] = [
	...pageOperations,
	...blockOperations,
	...databaseOperations,
	...fieldOperations,
	...recordOperations,
	...searchOperations,
	...trashOperations,
];

/**
 * Registers every declared operation against `router`. Auth, membership, the
 * resource-level permission check and the operation's own work all run inside
 * a single `WorkspaceDb` layer acquisition.
 */
export const registerOperations = (
	router: typeof HttpRouter.HttpRouter.Service,
	operations: readonly Operation[],
) =>
	Effect.forEach(operations, (op) =>
		router.add(
			op.method,
			op.path,
			handle(
				Effect.gen(function* () {
					const { userId } = yield* resolveApiUser;
					const params = yield* HttpRouter.params;
					const workspaceId = yield* requireParam(params, "workspaceId");
					const role = yield* requireWorkspaceMember(workspaceId, userId);
					const wdb = yield* WorkspaceDb;
					return yield* Effect.provide(
						Effect.gen(function* () {
							if (op.checkPermission)
								yield* op.checkPermission({ userId, workspaceId, params });
							return yield* op.run({ userId, workspaceId, role, params });
						}),
						wdb.getLayer(workspaceId),
					);
				}),
			),
		),
	);

/**
 * The OpenAPI `paths` fragment for every operation in `operations`, grouped by
 * path — the same list the router registers, so route and document cannot
 * drift apart.
 */
export const operationsOpenApiPaths = (
	operations: readonly Operation[],
	wsParam: object,
) => {
	const toDocPath = (routerPath: string) =>
		routerPath.replace("/api/v1", "").replace(/:([a-zA-Z]+)/g, "{$1}");

	const paths: Record<string, Record<string, unknown>> = {};
	for (const op of operations) {
		const docPath = toDocPath(op.path);
		paths[docPath] ??= { parameters: [wsParam, ...op.pathParams] };
		paths[docPath][op.method.toLowerCase()] = {
			tags: [op.tag],
			operationId: op.operationId,
			summary: op.openapi.summary,
			...(op.openapi.description
				? { description: op.openapi.description }
				: {}),
			...(op.openapi.requestBody
				? { requestBody: op.openapi.requestBody }
				: {}),
			...(op.openapi.parameters ? { parameters: op.openapi.parameters } : {}),
			responses: op.openapi.responses,
		};
	}
	return paths;
};
