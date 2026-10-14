/**
 * One-shot import of a Backlog.md project into a Notara database (NOT-156).
 *
 * Every task becomes a record that keeps its `NOT-n` number (a subtask such as
 * `NOT-25.1` takes the next free one and names its old id in its body);
 * status, assignee, labels, priority and dependencies become fields;
 * acceptance criteria become the to-dos of the record's page, the other
 * sections its body; comments come along with their original author written
 * in. Completed and archived tasks land as `done`.
 *
 * One transaction: a run that fails leaves nothing, so the next one starts
 * clean. The import ledger makes it re-runnable: a task already imported is
 * skipped, never cloned.
 *
 * `../import-backlog-api.ts` imports the same tasks over REST, for when the
 * server's database is not at hand; both read a project the same way.
 */
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ulid } from "ulidx";
import * as Blocks from "../handlers/blocks.js";
import * as Comments from "../handlers/comments.js";
import * as Databases from "../handlers/databases.js";
import * as Pages from "../handlers/pages.js";
import {
	readBacklog,
	strings,
	type BacklogTask as Task,
} from "./backlog-parse.js";
import { editorBlock, markdownAsEditorBlocks, todo } from "./editor-blocks.js";

const SOURCE = "backlog.md";

/** The record's page: provenance, description, criteria, then the other sections. */
const bodyBlocks = (task: Task) => {
	const md = markdownAsEditorBlocks;
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
		...notes.map((n) => editorBlock("paragraph", n)),
		...md(description.text),
		...(task.criteria.length > 0
			? [editorBlock("heading2", "Acceptance Criteria")]
			: []),
		...task.criteria.map((c) => todo(c.text, c.checked)),
		...others.flatMap((s) => [
			editorBlock("heading2", s.heading ?? ""),
			...md(s.text),
		]),
	];
};

export const importBacklog = (req: {
	/** The Backlog.md directory: `config.yml`, `tasks/`, `archive/tasks/`, `completed/`. */
	dir: string;
	workspaceId: string;
	/** Who the cards and comments are written as. */
	authorId: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const { config, tasks, unreadable } = yield* readBacklog(req.dir);

		const runId = ulid();
		const ledger = (kind: string, key: string) =>
			sql<{ id: string }>`
        SELECT local_id as id FROM import_ledger
        WHERE source = ${SOURCE} AND kind = ${kind} AND source_key = ${key}
      `.pipe(Effect.map((rows) => rows[0]?.id ?? null));
		const remember = (kind: string, key: string, id: string) =>
			sql`INSERT INTO import_ledger (source, kind, source_key, local_id, last_run_id)
          VALUES (${SOURCE}, ${kind}, ${key}, ${id}, ${runId})`;

		// The database and its fields: made once, found again on a rerun.
		let databaseId = yield* ledger("database", "backlog");
		const fieldIds = new Map<string, string>();
		if (!databaseId) {
			const page = yield* Pages.createPage({
				title: "Backlog",
				parentId: null,
			});
			const db = yield* Databases.createDatabase({
				pageId: page.id,
				name: "Backlog",
			});
			databaseId = db.id;
			yield* Databases.updateDatabase({
				id: db.id,
				shortPrefix: String(config.task_prefix ?? "NOT"),
			});
			const seen = (pick: (t: Task) => string[]) => [
				...new Set(tasks.flatMap(pick)),
			];
			const fields = [
				{
					name: "Status",
					type: "select",
					options: [
						...new Set([
							...strings(config.statuses),
							...seen((t) => [t.status]),
						]),
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
				{
					name: "Priority",
					type: "select",
					options: ["high", "medium", "low"],
				},
				{ name: "Depends on", type: "relation", options: null },
			] as const;
			for (const { name, type, options } of fields) {
				const field = yield* Databases.createField({
					databaseId: db.id,
					name,
					type,
					options: options ? [...options] : null,
					relationTargetDbId: type === "relation" ? db.id : null,
				});
				yield* remember("field", `${db.id}::${name}`, field.id);
			}
			yield* remember("database", "backlog", db.id);
		}
		for (const name of [
			"Status",
			"Agent",
			"Labels",
			"Priority",
			"Depends on",
		]) {
			const id = yield* ledger("field", `${databaseId}::${name}`);
			if (!id)
				return yield* Effect.die(
					new Error(`The backlog database has lost its "${name}" field`),
				);
			fieldIds.set(name, id);
		}
		const field = (name: string) => fieldIds.get(name) as string;

		let imported = 0;
		let skipped = 0;
		const fresh: Array<{ task: Task; recordId: string }> = [];
		for (const task of tasks) {
			if (yield* ledger("record", task.id)) {
				skipped++;
				continue;
			}
			const record = yield* Databases.createRecord({
				databaseId,
				title: task.title,
			});
			if (task.number !== null)
				yield* Databases.setShortNumber(record.id, task.number);
			const values: Array<[string, string | null]> = [
				["Status", task.status],
				["Agent", task.assignees[0] ?? null],
				["Labels", task.labels.length > 0 ? JSON.stringify(task.labels) : null],
				["Priority", task.priority],
			];
			for (const [name, value] of values)
				if (value !== null)
					yield* Databases.updateFieldValue({
						recordId: record.id,
						fieldId: field(name),
						value,
					});
			const { pageId } = yield* Databases.openRecordAsPage(record.id);
			for (const [index, block] of bodyBlocks(task).entries())
				yield* Blocks.createBlock({ pageId, ...block, index, parentId: null });
			for (const c of task.comments)
				yield* Comments.addComment({
					pageId,
					workspaceId: req.workspaceId,
					authorId: req.authorId,
					body: `**${c.author}** (${c.created}): ${c.body}`,
				});
			yield* remember("record", task.id, record.id);
			fresh.push({ task, recordId: record.id });
			imported++;
		}

		// Dependencies last: they may name tasks imported after the one citing them.
		for (const { task, recordId } of fresh) {
			const ids: string[] = [];
			for (const dep of task.dependencies) {
				const id = yield* ledger("record", dep);
				if (id) ids.push(id);
			}
			if (ids.length > 0)
				yield* Databases.updateFieldValue({
					recordId,
					fieldId: field("Depends on"),
					value: JSON.stringify(ids),
				});
		}

		return { databaseId, imported, skipped, unreadable };
	}).pipe((run) =>
		Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(run)),
	);
