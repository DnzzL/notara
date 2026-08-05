// Side-effect import: must run before anything else so PostHog catches early errors.

import * as fs from "node:fs";
import { createServer } from "node:http";
import * as path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter";
import * as HttpRouter from "@effect/platform/HttpRouter";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import * as RpcSerialization from "@effect/rpc/RpcSerialization";
import * as RpcServer from "@effect/rpc/RpcServer";
import { AppRpc } from "@notara/shared";
import { Effect, Layer } from "effect";
import { registerV1Routes } from "./api-v1/routes.js";
import { auth } from "./auth.js";
import { startBackupScheduler } from "./backup-scheduler.js";
import {
	runMigrations,
	SqliteLive,
	WorkspaceDb,
	WorkspaceDbLive,
} from "./db.js";
import { demoMode, startDemoPurge } from "./demo.js";
import { listBackups, triggerBackup } from "./handlers/backup.js";
import * as ImportExport from "./handlers/importExport.js";
import { restoreBackup } from "./handlers/restore.js";
import { loadSettings, saveSettings } from "./handlers/settings.js";
import * as Upload from "./handlers/upload.js";
import {
	checkRateLimit,
	corsHeaders,
	getIp,
	tooManyRequests,
} from "./middleware.js";
import { LoggerLive, reportError } from "./observability.js";
import { PlatformDbLive, platformDb } from "./platform-db.js";
import {
	leaveHandler,
	makeHeartbeatHandler,
	makeStreamHandler,
} from "./presence/routes.js";
import { rpcHandlersLayer } from "./rpc-handlers.js";
import { AuthError, withAuthedWorkspace } from "./workspace-context.js";
import { startTrashSweep } from "./trash-sweeper.js";
import { makeViewConfigStreamHandler } from "./view-config-stream.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, "../../..");

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
	console.log(JSON.stringify({ event: "static_dist", path: appDist }));
} else {
	console.log(
		JSON.stringify({ event: "static_dist", path: null, mode: "api_only" }),
	);
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
	".pdf": "application/pdf",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".webmanifest": "application/manifest+json",
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
	console.error(
		"\nSet these in your .env file or environment before starting the server.\n",
	);
	process.exit(1);
}

validateEnv();

// Static file handler + import upload route as an Effect
const staticFilesRoute = Effect.gen(function* () {
	const router = yield* HttpLayerRouter.HttpRouter;
	const wdb = yield* WorkspaceDb;

	// Better Auth handler — mount before RPC (handles GET and POST)
	const authHandlerInner = Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const url = new URL(request.url, "http://localhost");
		const bodyBuffer =
			request.method !== "GET" && request.method !== "HEAD"
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
			if (cause._tag === "Fail") {
				const msg = String(cause.error);
				reportError(cause.error);
				return HttpServerResponse.text(JSON.stringify({ error: msg }), {
					status: 500,
					headers: { "Content-Type": "application/json", ...corsHeaders },
				});
			}
			reportError(new Error(cause.toString()));
			return Effect.gen(function* () {
				yield* Effect.logError("Unhandled error", cause);
				return HttpServerResponse.text(
					JSON.stringify({ error: "Something went wrong" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json", ...corsHeaders },
					},
				);
			});
		}),
	);
	// Auth mutation endpoints get a stricter rate limit (10 req/min per IP)
	const authHandlerStrict = Effect.gen(function* () {
		const req = yield* HttpServerRequest.HttpServerRequest;
		const isAuthMutation =
			/\/(sign-in|sign-up|request-password-reset|reset-password)/.test(req.url);
		if (isAuthMutation && !checkRateLimit(`${getIp(req)}:auth`, 10))
			return tooManyRequests(60);
		return yield* authHandlerInner;
	});
	yield* router.add("GET", "/api/auth/*", authHandlerInner);
	yield* router.add("POST", "/api/auth/*", authHandlerStrict);

	// Health check
	yield* router.add(
		"GET",
		"/health",
		Effect.succeed(HttpServerResponse.text("ok", { status: 200 })),
	);

	// ── Admin gate ────────────────────────────────────────────────────────────
	// Declared before its first use: everything below runs top-to-bottom in this
	// generator, so a later `const` would still be in its temporal dead zone.
	const adminEmails = (process.env.ADMIN_EMAILS ?? "")
		.split(",")
		.map((e) => e.trim())
		.filter(Boolean);

	const requireAdmin = <A>(inner: Effect.Effect<A, unknown, any>) =>
		Effect.gen(function* () {
			if (adminEmails.length === 0) {
				return HttpServerResponse.text(
					JSON.stringify({ error: "Admin not configured" }),
					{
						status: 403,
						headers: { "Content-Type": "application/json", ...corsHeaders },
					},
				) as unknown as A;
			}
			const req = yield* HttpServerRequest.HttpServerRequest;
			const headers = new Headers(req.headers as Record<string, string>);
			const session = yield* Effect.promise(() =>
				auth.api.getSession({ headers }),
			);
			if (!session || !adminEmails.includes(session.user.email)) {
				return HttpServerResponse.text(JSON.stringify({ error: "Forbidden" }), {
					status: 403,
					headers: { "Content-Type": "application/json", ...corsHeaders },
				}) as unknown as A;
			}
			return yield* inner;
		});

	// Public instance config. Deliberately minimal: the landing page needs to know
	// whether demo mode is on, and one published image has to serve both modes, so
	// this cannot be a build-time flag. Nothing sensitive belongs here.
	yield* router.add(
		"GET",
		"/api/public-config",
		Effect.sync(() =>
			HttpServerResponse.text(JSON.stringify({ demoMode: demoMode() }), {
				headers: { "Content-Type": "application/json", ...corsHeaders },
			}),
		),
	);

	// Settings GET (admin only — the payload carries the S3 access key and secret)
	yield* router.add(
		"GET",
		"/api/settings",
		requireAdmin(
			Effect.sync(() => {
				const settings = loadSettings();
				return HttpServerResponse.text(JSON.stringify(settings), {
					headers: { "Content-Type": "application/json", ...corsHeaders },
				});
			}),
		),
	);

	// Settings POST (admin only — this repoints where backups are written)
	yield* router.add(
		"POST",
		"/api/settings",
		requireAdmin(
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const ab = yield* request.arrayBuffer;
				const body = yield* Effect.try({
					// pi-lens-ignore: ast-grep:unchecked-throwing-call
					try: () => JSON.parse(Buffer.from(ab).toString("utf-8")),
					catch: (e) =>
						new Error(
							`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
						),
				});
				saveSettings(body);
				return HttpServerResponse.text(JSON.stringify({ ok: true }), {
					headers: { "Content-Type": "application/json", ...corsHeaders },
				});
			}).pipe(
			Effect.catchAllCause((cause) => {
				if (cause._tag === "Fail") {
					const msg = String(cause.error);
					reportError(cause.error);
					return HttpServerResponse.text(JSON.stringify({ error: msg }), {
						status: 500,
						headers: { "Content-Type": "application/json", ...corsHeaders },
					});
				}
					reportError(new Error(cause.toString()));
					return Effect.gen(function* () {
						yield* Effect.logError("Unhandled error", cause);
						return HttpServerResponse.text(
							JSON.stringify({ error: "Something went wrong" }),
							{
								status: 500,
								headers: { "Content-Type": "application/json", ...corsHeaders },
							},
						);
					});
				}),
			),
		),
	);

	// Backup trigger (admin only — writes the whole instance to the S3 target)
	yield* router.add(
		"POST",
		"/api/backup/trigger",
		requireAdmin(
			Effect.gen(function* () {
				const result = yield* Effect.promise(() => triggerBackup());
				return HttpServerResponse.text(JSON.stringify(result), {
					headers: { "Content-Type": "application/json", ...corsHeaders },
				});
			}).pipe(
				Effect.catchAllCause((cause) => {
					if (cause._tag === "Fail") {
						const msg = String(cause.error);
						reportError(cause.error);
						return HttpServerResponse.text(JSON.stringify({ error: msg }), {
							status: 500,
							headers: { "Content-Type": "application/json", ...corsHeaders },
						});
					}
					reportError(new Error(cause.toString()));
					return Effect.gen(function* () {
						yield* Effect.logError("Unhandled error", cause);
						return HttpServerResponse.text(
							JSON.stringify({ error: "Something went wrong" }),
							{
								status: 500,
								headers: { "Content-Type": "application/json", ...corsHeaders },
							},
						);
					});
				}),
			),
		),
	);

	// List available S3 backups (admin only)
	yield* router.add(
		"GET",
		"/api/backup/list",
		requireAdmin(
			Effect.gen(function* () {
				const items = yield* Effect.promise(() => listBackups());
				return HttpServerResponse.text(JSON.stringify(items), {
					headers: { "Content-Type": "application/json", ...corsHeaders },
				});
			}).pipe(
				Effect.catchAllCause((cause) => {
					if (cause._tag === "Fail") {
						const msg = String(cause.error);
						reportError(cause.error);
						return HttpServerResponse.text(JSON.stringify({ error: msg }), {
							status: 500,
							headers: { "Content-Type": "application/json", ...corsHeaders },
						});
					}
					reportError(new Error(cause.toString()));
					return Effect.gen(function* () {
						yield* Effect.logError("Unhandled error", cause);
						return HttpServerResponse.text(
							JSON.stringify({ error: "Something went wrong" }),
							{
								status: 500,
								headers: { "Content-Type": "application/json", ...corsHeaders },
							},
						);
					});
				}),
			),
		),
	);

	// Restore the whole instance from an S3 backup (admin only).
	// On success the process exits so Docker relaunches the server with fresh
	// SQLite handles on the restored files — open handles can't be hot-swapped.
	yield* router.add(
		"POST",
		"/api/backup/restore",
		requireAdmin(
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const ab = yield* request.arrayBuffer;
				const body = (yield* Effect.try({
					// pi-lens-ignore: ast-grep:unchecked-throwing-call
					try: () => JSON.parse(Buffer.from(ab).toString("utf-8")),
					catch: (e) =>
						new Error(
							`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
						),
				})) as {
					key?: string;
				};
				if (!body.key) throw new Error("Missing backup key");
				const result = yield* Effect.promise(() => restoreBackup(body.key!));
				// Flush the response, then exit so the container restarts.
				setTimeout(() => {
					console.log(
						"[restore] restored from",
						result.restoredFrom,
						"— exiting for restart",
					);
					process.exit(0);
				}, 250);
				return HttpServerResponse.text(JSON.stringify(result), {
					headers: { "Content-Type": "application/json", ...corsHeaders },
				});
			}).pipe(
				Effect.catchAllCause((cause) => {
					if (cause._tag === "Fail") {
						const msg = String(cause.error);
						reportError(cause.error);
						return HttpServerResponse.text(JSON.stringify({ error: msg }), {
							status: 500,
							headers: { "Content-Type": "application/json", ...corsHeaders },
						});
					}
					reportError(new Error(cause.toString()));
					return Effect.gen(function* () {
						yield* Effect.logError("Unhandled error", cause);
						return HttpServerResponse.text(
							JSON.stringify({ error: "Something went wrong" }),
							{
								status: 500,
								headers: { "Content-Type": "application/json", ...corsHeaders },
							},
						);
					});
				}),
			),
		),
	);

	yield* router.add(
		"GET",
		"/api/admin/users",
		requireAdmin(
			Effect.sync(() => {
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
			}),
		),
	);

	yield* router.add(
		"GET",
		"/api/admin/workspaces",
		requireAdmin(
			Effect.sync(() => {
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
			}),
		),
	);

	yield* router.add(
		"DELETE",
		"/api/admin/users/:userId",
		requireAdmin(
			Effect.gen(function* () {
				const params = yield* HttpRouter.params;
				const userId = params.userId as string | undefined;
				if (!userId) {
					return HttpServerResponse.text(
						JSON.stringify({ error: "Missing userId" }),
						{
							status: 400,
							headers: { "Content-Type": "application/json", ...corsHeaders },
						},
					);
				}
				platformDb
					.prepare("DELETE FROM workspace_members WHERE user_id = ?")
					.run(userId);
				yield* Effect.logInfo("User deactivated", userId);
				return HttpServerResponse.text(JSON.stringify({ deactivated: true }), {
					headers: { "Content-Type": "application/json", ...corsHeaders },
				});
			}),
		),
	);

	// Presence (collaboration) routes — wdb is closed over so the per-request
	// handler doesn't need WorkspaceDb in its own context.
	yield* router.add(
		"POST",
		"/api/presence/heartbeat",
		makeHeartbeatHandler(wdb),
	);
	yield* router.add("POST", "/api/presence/leave", leaveHandler);
	yield* router.add("GET", "/api/presence/stream", makeStreamHandler(wdb));

	// View-config SSE stream — notifies ViewReferenceBlock instances of config changes.
	// Auth handled inside the handler via workspace-level session check.
	yield* router.add(
		"GET",
		"/api/stream/view-config",
		makeViewConfigStreamHandler(),
	);

	// Handle CORS preflight
	yield* router.add(
		"OPTIONS",
		"/*",
		Effect.succeed(
			HttpServerResponse.empty({ status: 204, headers: corsHeaders }),
		),
	);

	// Import upload route. Same chokepoint reasoning as /api/upload: it writes
	// whole pages and databases into the workspace the header names.
	yield* router.add(
		"POST",
		"/import-notion",
		withAuthedWorkspace(() =>
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;

				const ab = yield* request.arrayBuffer;
			const buffer = Buffer.from(ab);

			if (buffer.length === 0) {
				return HttpServerResponse.text(
					JSON.stringify({ error: "Empty request body" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json", ...corsHeaders },
					},
				);
			}

			const cd = request.headers["content-disposition"] || "";
			const filenameMatch = cd.match(/filename="([^"]+)"/);
			const fileName = filenameMatch ? filenameMatch[1] : "notion-export.zip";

				// Workspace layer provided by withAuthedWorkspace, post membership check.
				const result =
					yield* ImportExport.importNotionZip(buffer, fileName);

				return HttpServerResponse.text(
					JSON.stringify({
						pagesImported: result.pagesImported,
						databasesImported: result.databasesImported,
					}),
					{ headers: { "Content-Type": "application/json", ...corsHeaders } },
				);
			}),
		).pipe(
			Effect.catchAllCause((cause) => {
				if (cause._tag === "Fail") {
					if (cause.error instanceof AuthError) {
						return HttpServerResponse.text(
							JSON.stringify({ error: cause.error.message }),
							{
								status: cause.error.status,
								headers: { "Content-Type": "application/json", ...corsHeaders },
							},
						);
					}
					const msg = String(cause.error);
					reportError(cause.error);
					return HttpServerResponse.text(JSON.stringify({ error: msg }), {
						status: 500,
						headers: { "Content-Type": "application/json", ...corsHeaders },
					});
				}
				reportError(new Error(cause.toString()));
				return Effect.gen(function* () {
					yield* Effect.logError("Unhandled error", cause);
					return HttpServerResponse.text(
						JSON.stringify({ error: "Something went wrong" }),
						{
							status: 500,
							headers: { "Content-Type": "application/json", ...corsHeaders },
						},
					);
				});
			}),
		),
	);

	// File upload route. Client sends raw bytes; metadata travels in headers.
	// Headers: X-Page-Id, X-File-Name (URL-encoded), Content-Type (MIME).
	// Rate-limited to 60 req/min per IP.
	// Through the chokepoint: this writes an attachment row and a block into a
	// workspace named by a client-supplied header, so membership has to be proven
	// before the workspace layer is handed over.
	const uploadInner = withAuthedWorkspace(() =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const pageId = request.headers["x-page-id"];
		const fileNameRaw = request.headers["x-file-name"];
		const mimeType =
			request.headers["content-type"] || "application/octet-stream";

		if (!pageId || !fileNameRaw) {
			return HttpServerResponse.text(
				JSON.stringify({ error: "Missing X-Page-Id or X-File-Name header" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json", ...corsHeaders },
				},
			);
		}

		const fileName = decodeURIComponent(fileNameRaw);
		const ab = yield* request.arrayBuffer;
		const fileBuffer = Buffer.from(ab);

		if (fileBuffer.length === 0) {
			return HttpServerResponse.text(
				JSON.stringify({ error: "Empty file body" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json", ...corsHeaders },
				},
			);
		}

			// The workspace layer now comes from withAuthedWorkspace, which only
			// provides it after checking the caller's workspace_members row.
			const result = yield* Upload.uploadFile({
				pageId,
				fileName,
				mimeType,
				fileBuffer,
			});

			return HttpServerResponse.text(JSON.stringify(result), {
				headers: { "Content-Type": "application/json", ...corsHeaders },
			});
		}),
	).pipe(
		Effect.catchAllCause((cause) => {
			if (cause._tag === "Fail") {
				// 401/403 from the chokepoint must not be flattened into a 500.
				if (cause.error instanceof AuthError) {
					return HttpServerResponse.text(
						JSON.stringify({ error: cause.error.message }),
						{
							status: cause.error.status,
							headers: { "Content-Type": "application/json", ...corsHeaders },
						},
					);
				}
				const msg = String(cause.error);
				reportError(cause.error);
				return HttpServerResponse.text(JSON.stringify({ error: msg }), {
					status: 500,
					headers: { "Content-Type": "application/json", ...corsHeaders },
				});
			}
			reportError(new Error(cause.toString()));
			return Effect.gen(function* () {
				yield* Effect.logError("Unhandled error", cause);
				return HttpServerResponse.text(
					JSON.stringify({ error: "Something went wrong" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json", ...corsHeaders },
					},
				);
			});
		}),
	);
	yield* router.add(
		"POST",
		"/api/upload",
		Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest;
			if (!checkRateLimit(`${getIp(req)}:upload`, 60))
				return tooManyRequests(60);
			return yield* uploadInner;
		}),
	);

	// Attachment serving route
	yield* router.add(
		"GET",
		"/attachments/:fileName",
		Effect.gen(function* () {
			const params = yield* HttpRouter.params;
			const fileName = params.fileName as string | undefined;

			if (!fileName) {
				return HttpServerResponse.text("Not found", {
					status: 404,
					headers: corsHeaders,
				});
			}

			// Validate filename to prevent path traversal
			if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
				return HttpServerResponse.text("Not found", {
					status: 404,
					headers: corsHeaders,
				});
			}

			const dataDir = process.env.DATA_DIR
				? path.join(process.env.DATA_DIR, "attachments")
				: path.join(rootDir, ".data", "attachments");
			const filePath = path.join(dataDir, fileName);

			if (!fs.existsSync(filePath)) {
				return HttpServerResponse.text("Not found", {
					status: 404,
					headers: corsHeaders,
				});
			}

			const ext = path.extname(filePath);
			const contentType = mimeTypes[ext] || "application/octet-stream";
			const content = fs.readFileSync(filePath);

			return HttpServerResponse.uint8Array(new Uint8Array(content), {
				headers: { "Content-Type": contentType, ...corsHeaders },
			});
		}),
	);

	if (!appDist) return;

	yield* router.add(
		"GET",
		"/*",
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			let urlPath = request.url.split("?")[0];
			if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

			let filePath = path.join(appDist!, urlPath);

			if (!fs.existsSync(filePath)) {
				filePath = path.join(appDist!, "index.html");
			}

			if (!fs.existsSync(filePath)) {
				return HttpServerResponse.text("Not found", {
					status: 404,
					headers: corsHeaders,
				});
			}

			const ext = path.extname(filePath);
			const contentType = mimeTypes[ext] || "application/octet-stream";
			const content = fs.readFileSync(filePath);

			// Service worker must be served with no-cache so browsers check for updates.
			const additionalHeaders: Record<string, string> = {};
			const baseName = path.basename(filePath);
			if (baseName === "sw.js") {
				additionalHeaders["Cache-Control"] =
					"no-cache, no-store, must-revalidate";
				additionalHeaders["Service-Worker-Allowed"] = "/";
			}

			return HttpServerResponse.uint8Array(new Uint8Array(content), {
				headers: {
					"Content-Type": contentType,
					...corsHeaders,
					...additionalHeaders,
				},
			});
		}),
	);
});

// Layer that adds static file routes + import upload
const StaticFilesLive = Layer.effectDiscard(staticFilesRoute);

// Layer that adds the /api/v1 REST routes + /api/docs
const ApiV1Live = Layer.effectDiscard(registerV1Routes);

// Create RPC router layer
const RpcRouterLive = RpcServer.layerHttpRouter({
	group: AppRpc,
	path: "/api",
	protocol: "http",
});

// Combine all layers: RPC + static files + handlers + serialization + database
const AppLive = Layer.mergeAll(RpcRouterLive, StaticFilesLive, ApiV1Live).pipe(
	Layer.provide(rpcHandlersLayer),
	Layer.provide(RpcSerialization.layerJson),
	Layer.provide(SqliteLive),
	Layer.provide(WorkspaceDbLive),
	Layer.provide(PlatformDbLive),
);

// Serve the app with HTTP server
const ServerLive = HttpLayerRouter.serve(AppLive).pipe(
	Layer.provide(
		NodeHttpServer.layer(createServer, {
			port: Number(process.env.PORT ?? 3000),
			host: "0.0.0.0",
		}),
	),
);

// Run migrations then start server
const program = Effect.gen(function* () {
	yield* runMigrations;
	startBackupScheduler();
	startTrashSweep();
	if (demoMode()) startDemoPurge();
	yield* Effect.logInfo(
		`Server running on http://localhost:${process.env.PORT ?? 3000}`,
	);
	// Keep the server running
	yield* Effect.never;
});

// Server program - combine migrations with server layer
const main = program.pipe(
	Effect.provide(ServerLive),
	Effect.provide(LoggerLive),
);

NodeRuntime.runMain(
	main as import("effect/Effect").Effect<void, unknown, never>,
);
