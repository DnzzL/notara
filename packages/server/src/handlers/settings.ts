import fs from "node:fs";
import path from "node:path";

const settingsPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "settings.json")
  : path.join(process.cwd(), ".data", "settings.json");

export type BackupSchedule = "manual" | "hourly" | "every6h" | "daily" | "weekly";

export interface AppSettings {
  s3Enabled: boolean;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3Prefix: string;
  s3Schedule: BackupSchedule;
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
};

export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsPath)) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(settingsPath, "utf-8")) };
    }
  } catch {}
  return { ...defaults };
}

export function saveSettings(settings: AppSettings): void {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}
