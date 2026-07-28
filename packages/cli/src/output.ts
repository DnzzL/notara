import { Console, type Effect } from "effect";

const trunc = (s: string, max = 60) =>
	s.length > max ? `${s.slice(0, max - 1)}…` : s;

/** Render any value to a compact one-line string for table cells. */
const cell = (v: unknown): string => {
	if (v === null || v === undefined) return "";
	if (typeof v === "object") return trunc(JSON.stringify(v));
	return trunc(String(v).replace(/\s+/g, " "));
};

/** A left-aligned text table over `rows`, showing only `cols`. */
export const table = (
	rows: ReadonlyArray<Record<string, unknown>>,
	cols: string[],
): string => {
	if (rows.length === 0) return "(no results)";
	const widths = cols.map((c) =>
		Math.max(c.length, ...rows.map((r) => cell(r[c]).length)),
	);
	const line = (vals: string[]) =>
		vals.map((v, i) => v.padEnd(widths[i])).join("  ");
	return [
		line(cols),
		widths.map((w) => "─".repeat(w)).join("  "),
		...rows.map((r) => line(cols.map((c) => cell(r[c])))),
	].join("\n");
};

/** Key/value lines for a single object. */
export const kv = (obj: Record<string, unknown>): string =>
	Object.entries(obj)
		.map(
			([k, v]) =>
				`${k}: ${typeof v === "object" && v !== null ? JSON.stringify(v) : v}`,
		)
		.join("\n");

/**
 * Print `data` as a human table/text, unless `json` is set (or `data` is
 * scalar/null), in which case print pretty JSON. `render` produces the human
 * form. Keeping JSON one flag away makes the CLI scriptable and LLM-friendly.
 */
export const print = (
	json: boolean,
	data: unknown,
	render: (data: never) => string,
): Effect.Effect<void> =>
	Console.log(
		json || data === null || typeof data !== "object"
			? JSON.stringify(data, null, 2)
			: render(data as never),
	);
