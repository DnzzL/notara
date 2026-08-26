import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import {
	type BackupListItem,
	type BackupStore,
	resolveBackupStore,
} from "../backup/store.js";
import { loadSettings } from "./settings.js";

export type { BackupListItem } from "../backup/store.js";

export interface BackupResult {
	key: string;
	size: number;
	timestamp: string;
}

/**
 * Assemble the archive: every database file plus the attachments directory.
 *
 * Split out from the upload so it can be exercised without a transport — until
 * the store seam existed, nothing about the archive's contents was testable.
 */
export function buildArchive(dataDir: string): Uint8Array {
	const zip = new AdmZip();

	// platform.db — users, workspaces, auth
	const platformDbPath = path.join(dataDir, "platform.db");
	if (fs.existsSync(platformDbPath)) zip.addLocalFile(platformDbPath);

	// workspaces/ — one .db file per workspace
	const workspacesDir = path.join(dataDir, "workspaces");
	if (fs.existsSync(workspacesDir))
		zip.addLocalFolder(workspacesDir, "workspaces");

	// attachments/
	const attachmentsDir = path.join(dataDir, "attachments");
	if (fs.existsSync(attachmentsDir))
		zip.addLocalFolder(attachmentsDir, "attachments");

	// legacy notes.db — include if present for older installs
	const legacyDbPath = path.join(dataDir, "notes.db");
	if (fs.existsSync(legacyDbPath)) zip.addLocalFile(legacyDbPath);

	return zip.toBuffer();
}

/** The name a backup taken now should carry. */
export function archiveKey(store: BackupStore, at = new Date()): string {
	return `${store.prefix}backup-${at.toISOString().replace(/[:.]/g, "-")}.zip`;
}

/**
 * Retention: given backups newest-first, return the ones to delete so only the
 * `keepLast` most recent survive. `keepLast <= 0` keeps everything.
 */
export function selectExpired(
	items: BackupListItem[],
	keepLast: number,
): BackupListItem[] {
	if (keepLast <= 0) return [];
	return items.slice(keepLast);
}

/**
 * Delete every backup beyond the `s3KeepLast` most recent. Returns the keys
 * removed. Called after a successful backup so the bucket stays bounded.
 */
export async function pruneBackups(
	store: BackupStore = resolveBackupStore(),
): Promise<string[]> {
	const keepLast = loadSettings().s3KeepLast ?? 0;
	const expired = selectExpired(await store.list(), keepLast);
	if (expired.length === 0) return [];

	const keys = expired.map((b) => b.key);
	await store.delete(keys);
	return keys;
}

/**
 * Zip the whole instance and upload it to S3. Prunes old backups afterwards
 * unless `prune` is false — the restore handler's safety snapshot passes false
 * so the purge can never delete the backup being restored.
 */
export async function triggerBackup({
	prune = true,
	store = resolveBackupStore(),
}: {
	prune?: boolean;
	store?: BackupStore;
} = {}): Promise<BackupResult> {
	const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
	const archive = buildArchive(dataDir);
	const key = archiveKey(store);

	await store.put(key, archive);

	if (prune) {
		const removed = await pruneBackups(store).catch((e) => {
			// A failed purge must not fail the backup that just succeeded.
			console.error("[backup] retention purge failed:", e);
			return [] as string[];
		});
		if (removed.length)
			console.log(
				`[backup] retention purge removed ${removed.length} backup(s)`,
			);
	}

	return { key, size: archive.length, timestamp: new Date().toISOString() };
}

/** Backups at the configured target, newest first. */
export async function listBackups(
	store: BackupStore = resolveBackupStore(),
): Promise<BackupListItem[]> {
	return await store.list();
}
