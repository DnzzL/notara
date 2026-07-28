import fs from "node:fs";
import path from "node:path";
import {
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import AdmZip from "adm-zip";
import { loadSettings } from "./settings.js";

export interface BackupResult {
	key: string;
	size: number;
	timestamp: string;
}

export interface BackupListItem {
	key: string;
	size: number;
	lastModified: string;
}

/**
 * Build an S3 client from the resolved settings, along with the bucket and
 * normalized key prefix. Throws if S3 backups are not fully configured.
 * Shared by triggerBackup, listBackups, and the restore handler.
 */
export function getS3(): { client: S3Client; bucket: string; prefix: string } {
	const settings = loadSettings();

	if (!settings.s3Enabled) throw new Error("S3 backup is not enabled");
	if (!settings.s3Bucket) throw new Error("S3 bucket is not configured");
	if (!settings.s3AccessKeyId || !settings.s3SecretAccessKey)
		throw new Error("S3 credentials are not configured");

	const endpoint = settings.s3Endpoint
		? /^https?:\/\//i.test(settings.s3Endpoint)
			? settings.s3Endpoint
			: `https://${settings.s3Endpoint}`
		: undefined;

	const client = new S3Client({
		region: settings.s3Region || "us-east-1",
		endpoint,
		forcePathStyle: !!endpoint,
		credentials: {
			accessKeyId: settings.s3AccessKeyId,
			secretAccessKey: settings.s3SecretAccessKey,
		},
	});

	const prefix = settings.s3Prefix
		? `${settings.s3Prefix.replace(/\/$/, "")}/`
		: "";
	return { client, bucket: settings.s3Bucket, prefix };
}

export async function triggerBackup(): Promise<BackupResult> {
	const { client, bucket, prefix } = getS3();

	const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
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

	const zipBuffer = zip.toBuffer();
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const key = `${prefix}backup-${timestamp}.zip`;

	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: zipBuffer,
			ContentType: "application/zip",
		}),
	);

	return { key, size: zipBuffer.length, timestamp: new Date().toISOString() };
}

/** List backup zips in the bucket, newest first. */
export async function listBackups(): Promise<BackupListItem[]> {
	const { client, bucket, prefix } = getS3();

	const items: BackupListItem[] = [];
	let continuationToken: string | undefined;
	do {
		const resp = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: continuationToken,
			}),
		);
		for (const obj of resp.Contents ?? []) {
			if (!obj.Key) continue;
			if (!/backup-.*\.zip$/.test(obj.Key)) continue;
			items.push({
				key: obj.Key,
				size: obj.Size ?? 0,
				lastModified: (obj.LastModified ?? new Date(0)).toISOString(),
			});
		}
		continuationToken = resp.IsTruncated
			? resp.NextContinuationToken
			: undefined;
	} while (continuationToken);

	items.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
	return items;
}
