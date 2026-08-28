export type AgendaRow = {
	record: { id: string; title?: string };
	values: Record<string, unknown>;
};

export type AgendaGroup = {
	/** `YYYY-MM-DD`, or null for the trailing bucket of undated records. */
	day: string | null;
	rows: AgendaRow[];
};

/**
 * Group records by day for the narrow calendar layout.
 *
 * Dated groups come first in chronological order; anything without a usable
 * date falls into a single trailing group. Records inside a day keep the order
 * they arrived in, which is whatever sort the view is already applying.
 *
 * Stored dates may be `YYYY-MM-DD` or a full ISO timestamp, so only the date
 * prefix is significant — the same assumption the month grid makes.
 */
export function buildAgenda(
	rows: AgendaRow[],
	dateFieldName: string | null,
): AgendaGroup[] {
	const byDay = new Map<string, AgendaRow[]>();
	const undated: AgendaRow[] = [];

	for (const row of rows) {
		const raw = dateFieldName ? row.values[dateFieldName] : null;
		const day = typeof raw === "string" ? raw.slice(0, 10) : "";
		if (!day) {
			undated.push(row);
			continue;
		}
		const bucket = byDay.get(day);
		if (bucket) bucket.push(row);
		else byDay.set(day, [row]);
	}

	const groups: AgendaGroup[] = [...byDay.entries()]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([day, dayRows]) => ({ day, rows: dayRows }));

	if (undated.length > 0) groups.push({ day: null, rows: undated });
	return groups;
}

const DAY_LABEL = new Intl.DateTimeFormat(undefined, {
	weekday: "short",
	day: "numeric",
	month: "short",
});

/** "Mon 10 Mar" — parsed as local time so a date never lands on the day before. */
export function formatAgendaDay(day: string): string {
	const [y, m, d] = day.split("-").map(Number);
	if (!y || !m || !d) return day;
	return DAY_LABEL.format(new Date(y, m - 1, d));
}
