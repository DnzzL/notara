import { Effect, Layer, pipe } from "effect";
import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter";
import * as HttpRouter from "@effect/platform/HttpRouter";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import * as RpcServer from "@effect/rpc/RpcServer";
import * as RpcSerialization from "@effect/rpc/RpcSerialization";
import { SqliteLive, runMigrations } from "./db.js";
import * as Pages from "./handlers/pages.js";
import * as Blocks from "./handlers/blocks.js";
import * as Databases from "./handlers/databases.js";
import * as Search from "./handlers/search.js";
import * as ImportExport from "./handlers/importExport.js";
import * as Upload from "./handlers/upload.js";
import { AppRpc, RecordFieldValue } from "@notion-alt/shared";
import { createServer } from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, "../..");

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

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Static file handler + import upload route as an Effect
const staticFilesRoute = Effect.gen(function* () {
  const router = yield* HttpLayerRouter.HttpRouter;

  // Health check
  yield* router.add("GET", "/health", Effect.succeed(
    HttpServerResponse.text("ok", { status: 200 })
  ));

  // Handle CORS preflight
  yield* router.add("OPTIONS", "/*", Effect.succeed(
    HttpServerResponse.empty({ status: 204, headers: corsHeaders })
  ));

  // Import upload route
  yield* router.add("POST", "/import-notion", Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;

    const ab = yield* request.arrayBuffer;
    const buffer = Buffer.from(ab);

    if (buffer.length === 0) {
      return HttpServerResponse.text(JSON.stringify({ error: "Empty request body" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const cd = request.headers["content-disposition"] || "";
    const filenameMatch = cd.match(/filename="([^"]+)"/);
    const fileName = filenameMatch ? filenameMatch[1] : "notion-export.zip";

    const result = yield* ImportExport.importNotionZip(buffer, fileName).pipe(
      Effect.provide(SqliteLive)
    );

    return HttpServerResponse.text(JSON.stringify({
      pagesImported: result.pagesImported,
      databasesImported: result.databasesImported,
    }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail"
        ? String(cause.error)
        : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  ));

  // File upload route. Client sends raw bytes; metadata travels in headers.
  // Headers: X-Page-Id, X-File-Name (URL-encoded), Content-Type (MIME).
  yield* router.add("POST", "/api/upload", Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const pageId = request.headers["x-page-id"];
    const fileNameRaw = request.headers["x-file-name"];
    const mimeType = request.headers["content-type"] || "application/octet-stream";

    if (!pageId || !fileNameRaw) {
      return HttpServerResponse.text(
        JSON.stringify({ error: "Missing X-Page-Id or X-File-Name header" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const fileName = decodeURIComponent(fileNameRaw);
    const ab = yield* request.arrayBuffer;
    const fileBuffer = Buffer.from(ab);

    if (fileBuffer.length === 0) {
      return HttpServerResponse.text(
        JSON.stringify({ error: "Empty file body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = yield* Upload.uploadFile({ pageId, fileName, mimeType, fileBuffer }).pipe(
      Effect.provide(SqliteLive)
    );

    return HttpServerResponse.text(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail" ? String(cause.error) : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  ));

  // Attachment serving route
  yield* router.add("GET", "/attachments/:fileName", Effect.gen(function* () {
    const params = yield* HttpRouter.params;
    const fileName = params["fileName"] as string | undefined;

    if (!fileName) {
      return HttpServerResponse.text("Not found", { status: 404, headers: corsHeaders });
    }

    const dataDir = process.env.DATA_DIR
      ? path.join(process.env.DATA_DIR, "attachments")
      : path.join(rootDir, ".data", "attachments");
    const filePath = path.join(dataDir, fileName);

    if (!fs.existsSync(filePath)) {
      return HttpServerResponse.text("Not found", { status: 404, headers: corsHeaders });
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const content = fs.readFileSync(filePath);

    return HttpServerResponse.uint8Array(new Uint8Array(content), {
      headers: { "Content-Type": contentType, ...corsHeaders },
    });
  }));

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
      return HttpServerResponse.text("Not found", { status: 404, headers: corsHeaders });
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const content = fs.readFileSync(filePath);

    return HttpServerResponse.uint8Array(new Uint8Array(content), {
      headers: { "Content-Type": contentType, ...corsHeaders },
    });
  }));
});

// Layer that adds static file routes + import upload
const StaticFilesLive = Layer.effectDiscard(staticFilesRoute);

// RPC handlers layer
const rpcHandlersLayer = AppRpc.toLayer({
  listPages: () => Pages.listPages.pipe(Effect.orDie),
  getPage: ({ id }) => Pages.getPage(id).pipe(Effect.orDie),
  createPage: (req) => Pages.createPage(req).pipe(Effect.orDie),
  updatePage: (req) => Pages.updatePage(req).pipe(Effect.orDie),
  deletePage: ({ id }) => Pages.deletePage(id).pipe(Effect.orDie),
  globalSearch: ({ query }) => Search.globalSearch(query).pipe(Effect.orDie),
  movePage: (req) => Pages.movePage(req).pipe(Effect.orDie),
  reorderPages: ({ parentId, pageIds }) => Pages.reorderPages({ parentId, pageIds: [...pageIds] }).pipe(Effect.orDie),

  listBlocks: ({ pageId }) => Blocks.listBlocks(pageId).pipe(Effect.orDie),
  createBlock: (req) => Blocks.createBlock(req).pipe(Effect.orDie),
  updateBlock: (req) => Blocks.updateBlock(req).pipe(Effect.orDie),
  deleteBlock: ({ id }) => Blocks.deleteBlock(id).pipe(Effect.orDie),
  reorderBlocks: ({ pageId, blockIds }) => Blocks.reorderBlocks(pageId, [...blockIds]).pipe(Effect.orDie),
  getBacklinks: ({ pageId }) => Blocks.getBacklinks(pageId).pipe(Effect.orDie),

  listDatabases: ({ pageId }) => Databases.listDatabases(pageId).pipe(Effect.orDie),
  listAllDatabases: () => Databases.listAllDatabases.pipe(Effect.orDie),
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
  listRecordsWithValues: ({ databaseId }) => Databases.listRecordsWithValues(databaseId).pipe(Effect.orDie),
  getRecordWithValues: ({ recordId }) => Databases.getRecordWithValues(recordId).pipe(Effect.orDie),
  createRecord: (req) => Databases.createRecord(req).pipe(Effect.orDie),
  updateFieldValue: (req) => Databases.updateFieldValue(req).pipe(
    Effect.map((row) => new RecordFieldValue({
      id: row.id as string,
      recordId: row.recordId as string,
      fieldId: row.fieldId as string,
      value: row.value as string,
    })),
    Effect.orDie,
  ),
  deleteRecord: ({ id }) => Databases.deleteRecord(id).pipe(Effect.orDie),
  listViews: ({ databaseId }) => Databases.listViews(databaseId).pipe(Effect.orDie),
  createView: (req) => Databases.createView({
    databaseId: req.databaseId,
    name: req.name,
    type: req.type,
    groupByFieldId: req.groupByFieldId,
  }).pipe(Effect.orDie),
  updateField: (req) => Databases.updateField({
    id: req.id,
    name: req.name,
    type: req.type,
    options: req.options === undefined ? undefined : (req.options ? [...req.options] : null),
    relationTargetDbId: req.relationTargetDbId,
  }).pipe(Effect.orDie),
  updateRecord: (req) => Databases.updateRecord(req).pipe(Effect.orDie),
  reorderRecords: ({ databaseId, recordIds }) => Databases.reorderRecords({
    databaseId,
    recordIds: [...recordIds],
  }).pipe(Effect.orDie),
  renameDatabase: (req) => Databases.renameDatabase({
    id: req.id,
    name: req.name,
  }).pipe(Effect.orDie),
  updateDatabase: (req) => Databases.updateDatabase(req).pipe(Effect.orDie),
  deleteField: ({ id }) => Databases.deleteField(id).pipe(Effect.orDie),
  reorderDatabases: (req) => Databases.reorderDatabases({
    pageId: req.pageId,
    databaseIds: [...req.databaseIds],
  }).pipe(Effect.orDie),

  // Import/Export
  importNotion: ({ directory }) => ImportExport.importNotion(directory).pipe(Effect.orDie),
  exportPage: ({ pageId, includeDatabases }) =>
    ImportExport.exportPage(pageId, includeDatabases).pipe(Effect.orDie),
  exportDatabase: ({ dbId }) => ImportExport.exportDatabase(dbId).pipe(Effect.orDie),
  exportAll: ({ outputDir }) => ImportExport.exportAll(outputDir).pipe(Effect.orDie),
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
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000, host: "0.0.0.0" })),
);

// Run migrations then start server
const program = Effect.gen(function* () {
  yield* runMigrations;
  yield* Effect.logInfo("Server running on http://localhost:3000");
  // Keep the server running
  yield* Effect.never;
});

// Server program - combine migrations with server layer
const main = program.pipe(
  Effect.provide(ServerLive),
);

NodeRuntime.runMain(main as import("effect/Effect").Effect<void, unknown, never>);
