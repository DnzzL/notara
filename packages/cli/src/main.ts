#!/usr/bin/env bun
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Console, Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { type Cfg, NotaraError, request, requireWorkspace } from "./client.js";
import { kv, print, table } from "./output.js";

// ── Global options (flag → env var → default) ──────────────────────────────────

const url = Flag.String("url").pipe(
	Flag.withFallbackConfig(Config.String("NOTARA_URL")),
	Flag.withDefault("http://localhost:3000"),
	Flag.withDescription("Base URL of the Notara server (env: NOTARA_URL)"),
);

const token = Flag.String("token").pipe(
	Flag.withAlias("t"),
	Flag.withFallbackConfig(Config.String("NOTARA_API_KEY")),
	Flag.withDefault(""),
	Flag.withDescription("API key, format ntr_... (env: NOTARA_API_KEY)"),
);

const workspace = Flag.String("workspace").pipe(
	Flag.withAlias("w"),
	Flag.withFallbackConfig(Config.String("NOTARA_WORKSPACE")),
	Flag.withDefault(""),
	Flag.withDescription("Workspace id to operate in (env: NOTARA_WORKSPACE)"),
);

const json = Flag.Boolean("json").pipe(
	Flag.withDefault(false),
	Flag.withDescription("Output raw JSON instead of a table"),
);

const globals = { url, token, workspace, json };

/** Pull the connection config out of a parsed options bag. */
const toCfg = (o: { url: string; token: string; workspace: string }): Cfg => ({
	url: o.url.replace(/\/+$/, ""),
	token: o.token,
	workspace: o.workspace,
});

/** Path prefix for the current workspace, or a clean error if none is set. */
const wsPath = (cfg: Cfg) =>
	requireWorkspace(cfg).pipe(Effect.map((id) => `/api/v1/workspaces/${id}`));

// ── workspaces ──────────────────────────────────────────────────────────────

const workspacesList = Command.make("list", globals, (o) =>
	Effect.gen(function* () {
		const data = yield* request(toCfg(o), "GET", "/api/v1/workspaces");
		yield* print(o.json, data, (ws: Array<Record<string, unknown>>) =>
			table(ws, ["id", "name", "slug", "role"]),
		);
	}),
).pipe(
	Command.withDescription(
		"List workspaces you belong to (works without --workspace)",
	),
);

const workspacesCmd = Command.make("workspaces").pipe(
	Command.withDescription("Inspect workspaces"),
	Command.withSubcommands([workspacesList]),
);

// ── pages ─────────────────────────────────────────────────────────────────────

const pageId = Argument.String("pageId").pipe(
	Argument.withDescription("Page id (ULID)"),
);

const pagesList = Command.make("list", globals, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(cfg, "GET", `${base}/pages`);
		yield* print(o.json, data, (pages: Array<Record<string, unknown>>) =>
			table(pages, ["id", "title", "parentId", "isFavorite", "updatedAt"]),
		);
	}),
).pipe(Command.withDescription("List pages in the workspace"));

const pagesGet = Command.make("get", { ...globals, pageId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(cfg, "GET", `${base}/pages/${o.pageId}`);
		yield* print(o.json, data, kv);
	}),
).pipe(Command.withDescription("Get a single page by id"));

const pagesCreate = Command.make(
	"create",
	{
		...globals,
		title: Flag.String("title").pipe(Flag.withDescription("Page title")),
		parent: Flag.String("parent").pipe(
			Flag.optional,
			Flag.withDescription("Parent page id (omit for a top-level page)"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const body: Record<string, unknown> = { title: o.title };
			if (o.parent._tag === "Some") body.parentId = o.parent.value;
			const data = yield* request(cfg, "POST", `${base}/pages`, { body });
			yield* print(
				o.json,
				data,
				(p: { id: string; title: string }) =>
					`Created page ${p.id} — ${p.title}`,
			);
		}),
).pipe(Command.withDescription("Create a page"));

const pagesUpdate = Command.make(
	"update",
	{
		...globals,
		pageId,
		title: Flag.String("title").pipe(
			Flag.optional,
			Flag.withDescription("New title"),
		),
		icon: Flag.String("icon").pipe(
			Flag.optional,
			Flag.withDescription("New icon (emoji)"),
		),
		favorite: Flag.Boolean("favorite").pipe(
			Flag.withDefault(false),
			Flag.withDescription("Mark the page as favorite"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const body: Record<string, unknown> = {};
			if (o.title._tag === "Some") body.title = o.title.value;
			if (o.icon._tag === "Some") body.icon = o.icon.value;
			if (o.favorite) body.isFavorite = true;
			if (Object.keys(body).length === 0) {
				return yield* new NotaraError({
					message:
						"Nothing to update. Pass --title, --icon, and/or --favorite.",
				});
			}
			const data = yield* request(cfg, "PATCH", `${base}/pages/${o.pageId}`, {
				body,
			});
			yield* print(o.json, data, (p: { id: string }) => `Updated page ${p.id}`);
		}),
).pipe(
	Command.withDescription("Update a page's title, icon, or favorite flag"),
);

const permanent = Flag.Boolean("permanent").pipe(
	Flag.withDefault(false),
	Flag.withDescription(
		"Permanently delete instead of moving to trash (irreversible)",
	),
);

const pagesDelete = Command.make(
	"delete",
	{ ...globals, pageId, permanent },
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const path = `${base}/pages/${o.pageId}${o.permanent ? "?permanent=true" : ""}`;
			yield* request(cfg, "DELETE", path);
			const verb = o.permanent ? "Permanently deleted" : "Trashed";
			yield* Console.log(
				o.json
					? JSON.stringify({ deleted: o.pageId, permanent: o.permanent })
					: `${verb} page ${o.pageId}`,
			);
		}),
).pipe(
	Command.withDescription(
		"Delete a page (trash by default; --permanent to purge)",
	),
);

const pagesRestore = Command.make("restore", { ...globals, pageId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(
			cfg,
			"POST",
			`${base}/pages/${o.pageId}/restore`,
		);
		yield* print(o.json, data, (r: { restored: boolean }) =>
			r.restored
				? `Restored page ${o.pageId}`
				: `Page ${o.pageId} was not in trash`,
		);
	}),
).pipe(Command.withDescription("Restore a trashed page"));

const pagesCmd = Command.make("pages").pipe(
	Command.withDescription("Manage pages"),
	Command.withSubcommands([
		pagesList,
		pagesGet,
		pagesCreate,
		pagesUpdate,
		pagesDelete,
		pagesRestore,
	]),
);

// ── blocks ──────────────────────────────────────────────────────────────────

const blockId = Argument.String("blockId").pipe(
	Argument.withDescription("Block id (ULID)"),
);

const blocksList = Command.make("list", { ...globals, pageId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(cfg, "GET", `${base}/pages/${o.pageId}/blocks`);
		yield* print(o.json, data, (blocks: Array<Record<string, unknown>>) =>
			table(blocks, ["index", "id", "type", "content"]),
		);
	}),
).pipe(Command.withDescription("List the blocks of a page (ordered)"));

const blocksCreate = Command.make(
	"create",
	{
		...globals,
		pageId,
		type: Flag.String("type").pipe(
			Flag.withDefault("paragraph"),
			Flag.withDescription(
				"Block type: paragraph, heading1-3, bulletList, numberedList, todo, code, " +
					"blockquote, divider, callout, toggle, image, pdf, pageLink, database",
			),
		),
		content: Flag.String("content").pipe(
			Flag.withDefault(""),
			Flag.withDescription(
				"Block content. Text blocks use HTML, e.g. '<p>Hello</p>'. " +
					"image/pdf use JSON {src,fileName}; pageLink/database use the target id.",
			),
		),
		index: Flag.Int("index").pipe(
			Flag.withDefault(0),
			Flag.withDescription("0-based position within the page"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"POST",
				`${base}/pages/${o.pageId}/blocks`,
				{
					body: { type: o.type, content: o.content, index: o.index },
				},
			);
			yield* print(
				o.json,
				data,
				(b: { id: string; type: string }) =>
					`Created block ${b.id} (${b.type})`,
			);
		}),
).pipe(Command.withDescription("Append or insert a block on a page"));

const blocksUpdate = Command.make(
	"update",
	{
		...globals,
		blockId,
		content: Flag.String("content").pipe(
			Flag.withDescription("New block content"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(cfg, "PATCH", `${base}/blocks/${o.blockId}`, {
				body: { content: o.content },
			});
			yield* print(
				o.json,
				data,
				(b: { id: string }) => `Updated block ${b.id}`,
			);
		}),
).pipe(Command.withDescription("Replace a block's content"));

const blocksDelete = Command.make("delete", { ...globals, blockId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		yield* request(cfg, "DELETE", `${base}/blocks/${o.blockId}`);
		yield* Console.log(
			o.json
				? JSON.stringify({ deleted: o.blockId })
				: `Deleted block ${o.blockId}`,
		);
	}),
).pipe(Command.withDescription("Delete a block"));

const blocksCmd = Command.make("blocks").pipe(
	Command.withDescription("Manage the blocks within a page"),
	Command.withSubcommands([
		blocksList,
		blocksCreate,
		blocksUpdate,
		blocksDelete,
	]),
);

// ── databases ─────────────────────────────────────────────────────────────────

const databasesList = Command.make("list", globals, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(cfg, "GET", `${base}/databases`);
		yield* print(o.json, data, (dbs: Array<Record<string, unknown>>) =>
			table(dbs, ["id", "name", "pageId"]),
		);
	}),
).pipe(Command.withDescription("List databases in the workspace"));

const dbId = Argument.String("dbId").pipe(
	Argument.withDescription("Database id"),
);
const fieldId = Argument.String("fieldId").pipe(
	Argument.withDescription("Field id"),
);
const recordId = Argument.String("recordId").pipe(
	Argument.withDescription("Record id"),
);

const databasesRecords = Command.make("records", { ...globals, dbId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(
			cfg,
			"GET",
			`${base}/databases/${o.dbId}/records`,
		);
		yield* print(o.json, data, (recs: Array<Record<string, unknown>>) =>
			table(recs, ["id", "title", "fields"]),
		);
	}),
).pipe(
	Command.withDescription("List a database's records with their field values"),
);

const databasesCreate = Command.make(
	"create",
	{
		...globals,
		page: Flag.String("page").pipe(
			Flag.withDescription("Page id to create the database on"),
		),
		name: Flag.String("name").pipe(Flag.withDescription("Database name")),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(cfg, "POST", `${base}/databases`, {
				body: { pageId: o.page, name: o.name },
			});
			yield* print(
				o.json,
				data,
				(d: { id: string; name: string }) =>
					`Created database ${d.id} — ${d.name}`,
			);
		}),
).pipe(Command.withDescription("Create a database on a page"));

const databasesUpdate = Command.make(
	"update",
	{
		...globals,
		dbId,
		name: Flag.String("name").pipe(
			Flag.optional,
			Flag.withDescription("New database name"),
		),
		titleLabel: Flag.String("title-label").pipe(
			Flag.optional,
			Flag.withDescription("Label for the built-in title column"),
		),
		titleHidden: Flag.Boolean("title-hidden").pipe(
			Flag.optional,
			Flag.withDescription(
				"Hide (--title-hidden) or show (--no-title-hidden) the title column",
			),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const body: Record<string, unknown> = {};
			if (o.name._tag === "Some") body.name = o.name.value;
			if (o.titleLabel._tag === "Some") body.titleLabel = o.titleLabel.value;
			if (o.titleHidden._tag === "Some") body.titleHidden = o.titleHidden.value;
			if (Object.keys(body).length === 0) {
				return yield* new NotaraError({
					message:
						"Nothing to update. Pass --name, --title-label, and/or --title-hidden.",
				});
			}
			const data = yield* request(cfg, "PATCH", `${base}/databases/${o.dbId}`, {
				body,
			});
			yield* print(
				o.json,
				data,
				(d: { id: string; name: string }) =>
					`Updated database ${d.id} — ${d.name}`,
			);
		}),
).pipe(
	Command.withDescription(
		"Update a database's name, title-column label, or title visibility",
	),
);

const databasesDelete = Command.make(
	"delete",
	{ ...globals, dbId, permanent },
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const path = `${base}/databases/${o.dbId}${o.permanent ? "?permanent=true" : ""}`;
			yield* request(cfg, "DELETE", path);
			const verb = o.permanent ? "Permanently deleted" : "Trashed";
			yield* Console.log(
				o.json
					? JSON.stringify({ deleted: o.dbId, permanent: o.permanent })
					: `${verb} database ${o.dbId}`,
			);
		}),
).pipe(
	Command.withDescription(
		"Delete a database (trash by default; --permanent to purge)",
	),
);

const databasesRestore = Command.make("restore", { ...globals, dbId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(
			cfg,
			"POST",
			`${base}/databases/${o.dbId}/restore`,
		);
		yield* print(o.json, data, (r: { restored: boolean }) =>
			r.restored
				? `Restored database ${o.dbId}`
				: `Database ${o.dbId} was not in trash`,
		);
	}),
).pipe(Command.withDescription("Restore a trashed database"));

const databasesFields = Command.make("fields", { ...globals, dbId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(
			cfg,
			"GET",
			`${base}/databases/${o.dbId}/fields`,
		);
		yield* print(o.json, data, (fields: Array<Record<string, unknown>>) =>
			table(fields, ["sortOrder", "id", "name", "type", "options"]),
		);
	}),
).pipe(Command.withDescription("List a database's fields (columns)"));

const fieldTypeDesc =
	"Field type: text, number, select, multiSelect, date, checkbox, relation, page, formula";

const databasesAddField = Command.make(
	"add-field",
	{
		...globals,
		dbId,
		name: Flag.String("name").pipe(Flag.withDescription("Field name")),
		type: Flag.String("type").pipe(
			Flag.withDefault("text"),
			Flag.withDescription(fieldTypeDesc),
		),
		options: Flag.String("options").pipe(
			Flag.optional,
			Flag.withDescription(
				"Comma-separated choices for select/multiSelect, e.g. 'Low,High'",
			),
		),
		relation: Flag.String("relation").pipe(
			Flag.optional,
			Flag.withDescription("Target database id for a relation field"),
		),
		formula: Flag.String("formula").pipe(
			Flag.optional,
			Flag.withDescription("Expression for a formula field"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const body: Record<string, unknown> = { name: o.name, type: o.type };
			if (o.options._tag === "Some") {
				body.options = o.options.value
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean);
			}
			if (o.relation._tag === "Some")
				body.relationTargetDbId = o.relation.value;
			if (o.formula._tag === "Some") body.formula = o.formula.value;
			const data = yield* request(
				cfg,
				"POST",
				`${base}/databases/${o.dbId}/fields`,
				{ body },
			);
			yield* print(
				o.json,
				data,
				(f: { id: string; name: string; type: string }) =>
					`Created field ${f.id} — ${f.name} (${f.type})`,
			);
		}),
).pipe(Command.withDescription("Add a field (column) to a database"));

const databasesUpdateField = Command.make(
	"update-field",
	{
		...globals,
		dbId,
		fieldId,
		name: Flag.String("name").pipe(
			Flag.optional,
			Flag.withDescription("New field name"),
		),
		type: Flag.String("type").pipe(
			Flag.optional,
			Flag.withDescription(fieldTypeDesc),
		),
		options: Flag.String("options").pipe(
			Flag.optional,
			Flag.withDescription("Comma-separated choices (replaces existing)"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const body: Record<string, unknown> = {};
			if (o.name._tag === "Some") body.name = o.name.value;
			if (o.type._tag === "Some") body.type = o.type.value;
			if (o.options._tag === "Some") {
				body.options = o.options.value
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean);
			}
			if (Object.keys(body).length === 0) {
				return yield* new NotaraError({
					message: "Nothing to update. Pass --name, --type, and/or --options.",
				});
			}
			const data = yield* request(
				cfg,
				"PATCH",
				`${base}/databases/${o.dbId}/fields/${o.fieldId}`,
				{ body },
			);
			yield* print(
				o.json,
				data,
				(f: { id: string }) => `Updated field ${f.id}`,
			);
		}),
).pipe(Command.withDescription("Update a field's name, type, or options"));

const databasesDeleteField = Command.make(
	"delete-field",
	{ ...globals, dbId, fieldId },
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			yield* request(
				cfg,
				"DELETE",
				`${base}/databases/${o.dbId}/fields/${o.fieldId}`,
			);
			yield* Console.log(
				o.json
					? JSON.stringify({ deleted: o.fieldId })
					: `Deleted field ${o.fieldId}`,
			);
		}),
).pipe(Command.withDescription("Delete a field from a database"));

const databasesAddRecord = Command.make(
	"add-record",
	{
		...globals,
		dbId,
		title: Flag.String("title").pipe(Flag.withDescription("Record title")),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"POST",
				`${base}/databases/${o.dbId}/records`,
				{
					body: { title: o.title },
				},
			);
			yield* print(
				o.json,
				data,
				(r: { id: string; title: string }) =>
					`Created record ${r.id} — ${r.title}`,
			);
		}),
).pipe(Command.withDescription("Add a record (row) to a database"));

const databasesUpdateRecord = Command.make(
	"update-record",
	{
		...globals,
		dbId,
		recordId,
		title: Flag.String("title").pipe(
			Flag.optional,
			Flag.withDescription("New title"),
		),
		description: Flag.String("description").pipe(
			Flag.optional,
			Flag.withDescription("New description"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const body: Record<string, unknown> = {};
			if (o.title._tag === "Some") body.title = o.title.value;
			if (o.description._tag === "Some") body.description = o.description.value;
			if (Object.keys(body).length === 0) {
				return yield* new NotaraError({
					message: "Nothing to update. Pass --title and/or --description.",
				});
			}
			const data = yield* request(
				cfg,
				"PATCH",
				`${base}/databases/${o.dbId}/records/${o.recordId}`,
				{ body },
			);
			yield* print(o.json, data, () => `Updated record ${o.recordId}`);
		}),
).pipe(Command.withDescription("Update a record's title or description"));

const databasesDeleteRecord = Command.make(
	"delete-record",
	{ ...globals, dbId, recordId, permanent },
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const path = `${base}/databases/${o.dbId}/records/${o.recordId}${o.permanent ? "?permanent=true" : ""}`;
			yield* request(cfg, "DELETE", path);
			const verb = o.permanent ? "Permanently deleted" : "Trashed";
			yield* Console.log(
				o.json
					? JSON.stringify({ deleted: o.recordId, permanent: o.permanent })
					: `${verb} record ${o.recordId}`,
			);
		}),
).pipe(
	Command.withDescription(
		"Delete a record (trash by default; --permanent to purge)",
	),
);

const databasesRestoreRecord = Command.make(
	"restore-record",
	{ ...globals, dbId, recordId },
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"POST",
				`${base}/databases/${o.dbId}/records/${o.recordId}/restore`,
			);
			yield* print(o.json, data, (r: { restored: boolean }) =>
				r.restored
					? `Restored record ${o.recordId}`
					: `Record ${o.recordId} was not in trash`,
			);
		}),
).pipe(Command.withDescription("Restore a trashed record"));

const databasesSet = Command.make(
	"set",
	{
		...globals,
		dbId,
		recordId,
		fieldId,
		value: Flag.String("value").pipe(
			Flag.withDescription(
				"Cell value (stored as text). number: '42'; checkbox: 'true'/'false'; " +
					'multiSelect: JSON array like \'["a","b"]\'',
			),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"PUT",
				`${base}/databases/${o.dbId}/records/${o.recordId}/fields/${o.fieldId}`,
				{ body: { value: o.value } },
			);
			yield* print(
				o.json,
				data,
				() => `Set field ${o.fieldId} on record ${o.recordId}`,
			);
		}),
).pipe(Command.withDescription("Set a single cell value on a record"));

const databasesCmd = Command.make("databases").pipe(
	Command.withDescription("Create and edit databases, fields, and records"),
	Command.withSubcommands([
		databasesList,
		databasesCreate,
		databasesUpdate,
		databasesDelete,
		databasesRestore,
		databasesFields,
		databasesAddField,
		databasesUpdateField,
		databasesDeleteField,
		databasesRecords,
		databasesAddRecord,
		databasesUpdateRecord,
		databasesDeleteRecord,
		databasesRestoreRecord,
		databasesSet,
	]),
);

// ── trash ─────────────────────────────────────────────────────────────────────

const trashList = Command.make("list", globals, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(cfg, "GET", `${base}/trash`);
		yield* print(
			o.json,
			data,
			(t: {
				pages: Array<Record<string, unknown>>;
				databases: Array<Record<string, unknown>>;
				records: Array<Record<string, unknown>>;
			}) =>
				[
					"Pages:",
					table(t.pages, ["id", "title", "deletedAt"]),
					"\nDatabases:",
					table(t.databases, ["id", "name", "deletedAt"]),
					"\nRecords:",
					table(t.records, ["id", "databaseId", "title", "deletedAt"]),
				].join("\n"),
		);
	}),
).pipe(Command.withDescription("List trashed pages, databases, and records"));

const trashCmd = Command.make("trash").pipe(
	Command.withDescription(
		"Inspect the workspace trash (restore via pages/databases restore)",
	),
	Command.withSubcommands([trashList]),
);

// ── search ──────────────────────────────────────────────────────────────────

const searchCmd = Command.make(
	"search",
	{
		...globals,
		query: Argument.String("query").pipe(
			Argument.withDescription("Search text"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(cfg, "GET", `${base}/search`, {
				query: { q: o.query },
			});
			yield* print(o.json, data, (hits: Array<Record<string, unknown>>) =>
				table(hits, ["type", "id", "title", "content"]),
			);
		}),
).pipe(Command.withDescription("Full-text search across pages and blocks"));

// ── config ──────────────────────────────────────────────────────────────────

const configCmd = Command.make("config", globals, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		yield* Console.log(
			JSON.stringify(
				{
					url: cfg.url,
					workspace: cfg.workspace || null,
					tokenSet: cfg.token ? `${cfg.token.slice(0, 7)}…` : null,
				},
				null,
				2,
			),
		);
	}),
).pipe(Command.withDescription("Show the resolved connection settings"));

// ── root ──────────────────────────────────────────────────────────────────────

const root = Command.make("notara").pipe(
	Command.withDescription(
		"Command-line client for Notara. Authenticate with an API key (NOTARA_API_KEY) " +
			"and select a workspace (NOTARA_WORKSPACE). Add --json to any command for machine-readable output.",
	),
	Command.withSubcommands([
		workspacesCmd,
		pagesCmd,
		blocksCmd,
		databasesCmd,
		trashCmd,
		searchCmd,
		configCmd,
	]),
);

const cli = Command.runWith(root, { version: "0.1.0" });

cli(process.argv.slice(2)).pipe(
	Effect.catchTag("NotaraError", (e: NotaraError) =>
		Console.error(`✖ ${e.message}`).pipe(
			Effect.andThen(
				Effect.sync(() => {
					process.exitCode = 1;
				}),
			),
		),
	),
	Effect.provide([NodeHttpClient.layerNodeHttp, NodeServices.layer]),
	NodeRuntime.runMain,
);
