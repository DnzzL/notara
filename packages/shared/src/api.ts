import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import {
  Page,
  Block,
  Database,
  DatabaseField,
  DatabaseRecord,
  RecordFieldValue,
  DatabaseView,
  Backlink,
  SearchResult,
  PageExport,
  DatabaseCsvExport,
  ImportResult,
  ExportAllResult,
  Workspace,
  WorkspaceMember,
  ApiKey,
  ApiKeyCreated,
  AclRelation,
  AclRevision,
  Subject,
  PagePermissions,
} from "./schema.js";

// Combined RPC group — all requests
export const AppRpc = RpcGroup.make(
  // Pages
  Rpc.make("listPages", { success: Schema.Array(Page) }),
  Rpc.make("getPage", {
    payload: { id: Schema.String },
    success: Page,
  }),
  Rpc.make("createPage", {
    payload: { title: Schema.String, parentId: Schema.NullOr(Schema.String) },
    success: Page,
  }),
  Rpc.make("updatePage", {
    payload: {
      id: Schema.String,
      title: Schema.optional(Schema.NullOr(Schema.String)),
      icon: Schema.optional(Schema.NullOr(Schema.String)),
      coverUrl: Schema.optional(Schema.NullOr(Schema.String)),
      isFavorite: Schema.optional(Schema.NullOr(Schema.Boolean)),
    },
    success: Page,
  }),
  Rpc.make("deletePage", {
    payload: { id: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("globalSearch", {
    payload: { query: Schema.String },
    success: Schema.Array(SearchResult),
  }),
  Rpc.make("movePage", {
    payload: { id: Schema.String, parentId: Schema.NullOr(Schema.String) },
    success: Page,
  }),
  Rpc.make("reorderPages", {
    payload: {
      parentId: Schema.NullOr(Schema.String),
      pageIds: Schema.Array(Schema.String),
    },
    success: Schema.Struct({ reordered: Schema.Boolean }),
  }),

  // Blocks
  Rpc.make("listBlocks", {
    payload: { pageId: Schema.String },
    success: Schema.Array(Block),
  }),
  Rpc.make("createBlock", {
    payload: {
      pageId: Schema.String,
      type: Schema.String,
      content: Schema.String,
      index: Schema.Number,
      parentId: Schema.NullOr(Schema.String),
    },
    success: Block,
  }),
  Rpc.make("updateBlock", {
    payload: { id: Schema.String, content: Schema.String },
    success: Block,
  }),
  Rpc.make("deleteBlock", {
    payload: { id: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("reorderBlocks", {
    payload: { pageId: Schema.String, blockIds: Schema.Array(Schema.String) },
    success: Schema.Array(Block),
  }),
  Rpc.make("getBacklinks", {
    payload: { pageId: Schema.String },
    success: Schema.Array(Backlink),
  }),

  // Databases
  Rpc.make("listDatabases", {
    payload: { pageId: Schema.String },
    success: Schema.Array(Database),
  }),
  Rpc.make("listAllDatabases", { success: Schema.Array(Database) }),
  Rpc.make("getDatabase", {
    payload: { id: Schema.String },
    success: Database,
  }),
  Rpc.make("createDatabase", {
    payload: { pageId: Schema.String, name: Schema.String },
    success: Database,
  }),
  Rpc.make("listFields", {
    payload: { databaseId: Schema.String },
    success: Schema.Array(DatabaseField),
  }),
  Rpc.make("createField", {
    payload: {
      databaseId: Schema.String,
      name: Schema.String,
      type: Schema.Literal("text", "number", "select", "multiSelect", "date", "checkbox", "relation", "page"),
      options: Schema.NullOr(Schema.Array(Schema.String)),
      relationTargetDbId: Schema.NullOr(Schema.String),
    },
    success: DatabaseField,
  }),
  Rpc.make("listRecords", {
    payload: { databaseId: Schema.String },
    success: Schema.Array(DatabaseRecord),
  }),
  Rpc.make("listRecordsWithValues", {
    payload: { databaseId: Schema.String },
    success: Schema.Array(Schema.Struct({
      record: DatabaseRecord,
      values: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    })),
  }),
  Rpc.make("getRecordWithValues", {
    payload: { recordId: Schema.String },
    success: Schema.Struct({
      record: DatabaseRecord,
      values: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    }),
  }),
  Rpc.make("createRecord", {
    payload: { databaseId: Schema.String, title: Schema.String },
    success: DatabaseRecord,
  }),
  Rpc.make("updateFieldValue", {
    payload: { recordId: Schema.String, fieldId: Schema.String, value: Schema.String },
    success: RecordFieldValue,
  }),
  Rpc.make("deleteRecord", {
    payload: { id: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("listViews", {
    payload: { databaseId: Schema.String },
    success: Schema.Array(DatabaseView),
  }),
  Rpc.make("createView", {
    payload: {
      databaseId: Schema.String,
      name: Schema.String,
      type: Schema.Literal("table", "board"),
      groupByFieldId: Schema.NullOr(Schema.String),
    },
    success: DatabaseView,
  }),
  Rpc.make("updateField", {
    payload: {
      id: Schema.String,
      name: Schema.optional(Schema.String),
      type: Schema.optional(Schema.Literal("text", "number", "select", "multiSelect", "date", "checkbox", "relation", "page")),
      options: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
      relationTargetDbId: Schema.optional(Schema.NullOr(Schema.String)),
    },
    success: DatabaseField,
  }),
  Rpc.make("updateRecord", {
    payload: {
      id: Schema.String,
      title: Schema.optional(Schema.String),
      description: Schema.optional(Schema.String),
    },
    success: Schema.Struct({ updated: Schema.Boolean }),
  }),
  Rpc.make("reorderRecords", {
    payload: {
      databaseId: Schema.String,
      recordIds: Schema.Array(Schema.String),
    },
    success: Schema.Struct({ reordered: Schema.Boolean }),
  }),
  Rpc.make("renameDatabase", {
    payload: { id: Schema.String, name: Schema.String },
    success: Database,
  }),
  Rpc.make("updateDatabase", {
    payload: {
      id: Schema.String,
      titleLabel: Schema.optional(Schema.String),
      titleHidden: Schema.optional(Schema.Boolean),
    },
    success: Database,
  }),
  Rpc.make("deleteField", {
    payload: { id: Schema.String },
    success: Schema.Struct({ deleted: Schema.Boolean }),
  }),
  Rpc.make("reorderDatabases", {
    payload: { pageId: Schema.String, databaseIds: Schema.Array(Schema.String) },
    success: Schema.Struct({ reordered: Schema.Boolean }),
  }),

  // Workspaces
  Rpc.make("getMyWorkspaces", { success: Schema.Array(Workspace) }),
  Rpc.make("createWorkspace", {
    payload: { name: Schema.String, slug: Schema.String },
    success: Workspace,
  }),
  Rpc.make("joinWorkspaceByToken", {
    payload: { inviteToken: Schema.String },
    success: Workspace,
  }),
  Rpc.make("getWorkspaceMembers", {
    payload: { workspaceId: Schema.String },
    success: Schema.Array(WorkspaceMember),
  }),
  Rpc.make("removeMember", {
    payload: { workspaceId: Schema.String, userId: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("regenerateInviteLink", {
    payload: { workspaceId: Schema.String },
    success: Schema.Struct({ inviteToken: Schema.String }),
  }),
  Rpc.make("inviteMemberByEmail", {
    payload: { workspaceId: Schema.String, email: Schema.String },
    success: Schema.Void,
  }),

  // API keys
  Rpc.make("listApiKeys", { success: Schema.Array(ApiKey) }),
  Rpc.make("createApiKey", {
    payload: { name: Schema.String },
    success: ApiKeyCreated,
  }),
  Rpc.make("revokeApiKey", {
    payload: { id: Schema.String },
    success: Schema.Void,
  }),

  // Page ACL (Zanzibar-style: structured subjects, atomic writes, revisions)
  //
  // Returns only the locked-page IDs the caller can actually see; safe for use
  // as a "which of my visible pages are restricted?" hint in the sidebar.
  Rpc.make("listLockedPageIds", {
    success: Schema.Array(Schema.String),
  }),
  // Read direct grants on a page plus the inherited grants from the nearest
  // locked ancestor (if any), along with a revision token.
  Rpc.make("getPagePermissions", {
    payload: { pageId: Schema.String },
    success: PagePermissions,
  }),
  // Cheap UI-gating check. Never throws — returns { allowed: false } on deny.
  Rpc.make("checkPagePermission", {
    payload: { pageId: Schema.String, relation: AclRelation },
    success: Schema.Struct({ allowed: Schema.Boolean }),
  }),
  // Atomic batched write: applies all `set` upserts and all `remove`s in a
  // single transaction. `ifRevision`, when provided, fails the call if the
  // page's current ACL revision differs (optimistic concurrency, à la zookie).
  Rpc.make("writePagePermissions", {
    payload: {
      pageId: Schema.String,
      set: Schema.Array(Schema.Struct({ subject: Subject, relation: AclRelation })),
      remove: Schema.Array(Schema.Struct({ subject: Subject })),
      ifRevision: Schema.optional(AclRevision),
    },
    success: Schema.Struct({ revision: AclRevision }),
  }),

  // Import/Export
  Rpc.make("importNotion", {
    payload: { directory: Schema.String },
    success: ImportResult,
  }),
  Rpc.make("exportPage", {
    payload: { pageId: Schema.String, includeDatabases: Schema.Boolean },
    success: PageExport,
  }),
  Rpc.make("exportDatabase", {
    payload: { dbId: Schema.String },
    success: DatabaseCsvExport,
  }),
  Rpc.make("exportAll", {
    payload: { outputDir: Schema.String },
    success: ExportAllResult,
  }),
);

// Export the type for client use
export type AppRpc = typeof AppRpc;