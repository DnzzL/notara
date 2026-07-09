import { loadSettings } from "./handlers/settings.js";
import { triggerBackup } from "./handlers/backup.js";

const SCHEDULE_INTERVALS: Record<string, number | null> = {
  manual: null,
  hourly: 60 * 60 * 1000,
  every6h: 6 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/** Start the backup scheduler. Checks for schedule changes every minute. */
export function startBackupScheduler() {
  let currentHandle: ReturnType<typeof setInterval> | null = null;
  let currentSchedule: string | null = null;

  const tick = () => {
    const settings = loadSettings();
    const interval = SCHEDULE_INTERVALS[settings.s3Schedule ?? "manual"] ?? null;

    if (settings.s3Schedule !== currentSchedule) {
      if (currentHandle) { clearInterval(currentHandle); currentHandle = null; }
      currentSchedule = settings.s3Schedule ?? "manual";
      if (interval !== null) {
        currentHandle = setInterval(() => {
          triggerBackup().catch((e) => console.error("[backup] scheduled backup failed:", e));
        }, interval);
      }
    }
  };

  setInterval(tick, 60_000);
  tick();
}
