import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { loadSettings } from "./settings.js";

export interface BackupResult {
  key: string;
  size: number;
  timestamp: string;
}

export async function triggerBackup(): Promise<BackupResult> {
  const settings = loadSettings();

  if (!settings.s3Enabled) throw new Error("S3 backup is not enabled");
  if (!settings.s3Bucket) throw new Error("S3 bucket is not configured");
  if (!settings.s3AccessKeyId || !settings.s3SecretAccessKey)
    throw new Error("S3 credentials are not configured");

  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
  const zip = new AdmZip();

  // platform.db — users, workspaces, auth
  const platformDbPath = path.join(dataDir, "platform.db");
  if (fs.existsSync(platformDbPath)) zip.addLocalFile(platformDbPath);

  // workspaces/ — one .db file per workspace
  const workspacesDir = path.join(dataDir, "workspaces");
  if (fs.existsSync(workspacesDir)) zip.addLocalFolder(workspacesDir, "workspaces");

  // attachments/
  const attachmentsDir = path.join(dataDir, "attachments");
  if (fs.existsSync(attachmentsDir)) zip.addLocalFolder(attachmentsDir, "attachments");

  // legacy notes.db — include if present for older installs
  const legacyDbPath = path.join(dataDir, "notes.db");
  if (fs.existsSync(legacyDbPath)) zip.addLocalFile(legacyDbPath);

  const zipBuffer = zip.toBuffer();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = settings.s3Prefix ? settings.s3Prefix.replace(/\/$/, "") + "/" : "";
  const key = `${prefix}backup-${timestamp}.zip`;

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

  await client.send(
    new PutObjectCommand({
      Bucket: settings.s3Bucket,
      Key: key,
      Body: zipBuffer,
      ContentType: "application/zip",
    })
  );

  return { key, size: zipBuffer.length, timestamp: new Date().toISOString() };
}
