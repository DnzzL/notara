import { Effect } from "effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import type * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { WorkspaceDb } from "../db.js";
import * as Databases from "../handlers/databases.js";
import * as Pages from "../handlers/pages.js";
import * as Permissions from "../handlers/permissions.js";
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
 * One entry declares an operation's resource shape once: the REST route it
 * answers, the relation it requires, and how it runs. `registerPageOperations`
 * derives the router registration from it; `pagesOpenApiPaths` derives the
 * OpenAPI document from the same list — so route and document cannot drift
 * for the operations declared here.
 *
 * Scope: the "pages" resource only, as the first slice of NOT-122's operation
 * table. Every other REST resource (blocks, databases, fields, records,
 * workspaces, search, ACL) still goes through the route-by-route registration
 * in routes.ts, and RPC still goes through rpc-handlers.ts — both are
 * candidates for the same table in a follow-up, not touched here.
 */

/** Path parameters resolved by the router for the matched route. */
type RouteParams = Readonly<Record<string, string | undefined>>;

/** Everything a page operation's `run` needs once auth and layer are settled. */
export interface PageOperationContext {
	readonly userId: string;
	readonly workspaceId: string;
	readonly role: "owner" | "member";
	readonly params: RouteParams;
}

/**
 * The relation required to run the operation:
 *  - "member": workspace membership is enough (list, create).
 *  - "viewer" | "editor": also requires that ACL relation on the page named
 *    by the `:pageId` route parameter.
 */
export type PageRelation = "member" | "viewer" | "editor";

export interface PageOperation {
	readonly method: "GET" | "POST" | "PATCH" | "DELETE";
	/** Router-spelled path, e.g. "/api/v1/workspaces/:workspaceId/pages/:pageId". */
	readonly path: `/${string}`;
	readonly operationId: string;
	readonly relation: PageRelation;
	/**
	 * Runs with the per-workspace SQLite layer already provided by
	 * `registerPageOperations` — same context every handler in handlers/*.ts
	 * already assumes. `R` is `any` because each handler needs a different
	 * slice of that context; it's always satisfied by the time this runs.
	 */
	readonly run: (
		ctx: PageOperationContext,
	) => Effect.Effect<HttpServerResponse.HttpServerResponse, unknown, any>;
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

const permanentQuery = {
	name: "permanent",
	in: "query" as const,
	required: false,
	schema: { type: "boolean" },
	description:
		"When `true`, permanently purge instead of moving to trash. Irreversible.",
};

/** The 404 mapping the old hand-written routes gave getPage/updatePage. */
const notFound = (pageId: string) =>
	new ApiError({ status: 404, message: `Page ${pageId} not found` });

export const pageOperations: readonly PageOperation[] = [
	{
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages",
		operationId: "listPages",
		relation: "member",
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
		relation: "member",
		run: (ctx) =>
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
		relation: "viewer",
		run: (ctx) =>
			Effect.gen(function* () {
				const pageId = yield* requireParam(ctx.params, "pageId");
				const page = yield* Pages.getPage(pageId).pipe(
					Effect.mapError(() => notFound(pageId)),
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
		relation: "editor",
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
				}).pipe(Effect.mapError(() => notFound(pageId)));
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
		relation: "editor",
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
		relation: "editor",
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

/**
 * Registers every declared page operation against `router`. Auth, membership,
 * the page-level relation check and the operation's own work all run inside a
 * single `WorkspaceDb` layer acquisition — the fix for AC4: the permission
 * check and the mutation it guards now share one workspace-layer acquisition,
 * where the old routes acquired it once for the check and again for the
 * mutation.
 */
export const registerPageOperations = (
	router: typeof HttpRouter.HttpRouter.Service,
	operations: readonly PageOperation[],
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
							if (op.relation !== "member") {
								const pageId = yield* requireParam(params, "pageId");
								yield* Permissions.checkPagePermission(
									userId,
									workspaceId,
									pageId,
									op.relation,
								);
							}
							return yield* op.run({ userId, workspaceId, role, params });
						}),
						wdb.getLayer(workspaceId),
					);
				}),
			),
		),
	);

/**
 * The OpenAPI `paths` fragment for the pages resource, grouped by path from
 * the same `pageOperations` list the router registers — one declaration,
 * both surfaces.
 */
export const pagesOpenApiPaths = (
	operations: readonly PageOperation[],
	wsParam: object,
	pageParam: object,
) => {
	const toDocPath = (routerPath: string) =>
		routerPath.replace("/api/v1", "").replace(/:([a-zA-Z]+)/g, "{$1}");

	const paths: Record<string, Record<string, unknown>> = {};
	for (const op of operations) {
		const docPath = toDocPath(op.path);
		const hasPageId = op.path.includes(":pageId");
		paths[docPath] ??= {
			parameters: hasPageId ? [wsParam, pageParam] : [wsParam],
		};
		paths[docPath][op.method.toLowerCase()] = {
			tags: ["Pages"],
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
