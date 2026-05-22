import { Effect, Layer, pipe } from "effect";
import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter";
import * as HttpRouter from "@effect/platform/HttpRouter";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import * as RpcServer from "@effect/rpc/RpcServer";
import * as RpcSerialization from "@effect/rpc/RpcSerialization";
import { SqliteLive, runMigrations, WorkspaceDb, WorkspaceDbLive } from "./db.js";
import * as Pages from "./handlers/pages.js";
import * as Blocks from "./handlers/blocks.js";
import * as Databases from "./handlers/databases.js";
import * as Search from "./handlers/search.js";
import * as ImportExport from "./handlers/importExport.js";
import * as Upload from "./handlers/upload.js";
import * as Workspaces from "./handlers/workspaces.js";
import * as ApiKeys from "./handlers/api-keys.js";
import { loadSettings, saveSettings } from "./handlers/settings.js";
import { triggerBackup } from "./handlers/backup.js";
import { AppRpc, RecordFieldValue } from "@notion-alt/shared";
import { registerV1Routes } from "./api-v1/routes.js";
import { auth } from "./auth.js";
import { PlatformDbLive, PlatformDb, platformDb } from "./platform-db.js";
import * as Permissions from "./handlers/permissions.js";
import { resolveWorkspaceContext, getSessionUser, WorkspaceContext, AuthError } from "./workspace-context.js";
import { createServer } from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, "../..");

// ── Rate limiter ───────────────────────────────────────────────────────────
const RATE_WINDOW_MS = 60_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function setInterval_unref(fn: () => void, ms: number) {
  const t = setInterval(fn, ms);
  if (typeof t === "object" && "unref" in t) (t as NodeJS.Timeout).unref();
}
setInterval_unref(() => {
  const now = Date.now();
  for (const [k, v] of rateLimits) if (v.resetAt < now) rateLimits.delete(k);
}, 60_000);

function checkRateLimit(ip: string, limit: number): boolean {
  const now = Date.now();
  let entry = rateLimits.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimits.set(ip, entry);
  }
  entry.count++;
  return entry.count <= limit;
}

function getIp(req: import("@effect/platform/HttpServerRequest").HttpServerRequest): string {
  const h = req.headers;
  return (h["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? (h["x-real-ip"] as string)
    ?? "unknown";
}

const tooManyRequests = (retryAfter: number) =>
  HttpServerResponse.text("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": String(retryAfter), ...corsHeaders },
  });

// Wraps an effect with IP-based rate limiting
const withRateLimit = <A>(limit: number, inner: Effect.Effect<A, unknown, any>) =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const ip = getIp(req);
    if (!checkRateLimit(`${ip}:${limit}`, limit)) return tooManyRequests(60) as unknown as A;
    return yield* inner;
  });

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

// ── Env validation ────────────────────────────────────────────────────────────
const REQUIRED_ENV: Array<{ key: string; hint: string }> = [
  { key: "BETTER_AUTH_SECRET", hint: "generate with: openssl rand -hex 32" },
];

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter(({ key }) => !process.env[key]?.trim());
  if (missing.length === 0) return;
  console.error("\n[startup] Missing required environment variables:\n");
  for (const { key, hint } of missing) {
    console.error(`  ${key}  (${hint})`);
  }
  console.error("\nSet these in your .env file or environment before starting the server.\n");
  process.exit(1);
}

validateEnv();

// ── Security + CORS headers ───────────────────────────────────────────────────
// CORS origin: lock down to BASE_URL / TRUSTED_ORIGINS in production; allow * otherwise.
const _allowedOrigin = (() => {
  const base = process.env.BASE_URL?.trim();
  if (base) return base;
  const trusted = (process.env.TRUSTED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return trusted.length > 0 ? trusted[0] : "*";
})();

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-XSS-Protection": "0",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": _allowedOrigin,
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Vary": "Origin",
  ...securityHeaders,
};

// Static file handler + import upload route as an Effect
const staticFilesRoute = Effect.gen(function* () {
  const router = yield* HttpLayerRouter.HttpRouter;
  const wdb = yield* WorkspaceDb;

  // Better Auth handler — mount before RPC (handles GET and POST)
  const authHandlerInner = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const url = new URL(request.url, "http://localhost");
    const bodyBuffer = request.method !== "GET" && request.method !== "HEAD"
      ? Buffer.from(yield* request.arrayBuffer)
      : undefined;
    const fetchRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers as HeadersInit,
      body: bodyBuffer,
    });
    const response = yield* Effect.promise(() => auth.handler(fetchRequest));
    const body = yield* Effect.promise(() => response.arrayBuffer());
    return HttpServerResponse.uint8Array(new Uint8Array(body), {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders,
      },
    });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail" ? String(cause.error) : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  );
  // Auth mutation endpoints get a stricter rate limit (10 req/min per IP)
  const authHandlerStrict = Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const isAuthMutation = /\/(sign-in|sign-up|request-password-reset|reset-password)/.test(req.url);
    if (isAuthMutation && !checkRateLimit(`${getIp(req)}:auth`, 10)) return tooManyRequests(60);
    return yield* authHandlerInner;
  });
  yield* router.add("GET", "/api/auth/*", authHandlerInner);
  yield* router.add("POST", "/api/auth/*", authHandlerStrict);

  // Health check
  yield* router.add("GET", "/health", Effect.succeed(
    HttpServerResponse.text("ok", { status: 200 })
  ));

  // Settings GET
  yield* router.add("GET", "/api/settings", Effect.gen(function* () {
    const settings = loadSettings();
    return HttpServerResponse.text(JSON.stringify(settings), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }));

  // Settings POST
  yield* router.add("POST", "/api/settings", Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const ab = yield* request.arrayBuffer;
    const body = JSON.parse(Buffer.from(ab).toString("utf-8"));
    saveSettings(body);
    return HttpServerResponse.text(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail" ? String(cause.error) : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  ));

  // Backup trigger
  yield* router.add("POST", "/api/backup/trigger", Effect.gen(function* () {
    const result = yield* Effect.promise(() => triggerBackup());
    return HttpServerResponse.text(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail" ? String(cause.error) : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  ));

  // ── Admin routes ──────────────────────────────────────────────────────────
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

  const requireAdmin = <A>(inner: Effect.Effect<A, unknown, any>) =>
    Effect.gen(function* () {
      if (adminEmails.length === 0) {
        return HttpServerResponse.text(JSON.stringify({ error: "Admin not configured" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
        }) as unknown as A;
      }
      const req = yield* HttpServerRequest.HttpServerRequest;
      const headers = new Headers(req.headers as Record<string, string>);
      const session = yield* Effect.promise(() => auth.api.getSession({ headers }));
      if (!session || !adminEmails.includes(session.user.email)) {
        return HttpServerResponse.text(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
        }) as unknown as A;
      }
      return yield* inner;
    });

  yield* router.add("GET", "/api/admin/users", requireAdmin(Effect.gen(function* () {
    const users = platformDb
      .prepare(
        `SELECT u.id, u.name, u.email, u.createdAt,
                COUNT(DISTINCT wm.workspace_id) as workspace_count
         FROM "user" u
         LEFT JOIN workspace_members wm ON wm.user_id = u.id
         GROUP BY u.id
         ORDER BY u.createdAt DESC`,
      )
      .all() as any[];
    return HttpServerResponse.text(JSON.stringify(users), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  })));

  yield* router.add("GET", "/api/admin/workspaces", requireAdmin(Effect.gen(function* () {
    const workspaces = platformDb
      .prepare(
        `SELECT w.id, w.name, w.slug, w.created_at,
                COUNT(wm.user_id) as member_count
         FROM workspaces w
         LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
         GROUP BY w.id
         ORDER BY w.created_at DESC`,
      )
      .all() as any[];
    return HttpServerResponse.text(JSON.stringify(workspaces), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  })));

  yield* router.add("DELETE", "/api/admin/users/:userId", requireAdmin(Effect.gen(function* () {
    const params = yield* HttpRouter.params;
    const userId = params["userId"] as string | undefined;
    if (!userId) {
      return HttpServerResponse.text(JSON.stringify({ error: "Missing userId" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    platformDb.prepare("DELETE FROM workspace_members WHERE user_id = ?").run(userId);
    platformDb.prepare(`DELETE FROM "user" WHERE id = ?`).run(userId);
    return HttpServerResponse.text(JSON.stringify({ deleted: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  })));

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

    const workspaceId = request.headers["x-workspace-id"] as string | undefined;
    const dbLayer = workspaceId ? wdb.getLayer(workspaceId) : SqliteLive;

    const result = yield* ImportExport.importNotionZip(buffer, fileName).pipe(
      Effect.provide(dbLayer)
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

    const uploadWorkspaceId = request.headers["x-workspace-id"] as string | undefined;
    const uploadDbLayer = uploadWorkspaceId ? wdb.getLayer(uploadWorkspaceId) : SqliteLive;

    const result = yield* Upload.uploadFile({ pageId, fileName, mimeType, fileBuffer }).pipe(
      Effect.provide(uploadDbLayer)
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

// Layer that adds the /api/v1 REST routes + /api/docs
const ApiV1Live = Layer.effectDiscard(registerV1Routes);

// Helper: resolve workspace DB from X-Workspace-Id header
const withWorkspaceDb = <A, E, R>(inner: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const workspaceId = request.headers["x-workspace-id"] as string | undefined;
    if (!workspaceId) return yield* Effect.die(new Error("Missing X-Workspace-Id header"));

    const wdb = yield* WorkspaceDb;
    const dbLayer = wdb.getLayer(workspaceId);
    return yield* inner.pipe(Effect.provide(dbLayer));
  });

// Helper: authenticated user + workspace context. Yields { userId, workspaceId, role }
// to the inner builder, runs it with the per-workspace SqlClient layer applied.
const withAuthedWorkspace = <A, E, R>(
  build: (ctx: {
    userId: string;
    workspaceId: string;
    role: "owner" | "member";
  }) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const user = yield* getSessionUser;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const workspaceId = request.headers["x-workspace-id"] as string | undefined;
    if (!workspaceId) return yield* Effect.die(new Error("Missing X-Workspace-Id header"));
    const db = yield* PlatformDb;
    const memberRow = db
      .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .get(workspaceId, user.id) as { role: "owner" | "member" } | null;
    if (!memberRow) {
      return yield* Effect.fail(new AuthError(403, "Not a workspace member"));
    }
    const wdb = yield* WorkspaceDb;
    return yield* build({ userId: user.id, workspaceId, role: memberRow.role }).pipe(
      Effect.provide(wdb.getLayer(workspaceId)),
    );
  });

// RPC handlers layer
const rpcHandlersLayer = AppRpc.toLayer({
  listPages: () =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        const all = yield* Pages.listPages;
        return yield* Permissions.filterPagesByPermission(userId, workspaceId, role, all);
      }),
    ).pipe(Effect.orDie),
  getPage: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, id, "viewer");
        return yield* Pages.getPage(id);
      }),
    ).pipe(Effect.orDie),
  createPage: (req) => withWorkspaceDb(Pages.createPage(req)).pipe(Effect.orDie),
  updatePage: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.id, "editor");
        return yield* Pages.updatePage(req);
      }),
    ).pipe(Effect.orDie),
  deletePage: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, id, "editor");
        return yield* Pages.deletePage(id);
      }),
    ).pipe(Effect.orDie),
  globalSearch: ({ query }) =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        const results = yield* Search.globalSearch(query);
        const allPages = yield* Pages.listPages;
        const visible = yield* Permissions.filterPagesByPermission(userId, workspaceId, role, allPages);
        const visibleIds = new Set(visible.map((p) => p.id));
        return results.filter((r) => visibleIds.has(r.type === "page" ? r.id : r.pageId));
      }),
    ).pipe(Effect.orDie),
  movePage: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.id, "editor");
        return yield* Pages.movePage(req);
      }),
    ).pipe(Effect.orDie),
  reorderPages: ({ parentId, pageIds }) => withWorkspaceDb(Pages.reorderPages({ parentId, pageIds: [...pageIds] })).pipe(Effect.orDie),

  listBlocks: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        return yield* Blocks.listBlocks(pageId);
      }),
    ).pipe(Effect.orDie),
  createBlock: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.pageId, "editor");
        return yield* Blocks.createBlock(req);
      }),
    ).pipe(Effect.orDie),
  updateBlock: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkBlockPermission(userId, workspaceId, req.id, "editor");
        return yield* Blocks.updateBlock(req);
      }),
    ).pipe(Effect.orDie),
  deleteBlock: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkBlockPermission(userId, workspaceId, id, "editor");
        return yield* Blocks.deleteBlock(id);
      }),
    ).pipe(Effect.orDie),
  reorderBlocks: ({ pageId, blockIds }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "editor");
        return yield* Blocks.reorderBlocks(pageId, [...blockIds]);
      }),
    ).pipe(Effect.orDie),
  getBacklinks: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        const all = yield* Blocks.getBacklinks(pageId);
        const allPages = yield* Pages.listPages;
        const visible = yield* Permissions.filterPagesByPermission(userId, workspaceId, role, allPages);
        const visibleIds = new Set(visible.map((p) => p.id));
        return all.filter((b) => visibleIds.has(b.pageId));
      }),
    ).pipe(Effect.orDie),

  listDatabases: ({ pageId }) => withWorkspaceDb(Databases.listDatabases(pageId)).pipe(Effect.orDie),
  listAllDatabases: () => withWorkspaceDb(Databases.listAllDatabases).pipe(Effect.orDie),
  getDatabase: ({ id }) => withWorkspaceDb(Databases.getDatabase(id)).pipe(Effect.orDie),
  createDatabase: (req) => withWorkspaceDb(Databases.createDatabase(req)).pipe(Effect.orDie),
  listFields: ({ databaseId }) => withWorkspaceDb(Databases.listFields(databaseId)).pipe(Effect.orDie),
  createField: (req) => withWorkspaceDb(Databases.createField({
    databaseId: req.databaseId,
    name: req.name,
    type: req.type,
    options: req.options ? [...req.options] : null,
    relationTargetDbId: req.relationTargetDbId,
  })).pipe(Effect.orDie),
  listRecords: ({ databaseId }) => withWorkspaceDb(Databases.listRecords(databaseId)).pipe(Effect.orDie),
  listRecordsWithValues: ({ databaseId }) => withWorkspaceDb(Databases.listRecordsWithValues(databaseId)).pipe(Effect.orDie),
  getRecordWithValues: ({ recordId }) => withWorkspaceDb(Databases.getRecordWithValues(recordId)).pipe(Effect.orDie),
  createRecord: (req) => withWorkspaceDb(Databases.createRecord(req)).pipe(Effect.orDie),
  updateFieldValue: (req) => withWorkspaceDb(Databases.updateFieldValue(req).pipe(
    Effect.map((row) => new RecordFieldValue({
      id: row.id as string,
      recordId: row.recordId as string,
      fieldId: row.fieldId as string,
      value: row.value as string,
    })),
  )).pipe(Effect.orDie),
  deleteRecord: ({ id }) => withWorkspaceDb(Databases.deleteRecord(id)).pipe(Effect.orDie),
  listViews: ({ databaseId }) => withWorkspaceDb(Databases.listViews(databaseId)).pipe(Effect.orDie),
  createView: (req) => withWorkspaceDb(Databases.createView({
    databaseId: req.databaseId,
    name: req.name,
    type: req.type,
    groupByFieldId: req.groupByFieldId,
  })).pipe(Effect.orDie),
  updateField: (req) => withWorkspaceDb(Databases.updateField({
    id: req.id,
    name: req.name,
    type: req.type,
    options: req.options === undefined ? undefined : (req.options ? [...req.options] : null),
    relationTargetDbId: req.relationTargetDbId,
  })).pipe(Effect.orDie),
  updateRecord: (req) => withWorkspaceDb(Databases.updateRecord(req)).pipe(Effect.orDie),
  reorderRecords: ({ databaseId, recordIds }) => withWorkspaceDb(Databases.reorderRecords({
    databaseId,
    recordIds: [...recordIds],
  })).pipe(Effect.orDie),
  renameDatabase: (req) => withWorkspaceDb(Databases.renameDatabase({
    id: req.id,
    name: req.name,
  })).pipe(Effect.orDie),
  updateDatabase: (req) => withWorkspaceDb(Databases.updateDatabase(req)).pipe(Effect.orDie),
  deleteField: ({ id }) => withWorkspaceDb(Databases.deleteField(id)).pipe(Effect.orDie),
  reorderDatabases: (req) => withWorkspaceDb(Databases.reorderDatabases({
    pageId: req.pageId,
    databaseIds: [...req.databaseIds],
  })).pipe(Effect.orDie),

  // Workspaces (use PlatformDb, session-based)
  getMyWorkspaces: () => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* Workspaces.getMyWorkspaces(user.id);
  }).pipe(Effect.orDie),
  createWorkspace: ({ name, slug }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* Workspaces.createWorkspace({ userId: user.id, name, slug });
  }).pipe(Effect.orDie),
  joinWorkspaceByToken: ({ inviteToken }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* Workspaces.joinWorkspaceByToken({ userId: user.id, inviteToken });
  }).pipe(Effect.orDie),
  getWorkspaceMembers: ({ workspaceId }) =>
    Workspaces.getWorkspaceMembers(workspaceId).pipe(Effect.orDie),
  removeMember: ({ workspaceId, userId }) =>
    Workspaces.removeMember({ workspaceId, userId }).pipe(Effect.orDie),
  regenerateInviteLink: ({ workspaceId }) =>
    Workspaces.regenerateInviteLink(workspaceId).pipe(Effect.orDie),
  inviteMemberByEmail: ({ workspaceId, email }) => Effect.gen(function* () {
    yield* getSessionUser;
    return yield* Workspaces.inviteMemberByEmail({ workspaceId, email });
  }).pipe(Effect.orDie),

  // API keys
  listApiKeys: () => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* ApiKeys.listApiKeys(user.id);
  }).pipe(Effect.orDie),
  createApiKey: ({ name }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* ApiKeys.createApiKey({ userId: user.id, name });
  }).pipe(Effect.orDie),
  revokeApiKey: ({ id }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* ApiKeys.revokeApiKey({ userId: user.id, id });
  }).pipe(Effect.orDie),

  // Page ACL
  getPagePermissions: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        return yield* Permissions.listPageAcl(pageId);
      }),
    ).pipe(Effect.orDie),
  setPagePermission: ({ pageId, subject, relation }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "owner");
        yield* Permissions.setPageAcl(pageId, subject, relation);
      }),
    ).pipe(Effect.orDie),
  removePagePermission: ({ pageId, subject, relation }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "owner");
        yield* Permissions.removePageAcl(pageId, subject, relation);
      }),
    ).pipe(Effect.orDie),

  // Import/Export
  importNotion: ({ directory }) => withWorkspaceDb(ImportExport.importNotion(directory)).pipe(Effect.orDie),
  exportPage: ({ pageId, includeDatabases }) =>
    withWorkspaceDb(ImportExport.exportPage(pageId, includeDatabases)).pipe(Effect.orDie),
  exportDatabase: ({ dbId }) => withWorkspaceDb(ImportExport.exportDatabase(dbId)).pipe(Effect.orDie),
  exportAll: ({ outputDir }) => withWorkspaceDb(ImportExport.exportAll(outputDir)).pipe(Effect.orDie),
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
  ApiV1Live,
).pipe(
  Layer.provide(rpcHandlersLayer),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(SqliteLive),
  Layer.provide(WorkspaceDbLive),
  Layer.provide(PlatformDbLive),
);

// Serve the app with HTTP server
const ServerLive = HttpLayerRouter.serve(AppLive).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" })),
);

const SCHEDULE_INTERVALS: Record<string, number | null> = {
  manual: null,
  hourly: 60 * 60 * 1000,
  every6h: 6 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

function startBackupScheduler() {
  let currentHandle: ReturnType<typeof setInterval> | null = null;
  let currentSchedule: string | null = null;

  const tick = () => {
    const settings = loadSettings();
    const interval = SCHEDULE_INTERVALS[settings.s3Schedule ?? "manual"] ?? null;

    if (settings.s3Schedule !== currentSchedule) {
      if (currentHandle) { clearInterval(currentHandle); currentHandle = null; }
      currentSchedule = settings.s3Schedule ?? "manual";
      if (interval !== null) {
        currentHandle = setInterval(() => {
          triggerBackup().catch((e) => console.error("[backup] scheduled backup failed:", e));
        }, interval);
      }
    }
  };

  // Check for schedule changes every minute
  setInterval(tick, 60_000);
  tick();
}

// Run migrations then start server
const program = Effect.gen(function* () {
  yield* runMigrations;
  startBackupScheduler();
  yield* Effect.logInfo(`Server running on http://localhost:${process.env.PORT ?? 3000}`);
  // Keep the server running
  yield* Effect.never;
});

// Server program - combine migrations with server layer
const main = program.pipe(
  Effect.provide(ServerLive),
);

NodeRuntime.runMain(main as import("effect/Effect").Effect<void, unknown, never>);
