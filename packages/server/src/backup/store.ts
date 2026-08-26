/**
 * Where backups live, behind four operations.
 *
 * There was no seam here. `getS3()` was called directly by the trigger, list,
 * prune and restore paths, so archive assembly, key naming, retention and
 * transport were one undifferentiated mass — adding filesystem backup meant
 * editing four functions rather than writing one adapter.
 *
 * Two interface leaks went with it. "S3 backup is not enabled" was a bare
 * thrown `Error` whose *message* the scheduler matched on, so renaming the
 * string would have silently changed control flow. And nothing here could be
 * tested without a live bucket: coverage was one pure retention helper.
 *
 * The second adapter is the point rather than a hypothetical. Self-hosters
 * without an S3 bucket are precisely the audience for an AGPL notes app, and
 * until now the answer to "how do I back this up" was "set up object storage".
 * It also makes the archive itself testable, against a directory.
 */
import fs from "node:fs";
import path from "node:path";
import {
	DeleteObjectsCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { type AppSettings, loadSettings } from "../handlers/settings.js";

export interface BackupListItem {
	key: string;
	size: number;
	lastModified: string;
}

/**
 * Backups are not configured, or not configured completely.
 *
 * A type rather than a message, because the scheduler used to decide what to do
 * by matching on the text of an Error — which made the wording of a string into
 * load-bearing control flow.
 */
export class BackupNotConfigured extends Error {
	readonly _tag = "BackupNotConfigured";
	constructor(reason: string) {
		super(reason);
		this.name = "BackupNotConfigured";
	}
}

export interface BackupStore {
	/** Human-readable target, for logs and the settings screen. */
	readonly describe: string;
	put(key: string, body: Uint8Array): Promise<void>;
	/** Newest first. */
	list(): Promise<BackupListItem[]>;
	get(key: string): Promise<Uint8Array>;
	delete(keys: readonly string[]): Promise<void>;
	/** Prefix every key gets, so the two adapters name archives alike. */
	readonly prefix: string;
}

const isBackupArchive = (key: string) => /backup-.*\.zip$/.test(key);

/**
 * Newest first, by key rather than by modification time.
 *
 * The key carries the moment the backup was taken and sorts lexicographically;
 * mtime only records when the bytes happened to land. Two archives written in
 * the same millisecond sort arbitrarily by mtime, and retention — which deletes
 * everything past the newest N — must not depend on an arbitrary order.
 */
const newestFirst = (a: BackupListItem, b: BackupListItem) =>
	b.key.localeCompare(a.key);

// ── S3 ───────────────────────────────────────────────────────────────────────

const s3Store = (settings: AppSettings): BackupStore => {
	if (!settings.s3Bucket)
		throw new BackupNotConfigured("S3 bucket is not configured");
	if (!settings.s3AccessKeyId || !settings.s3SecretAccessKey)
		throw new BackupNotConfigured("S3 credentials are not configured");

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

	const bucket = settings.s3Bucket;
	const prefix = settings.s3Prefix
		? `${settings.s3Prefix.replace(/\/$/, "")}/`
		: "";

	return {
		describe: `S3 bucket ${bucket}`,
		prefix,
		async put(key, body) {
			await client.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: key,
					Body: body,
					ContentType: "application/zip",
				}),
			);
		},
		async list() {
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
					if (!obj.Key || !isBackupArchive(obj.Key)) continue;
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

			items.sort(newestFirst);
			return items;
		},
		async get(key) {
			const resp = await client.send(
				new GetObjectCommand({ Bucket: bucket, Key: key }),
			);
			const bytes = await resp.Body?.transformToByteArray();
			if (!bytes) throw new Error(`Backup ${key} has no body`);
			return bytes;
		},
		async delete(keys) {
			// S3 DeleteObjects accepts at most 1000 keys per call.
			for (let i = 0; i < keys.length; i += 1000) {
				await client.send(
					new DeleteObjectsCommand({
						Bucket: bucket,
						Delete: {
							Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })),
						},
					}),
				);
			}
		},
	};
};

// ── Local filesystem ─────────────────────────────────────────────────────────

const localStore = (directory: string): BackupStore => ({
	describe: `local directory ${directory}`,
	prefix: "",
	async put(key, body) {
		await fs.promises.mkdir(directory, { recursive: true });
		await fs.promises.writeFile(path.join(directory, key), body);
	},
	async list() {
		if (!fs.existsSync(directory)) return [];
		const names = (await fs.promises.readdir(directory)).filter(
			isBackupArchive,
		);
		const items = await Promise.all(
			names.map(async (key) => {
				const stat = await fs.promises.stat(path.join(directory, key));
				return {
					key,
					size: stat.size,
					lastModified: stat.mtime.toISOString(),
				};
			}),
		);
		items.sort(newestFirst);
		return items;
	},
	async get(key) {
		// The key comes from a caller and is joined onto a path, so a key
		// containing "../" would read outside the backup directory.
		if (key.includes("/") || key.includes("\\") || key.includes(".."))
			throw new Error(`Invalid backup key: ${key}`);
		return await fs.promises.readFile(path.join(directory, key));
	},
	async delete(keys) {
		for (const key of keys) {
			if (key.includes("/") || key.includes("\\") || key.includes(".."))
				continue;
			await fs.promises.rm(path.join(directory, key), { force: true });
		}
	},
});

/** Where local backups go when no directory is configured. */
export const defaultLocalBackupDir = () =>
	path.join(
		process.env.DATA_DIR ?? path.join(process.cwd(), ".data"),
		"backups",
	);

/**
 * The configured store, or `BackupNotConfigured`.
 *
 * The target is explicit rather than inferred. Falling back to local storage
 * whenever S3 is off would turn a scheduler that quietly did nothing into one
 * that quietly fills a disk, which is not an improvement anyone asked for.
 */
export function resolveBackupStore(
	settings: AppSettings = loadSettings(),
): BackupStore {
	const target = settings.backupTarget;
	if (target === "off")
		throw new BackupNotConfigured("Backups are not enabled");
	if (target === "local")
		return localStore(settings.localBackupDir || defaultLocalBackupDir());
	return s3Store(settings);
}

/** For tests and for callers that only need to know whether to bother. */
export const backupsConfigured = (settings: AppSettings = loadSettings()) =>
	settings.backupTarget !== "off";

export { localStore as localBackupStore };
