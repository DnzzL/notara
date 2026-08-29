/**
 * The API error contract (NOT-89): the failures declared in `@notara/shared`
 * must stay in the error channel, survive the wire, and carry a status at the
 * HTTP edge. Everything else must remain a defect.
 */
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import {
	ApiError,
	AuthError,
	BlockLockedError,
	ConflictError,
	NotFoundError,
	ValidationError,
} from "@notara/shared";
import { Cause, Effect, Exit, Option, Schema } from "effect";
import type { SqlClient } from "effect/unstable/sql";
import * as Pages from "../src/handlers/pages.js";
import { failureResponse } from "../src/http-error.js";
import { dieUnlessApiError } from "../src/rpc-handlers.js";

const migrationsDir = path.join(
	import.meta.dirname || __dirname,
	"../migrations",
);

function makeTestDb() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-apierr-"));
	const filename = path.join(tmpDir, "test.db");
	const db = new Database(filename);
	try {
		for (const file of fs
			.readdirSync(migrationsDir)
			.filter((f) => f.endsWith(".sql"))
			.sort()) {
			db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf-8"));
		}
	} finally {
		db.close();
	}
	return { filename, tmpDir };
}

/**
 * Run a handler against a throwaway database and return the error it failed
 * with. `Effect.flip` keeps the assertion on the error channel: a handler that
 * succeeds (or dies) fails the test instead of silently passing.
 */
async function failureOf<A, E>(
	handler: Effect.Effect<A, E, SqlClient.SqlClient>,
): Promise<E> {
	const { filename, tmpDir } = makeTestDb();
	try {
		return await Effect.flip(handler).pipe(
			Effect.provide(SqliteClient.layer({ filename })),
			Effect.runPromise,
		);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

describe("typed handler failures", () => {
	test("getPage on an unknown id fails with NotFoundError", async () => {
		const error = await failureOf(Pages.getPage("nope"));
		expect(error).toBeInstanceOf(NotFoundError);
		expect(error).toMatchObject({ resource: "page", id: "nope" });
		expect(error.message).toBe("page nope not found");
	});

	test("moving a page into itself fails with ConflictError", async () => {
		const error = await failureOf(Pages.movePage({ id: "p1", parentId: "p1" }));
		expect(error).toBeInstanceOf(ConflictError);
		expect(error.message).toBe("Cannot move a page into itself");
	});

	test("reordering pages outside their sibling group fails with ValidationError", async () => {
		const error = await failureOf(
			Pages.reorderPages({ parentId: null, pageIds: ["ghost"] }),
		);
		expect(error).toBeInstanceOf(ValidationError);
	});
});

describe("dieUnlessApiError", () => {
	test("keeps a declared failure in the error channel", async () => {
		const error = await Effect.runPromise(
			Effect.flip(
				dieUnlessApiError(
					Effect.fail(new NotFoundError({ resource: "block", id: "b1" })),
				),
			),
		);
		expect(error).toBeInstanceOf(NotFoundError);
	});

	test("turns anything else into a defect", async () => {
		const exit = await Effect.runPromiseExit(
			dieUnlessApiError(Effect.fail(new Error("no such column"))),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.hasDies(exit.cause)).toBe(true);
			expect(Cause.findErrorOption(exit.cause)).toEqual(Option.none());
		}
	});
});

describe("wire contract", () => {
	const encode = Schema.encodeUnknownSync(ApiError);
	const decode = Schema.decodeUnknownSync(ApiError);

	test.each([
		["NotFoundError", new NotFoundError({ resource: "record", id: "r1" })],
		["ConflictError", new ConflictError({ message: "slug taken" })],
		["ValidationError", new ValidationError({ message: "Invalid JSON" })],
		["AuthError", new AuthError({ status: 403, message: "Forbidden" })],
		["BlockLockedError", new BlockLockedError({ holderUserId: "u1" })],
	] as const)("%s survives an encode/decode round trip", (tag, error) => {
		const wire = encode(error) as { _tag: string };
		expect(wire._tag).toBe(tag);
		const back = decode(wire);
		expect(back._tag).toBe(tag);
		expect(back.message).toBe(error.message);
	});
});

describe("HTTP status mapping", () => {
	test.each([
		[new NotFoundError({ resource: "page", id: "p1" }), 404],
		[new ConflictError({ message: "conflict" }), 409],
		[new BlockLockedError({ holderUserId: "u1" }), 409],
		[new ValidationError({ message: "bad" }), 400],
		[new AuthError({ status: 401, message: "Unauthorized" }), 401],
		[new AuthError({ status: 403, message: "Forbidden" }), 403],
	] as const)("%s keeps its own status", (error, status) => {
		expect(failureResponse(error).status).toBe(status);
	});

	test("an undeclared error is a reported 500", () => {
		expect(failureResponse(new Error("boom")).status).toBe(500);
	});
});
