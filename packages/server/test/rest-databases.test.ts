/**
 * The database, field and record operations and setCell through the REST door,
 * end to end (NOT-169.4).
 *
 * Booted server, real SQLite workspace, real API keys: the only way to see the
 * door decode input, enforce the declared scope, check the page ACL and map
 * each tagged error to its status — all of which are wiring, not handler logic.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3459;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = join(tmpdir(), `notara-rest-databases-${process.pid}`);

// Booted at module scope, as in route-auth.test.ts: hooks carry bun's 5s
// default timeout, and a cold runner needs longer to migrate and listen.
const server = Bun.spawn(
	["bun", join(import.meta.dir, "..", "src", "index.ts")],
	{
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR,
			BETTER_AUTH_SECRET: "test-secret-for-rest-databases-checks-only",
			BETTER_AUTH_URL: BASE,
			ADMIN_EMAILS: "",
		},
		stdout: "pipe",
		stderr: "pipe",
	},
);

let up = false;
for (let i = 0; i < 300 && !up; i++) {
	try {
		up = (await fetch(`${BASE}/health`)).ok;
	} catch {}
	if (!up) await Bun.sleep(100);
}
if (!up) {
	const stderr = await new Response(server.stderr as ReadableStream).text();
	server.kill();
	throw new Error(`server did not come up in 30s:\n${stderr}`);
}

afterAll(() => {
	server?.kill();
	rmSync(DATA_DIR, { recursive: true, force: true });
});

// ── Fixture: set up through the app's own doors (auth + RPC) ─────────────────

const signUp = async (email: string) => {
	const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: BASE },
		body: JSON.stringify({ email, password: "correct-horse-1", name: email }),
	});
	if (!res.ok) throw new Error(`sign-up ${email}: ${await res.text()}`);
	const cookie = res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
	const { user } = (await res.json()) as { user: { id: string } };
	return { cookie, userId: user.id };
};

let rpcId = 0;
const rpc = async <T>(
	cookie: string,
	tag: string,
	payload: unknown,
	workspaceId?: string,
): Promise<T> => {
	const id = String(++rpcId);
	const res = await fetch(`${BASE}/api`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Cookie: cookie,
			...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
		},
		body: JSON.stringify({ _tag: "Request", id, tag, payload, headers: [] }),
	});
	const messages = (await res.json()) as Array<{
		_tag: string;
		requestId?: string;
		exit?: { _tag: string; value?: T };
	}>;
	const exit = messages.find((m) => m._tag === "Exit" && m.requestId === id);
	if (exit?.exit?._tag !== "Success")
		throw new Error(`rpc ${tag}: ${JSON.stringify(messages)}`);
	return exit.exit.value as T;
};

const owner = await signUp("owner@example.com");
const member = await signUp("member@example.com");
const ws = await rpc<{ id: string }>(owner.cookie, "createWorkspace", {
	name: "Databases",
	slug: "databases",
});
const key = async (cookie: string, scope: "read" | "write") =>
	(
		await rpc<{ rawKey: string }>(cookie, "createApiKey", {
			name: `${scope} key`,
			scope,
		})
	).rawKey;
const writeKey = await key(owner.cookie, "write");
const readKey = await key(owner.cookie, "read");
const { inviteToken } = await rpc<{ inviteToken: string }>(
	owner.cookie,
	"regenerateInviteLink",
	{ workspaceId: ws.id },
);
await rpc(member.cookie, "joinWorkspaceByToken", { inviteToken });
const memberKey = await key(member.cookie, "write");

const PAGES = `/api/v1/workspaces/${ws.id}/pages`;

const call = async (
	apiKey: string,
	method: string,
	path: string,
	body?: unknown,
) => {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	return { status: res.status, body: (text ? JSON.parse(text) : null) as any };
};

/** A page only its creator (the owner) can see. */
const lockedPage = async () => {
	const { body: page } = await call(writeKey, "POST", PAGES, {
		title: "Private",
	});
	await rpc(
		owner.cookie,
		"writePagePermissions",
		{
			pageId: page.id,
			set: [{ subject: { type: "user", id: owner.userId }, relation: "owner" }],
			remove: [],
		},
		ws.id,
	);
	return page.id as string;
};

const DBS = `/api/v1/workspaces/${ws.id}/databases`;

/** A database on a fresh page, with one record and one text field. */
const database = async (pageId?: string) => {
	const page =
		pageId ?? (await call(writeKey, "POST", PAGES, { title: "Host" })).body.id;
	const { body: db } = await call(writeKey, "POST", DBS, {
		pageId: page,
		name: "Tasks",
	});
	const { body: rec } = await call(
		writeKey,
		"POST",
		`${DBS}/${db.id}/records`,
		{
			title: "Row",
		},
	);
	const { body: field } = await call(
		writeKey,
		"POST",
		`${DBS}/${db.id}/fields`,
		{
			name: "Status",
			type: "text",
		},
	);
	return { page: page as string, db: db.id, rec: rec.id, field: field.id };
};

// ── The operations ───────────────────────────────────────────────────────────

describe("database operations through REST", () => {
	test("create, list, update, trash and restore a database", async () => {
		const { body: page } = await call(writeKey, "POST", PAGES, { title: "H" });
		const created = await call(writeKey, "POST", DBS, {
			pageId: page.id,
			name: "Tasks",
		});
		expect(created.status).toBe(201);
		expect(Object.keys(created.body).sort()).toEqual([
			"deletedAt",
			"id",
			"isDeleted",
			"name",
			"pageId",
			"sortOrder",
			"titleHidden",
			"titleLabel",
		]);
		expect(created.body).toMatchObject({ name: "Tasks", pageId: page.id });
		const id = created.body.id as string;

		const updated = await call(writeKey, "PATCH", `${DBS}/${id}`, {
			name: "Renamed",
			titleLabel: "Task",
			titleHidden: true,
		});
		expect(updated.status).toBe(200);
		expect(updated.body).toMatchObject({
			id,
			name: "Renamed",
			titleLabel: "Task",
			titleHidden: true,
		});

		const listed = await call(readKey, "GET", DBS);
		expect(listed.status).toBe(200);
		expect(listed.body).toContainEqual(updated.body);

		expect((await call(writeKey, "DELETE", `${DBS}/${id}`)).status).toBe(204);
		const restored = await call(writeKey, "POST", `${DBS}/${id}/restore`);
		expect(restored).toEqual({ status: 200, body: { restored: true } });
	});

	test("create, list, update and delete a field", async () => {
		const { db } = await database();
		const fields = `${DBS}/${db}/fields`;
		const created = await call(writeKey, "POST", fields, {
			name: "Priority",
			type: "select",
			options: ["Low", "High"],
		});
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({
			databaseId: db,
			name: "Priority",
			type: "select",
			options: ["Low", "High"],
			relationTargetDbId: null,
			formula: null,
		});
		const id = created.body.id as string;

		const updated = await call(writeKey, "PATCH", `${fields}/${id}`, {
			name: "Prio",
			options: null,
		});
		expect(updated.status).toBe(200);
		expect(updated.body).toMatchObject({ id, name: "Prio", options: null });

		const listed = await call(readKey, "GET", fields);
		expect(listed.status).toBe(200);
		expect(listed.body).toContainEqual(updated.body);

		expect((await call(writeKey, "DELETE", `${fields}/${id}`)).status).toBe(
			204,
		);
		const after = await call(readKey, "GET", fields);
		expect(after.body.map((f: { id: string }) => f.id)).not.toContain(id);
	});

	test("create, set a cell on, list, update, trash and restore a record", async () => {
		const { db, field } = await database();
		const records = `${DBS}/${db}/records`;
		const created = await call(writeKey, "POST", records, { title: "Fix" });
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({
			databaseId: db,
			title: "Fix",
			description: "",
			pageId: null,
			isDeleted: false,
			deletedAt: null,
		});
		const id = created.body.id as string;

		const cell = await call(
			writeKey,
			"PUT",
			`${records}/${id}/fields/${field}`,
			{ value: "Doing" },
		);
		expect(cell.status).toBe(200);
		expect(cell.body).toEqual({
			id: expect.any(String),
			recordId: id,
			fieldId: field,
			value: "Doing",
		});

		const updated = await call(writeKey, "PATCH", `${records}/${id}`, {
			title: "Fixed",
			description: "done",
		});
		expect(updated).toEqual({ status: 200, body: { updated: true } });

		const listed = await call(readKey, "GET", records);
		expect(listed.status).toBe(200);
		expect(listed.body).toContainEqual({
			id,
			databaseId: db,
			title: "Fixed",
			description: "done",
			isDeleted: false,
			createdAt: created.body.createdAt,
			fields: { Status: "Doing" },
		});

		expect((await call(writeKey, "DELETE", `${records}/${id}`)).status).toBe(
			204,
		);
		const restored = await call(writeKey, "POST", `${records}/${id}/restore`);
		expect(restored).toEqual({ status: 200, body: { restored: true } });
	});

	test("a non-string cell value is stored as its JSON", async () => {
		const { db, rec, field } = await database();
		const res = await call(
			writeKey,
			"PUT",
			`${DBS}/${db}/records/${rec}/fields/${field}`,
			{ value: ["a", "b"] },
		);
		expect(res.status).toBe(200);
		expect(res.body.value).toBe('["a","b"]');
	});

	test("a permanent delete purges the record", async () => {
		const { db, rec } = await database();
		const path = `${DBS}/${db}/records/${rec}`;
		expect(
			(await call(writeKey, "DELETE", `${path}?permanent=true`)).status,
		).toBe(204);
		expect((await call(writeKey, "POST", `${path}/restore`)).status).toBe(404);
	});
});

describe("malformed requests are refused with 422 naming the field", () => {
	const expect422 = (res: { status: number; body: any }, field: string) => {
		expect(res.status).toBe(422);
		expect(res.body.error).toContain(field);
	};

	test("createDatabase without a name", async () => {
		const { page } = await database();
		expect422(await call(writeKey, "POST", DBS, { pageId: page }), "name");
	});

	test("updateDatabase with a titleHidden that is not a boolean", async () => {
		const { db } = await database();
		expect422(
			await call(writeKey, "PATCH", `${DBS}/${db}`, { titleHidden: "yes" }),
			"titleHidden",
		);
	});

	test("createField with an unknown type", async () => {
		const { db } = await database();
		expect422(
			await call(writeKey, "POST", `${DBS}/${db}/fields`, {
				name: "X",
				type: "colour",
			}),
			"type",
		);
	});

	test("createRecord with a title that is not a string", async () => {
		const { db } = await database();
		expect422(
			await call(writeKey, "POST", `${DBS}/${db}/records`, { title: 7 }),
			"title",
		);
	});

	test("setCell without a value", async () => {
		const { db, rec, field } = await database();
		expect422(
			await call(
				writeKey,
				"PUT",
				`${DBS}/${db}/records/${rec}/fields/${field}`,
				{},
			),
			"value",
		);
	});

	test("deleteRecord with a permanent flag that is not a boolean", async () => {
		const { db, rec } = await database();
		expect422(
			await call(
				writeKey,
				"DELETE",
				`${DBS}/${db}/records/${rec}?permanent=maybe`,
			),
			"permanent",
		);
	});
});

describe("unknown ids are 404", () => {
	test("an unknown database", async () => {
		expect((await call(readKey, "GET", `${DBS}/nope/fields`)).status).toBe(404);
		expect(
			(await call(writeKey, "PATCH", `${DBS}/nope`, { name: "x" })).status,
		).toBe(404);
	});

	test("an unknown record or field of a known database", async () => {
		const { db, rec, field } = await database();
		expect(
			(
				await call(writeKey, "PATCH", `${DBS}/${db}/records/nope`, {
					title: "x",
				})
			).status,
		).toBe(404);
		expect(
			(
				await call(writeKey, "PUT", `${DBS}/${db}/records/${rec}/fields/nope`, {
					value: "x",
				})
			).status,
		).toBe(404);
		expect(
			(await call(writeKey, "DELETE", `${DBS}/${db}/fields/nope`)).status,
		).toBe(404);
		expect(field).toBeString();
	});

	test("another database's record or field is not found through this one, and is left untouched", async () => {
		const mine = await database();
		const theirs = await database(await lockedPage());
		const attempts = [
			await call(
				memberKey,
				"PATCH",
				`${DBS}/${mine.db}/records/${theirs.rec}`,
				{ title: "pwned" },
			),
			await call(
				memberKey,
				"PUT",
				`${DBS}/${mine.db}/records/${theirs.rec}/fields/${theirs.field}`,
				{ value: "pwned" },
			),
			await call(
				memberKey,
				"DELETE",
				`${DBS}/${mine.db}/records/${theirs.rec}?permanent=true`,
			),
			await call(
				memberKey,
				"PATCH",
				`${DBS}/${mine.db}/fields/${theirs.field}`,
				{ name: "pwned" },
			),
			await call(
				memberKey,
				"DELETE",
				`${DBS}/${mine.db}/fields/${theirs.field}`,
			),
		];
		expect(attempts.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);
		const records = await call(readKey, "GET", `${DBS}/${theirs.db}/records`);
		expect(records.body).toEqual([
			expect.objectContaining({ id: theirs.rec, title: "Row", fields: {} }),
		]);
		const fields = await call(readKey, "GET", `${DBS}/${theirs.db}/fields`);
		expect(fields.body.map((f: { name: string }) => f.name)).toContain(
			"Status",
		);
	});
});

describe("a database the caller cannot access is refused", () => {
	test("reads and writes on it are 403, and it is not listed", async () => {
		const { db, rec, field, page } = await database(await lockedPage());
		const attempts = [
			await call(memberKey, "GET", `${DBS}/${db}/records`),
			await call(memberKey, "GET", `${DBS}/${db}/fields`),
			await call(memberKey, "PATCH", `${DBS}/${db}`, { name: "pwned" }),
			await call(memberKey, "POST", DBS, { pageId: page, name: "pwned" }),
			await call(
				memberKey,
				"PUT",
				`${DBS}/${db}/records/${rec}/fields/${field}`,
				{ value: "pwned" },
			),
		];
		expect(attempts.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
		const listed = await call(memberKey, "GET", DBS);
		expect(listed.body.map((d: { id: string }) => d.id)).not.toContain(db);
	});
});

describe("each operation runs under its declared scope", () => {
	test("a read key runs the read operations", async () => {
		const { db } = await database();
		const reads = [
			await call(readKey, "GET", DBS),
			await call(readKey, "GET", `${DBS}/${db}/fields`),
			await call(readKey, "GET", `${DBS}/${db}/records`),
		];
		expect(reads.map((r) => r.status)).toEqual([200, 200, 200]);
	});

	test("a read key cannot run a write operation", async () => {
		const { page, db, rec, field } = await database();
		const attempts = [
			await call(readKey, "POST", DBS, { pageId: page, name: "x" }),
			await call(readKey, "PATCH", `${DBS}/${db}`, { name: "x" }),
			await call(readKey, "DELETE", `${DBS}/${db}`),
			await call(readKey, "POST", `${DBS}/${db}/restore`),
			await call(readKey, "POST", `${DBS}/${db}/fields`, {
				name: "x",
				type: "text",
			}),
			await call(readKey, "PATCH", `${DBS}/${db}/fields/${field}`, {
				name: "x",
			}),
			await call(readKey, "DELETE", `${DBS}/${db}/fields/${field}`),
			await call(readKey, "POST", `${DBS}/${db}/records`, { title: "x" }),
			await call(readKey, "PATCH", `${DBS}/${db}/records/${rec}`, {
				title: "x",
			}),
			await call(readKey, "DELETE", `${DBS}/${db}/records/${rec}`),
			await call(readKey, "POST", `${DBS}/${db}/records/${rec}/restore`),
			await call(
				readKey,
				"PUT",
				`${DBS}/${db}/records/${rec}/fields/${field}`,
				{ value: "x" },
			),
		];
		expect(attempts.map((r) => r.status)).toEqual(Array(12).fill(403));
	});
});
