import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fieldTypeSpec, NotFoundError } from "@notara/shared";
import { Effect } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { ulid } from "ulidx";
import { PAGE_COLS, pageFromRow } from "../mappers.js";
import type { PageDef, TemplateDef } from "../templates/_kit.js";

/**
 * Built-in templates are data: one file per template in `src/templates/`,
 * `export default { id, title, icon, description, blocks, children? } satisfies TemplateDef`
 * (shape and block helpers in `templates/_kit.ts`). To add a template, add a file
 * named `NN-<id>.ts` there — no edit here. The filename prefix sets the catalogue order.
 */
const dir = new URL("../templates/", import.meta.url);
export const TEMPLATES: TemplateDef[] = await Promise.all(
	readdirSync(fileURLToPath(dir))
		.filter((f) => /^\d.*(?<!\.d)\.[jt]s$/.test(f))
		.sort()
		.map(async (f) => (await import(new URL(f, dir).href)).default),
);

export const getTemplates = () =>
	TEMPLATES.map(({ id, title, icon, description }) => ({
		id,
		title,
		icon,
		description,
	}));

/** Shared, mutable resolution context for a single template build. Lets later
 *  pages/databases reference earlier ones by title/name (relations, page links). */
interface BuildCtx {
	/** Page title → page id, for resolving `page` field links to sub-pages. */
	pageIdByTitle: Map<string, string>;
	/** Database name → { id, record title → record id }, for resolving relations. */
	dbByName: Map<string, { id: string; recordIdByTitle: Map<string, string> }>;
}

/** Recursively create a page, its sub-pages, and its blocks. Sub-pages are
 *  created first so a `childLinks` block can reference them. Returns the page id. */
const buildPage = (
	def: PageDef,
	parentId: string | null,
	sortOrder: number,
	now: string,
	ctx: BuildCtx,
): Effect.Effect<string, SqlError.SqlError, SqlClient.SqlClient> =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const pageId = ulid();

		yield* sql`
      INSERT INTO pages (id, title, parent_id, icon, sort_order, created_at, updated_at)
      VALUES (${pageId}, ${def.title}, ${parentId}, ${def.icon}, ${sortOrder}, ${now}, ${now})
    `;
		ctx.pageIdByTitle.set(def.title, pageId);

		// Children first, so childLinks blocks can point at them.
		const childIds: string[] = [];
		if (def.children) {
			for (let ci = 0; ci < def.children.length; ci++) {
				const cid = yield* buildPage(
					def.children[ci],
					pageId,
					ci + 1,
					now,
					ctx,
				);
				childIds.push(cid);
			}
		}

		let blockIndex = 0;
		let dbOrder = 0;
		for (const blockDef of def.blocks) {
			if (blockDef.kind === "block") {
				yield* sql`
          INSERT INTO blocks (id, page_id, type, content, "index", parent_id)
          VALUES (${ulid()}, ${pageId}, ${blockDef.type}, ${blockDef.content}, ${blockIndex}, NULL)
        `;
				blockIndex++;
				continue;
			}

			if (blockDef.kind === "childLinks") {
				for (const cid of childIds) {
					yield* sql`
            INSERT INTO blocks (id, page_id, type, content, "index", parent_id)
            VALUES (${ulid()}, ${pageId}, 'pageLink', ${cid}, ${blockIndex}, NULL)
          `;
					blockIndex++;
				}
				continue;
			}

			// Database block. No `database`-type block is inserted: the editor
			// renders databases attached to a page (and not pointed at by an inline
			// block) as "orphans" after the block list, which matches the /database
			// slash command and renders correctly. sort_order controls the order in
			// which multiple databases on one page appear.
			const dbId = ulid();
			yield* sql`
        INSERT INTO databases (id, page_id, name, title_label, title_hidden, sort_order)
        VALUES (${dbId}, ${pageId}, ${blockDef.name}, ${blockDef.titleLabel}, 0, ${dbOrder++})
      `;
			const recordIdByTitle = new Map<string, string>();
			ctx.dbByName.set(blockDef.name, { id: dbId, recordIdByTitle });

			const fieldIdMap: Record<string, string> = {};
			for (let fi = 0; fi < blockDef.fields.length; fi++) {
				const field = blockDef.fields[fi];
				const fieldId = ulid();
				fieldIdMap[field.name] = fieldId;
				const options = field.options ? JSON.stringify(field.options) : null;
				// A relation's target may be this same database (self-relation) or one
				// created earlier on the page; both are already registered in dbByName.
				const relationTargetDbId = field.relationTargetName
					? field.relationTargetName === blockDef.name
						? dbId
						: (ctx.dbByName.get(field.relationTargetName)?.id ?? null)
					: null;
				yield* sql`
          INSERT INTO database_fields (id, database_id, name, type, options, relation_target_db_id, formula, sort_order)
          VALUES (${fieldId}, ${dbId}, ${field.name}, ${field.type}, ${options}, ${relationTargetDbId}, NULL, ${fi + 1})
        `;
			}

			for (const view of blockDef.views) {
				const groupByFieldId = view.groupByFieldName
					? (fieldIdMap[view.groupByFieldName] ?? null)
					: null;
				yield* sql`
          INSERT INTO database_views (id, database_id, name, type, group_by_field_id, sort_order)
          VALUES (${ulid()}, ${dbId}, ${view.name}, ${view.type}, ${groupByFieldId}, 'asc')
        `;
			}

			// First pass: create records (+ literal values) and register their ids.
			const recordIds: string[] = [];
			for (let ri = 0; ri < blockDef.records.length; ri++) {
				const rec = blockDef.records[ri];
				const recordId = ulid();
				recordIds.push(recordId);
				recordIdByTitle.set(rec.title, recordId);
				yield* sql`
          INSERT INTO database_records (id, database_id, title, sort_order, created_at)
          VALUES (${recordId}, ${dbId}, ${rec.title}, ${ri + 1}, ${now})
        `;
				if (rec.values) {
					for (const [fieldName, rawValue] of Object.entries(rec.values)) {
						const fieldId = fieldIdMap[fieldName];
						if (!fieldId) continue;
						const field = blockDef.fields.find((f) => f.name === fieldName);
						// How a value is stored for a field type is the registry's to
						// say; this used to special-case multiSelect on its own.
						const value = field
							? fieldTypeSpec(field.type).encode(
									fieldTypeSpec(field.type).encode([]) === "[]"
										? [rawValue]
										: rawValue,
								)
							: rawValue;
						yield* sql`
              INSERT INTO record_field_values (id, record_id, field_id, value)
              VALUES (${ulid()}, ${recordId}, ${fieldId}, ${value})
            `;
					}
				}
			}

			// Second pass: relation + page-link values, now that every record id and
			// sub-page id is known (handles self-relations and cross-database links).
			for (let ri = 0; ri < blockDef.records.length; ri++) {
				const rec = blockDef.records[ri];
				const recordId = recordIds[ri];

				for (const [fieldName, targetTitles] of Object.entries(
					rec.relations ?? {},
				)) {
					const fieldId = fieldIdMap[fieldName];
					const targetName = blockDef.fields.find(
						(f) => f.name === fieldName,
					)?.relationTargetName;
					const targetMap = targetName
						? ctx.dbByName.get(targetName)?.recordIdByTitle
						: undefined;
					if (!fieldId || !targetMap) continue;
					const ids = targetTitles
						.map((t) => targetMap.get(t))
						.filter((x): x is string => !!x);
					if (ids.length === 0) continue;
					yield* sql`
            INSERT INTO record_field_values (id, record_id, field_id, value)
            VALUES (${ulid()}, ${recordId}, ${fieldId}, ${JSON.stringify(ids)})
          `;
				}

				for (const [fieldName, pageTitle] of Object.entries(
					rec.pageLinks ?? {},
				)) {
					const fieldId = fieldIdMap[fieldName];
					const linkedPageId = ctx.pageIdByTitle.get(pageTitle);
					if (!fieldId || !linkedPageId) continue;
					yield* sql`
            INSERT INTO record_field_values (id, record_id, field_id, value)
            VALUES (${ulid()}, ${recordId}, ${fieldId}, ${JSON.stringify([linkedPageId])})
          `;
				}
			}
		}

		return pageId;
	});

export const createPageFromTemplate = (req: {
	templateId: string;
	parentId: string | null;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const template = TEMPLATES.find((t) => t.id === req.templateId);
		if (!template)
			return yield* new NotFoundError({
				resource: "template",
				id: req.templateId,
			});

		const now = new Date().toISOString();
		const siblingMaxOrder = req.parentId
			? yield* sql`
          SELECT COALESCE(MAX(sort_order), 0) as max_order
          FROM pages WHERE parent_id = ${req.parentId} AND is_deleted = 0
        `
			: yield* sql`
          SELECT COALESCE(MAX(sort_order), 0) as max_order
          FROM pages WHERE parent_id IS NULL AND is_deleted = 0
        `;
		const sortOrder = (Number((siblingMaxOrder[0] as any)?.max_order) || 0) + 1;

		const ctx: BuildCtx = { pageIdByTitle: new Map(), dbByName: new Map() };
		const pageId = yield* buildPage(
			template,
			req.parentId,
			sortOrder,
			now,
			ctx,
		);

		const rows = yield* sql.unsafe(
			`SELECT ${PAGE_COLS} FROM pages WHERE id = ?`,
			[pageId],
		);
		return pageFromRow(rows[0]);
	});
