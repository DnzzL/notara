import { BackupNotConfigured } from "./backup/store.js";
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
			// Not configured is an answer, not a failure. This used to be decided by
			// matching the TEXT of an error message, which made the wording of a
			// string into control flow — rename it and the scheduler starts logging
			// an error on every boot of every instance without backups.
			if (e instanceof BackupNotConfigured) return;
			console.error("[backup] startup retention purge failed:", e);
		});
}
