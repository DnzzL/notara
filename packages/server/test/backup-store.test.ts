/**
 * What the seam bought.
 *
 * Before it, archive contents, key naming and restore were unreachable without
 * a live S3 bucket, so coverage was one pure retention helper. Against the
 * filesystem adapter they are ordinary tests.
 */
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import {
	BackupNotConfigured,
	localBackupStore,
	resolveBackupStore,
} from "../src/backup/store.js";
import {
	archiveKey,
	buildArchive,
	selectExpired,
} from "../src/handlers/backup.js";
import type { AppSettings } from "../src/handlers/settings.js";

const tmp = (label: string) =>
	fs.mkdtempSync(path.join(os.tmpdir(), `notara-${label}-`));

const settings = (over: Partial<AppSettings>): AppSettings =>
	({
		backupTarget: "off",
		localBackupDir: "",
		s3Enabled: false,
		s3Endpoint: "",
		s3Region: "us-east-1",
		s3Bucket: "",
		s3AccessKeyId: "",
		s3SecretAccessKey: "",
		s3Prefix: "backups",
		s3Schedule: "manual",
		s3KeepLast: 10,
		trashRetentionDays: 30,
		...over,
	}) as AppSettings;

describe("resolveBackupStore", () => {
	test("refuses with a typed failure when backups are off", () => {
		// A type rather than a message: the scheduler used to branch on the text.
		expect(() => resolveBackupStore(settings({ backupTarget: "off" }))).toThrow(
			BackupNotConfigured,
		);
	});

	test("refuses with a typed failure when S3 is chosen but incomplete", () => {
		expect(() =>
			resolveBackupStore(settings({ backupTarget: "s3", s3Bucket: "" })),
		).toThrow(BackupNotConfigured);
	});

	test("a self-hoster with no bucket can choose local storage", () => {
		const dir = tmp("local-choice");
		const store = resolveBackupStore(
			settings({ backupTarget: "local", localBackupDir: dir }),
		);
		expect(store.describe).toContain(dir);
		fs.rmSync(dir, { recursive: true, force: true });
	});
});

describe("the local adapter round-trips a backup", () => {
	test("put, list, get and delete", async () => {
		const dir = tmp("local-store");
		const store = localBackupStore(dir);

		expect(await store.list()).toEqual([]);

		await store.put("backup-2026-01-01.zip", new Uint8Array([1, 2, 3]));
		await store.put("backup-2026-01-02.zip", new Uint8Array([4, 5]));

		const listed = await store.list();
		// Newest first, the order retention depends on.
		expect(listed.map((i) => i.key)).toEqual([
			"backup-2026-01-02.zip",
			"backup-2026-01-01.zip",
		]);
		expect(listed[1].size).toBe(3);

		expect([...(await store.get("backup-2026-01-01.zip"))]).toEqual([1, 2, 3]);

		await store.delete(["backup-2026-01-01.zip"]);
		expect((await store.list()).map((i) => i.key)).toEqual([
			"backup-2026-01-02.zip",
		]);

		fs.rmSync(dir, { recursive: true, force: true });
	});

	test("ignores files that are not backup archives", async () => {
		const dir = tmp("local-noise");
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, "notes.txt"), "not a backup");
		const store = localBackupStore(dir);
		await store.put("backup-2026-01-01.zip", new Uint8Array([1]));
		expect((await store.list()).map((i) => i.key)).toEqual([
			"backup-2026-01-01.zip",
		]);
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test("refuses a key that would escape the backup directory", async () => {
		// The key reaches here from a caller and is joined onto a path.
		const dir = tmp("local-traversal");
		const store = localBackupStore(dir);
		await expect(store.get("../../etc/passwd")).rejects.toThrow(
			"Invalid backup key",
		);
		fs.rmSync(dir, { recursive: true, force: true });
	});
});

describe("the archive", () => {
	test("carries platform.db, workspace databases and attachments", () => {
		// Untestable before the seam: assembling it required a bucket to send to.
		const dataDir = tmp("archive");
		fs.writeFileSync(path.join(dataDir, "platform.db"), "platform");
		fs.mkdirSync(path.join(dataDir, "workspaces"));
		fs.writeFileSync(path.join(dataDir, "workspaces", "ws1.db"), "ws1");
		fs.mkdirSync(path.join(dataDir, "attachments"));
		fs.writeFileSync(path.join(dataDir, "attachments", "a.png"), "img");

		const entries = new AdmZip(Buffer.from(buildArchive(dataDir)))
			.getEntries()
			.map((e) => e.entryName)
			.sort();

		expect(entries).toContain("platform.db");
		expect(entries).toContain("workspaces/ws1.db");
		expect(entries).toContain("attachments/a.png");

		fs.rmSync(dataDir, { recursive: true, force: true });
	});

	test("omits what is not there rather than failing", () => {
		const dataDir = tmp("archive-empty");
		expect(() => buildArchive(dataDir)).not.toThrow();
		fs.rmSync(dataDir, { recursive: true, force: true });
	});
});

describe("archiveKey", () => {
	test("is sortable and carries the store's prefix", () => {
		const store = localBackupStore("/tmp/x");
		const key = archiveKey(store, new Date("2026-08-26T12:34:56.789Z"));
		// Colons are illegal in Windows filenames and awkward in S3 keys.
		expect(key).toBe("backup-2026-08-26T12-34-56-789Z.zip");
	});

	test("orders lexicographically the way retention needs", () => {
		const store = localBackupStore("/tmp/x");
		const older = archiveKey(store, new Date("2026-08-25T00:00:00Z"));
		const newer = archiveKey(store, new Date("2026-08-26T00:00:00Z"));
		expect([newer, older].sort()).toEqual([older, newer]);
	});
});

describe("selectExpired", () => {
	test("keeps everything when keepLast is zero", () => {
		const items = [1, 2, 3].map((n) => ({
			key: `backup-${n}.zip`,
			size: 0,
			lastModified: `2026-01-0${n}`,
		}));
		expect(selectExpired(items, 0)).toEqual([]);
	});

	test("drops everything past the newest N", () => {
		const items = [3, 2, 1].map((n) => ({
			key: `backup-${n}.zip`,
			size: 0,
			lastModified: `2026-01-0${n}`,
		}));
		expect(selectExpired(items, 2).map((i) => i.key)).toEqual(["backup-1.zip"]);
	});
});
