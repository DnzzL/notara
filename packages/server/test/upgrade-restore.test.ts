/**
 * The self-host upgrade and restore procedure, end to end (README → "Upgrade,
 * backup and restore"). Every command the README gives is exercised here with
 * the same env vars and endpoints:
 *
 *   - BACKUP_DIR            local-filesystem backup target
 *   - POST /api/backup/trigger, GET /api/backup/list, POST /api/backup/restore
 *   - restore exits the process (code 0); the orchestrator restarts it
 *   - migrations run on boot; /health answers 200 once the DB is open
 *
 * Rollback = restore (below) onto the previous tag's image. Restoring is the
 * same code path; booting an older *build* on a migrated database is not
 * exercised here.
 *
 * The S3 target shares the BackupStore seam (see backup-store.test.ts); only
 * the transport differs, so it is not re-tested against a live bucket.
 *
 * Release fixtures: test/fixtures/<tag>/migrations is a copy of
 * packages/server/migrations at a release tag. Every v*\/ directory is
 * upgraded to the current migrations below. Add one per new minor, after
 * tagging: `mkdir -p packages/server/test/fixtures/<tag> && git archive <tag>
 * packages/server/migrations | tar -x -C packages/server/test/fixtures/<tag>
 * --strip-components=2`. No test edit needed.
 */
import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyMigrations } from "../src/platform-db.js";
import { bootServer, freePort } from "./boot-server.js";

const CURRENT = path.join(import.meta.dir, "..", "migrations");
const FIXTURES = path.join(import.meta.dir, "fixtures");
const TAGS = fs
	.readdirSync(FIXTURES)
	.filter((d) => /^v\d/.test(d))
	.sort();

const tmpDirs: string[] = [];
const tmp = (label: string) => {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), `notara-${label}-`));
	tmpDirs.push(d);
	return d;
};

afterAll(() => {
	for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

const SECRET = "test-secret-for-upgrade-restore-checks-only";
const ADMIN_A = {
	email: "admin-a@example.test",
	password: "correct-horse-1234",
};
const ADMIN_B = {
	email: "admin-b@example.test",
	password: "battery-staple-5678",
};
type Account = typeof ADMIN_A;

/** Boot the real server, as the container's CMD does, and wait for /health. */
const boot = (
	port: number,
	dataDir: string,
	extra: Record<string, string> = {},
) =>
	bootServer(
		(base) => ({
			DATA_DIR: dataDir,
			BETTER_AUTH_SECRET: SECRET,
			BASE_URL: base,
			TRUSTED_ORIGINS: base,
			ADMIN_EMAILS: `${ADMIN_A.email},${ADMIN_B.email}`,
			...extra,
		}),
		port,
	);

const json = (cookie: string, body?: unknown): RequestInit => ({
	method: body === undefined ? "GET" : "POST",
	headers: { "Content-Type": "application/json", Cookie: cookie },
	body: body === undefined ? undefined : JSON.stringify(body),
});

/** Cookie header from a Better Auth response. */
const cookieOf = (res: Response) =>
	res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");

async function signUp(base: string, acct: Account): Promise<string> {
	const res = await fetch(`${base}/api/auth/sign-up/email`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: base },
		body: JSON.stringify({ name: "Admin", ...acct }),
	});
	expect(res.status).toBe(200);
	return cookieOf(res);
}

async function signIn(base: string, acct: Account) {
	const res = await fetch(`${base}/api/auth/sign-in/email`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: base },
		body: JSON.stringify(acct),
	});
	return { status: res.status, cookie: cookieOf(res) };
}

/** A workspace db + an attachment: the data a backup must carry. */
function seedWorkspace(dataDir: string, migrations: string) {
	fs.mkdirSync(path.join(dataDir, "workspaces"), { recursive: true });
	const ws = new Database(path.join(dataDir, "workspaces", "ws-seed.db"));
	applyMigrations(ws, migrations);
	ws.run("INSERT INTO pages (id, title) VALUES ('p1', 'Seeded page')");
	ws.close();
	fs.mkdirSync(path.join(dataDir, "attachments"), { recursive: true });
	fs.writeFileSync(path.join(dataDir, "attachments", "a.txt"), "attachment");
}

const pageTitle = (dataDir: string) => {
	const ws = new Database(path.join(dataDir, "workspaces", "ws-seed.db"), {
		readonly: true,
	});
	try {
		return (ws.query("SELECT title FROM pages WHERE id='p1'").get() as any)
			?.title;
	} finally {
		ws.close();
	}
};

describe("backup then restore into a fresh data dir", () => {
	test("local-fs backup restores users, workspaces and attachments", async () => {
		const backups = tmp("backups");

		// 1. Instance A: an admin, a workspace db, an attachment → backup.
		const dirA = tmp("data-a");
		const a = await boot(freePort(), dirA, { BACKUP_DIR: backups });
		const cookieA = await signUp(a.base, ADMIN_A);
		seedWorkspace(dirA, CURRENT);
		const trig = await fetch(`${a.base}/api/backup/trigger`, json(cookieA, {}));
		expect(trig.status).toBe(200);
		const { key } = (await trig.json()) as { key: string };
		expect(fs.readdirSync(backups)).toContain(key);
		a.proc.kill();
		await a.proc.exited;

		// 2. Instance B: fresh dir, same backup target, its own admin account.
		//    Restore from the backup written by A.
		const dirB = tmp("data-b");
		const portB = freePort();
		const b = await boot(portB, dirB, { BACKUP_DIR: backups });
		const cookieB = await signUp(b.base, ADMIN_B);
		const list = await fetch(`${b.base}/api/backup/list`, json(cookieB));
		expect(
			((await list.json()) as { key: string }[]).map((i) => i.key),
		).toContain(key);

		const restore = await fetch(
			`${b.base}/api/backup/restore`,
			json(cookieB, { key }),
		);
		expect(restore.status).toBe(200);
		// By design: the process exits so the orchestrator restarts it.
		expect(await b.proc.exited).toBe(0);

		// 3. The "restart": same data dir, new process. Data is A's.
		const b2 = await boot(portB, dirB, { BACKUP_DIR: backups });
		expect(pageTitle(dirB)).toBe("Seeded page");
		expect(
			fs.readFileSync(path.join(dirB, "attachments", "a.txt"), "utf-8"),
		).toBe("attachment");
		// A's account came across; B's own account was replaced by the restore.
		expect((await signIn(b2.base, ADMIN_A)).status).toBe(200);
		expect((await signIn(b2.base, ADMIN_B)).status).not.toBe(200);
		b2.proc.kill();
	}, 60_000);
});

test("release fixtures exist", () => expect(TAGS.length).toBeGreaterThan(0));

for (const PREV of TAGS)
	describe(`a data dir from ${PREV} boots on the current migrations`, () => {
		const PREVIOUS = path.join(FIXTURES, PREV, "migrations");
		test("every previous migration is a prefix of the current set", () => {
			// Released migrations are immutable: editing one would skip it on
			// instances that already applied it.
			for (const sub of ["", "platform"]) {
				const files = (d: string) =>
					fs.readdirSync(path.join(d, sub)).filter((f) => f.endsWith(".sql"));
				for (const f of files(PREVIOUS)) {
					expect(fs.readFileSync(path.join(CURRENT, sub, f), "utf-8")).toBe(
						fs.readFileSync(path.join(PREVIOUS, sub, f), "utf-8"),
					);
				}
			}
		});

		test("the server migrates it on boot and the data survives", async () => {
			const dir = tmp("data-prev");
			fs.mkdirSync(dir, { recursive: true });

			// Build the data dir exactly as the previous release left it.
			const platform = new Database(path.join(dir, "platform.db"));
			applyMigrations(platform, path.join(PREVIOUS, "platform"));
			platform.run(
				`INSERT INTO "user" (id, name, email, createdAt, updatedAt)
			 VALUES ('u1', 'Old', 'old@example.test', 'x', 'x')`,
			);
			platform.close();
			seedWorkspace(dir, PREVIOUS);
			// An orphan from the FK-off era: its page is gone.
			const old = new Database(path.join(dir, "workspaces", "ws-seed.db"));
			old.run(
				"INSERT INTO blocks (id, page_id, type) VALUES ('orphan', 'gone', 'paragraph')",
			);
			old.close();

			const s = await boot(freePort(), dir);

			// Platform DB: user kept, newer migrations recorded.
			const p = new Database(path.join(dir, "platform.db"), { readonly: true });
			expect(
				(p.query(`SELECT email FROM "user" WHERE id='u1'`).get() as any).email,
			).toBe("old@example.test");
			const applied = (
				p.query("SELECT name FROM _migrations").all() as { name: string }[]
			).map((r) => r.name);
			p.close();
			const latestPlatform = fs
				.readdirSync(path.join(CURRENT, "platform"))
				.sort()
				.pop()!;
			expect(applied).toContain(latestPlatform);
			s.proc.kill();

			// Workspace DB: opened lazily on first use, through the server's own
			// code path (WorkspaceDbLive), in a process pointed at the same data dir.
			const open = Bun.spawnSync(
				[
					"bun",
					"-e",
					`import { Effect } from "effect";
				import { WorkspaceDb, WorkspaceDbLive } from ${JSON.stringify(path.join(import.meta.dir, "..", "src", "db.ts"))};
				await Effect.runPromise(Effect.gen(function* () { (yield* WorkspaceDb).getLayer("ws-seed"); }).pipe(Effect.provide(WorkspaceDbLive)));`,
				],
				{
					cwd: path.join(import.meta.dir, ".."),
					env: { ...process.env, DATA_DIR: dir },
				},
			);
			expect(open.stderr.toString()).toBe("");
			expect(open.exitCode).toBe(0);
			// The orphan is reported (per FK), then removed, before FKs go on.
			expect(open.stdout.toString()).toContain('"blocks.page_id -> pages":1');
			const ws = new Database(path.join(dir, "workspaces", "ws-seed.db"), {
				readonly: true,
			});
			const wsApplied = (
				ws.query("SELECT name FROM _migrations").all() as { name: string }[]
			).map((r) => r.name);
			const orphans = ws.query("SELECT id FROM blocks WHERE id='orphan'").all();
			ws.close();
			expect(orphans).toEqual([]);
			expect(wsApplied).toContain(
				fs
					.readdirSync(CURRENT)
					.filter((f) => f.endsWith(".sql"))
					.sort()
					.pop()!,
			);
			expect(pageTitle(dir)).toBe("Seeded page");
		}, 60_000);
	});
