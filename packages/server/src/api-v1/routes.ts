import { Effect } from "effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { WorkspaceDb } from "../db.js";
import * as Blocks from "../handlers/blocks.js";
import * as Databases from "../handlers/databases.js";
import * as Pages from "../handlers/pages.js";
import * as Permissions from "../handlers/permissions.js";
import * as Search from "../handlers/search.js";
import * as Workspaces from "../handlers/workspaces.js";
import { ApiError, requireWorkspaceMember, resolveApiUser } from "./auth.js";
import { spec as openApiSpec, swaggerHtml } from "./openapi.js";
import { pageOperations, registerPageOperations } from "./operations.js";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Run a workspace-scoped handler with the correct per-workspace SQLite layer. */
const withWorkspace = <A, E, R>(
	workspaceId: string,
	inner: Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const wdb = yield* WorkspaceDb;
		return yield* Effect.provide(inner, wdb.getLayer(workspaceId));
	});

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

// ── Route registration ────────────────────────────────────────────────────────

export const registerV1Routes = Effect.gen(function* () {
	const router = yield* HttpRouter.HttpRouter;

	// ── OpenAPI spec + Swagger UI ─────────────────────────────────────────────

	yield* router.add(
		"GET",
		"/api/v1/openapi.json",
		Effect.succeed(
			HttpServerResponse.text(JSON.stringify(openApiSpec, null, 2), {
				headers: { "Content-Type": "application/json" },
			}),
		),
	);

	yield* router.add(
		"GET",
		"/api/docs",
		Effect.succeed(
			HttpServerResponse.text(swaggerHtml, {
				headers: { "Content-Type": "text/html" },
			}),
		),
	);

	// ── GET /api/v1/workspaces ────────────────────────────────────────────────

	yield* router.add(
		"GET",
		"/api/v1/workspaces",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const workspaces = yield* Workspaces.getMyWorkspaces(userId);
				return ok(
					workspaces.map((w) => ({
						id: w.id,
						name: w.name,
						slug: w.slug,
						role: w.role,
					})),
				);
			}),
		),
	);

	// ── Pages: one operation table drives REST registration + OpenAPI ────────
	// See api-v1/operations.ts — the six routes below (list/create/get/patch/
	// delete/restore) are declared once there, each running its permission
	// check and its mutation inside a single workspace-layer acquisition.

	yield* registerPageOperations(router, pageOperations);

	// ── GET /api/v1/workspaces/:workspaceId/pages/:pageId/blocks ─────────────

	yield* router.add(
		"GET",
		"/api/v1/workspaces/:workspaceId/pages/:pageId/blocks",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const pageId = yield* requireParam(p, "pageId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkPagePermission(
						userId,
						workspaceId,
						pageId,
						"viewer",
					),
				);
				const blocks = yield* withWorkspace(
					workspaceId,
					Blocks.listBlocks(pageId),
				);
				return ok(blocks);
			}),
		),
	);

	// ── POST /api/v1/workspaces/:workspaceId/pages/:pageId/blocks ────────────

	yield* router.add(
		"POST",
		"/api/v1/workspaces/:workspaceId/pages/:pageId/blocks",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const pageId = yield* requireParam(p, "pageId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkPagePermission(
						userId,
						workspaceId,
						pageId,
						"editor",
					),
				);
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const type = yield* requireField(body, "type");
				const content = yield* requireBlockContent(b.content);
				const index = typeof b.index === "number" ? b.index : 0;
				const parentId = optionalField(body, "parentId");
				const block = yield* withWorkspace(
					workspaceId,
					Blocks.createBlock({ pageId, type, content, index, parentId }),
				);
				return created(block);
			}),
		),
	);

	// ── PATCH /api/v1/workspaces/:workspaceId/blocks/:blockId ────────────────

	yield* router.add(
		"PATCH",
		"/api/v1/workspaces/:workspaceId/blocks/:blockId",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const blockId = yield* requireParam(p, "blockId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkBlockPermission(
						userId,
						workspaceId,
						blockId,
						"editor",
					),
				);
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
				const block = yield* withWorkspace(
					workspaceId,
					Blocks.updateBlock({
						id: blockId,
						content: yield* requireBlockContent(b.content),
					}),
				).pipe(
					Effect.mapError(
						() =>
							new ApiError({
								status: 404,
								message: `Block ${blockId} not found`,
							}),
					),
				);
				return ok(block);
			}),
		),
	);

	// ── DELETE /api/v1/workspaces/:workspaceId/blocks/:blockId ───────────────

	yield* router.add(
		"DELETE",
		"/api/v1/workspaces/:workspaceId/blocks/:blockId",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const blockId = yield* requireParam(p, "blockId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkBlockPermission(
						userId,
						workspaceId,
						blockId,
						"editor",
					),
				);
				yield* withWorkspace(workspaceId, Blocks.deleteBlock(blockId));
				return noContent();
			}),
		),
	);

	// ── GET /api/v1/workspaces/:workspaceId/databases ────────────────────────

	yield* router.add(
		"GET",
		"/api/v1/workspaces/:workspaceId/databases",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const role = yield* requireWorkspaceMember(workspaceId, userId);
				const dbs = yield* withWorkspace(
					workspaceId,
					Effect.gen(function* () {
						const all = yield* Databases.listAllDatabases;
						const allPages = yield* Pages.listPages;
						const visible = yield* Permissions.filterPagesByPermission(
							userId,
							workspaceId,
							role,
							allPages,
						);
						const visibleIds = new Set(visible.map((p) => p.id));
						return all.filter((db) => visibleIds.has(db.pageId));
					}),
				);
				return ok(dbs);
			}),
		),
	);

	// ── GET /api/v1/workspaces/:workspaceId/databases/:dbId/records ──────────

	yield* router.add(
		"GET",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/records",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"viewer",
					),
				);
				// `listRecordsWithValues` yields `{ record, values }`, where `values` is
				// already a field-name → parsed-value map. Flatten it for REST consumers.
				const raw = yield* withWorkspace(
					workspaceId,
					Databases.listRecordsWithValues(dbId),
				);
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
		),
	);

	// ── POST /api/v1/workspaces/:workspaceId/databases ───────────────────────

	yield* router.add(
		"POST",
		"/api/v1/workspaces/:workspaceId/databases",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const body = yield* parseBody;
				const pageId = yield* requireField(body, "pageId");
				const name = yield* requireField(body, "name");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkPagePermission(
						userId,
						workspaceId,
						pageId,
						"editor",
					),
				);
				const db = yield* withWorkspace(
					workspaceId,
					Databases.createDatabase({ pageId, name }),
				);
				return created(db);
			}),
		),
	);

	// ── PATCH /api/v1/workspaces/:workspaceId/databases/:dbId ─────────────────

	yield* router.add(
		"PATCH",
		"/api/v1/workspaces/:workspaceId/databases/:dbId",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const db = yield* withWorkspace(
					workspaceId,
					Effect.gen(function* () {
						if (typeof b.name === "string")
							yield* Databases.renameDatabase({ id: dbId, name: b.name });
						return yield* Databases.updateDatabase({
							id: dbId,
							titleLabel:
								typeof b.titleLabel === "string" ? b.titleLabel : undefined,
							titleHidden:
								"titleHidden" in b ? Boolean(b.titleHidden) : undefined,
						});
					}),
				).pipe(
					Effect.mapError(
						() =>
							new ApiError({
								status: 404,
								message: `Database ${dbId} not found`,
							}),
					),
				);
				return ok(db);
			}),
		),
	);

	// ── DELETE /api/v1/workspaces/:workspaceId/databases/:dbId ────────────────

	yield* router.add(
		"DELETE",
		"/api/v1/workspaces/:workspaceId/databases/:dbId",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				const permanent = (yield* queryParam("permanent")) === "true";
				if (permanent)
					yield* withWorkspace(workspaceId, Databases.purgeDatabase(dbId));
				else yield* withWorkspace(workspaceId, Databases.deleteDatabase(dbId));
				return noContent();
			}),
		),
	);

	// ── POST /api/v1/workspaces/:workspaceId/databases/:dbId/restore ──────────

	yield* router.add(
		"POST",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/restore",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				const result = yield* withWorkspace(
					workspaceId,
					Databases.restoreDatabase(dbId),
				);
				return ok(result);
			}),
		),
	);

	// ── GET /api/v1/workspaces/:workspaceId/databases/:dbId/fields ────────────

	yield* router.add(
		"GET",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/fields",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"viewer",
					),
				);
				const fields = yield* withWorkspace(
					workspaceId,
					Databases.listFields(dbId),
				);
				return ok(fields);
			}),
		),
	);

	// ── POST /api/v1/workspaces/:workspaceId/databases/:dbId/fields ───────────

	yield* router.add(
		"POST",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/fields",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const name = yield* requireField(body, "name");
				const type = yield* requireField(body, "type");
				const field = yield* withWorkspace(
					workspaceId,
					Databases.createField({
						databaseId: dbId,
						name,
						type,
						options: Array.isArray(b.options) ? (b.options as string[]) : null,
						relationTargetDbId: optionalField(body, "relationTargetDbId"),
						formula: optionalField(body, "formula"),
					}),
				);
				return created(field);
			}),
		),
	);

	// ── PATCH /api/v1/workspaces/:workspaceId/databases/:dbId/fields/:fieldId ─

	yield* router.add(
		"PATCH",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/fields/:fieldId",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				const fieldId = yield* requireParam(p, "fieldId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const field = yield* withWorkspace(
					workspaceId,
					Databases.updateField({
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
					}),
				).pipe(
					Effect.mapError(
						() =>
							new ApiError({
								status: 404,
								message: `Field ${fieldId} not found`,
							}),
					),
				);
				return ok(field);
			}),
		),
	);

	// ── DELETE /api/v1/workspaces/:workspaceId/databases/:dbId/fields/:fieldId ─

	yield* router.add(
		"DELETE",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/fields/:fieldId",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				const fieldId = yield* requireParam(p, "fieldId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				yield* withWorkspace(workspaceId, Databases.deleteField(fieldId));
				return noContent();
			}),
		),
	);

	// ── POST /api/v1/workspaces/:workspaceId/databases/:dbId/records ──────────

	yield* router.add(
		"POST",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/records",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				const body = yield* parseBody;
				const title = yield* requireField(body, "title");
				const record = yield* withWorkspace(
					workspaceId,
					Databases.createRecord({ databaseId: dbId, title }),
				);
				return created(record);
			}),
		),
	);

	// ── PATCH /api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId ─

	yield* router.add(
		"PATCH",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				const recordId = yield* requireParam(p, "recordId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				const result = yield* withWorkspace(
					workspaceId,
					Databases.updateRecord({
						id: recordId,
						title: typeof b.title === "string" ? b.title : undefined,
						description:
							typeof b.description === "string" ? b.description : undefined,
					}),
				);
				return ok(result);
			}),
		),
	);

	// ── DELETE /api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId ─

	yield* router.add(
		"DELETE",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				const recordId = yield* requireParam(p, "recordId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				const permanent = (yield* queryParam("permanent")) === "true";
				yield* withWorkspace(
					workspaceId,
					permanent
						? Databases.purgeRecord(recordId)
						: Databases.deleteRecord(recordId),
				);
				return noContent();
			}),
		),
	);

	// ── POST /api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId/restore ─

	yield* router.add(
		"POST",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId/restore",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				const recordId = yield* requireParam(p, "recordId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				const result = yield* withWorkspace(
					workspaceId,
					Databases.restoreRecord(recordId),
				);
				return ok(result);
			}),
		),
	);

	// ── PUT /api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId/fields/:fieldId ─
	// Sets a single cell value. `value` is stored as a string; for number use "42",
	// checkbox "true"/"false", multiSelect a JSON array string like '["a","b"]'.

	yield* router.add(
		"PUT",
		"/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId/fields/:fieldId",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const dbId = yield* requireParam(p, "dbId");
				const recordId = yield* requireParam(p, "recordId");
				const fieldId = yield* requireParam(p, "fieldId");
				yield* withWorkspace(
					workspaceId,
					Permissions.checkDatabasePermission(
						userId,
						workspaceId,
						dbId,
						"editor",
					),
				);
				const body = yield* parseBody;
				const b = body as Record<string, unknown>;
				if (!("value" in b)) {
					return yield* Effect.fail(
						new ApiError({ status: 422, message: 'Field "value" is required' }),
					);
				}
				const value =
					typeof b.value === "string" ? b.value : JSON.stringify(b.value);
				const result = yield* withWorkspace(
					workspaceId,
					Databases.updateFieldValue({ recordId, fieldId, value }),
				);
				return ok(result);
			}),
		),
	);

	// ── GET /api/v1/workspaces/:workspaceId/search ───────────────────────────

	yield* router.add(
		"GET",
		"/api/v1/workspaces/:workspaceId/search",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				const role = yield* requireWorkspaceMember(workspaceId, userId);
				const q = yield* queryParam("q");
				if (!q?.trim()) {
					return yield* Effect.fail(
						new ApiError({
							status: 422,
							message: 'Query parameter "q" is required',
						}),
					);
				}
				const results = yield* withWorkspace(
					workspaceId,
					Effect.gen(function* () {
						const hits = yield* Search.globalSearch(q);
						const allPages = yield* Pages.listPages;
						const visible = yield* Permissions.filterPagesByPermission(
							userId,
							workspaceId,
							role,
							allPages,
						);
						const visibleIds = new Set(visible.map((p) => p.id));
						return hits.filter((r) =>
							visibleIds.has(r.type === "page" ? r.id : r.pageId),
						);
					}),
				);
				return ok(results);
			}),
		),
	);

	// ── GET /api/v1/workspaces/:workspaceId/trash ────────────────────────────

	yield* router.add(
		"GET",
		"/api/v1/workspaces/:workspaceId/trash",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const p = yield* HttpRouter.params;
				const workspaceId = yield* requireParam(p, "workspaceId");
				yield* requireWorkspaceMember(workspaceId, userId);
				const trash = yield* withWorkspace(workspaceId, Databases.listTrash);
				return ok(trash);
			}),
		),
	);
});
