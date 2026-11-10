import type { Database } from "bun:sqlite";
import { Effect } from "effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

/**
 * Readiness probe: 200 "ok" when the platform DB answers a trivial query,
 * 503 otherwise. Body never carries error details (unauthenticated route).
 */
export const healthResponse = (db: Database) =>
	Effect.try(() => db.query("SELECT 1").get()).pipe(
		Effect.as(HttpServerResponse.text("ok", { status: 200 })),
		Effect.catch(() =>
			Effect.succeed(HttpServerResponse.text("unavailable", { status: 503 })),
		),
	);
