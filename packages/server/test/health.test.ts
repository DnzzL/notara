import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { healthResponse } from "../src/health.js";

const run = (db: Database) =>
	Effect.runPromise(healthResponse(db)).then((r) =>
		HttpServerResponse.toWeb(r),
	);

describe("healthResponse", () => {
	test("200 'ok' when the DB answers", async () => {
		const res = await run(new Database(":memory:"));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("ok");
	});

	test("503 when the DB query fails", async () => {
		const db = new Database(":memory:");
		db.close();
		const res = await run(db);
		expect(res.status).toBe(503);
		expect(await res.text()).not.toContain("ok");
	});
});
