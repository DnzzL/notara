import { Config, Console, Context, Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { type Cfg, NotaraError, request, requireWorkspace } from "./client.js";
import { kv, print, table } from "./output.js";

/**
 * The REST `operationId` a command calls. The server's CLI parity test walks
 * the tree for it, so an operation without a command fails the build.
 */
export const OperationId = Context.Service<string>("notara/cli/OperationId");

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
	Command.annotate(OperationId, "listWorkspaces"),
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
).pipe(
	Command.annotate(OperationId, "listPages"),
	Command.withDescription("List pages in the workspace"),
);

const pagesGet = Command.make("get", { ...globals, pageId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(cfg, "GET", `${base}/pages/${o.pageId}`);
		yield* print(o.json, data, kv);
	}),
).pipe(
	Command.annotate(OperationId, "getPage"),
	Command.withDescription("Get a single page by id"),
);

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
).pipe(
	Command.annotate(OperationId, "createPage"),
	Command.withDescription("Create a page"),
);

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
	Command.annotate(OperationId, "updatePage"),
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
	Command.annotate(OperationId, "deletePage"),
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
).pipe(
	Command.annotate(OperationId, "restorePage"),
	Command.withDescription("Restore a trashed page"),
);

const pagesBacklinks = Command.make("backlinks", { ...globals, pageId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(
			cfg,
			"GET",
			`${base}/pages/${o.pageId}/backlinks`,
		);
		yield* print(o.json, data, (links: Array<Record<string, unknown>>) =>
			table(links, ["pageId", "pageTitle", "blockId", "blockType"]),
		);
	}),
).pipe(
	Command.annotate(OperationId, "getBacklinks"),
	Command.withDescription("List the blocks that link to a page"),
);

const pagesExport = Command.make(
	"export",
	{
		...globals,
		pageId,
		includeDatabases: Flag.Boolean("include-databases").pipe(
			Flag.withDefault(false),
			Flag.withDescription("Append the page's inline databases as CSV"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"GET",
				`${base}/pages/${o.pageId}/export`,
				{
					query: { includeDatabases: String(o.includeDatabases) },
				},
			);
			yield* print(o.json, data, (e: { markdown: string }) => e.markdown);
		}),
).pipe(
	Command.annotate(OperationId, "exportPage"),
	Command.withDescription("Export a page as Markdown"),
);

const pagesMove = Command.make(
	"move",
	{
		...globals,
		pageId,
		parent: Flag.String("parent").pipe(
			Flag.optional,
			Flag.withDescription("New parent page id (omit for the top level)"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"POST",
				`${base}/pages/${o.pageId}/move`,
				{
					body: { parentId: o.parent._tag === "Some" ? o.parent.value : null },
				},
			);
			yield* print(o.json, data, (p: { id: string }) => `Moved page ${p.id}`);
		}),
).pipe(
	Command.annotate(OperationId, "movePage"),
	Command.withDescription("Move a page under another parent (or to the top)"),
);

const pagesReorder = Command.make(
	"reorder",
	{
		...globals,
		parent: Flag.String("parent").pipe(
			Flag.optional,
			Flag.withDescription("Parent page id (omit for the top level)"),
		),
		pageIds: Argument.String("pageIds").pipe(
			Argument.withDescription("Every sibling page id, in the new order"),
			Argument.variadic({ min: 1 }),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(cfg, "POST", `${base}/pages/reorder`, {
				body: {
					parentId: o.parent._tag === "Some" ? o.parent.value : null,
					pageIds: o.pageIds,
				},
			});
			yield* print(o.json, data, () => "Reordered pages");
		}),
).pipe(
	Command.annotate(OperationId, "reorderPages"),
	Command.withDescription("Reorder the child pages of a parent"),
);

const pagesCmd = Command.make("pages").pipe(
	Command.withDescription("Manage pages"),
	Command.withSubcommands([
		pagesList,
		pagesGet,
		pagesCreate,
		pagesUpdate,
		pagesDelete,
		pagesRestore,
		pagesMove,
		pagesReorder,
		pagesBacklinks,
		pagesExport,
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
).pipe(
	Command.annotate(OperationId, "listBlocks"),
	Command.withDescription("List the blocks of a page (ordered)"),
);

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
).pipe(
	Command.annotate(OperationId, "createBlock"),
	Command.withDescription("Append or insert a block on a page"),
);

const blocksUpdate = Command.make(
	"update",
	{
		...globals,
		blockId,
		content: Flag.String("content").pipe(
			Flag.withDescription("New block content"),
		),
		type: Flag.String("type").pipe(
			Flag.optional,
			Flag.withDescription("Turn the block into this type (e.g. heading1)"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(cfg, "PATCH", `${base}/blocks/${o.blockId}`, {
				body: {
					content: o.content,
					...(o.type._tag === "Some" ? { type: o.type.value } : {}),
				},
			});
			yield* print(
				o.json,
				data,
				(b: { id: string }) => `Updated block ${b.id}`,
			);
		}),
).pipe(
	Command.annotate(OperationId, "updateBlock"),
	Command.withDescription("Replace a block's content, and optionally its type"),
);

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
).pipe(
	Command.annotate(OperationId, "deleteBlock"),
	Command.withDescription("Delete a block"),
);

const blocksReorder = Command.make(
	"reorder",
	{
		...globals,
		pageId,
		blockIds: Argument.String("blockIds").pipe(
			Argument.withDescription("Block ids, in the new order"),
			Argument.variadic({ min: 1 }),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"POST",
				`${base}/pages/${o.pageId}/blocks/reorder`,
				{ body: { blockIds: o.blockIds } },
			);
			yield* print(o.json, data, () => `Reordered blocks of ${o.pageId}`);
		}),
).pipe(
	Command.annotate(OperationId, "reorderBlocks"),
	Command.withDescription("Reorder a page's blocks"),
);

const blocksCmd = Command.make("blocks").pipe(
	Command.withDescription("Manage the blocks within a page"),
	Command.withSubcommands([
		blocksList,
		blocksCreate,
		blocksUpdate,
		blocksDelete,
		blocksReorder,
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
).pipe(
	Command.annotate(OperationId, "listDatabases"),
	Command.withDescription("List databases in the workspace"),
);

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
	Command.annotate(OperationId, "listDatabaseRecords"),
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
).pipe(
	Command.annotate(OperationId, "createDatabase"),
	Command.withDescription("Create a database on a page"),
);

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
	Command.annotate(OperationId, "updateDatabase"),
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
	Command.annotate(OperationId, "deleteDatabase"),
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
).pipe(
	Command.annotate(OperationId, "restoreDatabase"),
	Command.withDescription("Restore a trashed database"),
);

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
).pipe(
	Command.annotate(OperationId, "listFields"),
	Command.withDescription("List a database's fields (columns)"),
);

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
).pipe(
	Command.annotate(OperationId, "createField"),
	Command.withDescription("Add a field (column) to a database"),
);

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
).pipe(
	Command.annotate(OperationId, "updateField"),
	Command.withDescription("Update a field's name, type, or options"),
);

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
).pipe(
	Command.annotate(OperationId, "deleteField"),
	Command.withDescription("Delete a field from a database"),
);

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
).pipe(
	Command.annotate(OperationId, "createRecord"),
	Command.withDescription("Add a record (row) to a database"),
);

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
).pipe(
	Command.annotate(OperationId, "updateRecord"),
	Command.withDescription("Update a record's title or description"),
);

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
	Command.annotate(OperationId, "deleteRecord"),
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
).pipe(
	Command.annotate(OperationId, "restoreRecord"),
	Command.withDescription("Restore a trashed record"),
);

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
).pipe(
	Command.annotate(OperationId, "setCell"),
	Command.withDescription("Set a single cell value on a record"),
);

const viewId = Argument.String("viewId").pipe(
	Argument.withDescription("View id"),
);

const databasesGet = Command.make("get", { ...globals, dbId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(cfg, "GET", `${base}/databases/${o.dbId}`);
		yield* print(
			o.json,
			data,
			(d: { id: string; name: string; pageId: string }) =>
				`${d.id} — ${d.name} (page ${d.pageId})`,
		);
	}),
).pipe(
	Command.annotate(OperationId, "getDatabase"),
	Command.withDescription("Show one database"),
);

const databasesExport = Command.make("export", { ...globals, dbId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(
			cfg,
			"GET",
			`${base}/databases/${o.dbId}/export`,
		);
		yield* print(o.json, data, (e: { csv: string }) => e.csv);
	}),
).pipe(
	Command.annotate(OperationId, "exportDatabase"),
	Command.withDescription("Export a database as CSV"),
);

const databasesRecord = Command.make(
	"record",
	{ ...globals, dbId, recordId },
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"GET",
				`${base}/databases/${o.dbId}/records/${o.recordId}`,
			);
			yield* print(
				o.json,
				data,
				(r: { id: string; title: string; fields: unknown }) =>
					`${r.id} — ${r.title}\n${JSON.stringify(r.fields)}`,
			);
		}),
).pipe(
	Command.annotate(OperationId, "getRecordWithValues"),
	Command.withDescription("Show one record with its field values"),
);

const databasesOpenRecord = Command.make(
	"open-record",
	{ ...globals, dbId, recordId },
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"POST",
				`${base}/databases/${o.dbId}/records/${o.recordId}/page`,
			);
			yield* print(
				o.json,
				data,
				(p: { pageId: string }) => `Record page ${p.pageId}`,
			);
		}),
).pipe(
	Command.annotate(OperationId, "openRecordAsPage"),
	Command.withDescription("Open a record as a page (created on first call)"),
);

const databasesViews = Command.make("views", { ...globals, dbId }, (o) =>
	Effect.gen(function* () {
		const cfg = toCfg(o);
		const base = yield* wsPath(cfg);
		const data = yield* request(
			cfg,
			"GET",
			`${base}/databases/${o.dbId}/views`,
		);
		yield* print(o.json, data, (views: Array<Record<string, unknown>>) =>
			table(views, ["id", "name", "type", "isDefault"]),
		);
	}),
).pipe(
	Command.annotate(OperationId, "listViews"),
	Command.withDescription("List a database's views"),
);

const viewTypeDesc = "View type: table, board, calendar";

const databasesAddView = Command.make(
	"add-view",
	{
		...globals,
		dbId,
		name: Flag.String("name").pipe(Flag.withDescription("View name")),
		type: Flag.String("type").pipe(Flag.withDescription(viewTypeDesc)),
		groupBy: Flag.String("group-by").pipe(
			Flag.optional,
			Flag.withDescription("Field id to group by (board)"),
		),
		config: Flag.String("config").pipe(
			Flag.optional,
			Flag.withDescription("View settings as a JSON string"),
		),
		isDefault: Flag.Boolean("default").pipe(
			Flag.withDefault(false),
			Flag.withDescription("Make this the database's default view"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const body: Record<string, unknown> = {
				name: o.name,
				type: o.type,
				isDefault: o.isDefault,
			};
			if (o.groupBy._tag === "Some") body.groupByFieldId = o.groupBy.value;
			if (o.config._tag === "Some") body.config = o.config.value;
			const data = yield* request(
				cfg,
				"POST",
				`${base}/databases/${o.dbId}/views`,
				{ body },
			);
			yield* print(
				o.json,
				data,
				(v: { id: string; name: string; type: string }) =>
					`Created view ${v.id} — ${v.name} (${v.type})`,
			);
		}),
).pipe(
	Command.annotate(OperationId, "createView"),
	Command.withDescription("Add a view to a database"),
);

const databasesUpdateView = Command.make(
	"update-view",
	{
		...globals,
		dbId,
		viewId,
		name: Flag.String("name").pipe(
			Flag.optional,
			Flag.withDescription("New view name"),
		),
		type: Flag.String("type").pipe(
			Flag.optional,
			Flag.withDescription(viewTypeDesc),
		),
		groupBy: Flag.String("group-by").pipe(
			Flag.optional,
			Flag.withDescription("Field id to group by"),
		),
		config: Flag.String("config").pipe(
			Flag.optional,
			Flag.withDescription("View settings as a JSON string"),
		),
		isDefault: Flag.Boolean("default").pipe(
			Flag.optional,
			Flag.withDescription("Make default (--default) or not (--no-default)"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const body: Record<string, unknown> = {};
			if (o.name._tag === "Some") body.name = o.name.value;
			if (o.type._tag === "Some") body.type = o.type.value;
			if (o.groupBy._tag === "Some") body.groupByFieldId = o.groupBy.value;
			if (o.config._tag === "Some") body.config = o.config.value;
			if (o.isDefault._tag === "Some") body.isDefault = o.isDefault.value;
			if (Object.keys(body).length === 0) {
				return yield* new NotaraError({
					message:
						"Nothing to update. Pass --name, --type, --group-by, --config, and/or --default.",
				});
			}
			const data = yield* request(
				cfg,
				"PATCH",
				`${base}/databases/${o.dbId}/views/${o.viewId}`,
				{ body },
			);
			yield* print(o.json, data, () => `Updated view ${o.viewId}`);
		}),
).pipe(
	Command.annotate(OperationId, "updateView"),
	Command.withDescription("Update a view"),
);

const databasesDeleteView = Command.make(
	"delete-view",
	{ ...globals, dbId, viewId },
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			yield* request(
				cfg,
				"DELETE",
				`${base}/databases/${o.dbId}/views/${o.viewId}`,
			);
			yield* Console.log(
				o.json
					? JSON.stringify({ deleted: o.viewId })
					: `Deleted view ${o.viewId}`,
			);
		}),
).pipe(
	Command.annotate(OperationId, "deleteView"),
	Command.withDescription("Delete a view"),
);

const databasesReorderFields = Command.make(
	"reorder-fields",
	{
		...globals,
		dbId,
		fieldIds: Argument.String("fieldIds").pipe(
			Argument.withDescription("Field ids, in the new order"),
			Argument.variadic({ min: 1 }),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"POST",
				`${base}/databases/${o.dbId}/fields/reorder`,
				{ body: { fieldIds: o.fieldIds } },
			);
			yield* print(o.json, data, () => `Reordered fields of ${o.dbId}`);
		}),
).pipe(
	Command.annotate(OperationId, "reorderFields"),
	Command.withDescription("Reorder a database's fields (columns)"),
);

const databasesReorderRecords = Command.make(
	"reorder-records",
	{
		...globals,
		dbId,
		recordIds: Argument.String("recordIds").pipe(
			Argument.withDescription("Record ids, in the new order"),
			Argument.variadic({ min: 1 }),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(
				cfg,
				"POST",
				`${base}/databases/${o.dbId}/records/reorder`,
				{ body: { recordIds: o.recordIds } },
			);
			yield* print(o.json, data, () => `Reordered records of ${o.dbId}`);
		}),
).pipe(
	Command.annotate(OperationId, "reorderRecords"),
	Command.withDescription("Reorder a database's records (rows)"),
);

const databasesReorder = Command.make(
	"reorder",
	{
		...globals,
		pageId: Flag.String("page").pipe(
			Flag.withDescription("Page hosting the databases"),
		),
		databaseIds: Argument.String("databaseIds").pipe(
			Argument.withDescription("Database ids, in the new order"),
			Argument.variadic({ min: 1 }),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const data = yield* request(cfg, "POST", `${base}/databases/reorder`, {
				body: { pageId: o.pageId, databaseIds: o.databaseIds },
			});
			yield* print(o.json, data, () => `Reordered databases of ${o.pageId}`);
		}),
).pipe(
	Command.annotate(OperationId, "reorderDatabases"),
	Command.withDescription("Reorder the databases hosted on a page"),
);

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
		databasesGet,
		databasesRecord,
		databasesOpenRecord,
		databasesViews,
		databasesAddView,
		databasesUpdateView,
		databasesDeleteView,
		databasesExport,
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
).pipe(
	Command.annotate(OperationId, "listTrash"),
	Command.withDescription("List trashed pages, databases, and records"),
);

const trashCmd = Command.make("trash").pipe(
	Command.withDescription(
		"Inspect the workspace trash (restore via pages/databases restore)",
	),
	Command.withSubcommands([trashList]),
);

// ── templates ─────────────────────────────────────────────────────────────────

const templatesList = Command.make("list", globals, (o) =>
	Effect.gen(function* () {
		const data = yield* request(toCfg(o), "GET", "/api/v1/templates");
		yield* print(o.json, data, (t: Array<Record<string, unknown>>) =>
			table(t, ["id", "title", "description"]),
		);
	}),
).pipe(
	Command.annotate(OperationId, "listTemplates"),
	Command.withDescription(
		"List built-in page templates (no --workspace needed)",
	),
);

const templatesUse = Command.make(
	"use",
	{
		...globals,
		templateId: Argument.String("templateId").pipe(
			Argument.withDescription("Template id, from `templates list`"),
		),
		parent: Flag.String("parent").pipe(
			Flag.optional,
			Flag.withDescription("Parent page id (omit for a top-level page)"),
		),
	},
	(o) =>
		Effect.gen(function* () {
			const cfg = toCfg(o);
			const base = yield* wsPath(cfg);
			const body: Record<string, unknown> = {};
			if (o.parent._tag === "Some") body.parentId = o.parent.value;
			const data = yield* request(
				cfg,
				"POST",
				`${base}/templates/${o.templateId}/pages`,
				{ body },
			);
			yield* print(
				o.json,
				data,
				(p: { id: string; title: string }) =>
					`Created page ${p.id} — ${p.title}`,
			);
		}),
).pipe(
	Command.annotate(OperationId, "createPageFromTemplate"),
	Command.withDescription("Create a page from a template"),
);

const templatesCmd = Command.make("templates").pipe(
	Command.withDescription("Page templates"),
	Command.withSubcommands([templatesList, templatesUse]),
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
).pipe(
	Command.annotate(OperationId, "search"),
	Command.withDescription("Full-text search across pages and blocks"),
);

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

export const root = Command.make("notara").pipe(
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
		templatesCmd,
		searchCmd,
		configCmd,
	]),
);
