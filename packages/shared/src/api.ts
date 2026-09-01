import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { ApiError } from "./errors.js";

// ── Validation-only primitives ────────────────────────────────────────────────
// Constrained string types used at RPC boundaries to bound payload sizes and
// reject obviously bad inputs without scattering checks across handlers. Decoded
// values are still plain strings; the constraints only affect input acceptance.

const TitleString = Schema.String.pipe(Schema.check(Schema.isMaxLength(500)));
const ShortName = Schema.String.pipe(
	Schema.check(Schema.isMinLength(1)),
	Schema.check(Schema.isMaxLength(120)),
);
const Slug = Schema.String.pipe(
	Schema.check(Schema.isPattern(/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/)),
);
const Email = Schema.String.pipe(
	Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
	Schema.check(Schema.isMaxLength(254)),
);
const SearchQuery = Schema.String.pipe(Schema.check(Schema.isMaxLength(500)));
const BlockContent = Schema.String.pipe(
	Schema.check(Schema.isMaxLength(1_048_576)),
);

import {
	AclRelation,
	AclRevision,
	ApiKey,
	ApiKeyCreated,
	ApiKeyScope,
	Backlink,
	Block,
	Database,
	DatabaseCsvExport,
	DatabaseField,
	DatabaseFieldType,
	DatabaseRecord,
	DatabaseView,
	ExportAllResult,
	ImportResult,
	Page,
	PageExport,
	PagePermissions,
	RecordFieldValue,
	SearchResult,
	Subject,
	TrashContents,
	Workspace,
	WorkspaceMember,
} from "./schema.js";

// Combined RPC group — all requests.
//
// Every method declares the same `error: ApiError` union rather than a per-method
// subset: each one runs behind the auth/workspace check, so each one can already
// fail with AuthError, and one shared contract keeps the server side to a single
// `dieUnlessApiError` step instead of 68 bespoke error lists.
export const AppRpc = RpcGroup.make(
	// Pages
	Rpc.make("listPages", {
		error: ApiError,
		success: Schema.Array(Page),
	}),
	Rpc.make("getPage", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Page,
	}),
	Rpc.make("createPage", {
		error: ApiError,
		payload: { title: TitleString, parentId: Schema.NullOr(Schema.String) },
		success: Page,
	}),
	Rpc.make("updatePage", {
		error: ApiError,
		payload: {
			id: Schema.String,
			title: Schema.optional(Schema.NullOr(TitleString)),
			icon: Schema.optional(Schema.NullOr(Schema.String)),
			coverUrl: Schema.optional(Schema.NullOr(Schema.String)),
			isFavorite: Schema.optional(Schema.NullOr(Schema.Boolean)),
		},
		success: Page,
	}),
	Rpc.make("deletePage", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Void,
	}),
	Rpc.make("globalSearch", {
		error: ApiError,
		payload: { query: SearchQuery },
		success: Schema.Array(SearchResult),
	}),
	Rpc.make("movePage", {
		error: ApiError,
		payload: { id: Schema.String, parentId: Schema.NullOr(Schema.String) },
		success: Page,
	}),
	Rpc.make("reorderPages", {
		error: ApiError,
		payload: {
			parentId: Schema.NullOr(Schema.String),
			pageIds: Schema.Array(Schema.String),
		},
		success: Schema.Struct({ reordered: Schema.Boolean }),
	}),

	// Blocks
	Rpc.make("listBlocks", {
		error: ApiError,
		payload: { pageId: Schema.String },
		success: Schema.Array(Block),
	}),
	Rpc.make("createBlock", {
		error: ApiError,
		payload: {
			pageId: Schema.String,
			type: Schema.String,
			content: BlockContent,
			index: Schema.Number,
			parentId: Schema.NullOr(Schema.String),
			/**
			 * The block's id, chosen by the caller.
			 *
			 * The editor needs the new block to exist — and to be focusable — on
			 * the keystroke, not a round-trip later: while it waited, the caret
			 * stayed in the old block and the next characters typed landed there.
			 * Naming the block up front is what lets the client render it
			 * immediately and reconcile afterwards. Omit it and the server
			 * assigns one, as before.
			 */
			id: Schema.optional(Schema.String),
		},
		success: Block,
	}),
	Rpc.make("updateBlock", {
		error: ApiError,
		payload: {
			id: Schema.String,
			content: BlockContent,
			type: Schema.optional(Schema.String),
		},
		success: Block,
	}),
	Rpc.make("deleteBlock", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Void,
	}),
	Rpc.make("reorderBlocks", {
		error: ApiError,
		payload: { pageId: Schema.String, blockIds: Schema.Array(Schema.String) },
		success: Schema.Array(Block),
	}),
	Rpc.make("getBacklinks", {
		error: ApiError,
		payload: { pageId: Schema.String },
		success: Schema.Array(Backlink),
	}),

	// Databases
	Rpc.make("listDatabases", {
		error: ApiError,
		payload: { pageId: Schema.String },
		success: Schema.Array(Database),
	}),
	Rpc.make("listAllDatabases", {
		error: ApiError,
		success: Schema.Array(Database),
	}),
	Rpc.make("getDatabase", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Database,
	}),
	Rpc.make("createDatabase", {
		error: ApiError,
		payload: { pageId: Schema.String, name: Schema.String },
		success: Database,
	}),
	Rpc.make("listFields", {
		error: ApiError,
		payload: { databaseId: Schema.String },
		success: Schema.Array(DatabaseField),
	}),
	Rpc.make("createField", {
		error: ApiError,
		payload: {
			databaseId: Schema.String,
			name: Schema.String,
			type: DatabaseFieldType,
			options: Schema.NullOr(Schema.Array(Schema.String)),
			relationTargetDbId: Schema.NullOr(Schema.String),
			formula: Schema.optional(Schema.NullOr(Schema.String)),
			syncLinkedRow: Schema.optional(Schema.Boolean),
		},
		success: DatabaseField,
	}),
	Rpc.make("listRecords", {
		error: ApiError,
		payload: { databaseId: Schema.String },
		success: Schema.Array(DatabaseRecord),
	}),
	Rpc.make("listRecordsWithValues", {
		error: ApiError,
		payload: { databaseId: Schema.String },
		success: Schema.Array(
			Schema.Struct({
				record: DatabaseRecord,
				values: Schema.Record(Schema.String, Schema.Unknown),
			}),
		),
	}),
	Rpc.make("getRecordWithValues", {
		error: ApiError,
		payload: { recordId: Schema.String },
		success: Schema.Struct({
			record: DatabaseRecord,
			values: Schema.Record(Schema.String, Schema.Unknown),
		}),
	}),
	Rpc.make("createRecord", {
		error: ApiError,
		payload: { databaseId: Schema.String, title: Schema.String },
		success: DatabaseRecord,
	}),
	Rpc.make("updateFieldValue", {
		error: ApiError,
		payload: {
			recordId: Schema.String,
			fieldId: Schema.String,
			value: Schema.String,
		},
		success: RecordFieldValue,
	}),
	Rpc.make("deleteRecord", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Void,
	}),
	Rpc.make("listViews", {
		error: ApiError,
		payload: { databaseId: Schema.String },
		success: Schema.Array(DatabaseView),
	}),
	Rpc.make("createView", {
		error: ApiError,
		payload: {
			databaseId: Schema.String,
			name: Schema.String,
			type: Schema.Literals(["table", "board", "calendar"]),
			groupByFieldId: Schema.NullOr(Schema.String),
			config: Schema.optional(Schema.String),
			isDefault: Schema.optional(Schema.Boolean),
		},
		success: DatabaseView,
	}),
	Rpc.make("updateView", {
		error: ApiError,
		payload: {
			id: Schema.String,
			name: Schema.optional(Schema.String),
			type: Schema.optional(Schema.Literals(["table", "board", "calendar"])),
			groupByFieldId: Schema.optional(Schema.NullOr(Schema.String)),
			config: Schema.optional(Schema.String),
			isDefault: Schema.optional(Schema.Boolean),
		},
		success: DatabaseView,
	}),
	Rpc.make("deleteView", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Struct({ deleted: Schema.Boolean }),
	}),
	Rpc.make("updateField", {
		error: ApiError,
		payload: {
			id: Schema.String,
			name: Schema.optional(Schema.String),
			type: Schema.optional(DatabaseFieldType),
			options: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
			relationTargetDbId: Schema.optional(Schema.NullOr(Schema.String)),
			formula: Schema.optional(Schema.NullOr(Schema.String)),
			syncLinkedRow: Schema.optional(Schema.Boolean),
		},
		success: DatabaseField,
	}),
	Rpc.make("reorderFields", {
		error: ApiError,
		payload: {
			databaseId: Schema.String,
			fieldIds: Schema.Array(Schema.String),
		},
		success: Schema.Struct({ reordered: Schema.Boolean }),
	}),
	Rpc.make("updateRecord", {
		error: ApiError,
		payload: {
			id: Schema.String,
			title: Schema.optional(Schema.String),
			description: Schema.optional(Schema.String),
		},
		success: Schema.Struct({ updated: Schema.Boolean }),
	}),
	Rpc.make("reorderRecords", {
		error: ApiError,
		payload: {
			databaseId: Schema.String,
			recordIds: Schema.Array(Schema.String),
		},
		success: Schema.Struct({ reordered: Schema.Boolean }),
	}),
	Rpc.make("openRecordAsPage", {
		error: ApiError,
		payload: { recordId: Schema.String },
		success: Schema.Struct({ pageId: Schema.String }),
	}),
	Rpc.make("renameDatabase", {
		error: ApiError,
		payload: { id: Schema.String, name: Schema.String },
		success: Database,
	}),
	Rpc.make("updateDatabase", {
		error: ApiError,
		payload: {
			id: Schema.String,
			titleLabel: Schema.optional(Schema.String),
			titleHidden: Schema.optional(Schema.Boolean),
		},
		success: Database,
	}),
	Rpc.make("deleteField", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Struct({ deleted: Schema.Boolean }),
	}),
	Rpc.make("reorderDatabases", {
		error: ApiError,
		payload: {
			pageId: Schema.String,
			databaseIds: Schema.Array(Schema.String),
		},
		success: Schema.Struct({ reordered: Schema.Boolean }),
	}),
	Rpc.make("deleteDatabase", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Struct({ deleted: Schema.Boolean }),
	}),

	// Trash: restore / permanent purge / listing
	Rpc.make("listTrash", {
		error: ApiError,
		success: TrashContents,
	}),
	Rpc.make("restorePage", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Struct({ restored: Schema.Boolean }),
	}),
	Rpc.make("restoreDatabase", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Struct({ restored: Schema.Boolean }),
	}),
	Rpc.make("restoreRecord", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Struct({ restored: Schema.Boolean }),
	}),
	Rpc.make("purgePage", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Struct({ purged: Schema.Boolean }),
	}),
	Rpc.make("purgeDatabase", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Struct({ purged: Schema.Boolean }),
	}),
	Rpc.make("purgeRecord", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Struct({ purged: Schema.Boolean }),
	}),

	// Workspaces
	Rpc.make("getMyWorkspaces", {
		error: ApiError,
		success: Schema.Array(Workspace),
	}),
	Rpc.make("createWorkspace", {
		error: ApiError,
		payload: { name: ShortName, slug: Slug },
		success: Workspace,
	}),
	Rpc.make("joinWorkspaceByToken", {
		error: ApiError,
		payload: { inviteToken: Schema.String },
		success: Workspace,
	}),
	// Hosted-demo entry point. Rejected unless the server runs with DEMO_MODE=true.
	Rpc.make("startDemo", {
		error: ApiError,
		success: Workspace,
	}),
	Rpc.make("getWorkspaceMembers", {
		error: ApiError,
		payload: { workspaceId: Schema.String },
		success: Schema.Array(WorkspaceMember),
	}),
	Rpc.make("removeMember", {
		error: ApiError,
		payload: { workspaceId: Schema.String, userId: Schema.String },
		success: Schema.Void,
	}),
	Rpc.make("regenerateInviteLink", {
		error: ApiError,
		payload: { workspaceId: Schema.String },
		success: Schema.Struct({ inviteToken: Schema.String }),
	}),
	Rpc.make("inviteMemberByEmail", {
		error: ApiError,
		payload: { workspaceId: Schema.String, email: Email },
		success: Schema.Void,
	}),

	// API keys
	Rpc.make("listApiKeys", {
		error: ApiError,
		success: Schema.Array(ApiKey),
	}),
	Rpc.make("createApiKey", {
		error: ApiError,
		payload: { name: ShortName, scope: ApiKeyScope },
		success: ApiKeyCreated,
	}),
	Rpc.make("revokeApiKey", {
		error: ApiError,
		payload: { id: Schema.String },
		success: Schema.Void,
	}),

	// Page ACL (Zanzibar-style: structured subjects, atomic writes, revisions)
	//
	// Returns only the locked-page IDs the caller can actually see; safe for use
	// as a "which of my visible pages are restricted?" hint in the sidebar.
	Rpc.make("listLockedPageIds", {
		error: ApiError,
		success: Schema.Array(Schema.String),
	}),
	// Read direct grants on a page plus the inherited grants from the nearest
	// locked ancestor (if any), along with a revision token.
	// Public sharing is a capability, not a relation — see migration
	// platform/005. The token is returned bare; the client builds the URL, so
	// the server never has to know its own public origin.
	Rpc.make("getPageShare", {
		error: ApiError,
		payload: { pageId: Schema.String },
		success: Schema.NullOr(Schema.String),
	}),
	Rpc.make("setPageSharing", {
		error: ApiError,
		payload: { pageId: Schema.String, enabled: Schema.Boolean },
		success: Schema.NullOr(Schema.String),
	}),
	Rpc.make("getPagePermissions", {
		error: ApiError,
		payload: { pageId: Schema.String },
		success: PagePermissions,
	}),
	// Cheap UI-gating check. Never throws — returns { allowed: false } on deny.
	Rpc.make("checkPagePermission", {
		error: ApiError,
		payload: { pageId: Schema.String, relation: AclRelation },
		success: Schema.Struct({ allowed: Schema.Boolean }),
	}),
	// Atomic batched write: applies all `set` upserts and all `remove`s in a
	// single transaction. `ifRevision`, when provided, fails the call if the
	// page's current ACL revision differs (optimistic concurrency, à la zookie).
	Rpc.make("writePagePermissions", {
		error: ApiError,
		payload: {
			pageId: Schema.String,
			set: Schema.Array(
				Schema.Struct({ subject: Subject, relation: AclRelation }),
			),
			remove: Schema.Array(Schema.Struct({ subject: Subject })),
			ifRevision: Schema.optional(AclRevision),
		},
		success: Schema.Struct({ revision: AclRevision }),
	}),

	// Templates
	Rpc.make("listTemplates", {
		error: ApiError,
		success: Schema.Array(
			Schema.Struct({
				id: Schema.String,
				title: Schema.String,
				icon: Schema.String,
				description: Schema.String,
			}),
		),
	}),
	Rpc.make("createPageFromTemplate", {
		error: ApiError,
		payload: {
			templateId: Schema.String,
			parentId: Schema.NullOr(Schema.String),
		},
		success: Page,
	}),

	// Import/Export
	Rpc.make("importNotion", {
		error: ApiError,
		payload: { directory: Schema.String },
		success: ImportResult,
	}),
	Rpc.make("exportPage", {
		error: ApiError,
		payload: { pageId: Schema.String, includeDatabases: Schema.Boolean },
		success: PageExport,
	}),
	Rpc.make("exportDatabase", {
		error: ApiError,
		payload: { dbId: Schema.String },
		success: DatabaseCsvExport,
	}),
	Rpc.make("exportAll", {
		error: ApiError,
		payload: { outputDir: Schema.String },
		success: ExportAllResult,
	}),
);

// Export the type for client use
export type AppRpc = typeof AppRpc;
