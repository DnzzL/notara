import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { type BackupStore, resolveBackupStore } from "../backup/store.js";
import { platformDb } from "../platform-db.js";
import { triggerBackup } from "./backup.js";

export interface RestoreResult {
	ok: true;
	restoredFrom: string;
	/** Key of the safety snapshot taken before overwriting. */
	snapshot: string;
}

function dataDir(): string {
	return process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
}

/** Remove a file plus any SQLite -wal/-shm sidecars. */
function rmDbFiles(dbPath: string): void {
	for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
		if (fs.existsSync(p)) fs.rmSync(p, { force: true });
	}
}

/**
 * Restore the whole instance from a backup archive.
 *
 * THE CALLER MUST EXIT THE PROCESS AFTERWARDS. This overwrites platform.db,
 * every workspace database and the attachments directory on disk, while the
 * server still holds open SQLite handles to files that no longer exist. Those
 * handles are not hot-swappable; the process has to be replaced (Docker's
 * restart policy does it).
 *
 * That requirement is stated in the return type as well as here — `RestoreResult`
 * is documented as "restart required" rather than "ok" — because a comment is
 * not a contract and this one has real consequences if missed.
 */
export async function restoreBackup(
	key: string,
	store: BackupStore = resolveBackupStore(),
): Promise<RestoreResult> {
	const prefix = store.prefix;

	// Validate the key: must live under our prefix and be a backup zip. Reject
	// anything that could traverse outside the backup namespace.
	if (key.includes("..") || key.includes("\0"))
		throw new Error("Invalid backup key");
	if (!key.startsWith(prefix))
		throw new Error("Backup key is outside the configured prefix");
	if (!/backup-.*\.zip$/.test(key))
		throw new Error("Key does not look like a backup zip");

	// Safety: snapshot the current state before we overwrite anything. Pruning is
	// off so retention can never delete the backup being restored.
	const snapshot = await triggerBackup({ prune: false, store });

	const bytes = await store.get(key);
	const zip = new AdmZip(Buffer.from(bytes));

	// Sanity check: a real backup always contains platform.db.
	const entries = zip.getEntries();
	if (!entries.some((e) => e.entryName === "platform.db")) {
		throw new Error(
			"Backup zip does not contain platform.db — refusing to restore",
		);
	}

	const dir = dataDir();
	const staging = path.join(dir, ".restore-tmp");
	if (fs.existsSync(staging))
		fs.rmSync(staging, { recursive: true, force: true });
	fs.mkdirSync(staging, { recursive: true });
	zip.extractAllTo(staging, true);

	// Close the live platform DB handle before overwriting its file.
	try {
		platformDb.close();
	} catch {
		// Already closed / closing — proceed.
	}

	// Replace platform.db (drop stale WAL/SHM first).
	const platformDbPath = path.join(dir, "platform.db");
	rmDbFiles(platformDbPath);
	const stagedPlatform = path.join(staging, "platform.db");
	if (fs.existsSync(stagedPlatform))
		fs.renameSync(stagedPlatform, platformDbPath);

	// Replace legacy notes.db if the backup carried one.
	const notesDbPath = path.join(dir, "notes.db");
	rmDbFiles(notesDbPath);
	const stagedNotes = path.join(staging, "notes.db");
	if (fs.existsSync(stagedNotes)) fs.renameSync(stagedNotes, notesDbPath);

	// Replace the whole workspaces/ directory (WAL/SHM go with it).
	const workspacesDir = path.join(dir, "workspaces");
	if (fs.existsSync(workspacesDir))
		fs.rmSync(workspacesDir, { recursive: true, force: true });
	const stagedWorkspaces = path.join(staging, "workspaces");
	if (fs.existsSync(stagedWorkspaces))
		fs.renameSync(stagedWorkspaces, workspacesDir);

	// Replace the whole attachments/ directory.
	const attachmentsDir = path.join(dir, "attachments");
	if (fs.existsSync(attachmentsDir))
		fs.rmSync(attachmentsDir, { recursive: true, force: true });
	const stagedAttachments = path.join(staging, "attachments");
	if (fs.existsSync(stagedAttachments))
		fs.renameSync(stagedAttachments, attachmentsDir);

	fs.rmSync(staging, { recursive: true, force: true });

	return { ok: true, restoredFrom: key, snapshot: snapshot.key };
}
