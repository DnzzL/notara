import { Effect } from "effect";
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { NodeRuntime } from "@effect/platform-node";
import { RpcRouter } from "@effect/rpc";
import { RpcHttpServer } from "@effect/rpc-http";
import { SqliteLive, runMigrations } from "./db.js";
import * as Pages from "./handlers/pages.js";
import * as Blocks from "./handlers/blocks.js";
import * as Databases from "./handlers/databases.js";
import { AppRpc } from "@notion-alt/shared";
import * as path from "node:path";
import * as fs from "node:fs";

// Try to find the app dist directory
const possiblePaths = [
  path.join(process.cwd(), "packages/app/dist"),
  path.join(process.cwd(), "app/dist"),
];

let appDist: string | null = null;
for (const p of possiblePaths) {
  if (fs.existsSync(path.join(p, "index.html"))) {
    appDist = p;
    break;
  }
}

const router = RpcRouter.make(
  AppRpc,
  {
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
  },
);

// HTTP server with RPC + static file serving
const httpApp = Effect.gen(function* () {
  const httpRouter = yield* HttpRouter.Default;

  // RPC endpoint
  yield* httpRouter.pipe(
    RpcHttpServer.serve("/api"),
  );

  // Static file serving for frontend (if available)
  if (appDist) {
    console.log("Serving static files from:", appDist);

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

    yield* httpRouter.get("/*", Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      let urlPath = request.url.split("?")[0];
      if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

      const filePath = path.join(appDist!, urlPath);

      if (!fs.existsSync(filePath)) {
        // SPA fallback
        const indexPath = path.join(appDist!, "index.html");
        if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath);
          return HttpServerResponse.rawUint8Array(new Uint8Array(content), {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        }
        return HttpServerResponse.text("Not found", { status: 404 });
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || "application/octet-stream";
      const content = fs.readFileSync(filePath);

      return HttpServerResponse.rawUint8Array(new Uint8Array(content), {
        headers: { "Content-Type": contentType },
      });
    }));
  } else {
    console.log("No frontend dist found - API only mode");
  }

  yield* HttpServer.serve();
}).pipe(
  Effect.provide(RpcRouter.toLayer(router)),
);

// Main: run migrations, then start server
const main = Effect.gen(function* () {
  yield* runMigrations;
  yield* httpApp;
  console.log("Server running on http://localhost:3000");
}).pipe(
  Effect.provide(SqliteLive),
  Effect.catchAllCause(Effect.logFatal),
);

main.pipe(NodeRuntime.runMain);
