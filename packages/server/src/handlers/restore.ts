import fs from "node:fs";
import path from "node:path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import AdmZip from "adm-zip";
import { platformDb } from "../platform-db.js";
import { getS3, triggerBackup } from "./backup.js";

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
 * Restore the whole instance from a backup zip in S3.
 *
 * IMPORTANT: this overwrites platform.db, all workspace DBs, and attachments on
 * disk. The caller MUST exit the process afterwards so the server reopens fresh
 * SQLite handles (Docker's restart policy relaunches it). Open handles are not
 * hot-swappable.
 */
export async function restoreBackup(key: string): Promise<RestoreResult> {
	const { client, bucket, prefix } = getS3();

	// Validate the key: must live under our prefix and be a backup zip. Reject
	// anything that could traverse outside the backup namespace.
	if (key.includes("..") || key.includes("\0"))
		throw new Error("Invalid backup key");
	if (!key.startsWith(prefix))
		throw new Error("Backup key is outside the configured prefix");
	if (!/backup-.*\.zip$/.test(key))
		throw new Error("Key does not look like a backup zip");

	// Safety: snapshot the current state to S3 before we overwrite anything.
	const snapshot = await triggerBackup({ prune: false });

	// Download the chosen backup into memory.
	const resp = await client.send(
		new GetObjectCommand({ Bucket: bucket, Key: key }),
	);
	if (!resp.Body) throw new Error("Backup object had no body");
	const bytes = await resp.Body.transformToByteArray();
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
