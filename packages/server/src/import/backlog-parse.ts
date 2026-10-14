/**
 * Reading a Backlog.md project (NOT-156, NOT-157).
 *
 * The pure half of the import: files in, tasks out, no database and no
 * editor. `./backlog.ts` writes those tasks through the server's own
 * database; `../import-backlog-api.ts` writes them through the REST API. Both
 * read the same way, so a task is parsed once however it is imported.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ValidationError } from "@notara/shared";
import { Effect } from "effect";

export type BacklogTask = {
	id: string;
	/** `n` of `NOT-n`; null for a subtask (`NOT-25.1`), which takes the next free one. */
	number: number | null;
	parent: string | null;
	title: string;
	status: string;
	assignees: string[];
	labels: string[];
	priority: string | null;
	dependencies: string[];
	criteria: Array<{ text: string; checked: boolean }>;
	/** Description first, then the other sections, in file order. */
	sections: Array<{ heading: string | null; text: string }>;
	comments: Array<{ author: string; created: string; body: string }>;
};

/** Headings for the sections Backlog.md writes between `SECTION:X` markers. */
const SECTION_HEADINGS: Record<string, string> = {
	PLAN: "Implementation Plan",
	NOTES: "Implementation Notes",
	FINAL_SUMMARY: "Final Summary",
};

/** A frontmatter value as a list of strings, however it was written. */
export const strings = (v: unknown) =>
	Array.isArray(v) ? v.map(String) : v == null || v === "" ? [] : [String(v)];

export const parseTask = (
	file: string,
	archived: boolean,
): BacklogTask | null => {
	const fm = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(file);
	if (!fm) return null;
	let meta: Record<string, unknown>;
	try {
		meta = (Bun.YAML.parse(fm[1]) ?? {}) as Record<string, unknown>;
	} catch {
		return null;
	}
	const id = String(meta.id ?? "");
	if (!/-\d+(\.\d+)*$/.test(id)) return null;
	const whole = /-(\d+)$/.exec(id);
	const body = fm[2];
	const sections: BacklogTask["sections"] = [];
	for (const [, name, text] of body.matchAll(
		/<!-- SECTION:(\w+):BEGIN -->([\s\S]*?)<!-- SECTION:\1:END -->/g,
	)) {
		if (!text.trim()) continue;
		sections.push({
			heading:
				name === "DESCRIPTION"
					? null
					: (SECTION_HEADINGS[name] ?? name.replace(/_/g, " ").toLowerCase()),
			text: text.trim(),
		});
	}
	const ac = /<!-- AC:BEGIN -->([\s\S]*?)<!-- AC:END -->/.exec(body)?.[1] ?? "";
	const comments =
		/<!-- COMMENTS:BEGIN -->([\s\S]*?)<!-- COMMENTS:END -->/.exec(body)?.[1] ??
		"";
	return {
		id,
		number: whole ? Number(whole[1]) : null,
		parent:
			typeof meta.parent_task_id === "string" ? meta.parent_task_id : null,
		title: String(meta.title ?? id).trim(),
		status: archived ? "done" : String(meta.status ?? "needs-triage"),
		assignees: strings(meta.assignee).map((a) => a.replace(/^@/, "")),
		labels: strings(meta.labels),
		priority: typeof meta.priority === "string" ? meta.priority : null,
		dependencies: strings(meta.dependencies),
		criteria: [...ac.matchAll(/^- \[([ xX])\] (?:#\d+ )?(.*)$/gm)].map(
			([, mark, text]) => ({ text, checked: mark !== " " }),
		),
		sections,
		// Backlog.md reserves a standalone `---` line as the comment delimiter.
		comments: [
			...comments.matchAll(
				/^author: (.*)\ncreated: (.*)\n---\n([\s\S]*?)\n---$/gm,
			),
		].map(([, author, created, text]) => ({
			author,
			created,
			body: text.trim(),
		})),
	};
};

/** The tasks in `dir`, and the files that are not tasks this import reads. */
const readTasks = (dir: string, archived: boolean) =>
	Effect.promise(async () => {
		const names = await readdir(dir).catch(() => [] as string[]);
		const tasks: BacklogTask[] = [];
		const unreadable: string[] = [];
		for (const name of names.filter((n) => n.endsWith(".md"))) {
			const task = parseTask(
				await readFile(path.join(dir, name), "utf-8"),
				archived,
			);
			if (task) tasks.push(task);
			else unreadable.push(path.join(dir, name));
		}
		return { tasks, unreadable };
	});

export type BacklogRead = {
	config: Record<string, unknown>;
	/** Numbered tasks first, so a subtask's fresh number comes after them all. */
	tasks: BacklogTask[];
	unreadable: string[];
};

/**
 * Every task of a Backlog.md project: `tasks/`, `completed/` and
 * `archive/tasks/`, completed and archived both landing as `done`.
 */
export const readBacklog = (dir: string) =>
	Effect.gen(function* () {
		const configText = yield* Effect.promise(() =>
			readFile(path.join(dir, "config.yml"), "utf-8").catch(() => null),
		);
		if (configText === null)
			return yield* new ValidationError({
				message: `${dir} is not a Backlog.md project: no config.yml`,
			});
		const config = (Bun.YAML.parse(configText) ?? {}) as Record<
			string,
			unknown
		>;
		const read = [
			yield* readTasks(path.join(dir, "tasks"), false),
			yield* readTasks(path.join(dir, "completed"), true),
			yield* readTasks(path.join(dir, "archive/tasks"), true),
		];
		const tasks = read
			.flatMap((r) => r.tasks)
			.sort(
				(a, b) =>
					(a.number ?? Number.POSITIVE_INFINITY) -
					(b.number ?? Number.POSITIVE_INFINITY),
			);
		const ids = tasks.map((t) => t.id);
		const twice = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
		if (twice.length > 0)
			return yield* new ValidationError({
				message: `More than one task has the id ${twice.join(", ")}`,
			});
		return { config, tasks, unreadable: read.flatMap((r) => r.unreadable) };
	});
