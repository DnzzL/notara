import { describe, expect, test } from "bun:test";
import { type BackupListItem, selectExpired } from "../src/handlers/backup.js";

// listBackups returns newest-first, so the fixtures follow that order.
function backups(n: number): BackupListItem[] {
	return Array.from({ length: n }, (_, i) => ({
		key: `backups/backup-${String(n - i).padStart(3, "0")}.zip`,
		size: 1024,
		lastModified: new Date(Date.UTC(2026, 0, n - i)).toISOString(),
	}));
}

describe("selectExpired", () => {
	test("keeps everything when keepLast is 0 (unlimited)", () => {
		expect(selectExpired(backups(50), 0)).toEqual([]);
	});

	test("keeps everything when keepLast is negative", () => {
		expect(selectExpired(backups(5), -1)).toEqual([]);
	});

	test("keeps everything when under the limit", () => {
		expect(selectExpired(backups(3), 10)).toEqual([]);
	});

	test("keeps everything when exactly at the limit", () => {
		expect(selectExpired(backups(10), 10)).toEqual([]);
	});

	test("drops the oldest beyond the limit, newest survive", () => {
		const items = backups(12);
		const expired = selectExpired(items, 10);
		expect(expired.map((b) => b.key)).toEqual([
			"backups/backup-002.zip",
			"backups/backup-001.zip",
		]);
		// The newest is never touched.
		expect(expired).not.toContain(items[0]);
	});

	test("keepLast of 1 leaves only the newest", () => {
		const expired = selectExpired(backups(4), 1);
		expect(expired).toHaveLength(3);
		expect(expired.map((b) => b.key)).not.toContain("backups/backup-004.zip");
	});

	test("empty bucket deletes nothing", () => {
		expect(selectExpired([], 10)).toEqual([]);
	});
});
