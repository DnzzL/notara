import { Effect } from "effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { spec as openApiSpec, swaggerHtml } from "./openapi.js";
import { registerTypedOperations, typedOperations } from "./operations.js";

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

	// ── All resource routes: one operation table drives REST registration +
	// OpenAPI ─────────────────────────────────────────────────────────────────
	// See api-v1/operations.ts — every route below (workspaces, pages, blocks,
	// databases, fields, records, search, trash) is declared once there, each running its
	// permission check and its mutation inside a single workspace-layer
	// acquisition.

	yield* registerTypedOperations(router, typedOperations);
});
