/**
 * Import a Backlog.md project into Notara over REST.
 *
 * `./import-backlog.ts` writes the same cards through the server's own
 * database, which means running where the server's `DATA_DIR` is. This one
 * needs only an API key, so it runs from wherever the `backlog/` directory
 * is — the same reading, a different writer. Both keep each task's `NOT-n`
 * number.
 *
 * Re-runnable: a card whose short id or title is already in the database is
 * skipped, never cloned.
 *
 * Usage:
 *   NOTARA_URL=https://… NOTARA_API_KEY=ntr_… NOTARA_WORKSPACE=… \
 *     bun packages/server/src/import-backlog-api.ts [backlogDir]
 */
import { Effect } from "effect";
import {
	type BacklogTask,
	readBacklog,
	strings,
} from "./import/backlog-parse.js";

const [dir = "backlog"] = process.argv.slice(2);
const url = process.env.NOTARA_URL;
const apiKey = process.env.NOTARA_API_KEY;
const workspace = process.env.NOTARA_WORKSPACE;

if (!url || !apiKey || !workspace) {
	console.error(
		"Usage: NOTARA_URL=… NOTARA_API_KEY=ntr_… NOTARA_WORKSPACE=… bun packages/server/src/import-backlog-api.ts [backlogDir]",
	);
	process.exit(1);
}

type Json = Record<string, unknown>;
type Database = { id: string; name: string };
type Field = { id: string; name: string };
type Card = { id: string; shortId: string; title: string };

const base = `${url.replace(/\/$/, "")}/api/v1/workspaces/${workspace}`;

const call = async <T>(
	method: string,
	path: string,
	body?: unknown,
): Promise<T> => {
	const res = await fetch(`${base}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	let data: Json | null = null;
	if (text !== "") {
		try {
			data = JSON.parse(text) as Json;
		} catch {
			throw new Error(`${method} ${path} → ${res.status}: ${text}`);
		}
	}
	if (!res.ok)
		throw new Error(
			`${method} ${path} → ${res.status}: ${data?.error ?? text}`,
		);
	return data as T;
};

/** The task's page as markdown: provenance, description, then the other sections. */
const bodyOf = (task: BacklogTask) => {
	const notes = [
		...(task.number === null
			? [
					`Imported from ${task.id}${task.parent ? `, a subtask of ${task.parent}` : ""}.`,
				]
			: []),
		...(task.assignees.length > 1
			? [`Assignees: ${task.assignees.map((a) => `@${a}`).join(", ")}`]
			: []),
	];
	const [description, ...others] =
		task.sections[0]?.heading === null
			? task.sections
			: [{ heading: null, text: "" }, ...task.sections];
	return [
		...notes,
		description.text,
		// Acceptance criteria are not here: they are `criteria:` on the write,
		// so each stays a to-do with an id the API can tick.
		...others.map((s) => `## ${s.heading}\n\n${s.text}`),
	]
		.filter((s) => s.trim() !== "")
		.join("\n\n");
};

const main = async () => {
	const { config, tasks, unreadable } = await Effect.runPromise(
		readBacklog(dir),
	);
	const prefix = String(config.task_prefix ?? "NOT");

	// ── The database and its fields: made once, found again on a rerun. ──────
	const databases = await call<Database[]>("GET", "/databases");
	let db = databases.find((d) => d.name === "Backlog");
	if (!db) {
		const page = await call<{ id: string }>("POST", "/pages", {
			title: "Backlog",
		});
		db = await call<Database>("POST", "/databases", {
			pageId: page.id,
			name: "Backlog",
		});
		await call("PATCH", `/databases/${db.id}`, { shortPrefix: prefix });
	}

	const seen = (pick: (t: BacklogTask) => string[]) => [
		...new Set(tasks.flatMap(pick)),
	];
	const specs = [
		{
			name: "Status",
			type: "select",
			options: [
				...new Set([...strings(config.statuses), ...seen((t) => [t.status])]),
			],
		},
		{
			name: "Agent",
			type: "select",
			options: seen((t) => t.assignees.slice(0, 1)),
		},
		{
			name: "Labels",
			type: "multiSelect",
			options: [
				...new Set([...strings(config.labels), ...seen((t) => t.labels)]),
			],
		},
		{ name: "Priority", type: "select", options: ["high", "medium", "low"] },
		{ name: "Depends on", type: "relation", options: null },
	] as const;
	for (const spec of specs) {
		const existing = await call<Field[]>("GET", `/databases/${db.id}/fields`);
		if (existing.some((f) => f.name === spec.name)) continue;
		await call("POST", `/databases/${db.id}/fields`, {
			name: spec.name,
			type: spec.type,
			...(spec.options ? { options: spec.options } : {}),
			...(spec.type === "relation" ? { relationTargetDbId: db.id } : {}),
		});
	}

	// ── The cards. ───────────────────────────────────────────────────────────
	const listed = await call<Card[]>("GET", `/databases/${db.id}/records`);
	const byShort = new Map(listed.map((r) => [r.shortId, r]));
	const byTitle = new Map(listed.map((r) => [r.title, r]));
	const bySource = new Map<string, Card>();

	let imported = 0;
	let skipped = 0;
	for (const task of tasks) {
		const shortId = task.number === null ? null : `${prefix}-${task.number}`;
		const already =
			(shortId === null ? undefined : byShort.get(shortId)) ??
			byTitle.get(task.title);
		if (already) {
			bySource.set(task.id, already);
			skipped++;
			continue;
		}
		const fields: Json = { Status: task.status };
		if (task.assignees[0]) fields.Agent = task.assignees[0];
		if (task.labels.length > 0) fields.Labels = task.labels;
		if (task.priority) fields.Priority = task.priority;

		const card = await call<Card>("POST", `/databases/${db.id}/records`, {
			title: task.title,
			...(task.number === null ? {} : { shortNumber: task.number }),
			fields,
			body: bodyOf(task),
			criteria: task.criteria.map((c) => ({
				text: c.text,
				checked: c.checked,
			})),
		});
		for (const c of task.comments)
			await call("POST", `/databases/${db.id}/records/${card.id}/comments`, {
				body: `**${c.author}** (${c.created}): ${c.body}`,
			});

		byShort.set(card.shortId, card);
		byTitle.set(task.title, card);
		bySource.set(task.id, card);
		imported++;
	}

	// ── Dependencies last: they may name tasks imported after the one citing them. ──
	for (const task of tasks) {
		if (task.dependencies.length === 0) continue;
		const self = bySource.get(task.id);
		const ids = task.dependencies
			.map((dep) => bySource.get(dep)?.id)
			.filter((id): id is string => id !== undefined);
		if (self && ids.length > 0)
			await call("PATCH", `/databases/${db.id}/records/${self.id}`, {
				fields: { "Depends on": ids },
			});
	}

	console.log(
		`Imported ${imported}, skipped ${skipped} already imported, into database ${db.id}`,
	);
	for (const file of unreadable)
		console.warn(`Not a task this import can read: ${file}`);
};

await main().catch((e) => {
	console.error(e instanceof Error ? e.message : e);
	process.exitCode = 1;
});
