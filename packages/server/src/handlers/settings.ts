import fs from "node:fs";
import path from "node:path";

const settingsPath = process.env.DATA_DIR
	? path.join(process.env.DATA_DIR, "settings.json")
	: path.join(process.cwd(), ".data", "settings.json");

export type BackupSchedule =
	| "manual"
	| "hourly"
	| "every6h"
	| "daily"
	| "weekly";

export interface AppSettings {
	s3Enabled: boolean;
	s3Endpoint: string;
	s3Region: string;
	s3Bucket: string;
	s3AccessKeyId: string;
	s3SecretAccessKey: string;
	s3Prefix: string;
	s3Schedule: BackupSchedule;
	/** Number of most recent backups to keep in the bucket. 0 = keep everything. */
	s3KeepLast: number;
	/** Days a trashed item is kept before the sweep permanently deletes it. */
	trashRetentionDays: number;
}

const defaults: AppSettings = {
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
};

// Env var overrides — take precedence over settings.json values.
function envOverrides(): Partial<AppSettings> {
	const o: Partial<AppSettings> = {};
	if (process.env.S3_BUCKET) {
		o.s3Bucket = process.env.S3_BUCKET;
		o.s3Enabled = true;
	}
	if (process.env.S3_REGION) o.s3Region = process.env.S3_REGION;
	if (process.env.S3_ENDPOINT) o.s3Endpoint = process.env.S3_ENDPOINT;
	if (process.env.S3_ACCESS_KEY) o.s3AccessKeyId = process.env.S3_ACCESS_KEY;
	if (process.env.S3_SECRET_KEY)
		o.s3SecretAccessKey = process.env.S3_SECRET_KEY;
	if (process.env.S3_PREFIX) o.s3Prefix = process.env.S3_PREFIX;
	if (process.env.S3_SCHEDULE)
		o.s3Schedule = process.env.S3_SCHEDULE as BackupSchedule;
	if (process.env.S3_KEEP_LAST) {
		const n = Number.parseInt(process.env.S3_KEEP_LAST, 10);
		if (Number.isFinite(n) && n >= 0) o.s3KeepLast = n;
	}
	if (process.env.TRASH_RETENTION_DAYS) {
		const n = Number.parseInt(process.env.TRASH_RETENTION_DAYS, 10);
		if (Number.isFinite(n) && n >= 0) o.trashRetentionDays = n;
	}
	return o;
}

export function loadSettings(): AppSettings {
	try {
		if (fs.existsSync(settingsPath)) {
			return {
				...defaults,
				...JSON.parse(fs.readFileSync(settingsPath, "utf-8")),
				...envOverrides(),
			};
		}
	} catch {}
	return { ...defaults, ...envOverrides() };
}

export function saveSettings(settings: AppSettings): void {
	const dir = path.dirname(settingsPath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}
