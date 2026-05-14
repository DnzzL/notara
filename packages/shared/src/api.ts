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
    payload: { id: Schema.String, title: Schema.String },
    success: Page,
  }),
  Rpc.make("deletePage", {
    payload: { id: Schema.String },
    success: Schema.Void,
  }),
  Rpc.make("searchPages", {
    payload: { query: Schema.String },
    success: Schema.Array(Page),
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
      type: Schema.Literal("text", "number", "select", "multiSelect", "date", "checkbox", "relation"),
      options: Schema.NullOr(Schema.Array(Schema.String)),
      relationTargetDbId: Schema.NullOr(Schema.String),
    },
    success: DatabaseField,
  }),
  Rpc.make("listRecords", {
    payload: { databaseId: Schema.String },
    success: Schema.Array(DatabaseRecord),
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
      options: Schema.NullOr(Schema.Array(Schema.String)),
    },
    success: DatabaseField,
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
  Rpc.make("deleteField", {
    payload: { id: Schema.String },
    success: Schema.Struct({ deleted: Schema.Boolean }),
  }),
);

// Export the type for client use
export type AppRpc = typeof AppRpc;