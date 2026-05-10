import { Effect, Layer } from "effect";
import { RpcServer, RpcGroup } from "@effect/rpc";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { AppRpc } from "@notion-alt/shared";
import { runMigrations, makeSqliteLayer } from "./db.js";
import * as Pages from "./handlers/pages.js";
import * as Blocks from "./handlers/blocks.js";
import * as Databases from "./handlers/databases.js";

// Handler implementations mapped to RPC endpoints
const handlers = AppRpc.of({
  listPages: () => Pages.listPages,
  getPage: ({ id }) => Pages.getPage(id),
  createPage: (req) => Pages.createPage(req),
  updatePage: (req) => Pages.updatePage(req),
  deletePage: ({ id }) => Pages.deletePage(id),
  searchPages: ({ query }) => Pages.searchPages(query),

  listBlocks: ({ pageId }) => Blocks.listBlocks(pageId),
  createBlock: (req) => Blocks.createBlock(req),
  updateBlock: (req) => Blocks.updateBlock(req),
  deleteBlock: ({ id }) => Blocks.deleteBlock(id),
  reorderBlocks: ({ pageId, blockIds }) => Blocks.reorderBlocks(pageId, blockIds),

  listDatabases: ({ pageId }) => Databases.listDatabases(pageId),
  getDatabase: ({ id }) => Databases.getDatabase(id),
  createDatabase: (req) => Databases.createDatabase(req),
  listFields: ({ databaseId }) => Databases.listFields(databaseId),
  createField: (req) => Databases.createField(req),
  listRecords: ({ databaseId }) => Databases.listRecords(databaseId),
  getRecordWithValues: ({ recordId }) => Databases.getRecordWithValues(recordId),
  createRecord: (req) => Databases.createRecord(req),
  updateFieldValue: (req) => Databases.updateFieldValue(req),
  deleteRecord: ({ id }) => Databases.deleteRecord(id),
  listViews: ({ databaseId }) => Databases.listViews(databaseId),
  createView: (req) => Databases.createView(req),
});

// Layer that provides all RPC handler implementations
const HandlersLive = AppRpc.toLayer(handlers);

// Combined layer: handlers + SQLite
const ServerLayer = Layer.merge(HandlersLive, makeSqliteLayer());

// Main: run migrations, then start the Bun HTTP server
const main = Effect.gen(function* () {
  yield* runMigrations;

  // Create the RPC web handler
  const { handler, dispose } = RpcServer.toWebHandler(AppRpc, {
    layer: ServerLayer,
  });

  // Start Bun HTTP server
  const server = Bun.serve({
    port: 3000,
    fetch: handler,
  });

  console.log(`Server running on http://localhost:${server.port}/api`);

  // Handle graceful shutdown
  yield* Effect.acquireRelease(Effect.succeed(server), () =>
    Effect.sync(() => {
      server.stop();
      dispose();
    }),
  );
}).pipe(
  Effect.catchAllCause(Effect.logFatal),
);

// Run the server
main.pipe(Effect.runPromise);
