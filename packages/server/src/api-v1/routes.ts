import { Effect } from "effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as Workspaces from "../handlers/workspaces.js";
import { resolveApiUser } from "./auth.js";
import { spec as openApiSpec, swaggerHtml } from "./openapi.js";
import { registerOperations, restOperations } from "./operations.js";
import { handle, ok } from "./response.js";

// ── Route registration ────────────────────────────────────────────────────────

export const registerV1Routes = Effect.gen(function* () {
	const router = yield* HttpRouter.HttpRouter;

	// ── OpenAPI spec + Swagger UI ─────────────────────────────────────────────

	yield* router.add(
		"GET",
		"/api/v1/openapi.json",
		Effect.succeed(
			HttpServerResponse.text(JSON.stringify(openApiSpec, null, 2), {
				headers: { "Content-Type": "application/json" },
			}),
		),
	);

	yield* router.add(
		"GET",
		"/api/docs",
		Effect.succeed(
			HttpServerResponse.text(swaggerHtml, {
				headers: { "Content-Type": "text/html" },
			}),
		),
	);

	// ── GET /api/v1/workspaces ────────────────────────────────────────────────

	yield* router.add(
		"GET",
		"/api/v1/workspaces",
		handle(
			Effect.gen(function* () {
				const { userId } = yield* resolveApiUser;
				const workspaces = yield* Workspaces.getMyWorkspaces(userId);
				return ok(
					workspaces.map((w) => ({
						id: w.id,
						name: w.name,
						slug: w.slug,
						role: w.role,
					})),
				);
			}),
		),
	);

	// ── All resource routes: one operation table drives REST registration +
	// OpenAPI ─────────────────────────────────────────────────────────────────
	// See api-v1/operations.ts — every route below (pages, blocks, databases,
	// fields, records, search, trash) is declared once there, each running its
	// permission check and its mutation inside a single workspace-layer
	// acquisition.

	yield* registerOperations(router, restOperations);
});
