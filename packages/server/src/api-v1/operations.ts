import {
	AclRelation,
	AclRevision,
	AuthError,
	Backlink,
	Block,
	BlockContent,
	BlockLockedError,
	type ConflictError,
	Database,
	DatabaseCsvExport,
	DatabaseField,
	DatabaseFieldType,
	DatabaseRecord,
	DatabaseView,
	Email,
	type NotFoundError,
	Page,
	PageExport,
	PagePermissions,
	RecordFieldValue,
	SearchQuery,
	SearchResult,
	Subject,
	TitleString,
	TrashContents,
	ValidationError,
	WorkspaceMember,
} from "@notara/shared";
import {
	Effect,
	JsonSchema,
	Schema,
	type SchemaAST,
	SchemaRepresentation,
} from "effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import { type SqlClient, SqlError } from "effect/sql";
import { inSubtree, KeyRoot } from "../acl.js";
import { WorkspaceDb } from "../db.js";
import type { Editor } from "../editor.js";
import * as Blocks from "../handlers/blocks.js";
import * as Databases from "../handlers/databases.js";
import * as ImportExport from "../handlers/importExport.js";
import * as PageShares from "../handlers/page-shares.js";
import * as Pages from "../handlers/pages.js";
import * as Permissions from "../handlers/permissions.js";
import * as Search from "../handlers/search.js";
import * as Templates from "../handlers/templates.js";
import * as Workspaces from "../handlers/workspaces.js";
import type { WorkspaceRole } from "../membership.js";
import type { PlatformDb } from "../platform-db.js";
import { presence } from "../presence/index.js";
import {
	ApiError,
	editorOf,
	requireWorkspaceMember,
	resolveApiUser,
} from "./auth.js";
import { created, handle, noContent, ok, requireParam } from "./response.js";
import { type ApiKeyScope, enforceScope } from "./scope.js";

/**
 * One entry declares an operation once: its route, its scope, its input and
 * output Schemas and how it runs. `registerTypedOperations` derives the REST
 * routes from it, `typedOperationsOpenApi` the OpenAPI document and mcp.ts the
 * MCP tools — so no door can drift from another (NOT-169).
 *
 * RPC (rpc-handlers.ts) is a separate surface, not covered here.
 */

/** Everything an operation's `run` needs once auth and layer are settled. */
export interface OperationContext {
	readonly userId: string;
	readonly workspaceId: string;
	readonly role: WorkspaceRole;
	/** Set when the caller is a key limited to a page subtree. */
	readonly rootPageId: string | null;
	/** Who is writing, for `updated_by` (ADR-013). */
	readonly editor: Editor;
}

const errorRef = { $ref: "#/components/schemas/Error" };
const errorResponses = {
	400: {
		description: "Malformed JSON body",
		content: { "application/json": { schema: errorRef } },
	},
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
	409: {
		description: "Conflict, such as a block another user is editing",
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

const jsonResponse = (description: string, schema: object) => ({
	description,
	content: { "application/json": { schema } },
});

// ── Typed operations (NOT-169) ─────────────────────────────────────────────────
//
// The form every operation moves to: input and output are Schemas, scope is
// declared, and `run` returns data that can fail only with the shared tagged
// errors. The REST door below decodes, encodes and maps errors for it; the
// OpenAPI entry is generated from the same Schemas.

/** The per-workspace services an operation runs with. */
export type WorkspaceServices = SqlClient.SqlClient | PlatformDb;

/** The failures an operation may declare; anything else is a reported 500. */
export type OperationError =
	| NotFoundError
	| ValidationError
	| ConflictError
	| BlockLockedError
	| AuthError;

export interface TypedOperation<I, O> {
	readonly operationId: string;
	readonly tag: string;
	readonly summary: string;
	readonly description?: string;
	/** REST door only. Path params, then query (GET, DELETE) or body, fill `input`. */
	readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
	readonly path: `/${string}`;
	/** REST door only; 200 when omitted. */
	readonly successStatus?: 201 | 204;
	readonly scope: ApiKeyScope;
	/** Its input's `parentId` is where a page is placed; see requireParentInSubtree. */
	readonly placesPage?: true;
	readonly input: Schema.Codec<I, unknown> & {
		readonly fields: Schema.Struct.Fields;
	};
	readonly output: Schema.Codec<O, unknown>;
	/** Runs before `run`, under the same workspace-layer acquisition. */
	readonly checkPermission?: (
		ctx: OperationContext,
		input: I,
	) => Effect.Effect<void, AuthError | NotFoundError, WorkspaceServices>;
	readonly run: (
		ctx: OperationContext,
		input: I,
	) => Effect.Effect<O, OperationError, WorkspaceServices>;
}

/**
 * An operation that names no workspace (listWorkspaces): it runs as the
 * caller, outside any workspace layer, so it has no membership or permission
 * check to make. Its path has no `:workspaceId`, its MCP tool no `workspaceId`.
 */
export interface UserOperation<I, O>
	extends Omit<TypedOperation<I, O>, "checkPermission" | "run"> {
	readonly workspace: "none";
	readonly run: (
		ctx: { readonly userId: string },
		input: I,
	) => Effect.Effect<O, OperationError, PlatformDb>;
}

/** An entry of the operation table, workspace-scoped or not. */
export type AnyOperation = TypedOperation<any, any> | UserOperation<any, any>;

/** Checks one entry against the seam while keeping its own `I` and `O`. */
const typedOperation = <I, O>(op: TypedOperation<I, O>) => op;

/** A SQL failure is an incident, not an answer: it leaves the seam as a defect. */
const sqlDefect = <A, E, R>(
	self: Effect.Effect<A, E, R>,
): Effect.Effect<A, Exclude<E, SqlError.SqlError>, R> =>
	Effect.catch(self, (e) =>
		SqlError.isSqlError(e)
			? Effect.die(e)
			: Effect.fail(e as Exclude<E, SqlError.SqlError>),
	);

// ── Pages ──────────────────────────────────────────────────────────────────────

const PageId = Schema.String.annotate({ description: "Page ID" });
/** The RPC `Page`, as the plain JSON object the handlers return. */
const PageJson = Schema.Struct(Page.fields).annotate({ identifier: "Page" });
const RestoreResult = Schema.Struct({ restored: Schema.Boolean });
const ReorderResult = Schema.Struct({ reordered: Schema.Boolean });
const Permanent = Schema.optional(
	Schema.Literals(["true", "false"]).annotate({
		description:
			"When `true`, permanently purge instead of moving to trash. Irreversible.",
	}),
);

const pagePermission =
	(relation: Permissions.AclRelation) =>
	(ctx: OperationContext, input: { pageId: string }) =>
		Permissions.checkPagePermission(
			ctx.userId,
			ctx.workspaceId,
			input.pageId,
			relation,
		).pipe(
			// Declared as the whole ApiError union; it only ever refuses.
			Effect.catch((e) =>
				e._tag === "AuthError" ? Effect.fail(e) : Effect.die(e),
			),
		);

export const pageOperations = [
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages",
		operationId: "listPages",
		tag: "Pages",
		summary: "List all pages",
		scope: "read",
		input: Schema.Struct({}),
		output: Schema.Array(PageJson),
		run: (ctx) =>
			Pages.listPages.pipe(
				Effect.flatMap((all) =>
					Permissions.filterPagesByPermission(
						ctx.userId,
						ctx.workspaceId,
						ctx.role,
						all,
					),
				),
				sqlDefect,
			),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/pages",
		operationId: "createPage",
		placesPage: true,
		tag: "Pages",
		summary: "Create a page",
		successStatus: 201,
		scope: "write",
		input: Schema.Struct({
			title: TitleString,
			parentId: Schema.optional(Schema.NullOr(Schema.String)),
		}),
		output: PageJson,
		run: (ctx, input) =>
			Pages.createPage(
				{
					title: input.title,
					parentId: input.parentId ?? null,
				},
				ctx.editor,
			).pipe(sqlDefect),
	}),
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId",
		operationId: "getPage",
		tag: "Pages",
		summary: "Get a page",
		scope: "read",
		input: Schema.Struct({ pageId: PageId }),
		output: PageJson,
		checkPermission: pagePermission("viewer"),
		run: (_, input) => Pages.getPage(input.pageId).pipe(sqlDefect),
	}),
	typedOperation({
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId",
		operationId: "updatePage",
		tag: "Pages",
		summary: "Update a page",
		scope: "write",
		input: Schema.Struct({
			pageId: PageId,
			title: Schema.optional(Schema.NullOr(TitleString)),
			icon: Schema.optional(Schema.NullOr(Schema.String)),
			coverUrl: Schema.optional(Schema.NullOr(Schema.String)),
			isFavorite: Schema.optional(Schema.NullOr(Schema.Boolean)),
		}),
		output: PageJson,
		checkPermission: pagePermission("editor"),
		run: (ctx, { pageId, ...patch }) =>
			Pages.updatePage({ id: pageId, ...patch }, ctx.editor).pipe(
				Effect.tap((page) =>
					Effect.sync(() =>
						presence.broadcast(ctx.workspaceId, pageId, {
							type: "page.metaUpdated",
							actorUserId: ctx.userId,
							fields: {
								title: page.title,
								icon: page.icon,
								coverUrl: page.coverUrl,
							},
						}),
					),
				),
				sqlDefect,
			),
	}),
	typedOperation({
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId",
		operationId: "deletePage",
		tag: "Pages",
		summary: "Delete a page",
		description:
			"Moves the page to trash by default. Pass `?permanent=true` to purge it permanently along with its blocks, databases and records.",
		successStatus: 204,
		scope: "write",
		input: Schema.Struct({ pageId: PageId, permanent: Permanent }),
		output: Schema.Void,
		checkPermission: pagePermission("editor"),
		run: (_, input) =>
			(input.permanent === "true"
				? Databases.purgePage(input.pageId)
				: Pages.deletePage(input.pageId)
			).pipe(Effect.asVoid, sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/restore",
		operationId: "restorePage",
		tag: "Pages",
		summary: "Restore a trashed page",
		scope: "write",
		input: Schema.Struct({ pageId: PageId }),
		output: RestoreResult,
		checkPermission: pagePermission("editor"),
		run: (_, input) => Pages.restorePage(input.pageId).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/move",
		operationId: "movePage",
		placesPage: true,
		tag: "Pages",
		summary: "Move a page under another parent",
		description: "`parentId: null` moves the page to the top level.",
		scope: "write",
		input: Schema.Struct({
			pageId: PageId,
			parentId: Schema.NullOr(Schema.String),
		}),
		output: PageJson,
		checkPermission: pagePermission("editor"),
		run: (ctx, { pageId, parentId }) =>
			Pages.movePage({ id: pageId, parentId }, ctx.editor).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/pages/reorder",
		operationId: "reorderPages",
		placesPage: true,
		tag: "Pages",
		summary: "Reorder the child pages of a parent",
		description:
			"`pageIds` lists every sibling in the new order; `parentId: null` reorders the top level.",
		scope: "write",
		input: Schema.Struct({
			parentId: Schema.NullOr(Schema.String),
			pageIds: Schema.Array(Schema.String),
		}),
		output: ReorderResult,
		// As the RPC: the parent's ACL, none at the top level.
		checkPermission: (ctx, { parentId }) =>
			parentId === null
				? Effect.void
				: pagePermission("editor")(ctx, { pageId: parentId }),
		run: (_, { parentId, pageIds }) =>
			Pages.reorderPages({ parentId, pageIds: [...pageIds] }).pipe(sqlDefect),
	}),
];

// ── Blocks ─────────────────────────────────────────────────────────────────────

const BlockId = Schema.String.annotate({ description: "Block ID" });
/** The RPC `Block`, as the plain JSON object the handlers return. */
const BlockJson = Schema.Struct(Block.fields).annotate({ identifier: "Block" });
/**
 * Block content crosses this boundary exactly as it is stored: a string whose
 * reading depends on the block type. The contract lives in handlers/blocks.ts.
 */
const BlockContentInput = BlockContent.annotate({
	description: Blocks.CONTENT_CONTRACT,
});

/** The page must exist (and not be trashed) for its blocks to be reached. */
const requirePage = (pageId: string) =>
	Pages.getPage(pageId).pipe(Effect.asVoid);

/**
 * The block's page ACL. Run as `run`'s first step rather than as
 * `checkPermission`: an unknown block is a NotFoundError, which the seam's
 * `checkPermission` does not declare. Still under the one layer acquisition.
 */
const blockPermission = (ctx: OperationContext, blockId: string) =>
	Permissions.checkBlockPermission(
		ctx.userId,
		ctx.workspaceId,
		blockId,
		"editor",
	).pipe(
		Effect.catch((e) =>
			e._tag === "AuthError" || e._tag === "NotFoundError"
				? Effect.fail(e)
				: Effect.die(e),
		),
	);

/**
 * The block's page, refusing when another user holds the block in the editor:
 * an agent must not overwrite what someone is typing, as the RPC door refuses.
 */
const unlockedBlockPage = (ctx: OperationContext, blockId: string) =>
	Effect.gen(function* () {
		const pageId = yield* Blocks.getBlockPageId(blockId);
		const holder = pageId
			? presence.lockHolder(ctx.workspaceId, pageId, blockId)
			: null;
		if (holder && holder !== ctx.userId)
			return yield* Effect.fail(new BlockLockedError({ holderUserId: holder }));
		return pageId;
	});

export const blockOperations = [
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/blocks",
		operationId: "listBlocks",
		tag: "Blocks",
		summary: "List blocks in a page",
		scope: "read",
		input: Schema.Struct({ pageId: PageId }),
		output: Schema.Array(BlockJson),
		checkPermission: pagePermission("viewer"),
		run: (_, input) =>
			requirePage(input.pageId).pipe(
				Effect.andThen(Blocks.listBlocks(input.pageId)),
				sqlDefect,
			),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/blocks",
		operationId: "createBlock",
		tag: "Blocks",
		summary: "Create a block",
		successStatus: 201,
		scope: "write",
		input: Schema.Struct({
			pageId: PageId,
			type: Block.fields.type,
			content: BlockContentInput,
			index: Schema.optional(Schema.Number),
			parentId: Schema.optional(Schema.NullOr(Schema.String)),
		}),
		output: BlockJson,
		checkPermission: pagePermission("editor"),
		run: (ctx, input) =>
			requirePage(input.pageId).pipe(
				Effect.andThen(
					Blocks.createBlock(
						{
							pageId: input.pageId,
							type: input.type,
							content: input.content,
							index: input.index ?? 0,
							parentId: input.parentId ?? null,
						},
						ctx.editor,
					),
				),
				Effect.tap((block) =>
					Effect.sync(() =>
						presence.broadcast(ctx.workspaceId, input.pageId, {
							type: "block.created",
							actorUserId: ctx.userId,
							block,
						}),
					),
				),
				sqlDefect,
			),
	}),
	typedOperation({
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/blocks/:blockId",
		operationId: "updateBlock",
		tag: "Blocks",
		summary: "Update a block's content, and optionally its type",
		scope: "write",
		input: Schema.Struct({
			blockId: BlockId,
			content: BlockContentInput,
			type: Schema.optional(
				Block.fields.type.annotate({
					description: "New block type (turn into); kept when omitted",
				}),
			),
		}),
		output: BlockJson,
		run: (ctx, input) =>
			Effect.gen(function* () {
				yield* blockPermission(ctx, input.blockId);
				const pageId = yield* unlockedBlockPage(ctx, input.blockId);
				const block = yield* Blocks.updateBlock(
					{
						id: input.blockId,
						content: input.content,
						type: input.type,
					},
					ctx.editor,
				);
				if (pageId)
					presence.broadcast(ctx.workspaceId, pageId, {
						type: "block.updated",
						actorUserId: ctx.userId,
						blockId: input.blockId,
						content: input.content,
					});
				return block;
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/blocks/:blockId",
		operationId: "deleteBlock",
		tag: "Blocks",
		summary: "Delete a block",
		successStatus: 204,
		scope: "write",
		input: Schema.Struct({ blockId: BlockId }),
		output: Schema.Void,
		run: (ctx, input) =>
			Effect.gen(function* () {
				yield* blockPermission(ctx, input.blockId);
				const pageId = yield* unlockedBlockPage(ctx, input.blockId);
				yield* Blocks.deleteBlock(input.blockId, ctx.editor);
				if (pageId)
					presence.broadcast(ctx.workspaceId, pageId, {
						type: "block.deleted",
						actorUserId: ctx.userId,
						blockId: input.blockId,
					});
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/blocks/reorder",
		operationId: "reorderBlocks",
		tag: "Blocks",
		summary: "Reorder a page's blocks",
		description: "`blockIds` lists the page's blocks in the new order.",
		scope: "write",
		input: Schema.Struct({
			pageId: PageId,
			blockIds: Schema.Array(BlockId),
		}),
		output: Schema.Array(BlockJson),
		checkPermission: pagePermission("editor"),
		run: (ctx, { pageId, blockIds }) =>
			Blocks.reorderBlocks(pageId, [...blockIds]).pipe(
				Effect.tap(() =>
					Effect.sync(() =>
						presence.broadcast(ctx.workspaceId, pageId, {
							type: "block.reordered",
							actorUserId: ctx.userId,
							blockIds: [...blockIds],
						}),
					),
				),
				sqlDefect,
			),
	}),
];

// ── Databases, fields, records ─────────────────────────────────────────────────

const DatabaseId = Schema.String.annotate({ description: "Database ID" });
const FieldId = Schema.String.annotate({ description: "Field ID" });
const RecordId = Schema.String.annotate({ description: "Record ID" });
/** The RPC entities, as the plain JSON objects the handlers return. */
const DatabaseJson = Schema.Struct(Database.fields).annotate({
	identifier: "Database",
});
const FieldJson = Schema.Struct(DatabaseField.fields).annotate({
	identifier: "DatabaseField",
});
const RecordJson = Schema.Struct(DatabaseRecord.fields).annotate({
	identifier: "DatabaseRecord",
});
const record = DatabaseRecord.fields;
/** A record flattened with its cells, keyed by field name. */
const RecordWithValuesJson = Schema.Struct({
	id: record.id,
	databaseId: record.databaseId,
	title: record.title,
	description: record.description,
	isDeleted: record.isDeleted,
	createdAt: record.createdAt,
	fields: Schema.Record(Schema.String, Schema.Unknown),
}).annotate({ identifier: "DatabaseRecordWithValues" });
const ViewJson = Schema.Struct(DatabaseView.fields).annotate({
	identifier: "DatabaseView",
});
const ViewId = Schema.String.annotate({ description: "View ID" });
const ViewType = Schema.Literals(["table", "board", "calendar"]);
const CellJson = Schema.Struct(RecordFieldValue.fields).annotate({
	identifier: "RecordFieldValue",
});

/**
 * The permission check is on the database, so a record or field named next to
 * it must be that database's: a grant on one database never reaches another's.
 */
const databasePermission =
	(relation: Permissions.AclRelation) =>
	(
		ctx: OperationContext,
		input: {
			dbId: string;
			recordId?: string;
			fieldId?: string;
			viewId?: string;
		},
	) =>
		Permissions.checkDatabasePermission(
			ctx.userId,
			ctx.workspaceId,
			input.dbId,
			relation,
		).pipe(
			Effect.andThen(
				Databases.requireInDatabase(input.dbId, {
					recordId: input.recordId,
					fieldId: input.fieldId,
					viewId: input.viewId,
				}),
			),
			Effect.catch((e) =>
				e._tag === "AuthError" || e._tag === "NotFoundError"
					? Effect.fail(e)
					: Effect.die(e),
			),
		);

export const databaseOperations = [
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/databases",
		operationId: "listDatabases",
		tag: "Databases",
		summary: "List all databases in the workspace",
		scope: "read",
		input: Schema.Struct({}),
		output: Schema.Array(DatabaseJson),
		run: (ctx) =>
			Effect.gen(function* () {
				const all = yield* Databases.listAllDatabases;
				const visible = yield* Permissions.filterPagesByPermission(
					ctx.userId,
					ctx.workspaceId,
					ctx.role,
					yield* Pages.listPages,
				);
				const visibleIds = new Set(visible.map((p) => p.id));
				return all.filter((db) => visibleIds.has(db.pageId));
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases",
		operationId: "createDatabase",
		tag: "Databases",
		summary: "Create a database",
		successStatus: 201,
		scope: "write",
		input: Schema.Struct({
			pageId: PageId.annotate({
				description: "Page the database is hosted on",
			}),
			name: Schema.NonEmptyString,
		}),
		output: DatabaseJson,
		checkPermission: pagePermission("editor"),
		run: (_, input) => Databases.createDatabase(input).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/reorder",
		operationId: "reorderDatabases",
		tag: "Databases",
		summary: "Reorder the databases hosted on a page",
		scope: "write",
		input: Schema.Struct({
			pageId: PageId.annotate({ description: "Page hosting the databases" }),
			databaseIds: Schema.Array(DatabaseId),
		}),
		output: ReorderResult,
		checkPermission: pagePermission("editor"),
		run: (_, { pageId, databaseIds }) =>
			Databases.reorderDatabases({
				pageId,
				databaseIds: [...databaseIds],
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId",
		operationId: "updateDatabase",
		tag: "Databases",
		summary: "Update a database",
		scope: "write",
		input: Schema.Struct({
			dbId: DatabaseId,
			name: Schema.optional(Schema.String),
			titleLabel: Schema.optional(
				Schema.String.annotate({
					description: "Label of the built-in title column",
				}),
			),
			titleHidden: Schema.optional(
				Schema.Boolean.annotate({ description: "Hide the title column" }),
			),
		}),
		output: DatabaseJson,
		checkPermission: databasePermission("editor"),
		run: (_, { dbId, name, titleLabel, titleHidden }) =>
			Effect.gen(function* () {
				if (name !== undefined)
					yield* Databases.renameDatabase({ id: dbId, name });
				return yield* Databases.updateDatabase({
					id: dbId,
					titleLabel,
					titleHidden,
				});
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId",
		operationId: "deleteDatabase",
		tag: "Databases",
		summary: "Delete a database",
		description:
			"Moves the database to trash by default. Pass `?permanent=true` to purge it with all its records, fields and views.",
		successStatus: 204,
		scope: "write",
		input: Schema.Struct({ dbId: DatabaseId, permanent: Permanent }),
		output: Schema.Void,
		checkPermission: databasePermission("editor"),
		run: (_, input) =>
			(input.permanent === "true"
				? Effect.asVoid(Databases.purgeDatabase(input.dbId))
				: Effect.asVoid(Databases.deleteDatabase(input.dbId))
			).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/restore",
		operationId: "restoreDatabase",
		tag: "Databases",
		summary: "Restore a trashed database",
		scope: "write",
		input: Schema.Struct({ dbId: DatabaseId }),
		output: RestoreResult,
		checkPermission: databasePermission("editor"),
		run: (_, input) => Databases.restoreDatabase(input.dbId).pipe(sqlDefect),
	}),
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/fields",
		operationId: "listFields",
		tag: "Databases",
		summary: "List a database's fields (columns)",
		scope: "read",
		input: Schema.Struct({ dbId: DatabaseId }),
		output: Schema.Array(FieldJson),
		checkPermission: databasePermission("viewer"),
		run: (_, input) => Databases.listFields(input.dbId).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/fields",
		operationId: "createField",
		tag: "Databases",
		summary: "Create a field (column)",
		successStatus: 201,
		scope: "write",
		input: Schema.Struct({
			dbId: DatabaseId,
			name: Schema.NonEmptyString,
			type: DatabaseFieldType,
			options: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
			relationTargetDbId: Schema.optional(Schema.NullOr(Schema.String)),
			formula: Schema.optional(Schema.NullOr(Schema.String)),
		}),
		output: FieldJson,
		checkPermission: databasePermission("editor"),
		run: (_, { dbId, options, relationTargetDbId, ...field }) =>
			Databases.createField({
				...field,
				databaseId: dbId,
				options: options ? [...options] : null,
				relationTargetDbId: relationTargetDbId ?? null,
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/fields/reorder",
		operationId: "reorderFields",
		tag: "Databases",
		summary: "Reorder a database's fields (columns)",
		scope: "write",
		input: Schema.Struct({
			dbId: DatabaseId,
			fieldIds: Schema.Array(FieldId),
		}),
		output: ReorderResult,
		checkPermission: databasePermission("editor"),
		run: (_, { dbId, fieldIds }) =>
			Databases.reorderFields({
				databaseId: dbId,
				fieldIds: [...fieldIds],
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/fields/:fieldId",
		operationId: "updateField",
		tag: "Databases",
		summary: "Update a field",
		scope: "write",
		input: Schema.Struct({
			dbId: DatabaseId,
			fieldId: FieldId,
			name: Schema.optional(Schema.String),
			type: Schema.optional(DatabaseFieldType),
			options: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
			relationTargetDbId: Schema.optional(Schema.NullOr(Schema.String)),
			formula: Schema.optional(Schema.NullOr(Schema.String)),
		}),
		output: FieldJson,
		checkPermission: databasePermission("editor"),
		run: (_, { dbId: _db, fieldId, options, ...patch }) =>
			Databases.updateField({
				...patch,
				id: fieldId,
				options: options ? [...options] : options,
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/fields/:fieldId",
		operationId: "deleteField",
		tag: "Databases",
		summary: "Delete a field",
		successStatus: 204,
		scope: "write",
		input: Schema.Struct({ dbId: DatabaseId, fieldId: FieldId }),
		output: Schema.Void,
		checkPermission: databasePermission("editor"),
		run: (_, input) =>
			Databases.deleteField(input.fieldId).pipe(Effect.asVoid, sqlDefect),
	}),
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records",
		operationId: "listDatabaseRecords",
		tag: "Databases",
		summary: "List records in a database",
		scope: "read",
		input: Schema.Struct({ dbId: DatabaseId }),
		output: Schema.Array(RecordWithValuesJson),
		checkPermission: databasePermission("viewer"),
		run: (_, input) =>
			Databases.listRecordsWithValues(input.dbId).pipe(
				Effect.map((rows) =>
					rows.map(({ record, values }) => ({ ...record, fields: values })),
				),
				sqlDefect,
			),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records",
		operationId: "createRecord",
		tag: "Databases",
		summary: "Create a record (row)",
		successStatus: 201,
		scope: "write",
		input: Schema.Struct({ dbId: DatabaseId, title: Schema.NonEmptyString }),
		output: RecordJson,
		checkPermission: databasePermission("editor"),
		run: (_, input) =>
			Databases.createRecord({
				databaseId: input.dbId,
				title: input.title,
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/reorder",
		operationId: "reorderRecords",
		tag: "Databases",
		summary: "Reorder a database's records (rows)",
		scope: "write",
		input: Schema.Struct({
			dbId: DatabaseId,
			recordIds: Schema.Array(RecordId),
		}),
		output: ReorderResult,
		checkPermission: databasePermission("editor"),
		run: (_, { dbId, recordIds }) =>
			Databases.reorderRecords({
				databaseId: dbId,
				recordIds: [...recordIds],
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId",
		operationId: "updateRecord",
		tag: "Databases",
		summary: "Update a record's title or description",
		scope: "write",
		input: Schema.Struct({
			dbId: DatabaseId,
			recordId: RecordId,
			title: Schema.optional(Schema.String),
			description: Schema.optional(Schema.String),
		}),
		output: Schema.Struct({ updated: Schema.Boolean }),
		checkPermission: databasePermission("editor"),
		run: (_, { recordId, title, description }) =>
			Databases.updateRecord({ id: recordId, title, description }).pipe(
				sqlDefect,
			),
	}),
	typedOperation({
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId",
		operationId: "deleteRecord",
		tag: "Databases",
		summary: "Delete a record",
		description:
			"Moves the record to trash by default. Pass `?permanent=true` to purge it.",
		successStatus: 204,
		scope: "write",
		input: Schema.Struct({
			dbId: DatabaseId,
			recordId: RecordId,
			permanent: Permanent,
		}),
		output: Schema.Void,
		checkPermission: databasePermission("editor"),
		run: (_, input) =>
			(input.permanent === "true"
				? Databases.purgeRecord(input.recordId)
				: Databases.deleteRecord(input.recordId)
			).pipe(Effect.asVoid, sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId/restore",
		operationId: "restoreRecord",
		tag: "Databases",
		summary: "Restore a trashed record",
		scope: "write",
		input: Schema.Struct({ dbId: DatabaseId, recordId: RecordId }),
		output: RestoreResult,
		checkPermission: databasePermission("editor"),
		run: (_, input) => Databases.restoreRecord(input.recordId).pipe(sqlDefect),
	}),
	typedOperation({
		method: "PUT",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId/fields/:fieldId",
		operationId: "setCell",
		tag: "Databases",
		summary: "Set a single cell value",
		scope: "write",
		input: Schema.Struct({
			dbId: DatabaseId,
			recordId: RecordId,
			fieldId: FieldId,
			value: Schema.Unknown.annotate({
				description:
					'Cell value, stored as text: a string is kept as is, anything else as its JSON. Number: "42". Checkbox: "true"/"false". multiSelect: a JSON array string like \'["a","b"]\'.',
			}),
		}),
		output: CellJson,
		checkPermission: databasePermission("editor"),
		run: (_, { recordId, fieldId, value }) =>
			Databases.updateFieldValue({
				recordId,
				fieldId,
				value: typeof value === "string" ? value : JSON.stringify(value),
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId",
		operationId: "getDatabase",
		tag: "Databases",
		summary: "Get a database",
		scope: "read",
		input: Schema.Struct({ dbId: DatabaseId }),
		output: DatabaseJson,
		checkPermission: databasePermission("viewer"),
		run: (_, input) => Databases.getDatabase(input.dbId).pipe(sqlDefect),
	}),
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId",
		operationId: "getRecordWithValues",
		tag: "Databases",
		summary: "Get a record with its cell values",
		scope: "read",
		input: Schema.Struct({ dbId: DatabaseId, recordId: RecordId }),
		output: RecordWithValuesJson,
		checkPermission: databasePermission("viewer"),
		run: (_, input) =>
			Databases.getRecordWithValues(input.recordId).pipe(
				Effect.map(({ record, values }) => ({ ...record, fields: values })),
				sqlDefect,
			),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/records/:recordId/page",
		operationId: "openRecordAsPage",
		tag: "Databases",
		summary: "Open a record as a page",
		description:
			"Returns the record's page, creating it on first call. Later calls return the same page.",
		scope: "write",
		input: Schema.Struct({ dbId: DatabaseId, recordId: RecordId }),
		output: Schema.Struct({ pageId: Schema.String }),
		checkPermission: databasePermission("editor"),
		run: (_, input) =>
			Databases.openRecordAsPage(input.recordId).pipe(sqlDefect),
	}),
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/views",
		operationId: "listViews",
		tag: "Databases",
		summary: "List a database's views",
		scope: "read",
		input: Schema.Struct({ dbId: DatabaseId }),
		output: Schema.Array(ViewJson),
		checkPermission: databasePermission("viewer"),
		run: (_, input) => Databases.listViews(input.dbId).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/views",
		operationId: "createView",
		tag: "Databases",
		summary: "Create a view",
		successStatus: 201,
		scope: "write",
		input: Schema.Struct({
			dbId: DatabaseId,
			name: Schema.NonEmptyString,
			type: ViewType,
			groupByFieldId: Schema.optional(Schema.NullOr(Schema.String)),
			config: Schema.optional(
				Schema.String.annotate({
					description: "View settings (filters, sorts…) as a JSON string",
				}),
			),
			isDefault: Schema.optional(Schema.Boolean),
		}),
		output: ViewJson,
		checkPermission: databasePermission("editor"),
		run: (_, { dbId, groupByFieldId, ...view }) =>
			Databases.createView({
				...view,
				databaseId: dbId,
				groupByFieldId: groupByFieldId ?? null,
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "PATCH",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/views/:viewId",
		operationId: "updateView",
		tag: "Databases",
		summary: "Update a view",
		scope: "write",
		input: Schema.Struct({
			dbId: DatabaseId,
			viewId: ViewId,
			name: Schema.optional(Schema.String),
			type: Schema.optional(ViewType),
			groupByFieldId: Schema.optional(Schema.NullOr(Schema.String)),
			config: Schema.optional(Schema.String),
			isDefault: Schema.optional(Schema.Boolean),
		}),
		output: ViewJson,
		checkPermission: databasePermission("editor"),
		run: (_, { dbId: _db, viewId, ...patch }) =>
			Databases.updateView({ ...patch, id: viewId }).pipe(sqlDefect),
	}),
	typedOperation({
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/views/:viewId",
		operationId: "deleteView",
		tag: "Databases",
		summary: "Delete a view",
		scope: "write",
		input: Schema.Struct({ dbId: DatabaseId, viewId: ViewId }),
		output: Schema.Struct({ deleted: Schema.Boolean }),
		checkPermission: databasePermission("editor"),
		run: (_, input) => Databases.deleteView(input.viewId).pipe(sqlDefect),
	}),
];

// ── Search + Trash ─────────────────────────────────────────────────────────────

const SearchResultJson = Schema.Struct(SearchResult.fields).annotate({
	identifier: "SearchResult",
});
const TrashContentsJson = Schema.Struct(TrashContents.fields).annotate({
	identifier: "TrashContents",
});

export const searchOperations = [
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/search",
		operationId: "search",
		tag: "Search",
		summary: "Full-text search",
		scope: "read",
		input: Schema.Struct({
			// Blank is refused, as before: it would only ever match nothing.
			q: SearchQuery.pipe(Schema.check(Schema.isPattern(/\S/))).annotate({
				description: "Search query",
			}),
		}),
		output: Schema.Array(SearchResultJson),
		run: (ctx, input) =>
			Effect.gen(function* () {
				const hits = yield* Search.globalSearch(input.q);
				const allPages = yield* Pages.listPages;
				const visible = yield* Permissions.filterPagesByPermission(
					ctx.userId,
					ctx.workspaceId,
					ctx.role,
					allPages,
				);
				const visibleIds = new Set(visible.map((p) => p.id));
				return hits.filter((r) =>
					visibleIds.has(r.type === "page" ? r.id : r.pageId),
				);
			}).pipe(sqlDefect),
	}),
];

export const trashOperations = [
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/trash",
		operationId: "listTrash",
		tag: "Trash",
		summary: "List trashed items",
		description:
			"Returns explicitly-trashed pages, databases and records, newest first. Restore via the corresponding `…/restore` endpoint, or purge with `DELETE …?permanent=true`.",
		scope: "read",
		input: Schema.Struct({}),
		output: TrashContentsJson,
		run: (ctx) =>
			Databases.listTrash(ctx.userId, ctx.workspaceId, ctx.role).pipe(
				sqlDefect,
			),
	}),
];

// ── Backlinks, templates, export ───────────────────────────────────────────────
//
// importNotion and exportAll have no operation: see rpc-parity.test.ts.

const BacklinkJson = Schema.Struct(Backlink.fields).annotate({
	identifier: "Backlink",
});
const TemplateJson = Schema.Struct({
	id: Schema.String,
	title: Schema.String,
	icon: Schema.String,
	description: Schema.String,
}).annotate({ identifier: "Template" });
const PageExportJson = Schema.Struct(PageExport.fields).annotate({
	identifier: "PageExport",
});
const DatabaseCsvExportJson = Schema.Struct(DatabaseCsvExport.fields).annotate({
	identifier: "DatabaseCsvExport",
});

export const exchangeOperations = [
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/backlinks",
		operationId: "getBacklinks",
		tag: "Pages",
		summary: "List the blocks that link to a page",
		description: "Only blocks on pages the caller can see are returned.",
		scope: "read",
		input: Schema.Struct({ pageId: PageId }),
		output: Schema.Array(BacklinkJson),
		checkPermission: pagePermission("viewer"),
		run: (ctx, input) =>
			Effect.gen(function* () {
				const all = yield* Blocks.getBacklinks(input.pageId);
				const allPages = yield* Pages.listPages;
				const visible = yield* Permissions.filterPagesByPermission(
					ctx.userId,
					ctx.workspaceId,
					ctx.role,
					allPages,
				);
				const visibleIds = new Set(visible.map((p) => p.id));
				return all.filter((b) => visibleIds.has(b.pageId));
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/templates/:templateId/pages",
		operationId: "createPageFromTemplate",
		placesPage: true,
		tag: "Templates",
		summary: "Create a page from a template",
		description: "Use an `id` from `listTemplates` as `templateId`.",
		successStatus: 201,
		scope: "write",
		input: Schema.Struct({
			templateId: Schema.String,
			parentId: Schema.optional(Schema.NullOr(Schema.String)),
		}),
		output: PageJson,
		run: (_, { templateId, parentId }) =>
			Templates.createPageFromTemplate({
				templateId,
				parentId: parentId ?? null,
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/export",
		operationId: "exportPage",
		tag: "Pages",
		summary: "Export a page as Markdown",
		description:
			"Returns the Markdown in the JSON body. With `includeDatabases=true`, the page's inline databases are appended as CSV blocks.",
		scope: "read",
		input: Schema.Struct({
			pageId: PageId,
			includeDatabases: Schema.optional(Schema.Literals(["true", "false"])),
		}),
		output: PageExportJson,
		checkPermission: pagePermission("viewer"),
		run: (_, input) =>
			ImportExport.exportPage(
				input.pageId,
				input.includeDatabases === "true",
			).pipe(sqlDefect),
	}),
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/databases/:dbId/export",
		operationId: "exportDatabase",
		tag: "Databases",
		summary: "Export a database as CSV",
		description: "Returns the CSV text in the JSON body.",
		scope: "read",
		input: Schema.Struct({ dbId: DatabaseId }),
		output: DatabaseCsvExportJson,
		checkPermission: databasePermission("viewer"),
		run: (_, input) => ImportExport.exportDatabase(input.dbId).pipe(sqlDefect),
	}),
];

// ── Workspaces ─────────────────────────────────────────────────────────────────

const WorkspaceJson = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	slug: Schema.String,
	role: Schema.Literals(["owner", "member"]),
}).annotate({ identifier: "Workspace" });

const listWorkspaces: UserOperation<
	Record<string, never>,
	ReadonlyArray<typeof WorkspaceJson.Type>
> = {
	workspace: "none",
	method: "GET",
	path: "/api/v1/workspaces",
	operationId: "listWorkspaces",
	tag: "Workspaces",
	summary: "List workspaces",
	description:
		"Returns the workspaces the authenticated user belongs to. Use an `id` from here as `workspaceId` everywhere else.",
	scope: "read",
	input: Schema.Struct({}),
	output: Schema.Array(WorkspaceJson),
	run: (ctx) =>
		Workspaces.getMyWorkspaces(ctx.userId).pipe(
			Effect.map((ws) =>
				ws.map(({ id, name, slug, role }) => ({ id, name, slug, role })),
			),
		),
};

const listTemplates: UserOperation<
	Record<string, never>,
	ReadonlyArray<typeof TemplateJson.Type>
> = {
	workspace: "none",
	method: "GET",
	path: "/api/v1/templates",
	operationId: "listTemplates",
	tag: "Templates",
	summary: "List page templates",
	description:
		"The built-in catalogue, the same for every workspace. Use an `id` as `templateId` in `createPageFromTemplate`.",
	scope: "read",
	input: Schema.Struct({}),
	output: Schema.Array(TemplateJson),
	run: () => Effect.succeed(Templates.getTemplates()),
};

// ── Members, invites and sharing ───────────────────────────────────────────────
//
// Admin actions run the RPC's own handlers and checks for the key's owner: the
// role comes from `ctx.role` (the workspace membership of the key's creator),
// the page ACL from Permissions, exactly as the session path reads them. An
// API key never gets more than the person who made it.
//
// Secrets: only what the RPC already hands the same caller comes back (the
// regenerated invite token to an owner, a page's share token to an editor).
// `inviteMemberByEmail` returns nothing: the invite link goes by mail only.

const WorkspaceMemberJson = Schema.Struct(WorkspaceMember.fields).annotate({
	identifier: "WorkspaceMember",
});
const PagePermissionsJson = Schema.Struct(PagePermissions.fields).annotate({
	identifier: "PagePermissions",
});
const ShareJson = Schema.Struct({
	token: Schema.NullOr(Schema.String).annotate({
		description:
			"The public share token, or null when the page is not published. The public URL is `<origin>/p/<token>`.",
	}),
}).annotate({ identifier: "PageShare" });

/** Workspace-wide, so no business of a key limited to a subtree. */
const unscopedOnly = (ctx: OperationContext) =>
	ctx.rootPageId === null ? Effect.void : Effect.fail(OUTSIDE_SUBTREE);

/** The workspace owner, as `requireWorkspaceOwner` demands in the RPC. */
const ownerOnly = (ctx: OperationContext) =>
	ctx.rootPageId !== null
		? Effect.fail(OUTSIDE_SUBTREE)
		: ctx.role === "owner"
			? Effect.void
			: Effect.fail(
					new AuthError({
						status: 403,
						message: "Workspace owner role required",
					}),
				);

export const memberOperations = [
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/members",
		operationId: "getWorkspaceMembers",
		tag: "Members",
		summary: "List workspace members",
		scope: "read",
		input: Schema.Struct({}),
		output: Schema.Array(WorkspaceMemberJson),
		checkPermission: unscopedOnly,
		run: (ctx) =>
			Workspaces.getWorkspaceMembers(ctx.workspaceId).pipe(sqlDefect),
	}),
	typedOperation({
		method: "DELETE",
		path: "/api/v1/workspaces/:workspaceId/members/:userId",
		operationId: "removeMember",
		tag: "Members",
		summary: "Remove a member",
		description: "Owner only. The workspace owner cannot be removed.",
		successStatus: 204,
		scope: "write",
		input: Schema.Struct({ userId: Schema.String }),
		output: Schema.Void,
		checkPermission: ownerOnly,
		run: (ctx, input) =>
			Workspaces.removeMember({
				workspaceId: ctx.workspaceId,
				userId: input.userId,
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/invites/email",
		operationId: "inviteMemberByEmail",
		tag: "Members",
		summary: "Invite someone by email",
		description:
			"Owner only. Mails the workspace invite link to the address; the link is not returned.",
		successStatus: 204,
		scope: "write",
		input: Schema.Struct({ email: Email }),
		output: Schema.Void,
		checkPermission: ownerOnly,
		run: (ctx, input) =>
			Workspaces.inviteMemberByEmail({
				workspaceId: ctx.workspaceId,
				email: input.email,
			}).pipe(sqlDefect),
	}),
	typedOperation({
		method: "POST",
		path: "/api/v1/workspaces/:workspaceId/invites/link",
		operationId: "regenerateInviteLink",
		tag: "Members",
		summary: "Regenerate the invite link",
		description:
			"Owner only. Invalidates the previous invite link and returns the new token (`<origin>/join/<token>`).",
		scope: "write",
		input: Schema.Struct({}),
		output: Schema.Struct({ inviteToken: Schema.String }),
		checkPermission: ownerOnly,
		run: (ctx) =>
			Workspaces.regenerateInviteLink(ctx.workspaceId).pipe(sqlDefect),
	}),
];

export const sharingOperations = [
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/share",
		operationId: "getPageShare",
		tag: "Sharing",
		summary: "Get a page's public share token",
		description: "Needs editor access to the page, as in the app.",
		scope: "read",
		input: Schema.Struct({ pageId: PageId }),
		output: ShareJson,
		checkPermission: pagePermission("editor"),
		run: (ctx, input) =>
			PageShares.get(ctx.workspaceId, input.pageId).pipe(
				Effect.map((token) => ({ token })),
				sqlDefect,
			),
	}),
	typedOperation({
		method: "PUT",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/share",
		operationId: "setPageSharing",
		tag: "Sharing",
		summary: "Publish or unpublish a page",
		description:
			"`enabled: true` publishes the page as a read-only public link (idempotent); `false` revokes it. Needs editor access to the page.",
		scope: "write",
		input: Schema.Struct({ pageId: PageId, enabled: Schema.Boolean }),
		output: ShareJson,
		checkPermission: pagePermission("editor"),
		run: (ctx, input) =>
			(input.enabled
				? PageShares.enable(ctx.workspaceId, input.pageId, ctx.userId)
				: PageShares.disable(ctx.workspaceId, input.pageId).pipe(
						Effect.as<string | null>(null),
					)
			).pipe(
				Effect.map((token) => ({ token })),
				sqlDefect,
			),
	}),
	typedOperation({
		method: "GET",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/permissions",
		operationId: "getPagePermissions",
		tag: "Sharing",
		summary: "Get a page's access list",
		description:
			"Direct grants, plus those inherited from the nearest locked ancestor, and a revision for `writePagePermissions`.",
		scope: "read",
		input: Schema.Struct({ pageId: PageId }),
		output: PagePermissionsJson,
		checkPermission: pagePermission("viewer"),
		run: (_, input) =>
			Permissions.getPagePermissions(input.pageId).pipe(sqlDefect),
	}),
	typedOperation({
		method: "PUT",
		path: "/api/v1/workspaces/:workspaceId/pages/:pageId/permissions",
		operationId: "writePagePermissions",
		tag: "Sharing",
		summary: "Change a page's access list",
		description:
			"Atomic batch of `set` upserts and `remove`s. Needs owner access to the page. `ifRevision` fails the call when the list changed since `getPagePermissions`.",
		scope: "write",
		input: Schema.Struct({
			pageId: PageId,
			set: Schema.Array(
				Schema.Struct({ subject: Subject, relation: AclRelation }),
			),
			remove: Schema.Array(Schema.Struct({ subject: Subject })),
			ifRevision: Schema.optional(AclRevision),
		}),
		output: Schema.Struct({ revision: AclRevision }),
		checkPermission: pagePermission("owner"),
		run: (ctx, { pageId, set, remove, ifRevision }) =>
			Permissions.writePagePermissions({
				pageId,
				set,
				remove,
				ifRevision,
				callerWorkspaceRole: ctx.role,
			}).pipe(sqlDefect),
	}),
];

/** Every typed operation, in registration/OpenAPI order. */
export const typedOperations: ReadonlyArray<AnyOperation> = [
	listWorkspaces,
	listTemplates,
	...pageOperations,
	...databaseOperations,
	...blockOperations,
	...searchOperations,
	...trashOperations,
	...exchangeOperations,
	...memberOperations,
	...sharingOperations,
];

/** Membership, then `f` under one acquisition of the workspace's layer. */
const withWorkspace = <A, E, R>(
	caller: Caller,
	workspaceId: string,
	f: (ctx: OperationContext) => Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const { userId, rootPageId } = caller;
		const role = yield* requireWorkspaceMember(workspaceId, userId);
		const wdb = yield* WorkspaceDb;
		// The subtree a key is limited to is enforced from here: acl.ts reads
		// KeyRoot for every page check and permissions.ts for every page list.
		return yield* Effect.provide(
			f({ userId, workspaceId, role, rootPageId, editor: editorOf(caller) }),
			wdb.getLayer(workspaceId),
		).pipe(Effect.provideService(KeyRoot, rootPageId));
	});

/** Who is calling: the user and, for a key limited to a subtree, its root. */
export interface Caller {
	readonly userId: string;
	readonly rootPageId: string | null;
	/** Set for an API key; stamped on writes as `updated_by_key_*` (ADR-013). */
	readonly keyId?: string | null;
	readonly keyName?: string;
}

const OUTSIDE_SUBTREE = new AuthError({
	status: 403,
	message: "This API key is limited to one page subtree.",
});

/**
 * An operation declaring `placesPage` puts a page under its `parentId`: the key must reach
 * that parent, and a top-level placement (null) is outside any subtree. The
 * only input a page ACL check does not already cover.
 */
const requireParentInSubtree = (
	ctx: OperationContext,
	hasParent: boolean,
	input: Record<string, unknown>,
) =>
	ctx.rootPageId === null || !hasParent
		? Effect.void
		: typeof input.parentId === "string"
			? inSubtree(ctx.rootPageId, input.parentId).pipe(
					Effect.flatMap((ok) =>
						ok ? Effect.void : Effect.fail(OUTSIDE_SUBTREE),
					),
				)
			: Effect.fail(OUTSIDE_SUBTREE);

/**
 * Runs one typed operation for a caller already resolved by its door: the
 * membership check, `input`, the permission check and `run`, all under one
 * workspace-layer acquisition. Every door goes through here, so none can skip
 * a check another makes. `input` is an effect so a door that decodes late
 * (REST) still refuses a non-member before it says anything about the input.
 * A user-level operation skips the workspace part: it has none to check.
 */
export const runOperation = <I, O, E, R>(
	op: TypedOperation<I, O> | UserOperation<I, O>,
	caller: Caller,
	workspaceId: Effect.Effect<string, E, R>,
	input: Effect.Effect<I, ValidationError>,
) =>
	"workspace" in op
		? Effect.flatMap(input, (decoded) =>
				op.run({ userId: caller.userId }, decoded),
			)
		: Effect.flatMap(workspaceId, (id) =>
				withWorkspace(caller, id, (ctx) =>
					Effect.gen(function* () {
						const decoded = yield* input;
						yield* requireParentInSubtree(
							ctx,
							op.placesPage === true,
							decoded as Record<string, unknown>,
						);
						if (op.checkPermission) yield* op.checkPermission(ctx, decoded);
						return yield* op.run(ctx, decoded);
					}),
				),
			);

/** GET and DELETE carry their non-path input in the query; the rest in the body. */
const inQuery = (method: AnyOperation["method"]) =>
	method === "GET" || method === "DELETE";

/** The JSON body as an object; an absent body is an empty one. */
const bodyObject = Effect.gen(function* () {
	const req = yield* HttpServerRequest.HttpServerRequest;
	const text = yield* req.text;
	if (text.trim() === "") return {};
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return yield* Effect.fail(
			new ApiError({ status: 400, message: "Invalid JSON body" }),
		);
	}
	if (typeof body !== "object" || body === null || Array.isArray(body))
		return yield* Effect.fail(
			new ValidationError({ message: "Request body must be a JSON object" }),
		);
	return body as Record<string, unknown>;
});

/**
 * The REST door for typed operations: path params, then query or body, are
 * decoded into `input` once; `output` is encoded; a declared failure keeps its
 * status (ValidationError is 422 here), anything else is a reported 500.
 */
export const registerTypedOperations = (
	router: typeof HttpRouter.HttpRouter.Service,
	operations: ReadonlyArray<AnyOperation>,
) =>
	Effect.forEach(operations, (op) =>
		router.add(
			op.method,
			op.path,
			handle(
				Effect.gen(function* () {
					// Who is calling comes first: a stranger learns nothing, not even
					// that their body was malformed.
					const caller = yield* resolveApiUser;
					yield* enforceScope(caller.scope, op.scope);
					const req = yield* HttpServerRequest.HttpServerRequest;
					const rest = inQuery(op.method)
						? Object.fromEntries(new URL(req.url, "http://x").searchParams)
						: yield* bodyObject;
					const { workspaceId, ...pathParams } = yield* HttpRouter.params;
					const output = yield* runOperation(
						op,
						{
							userId: caller.userId,
							rootPageId: caller.rootPageId ?? null,
							keyId: caller.keyId,
							keyName: caller.keyName,
						},
						requireParam({ workspaceId }, "workspaceId"),
						Schema.decodeUnknownEffect(op.input)({
							...rest,
							...pathParams,
						}).pipe(
							Effect.mapError(
								(e) => new ValidationError({ message: e.message }),
							),
						),
					);
					const encoded = yield* Schema.encodeUnknownEffect(op.output)(
						output,
					).pipe(Effect.orDie);
					if (op.successStatus === 204) return noContent();
					return op.successStatus === 201 ? created(encoded) : ok(encoded);
				}).pipe(
					Effect.catchTag("ValidationError", (e) =>
						Effect.fail(new ApiError({ status: 422, message: e.message })),
					),
				),
			),
		),
	);

/**
 * The OpenAPI `paths` and component schemas for typed operations, generated
 * from the Schemas the REST door decodes and encodes with — so the document
 * describes what the server accepts, not what someone wrote down.
 */
export const typedOperationsOpenApi = (
	operations: ReadonlyArray<AnyOperation>,
	wsParam: object,
) => {
	const split = operations.map((op) => {
		const pathNames = [...op.path.matchAll(/:([a-zA-Z]+)/g)]
			.map((m) => m[1])
			.filter((name) => name !== "workspaceId");
		const pick = (inPath: boolean) =>
			Schema.Struct(
				Object.fromEntries(
					Object.entries(op.input.fields).filter(
						([name]) => pathNames.includes(name) === inPath,
					),
				),
			);
		return [pick(true).ast, pick(false).ast, op.output.ast];
	});
	const generated = JsonSchema.toMultiDocumentOpenApi3_1(
		SchemaRepresentation.toJsonSchemaMultiDocument(
			SchemaRepresentation.toRepresentations(
				split.flat() as [SchemaAST.AST, ...SchemaAST.AST[]],
			),
		),
	);

	type ObjectSchema = {
		properties?: Record<string, object>;
		required?: string[];
	};
	const asParams = (schema: ObjectSchema, where: "path" | "query") =>
		Object.entries(schema.properties ?? {}).map(([name, s]) => ({
			name,
			in: where,
			required: schema.required?.includes(name) ?? false,
			schema: s,
		}));

	const paths: Record<string, Record<string, unknown>> = {};
	operations.forEach((op, i) => {
		const [pathSchema, restSchema, outputSchema] = generated.schemas.slice(
			i * 3,
			i * 3 + 3,
		) as [ObjectSchema, ObjectSchema, object];
		const docPath = op.path
			.replace("/api/v1", "")
			.replace(/:([a-zA-Z]+)/g, "{$1}");
		const status = op.successStatus ?? 200;
		const hasRest = Object.keys(restSchema.properties ?? {}).length > 0;
		paths[docPath] ??= {
			parameters: [
				...("workspace" in op ? [] : [wsParam]),
				...asParams(pathSchema, "path"),
			],
		};
		paths[docPath][op.method.toLowerCase()] = {
			tags: [op.tag],
			operationId: op.operationId,
			summary: op.summary,
			...(op.description ? { description: op.description } : {}),
			...(hasRest && inQuery(op.method)
				? { parameters: asParams(restSchema, "query") }
				: {}),
			...(hasRest && !inQuery(op.method)
				? {
						requestBody: {
							required: true,
							content: { "application/json": { schema: restSchema } },
						},
					}
				: {}),
			responses: {
				[status]:
					status === 204
						? { description: "No content" }
						: jsonResponse("Success", outputSchema),
				...errorResponses,
			},
		};
	});
	return { paths, schemas: generated.definitions };
};
