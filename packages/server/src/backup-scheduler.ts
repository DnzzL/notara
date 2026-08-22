import { pruneBackups, triggerBackup } from "./handlers/backup.js";
import { loadSettings } from "./handlers/settings.js";

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
		const interval =
			SCHEDULE_INTERVALS[settings.s3Schedule ?? "manual"] ?? null;

		if (settings.s3Schedule !== currentSchedule) {
			if (currentHandle) {
				clearInterval(currentHandle);
				currentHandle = null;
			}
			currentSchedule = settings.s3Schedule ?? "manual";
			if (interval !== null) {
				currentHandle = setInterval(() => {
					triggerBackup().catch((e) =>
						console.error("[backup] scheduled backup failed:", e),
					);
				}, interval);
			}
		}
	};

	setInterval(tick, 60_000);
	tick();

	// Purge on boot too, not only after a backup. Otherwise a bucket that is
	// already over the limit stays that way until the next scheduled run —
	// which on the "manual" or "weekly" schedule may be never or a week away.
	pruneBackups()
		.then((removed) => {
			if (removed.length)
				console.log(
					`[backup] startup retention purge removed ${removed.length} backup(s)`,
				);
		})
		.catch((e) => {
			// Not configured, or S3 unreachable — never block startup on this.
			if (e instanceof Error && /not enabled|not configured/.test(e.message))
				return;
			console.error("[backup] startup retention purge failed:", e);
		});
}
