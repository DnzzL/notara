import type { Database } from "bun:sqlite";
import { Effect } from "effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

/**
 * Readiness probe: 200 "ok" when the platform DB answers a trivial query that reads the file (SELECT 1 would not notice corruption),
 * 503 otherwise. Body never carries error details (unauthenticated route).
 */
export const healthResponse = (db: Database) =>
	Effect.try(() => db.query("SELECT count(*) FROM sqlite_master").get()).pipe(
		Effect.as(HttpServerResponse.text("ok", { status: 200 })),
		Effect.catch(() =>
			Effect.succeed(HttpServerResponse.text("unavailable", { status: 503 })),
		),
	);
