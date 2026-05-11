import { Effect, Layer } from "effect";
import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import * as RpcServer from "@effect/rpc/RpcServer";
import * as RpcSerialization from "@effect/rpc/RpcSerialization";
import { SqliteLive, runMigrations } from "./db.js";
import * as Pages from "./handlers/pages.js";
import * as Blocks from "./handlers/blocks.js";
import * as Databases from "./handlers/databases.js";
import { AppRpc } from "@notion-alt/shared";
import { createServer } from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";

// Static file paths
const possibleDistPaths = [
  path.join(process.cwd(), "packages/app/dist"),
  path.join(process.cwd(), "app/dist"),
  "/app/packages/app/dist",
];

let appDist: string | null = null;
for (const p of possibleDistPaths) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
    appDist = p;
    break;
  }
}

if (appDist) {
  console.log("Serving static files from:", appDist);
} else {
  console.log("No frontend dist found - API only mode");
}

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Static file handler as an Effect
const staticFilesRoute = Effect.gen(function* () {
  const router = yield* HttpLayerRouter.HttpRouter;
  
  if (!appDist) return;
  
  yield* router.add("GET", "/*", Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    let urlPath = request.url.split("?")[0];
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

    let filePath = path.join(appDist!, urlPath);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(appDist!, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      return HttpServerResponse.text("Not found", { status: 404 });
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const content = fs.readFileSync(filePath);

    return HttpServerResponse.uint8Array(new Uint8Array(content), {
      headers: { "Content-Type": contentType },
    });
  }));
});

// Layer that adds static file routes
const StaticFilesLive = Layer.effectDiscard(staticFilesRoute);

// RPC handlers layer
const rpcHandlersLayer = AppRpc.toLayer({
  listPages: () => Pages.listPages.pipe(Effect.orDie),
  getPage: ({ id }) => Pages.getPage(id).pipe(Effect.orDie),
  createPage: (req) => Pages.createPage(req).pipe(Effect.orDie),
  updatePage: (req) => Pages.updatePage(req).pipe(Effect.orDie),
  deletePage: ({ id }) => Pages.deletePage(id).pipe(Effect.orDie),
  searchPages: ({ query }) => Pages.searchPages(query).pipe(Effect.orDie),

  listBlocks: ({ pageId }) => Blocks.listBlocks(pageId).pipe(Effect.orDie),
  createBlock: (req) => Blocks.createBlock(req).pipe(Effect.orDie),
  updateBlock: (req) => Blocks.updateBlock(req).pipe(Effect.orDie),
  deleteBlock: ({ id }) => Blocks.deleteBlock(id).pipe(Effect.orDie),
  reorderBlocks: ({ pageId, blockIds }) => Blocks.reorderBlocks(pageId, [...blockIds]).pipe(Effect.orDie),

  listDatabases: ({ pageId }) => Databases.listDatabases(pageId).pipe(Effect.orDie),
  getDatabase: ({ id }) => Databases.getDatabase(id).pipe(Effect.orDie),
  createDatabase: (req) => Databases.createDatabase(req).pipe(Effect.orDie),
  listFields: ({ databaseId }) => Databases.listFields(databaseId).pipe(Effect.orDie),
  createField: (req) => Databases.createField({
    databaseId: req.databaseId,
    name: req.name,
    type: req.type,
    options: req.options ? [...req.options] : null,
    relationTargetDbId: req.relationTargetDbId,
  }).pipe(Effect.orDie),
  listRecords: ({ databaseId }) => Databases.listRecords(databaseId).pipe(Effect.orDie),
  getRecordWithValues: ({ recordId }) => Databases.getRecordWithValues(recordId).pipe(Effect.orDie),
  createRecord: (req) => Databases.createRecord(req).pipe(Effect.orDie),
  updateFieldValue: (req) => Databases.updateFieldValue(req).pipe(Effect.orDie),
  deleteRecord: ({ id }) => Databases.deleteRecord(id).pipe(Effect.orDie),
  listViews: ({ databaseId }) => Databases.listViews(databaseId).pipe(Effect.orDie),
  createView: (req) => Databases.createView({
    databaseId: req.databaseId,
    name: req.name,
    type: req.type,
    groupByFieldId: req.groupByFieldId,
  }).pipe(Effect.orDie),
});

// Create RPC router layer
const RpcRouterLive = RpcServer.layerHttpRouter({
  group: AppRpc,
  path: "/api",
  protocol: "http",
});

// Combine all layers: RPC + static files + handlers + serialization + database
const AppLive = Layer.mergeAll(
  RpcRouterLive,
  StaticFilesLive,
).pipe(
  Layer.provide(rpcHandlersLayer),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(SqliteLive),
);

// Serve the app with HTTP server
const ServerLive = HttpLayerRouter.serve(AppLive).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
);

// Run migrations then start server
const program = Effect.gen(function* () {
  yield* runMigrations;
  yield* Effect.logInfo("Server running on http://localhost:3000");
});

// Server program - combine migrations with server layer
const main = program.pipe(
  Effect.provide(ServerLive),
);

NodeRuntime.runMain(main);
